import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { payAffiliateCommission } from '../affiliate/affiliate.routes'
import * as gateway from '../../lib/gateway.service'
import crypto from 'crypto'

export async function paymentRoutes(app: FastifyInstance) {

  // ── Gerar PIX (depósito) ─────────────────────────────────────────────────────
  app.post('/pix', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { return reply.status(401).send({ success: false, message: 'Não autenticado.' }) }

    const { id: userId } = request.user as { id: number }

    const schema = z.object({
      amount: z.number().positive(),
      cpf:    z.string().optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Valor inválido.' })

    const { amount } = body.data

    const minDepCfg = await prisma.setting.findUnique({ where: { settingKey: 'min_deposit' } })
    const minDep    = Number(minDepCfg?.settingValue ?? 10)
    if (amount < minDep) {
      return reply.status(400).send({ success: false, message: `Depósito mínimo: R$ ${minDep.toFixed(2)}` })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

    // CPF: salva se fornecido, obrigatório para prosseguir
    let cpf = user.cpf ? user.cpf.replace(/\D/g, '') : ''
    const cpfPost = (body.data.cpf ?? '').replace(/\D/g, '')
    if (cpfPost.length === 11) {
      await prisma.user.update({ where: { id: userId }, data: { cpf: cpfPost } })
      cpf = cpfPost
    }
    if (cpf.length !== 11) {
      return reply.status(400).send({ success: false, message: 'CPF inválido. Informe os 11 dígitos para continuar.' })
    }

    const externalId = 'dep_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex')

    const deposit = await prisma.deposit.create({
      data: { userId, amount, status: 'pending', type: 'deposit', externalId },
    })

    try {
      const resp = await gateway.createDeposit(amount, user.nomeCompleto, user.email, cpf, externalId)
      const qrcode        = resp.qrcode       ?? null
      const transactionId = resp.internal_id  ?? null

      if (!qrcode) throw new Error('QRCode não retornado pela Simplify.')

      await prisma.deposit.update({
        where: { id: deposit.id },
        data:  { qrcode, transactionId },
      })

      return reply.send({ success: true, depositId: deposit.id, transactionId: externalId, qrcode })
    } catch (err: any) {
      await prisma.deposit.delete({ where: { id: deposit.id } })
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── Callback do gateway (webhook) ────────────────────────────────────────────
  app.post('/callback', async (request, reply) => {
    const payload = request.body as Record<string, any>

    // Infere event a partir do status, se não vier explícito
    let event      = payload.event      ?? null
    const extId    = payload.external_id ?? null
    const intId    = payload.internal_id ?? null
    const status   = String(payload.status ?? '').toLowerCase()

    if (!event) {
      if (['approved', 'paid', 'aprovado'].includes(status))                          event = 'deposit.paid'
      else if (['cancelled', 'canceled', 'expired', 'failed', 'refused'].includes(status)) event = 'deposit.cancelled'
      else if (status === 'pending')                                                   event = 'deposit.pending'
    }

    if (!event || !extId) return reply.send({ success: true }) // descarta sem dados suficientes

    // Para eventos de pagamento, exige internal_id para evitar forjadas
    if ((event === 'deposit.paid' || event === 'withdrawal.paid') && !intId) {
      return reply.send({ success: true })
    }

    // INSERT IGNORE via upsert — deduplicação idempotente por (event, externalId)
    await prisma.webhookQueue.upsert({
      where:  { event_externalId: { event, externalId: extId } },
      create: { event, externalId: extId, internalId: intId, status: payload.status, payload },
      update: {},
    })

    return reply.send({ success: true })
  })

  // ── Processar webhook da fila (cron endpoint) ─────────────────────────────────
  app.post('/process-webhooks', async (request, reply) => {
    const cronSecret = request.headers['x-cron-secret']
    if (cronSecret !== process.env.CRON_SECRET) {
      return reply.status(403).send({ success: false })
    }

    // Pega até 20 itens não processados
    const items = await prisma.webhookQueue.findMany({
      where:   { processed: false, attempts: { lt: 3 } },
      orderBy: { receivedAt: 'asc' },
      take:    20,
    })

    if (items.length === 0) {
      // Reconciliação: busca depósitos órfãos (pending há mais de 2 min)
      await reconcile()
      return reply.send({ success: true, processed: 0, reconciled: true })
    }

    // Incrementa attempts atomicamente antes de processar
    await prisma.webhookQueue.updateMany({
      where: { id: { in: items.map(i => i.id) } },
      data:  { attempts: { increment: 1 } },
    })

    let processed = 0
    let errors    = 0

    for (const item of items) {
      try {
        const evt = item.event

        if (evt === 'withdrawal.paid' || evt === 'withdrawal.cancelled') {
          await processWithdrawal(item)
        } else if (evt === 'deposit.pending' || evt === 'withdrawal.pending') {
          // Apenas notificação — nenhuma ação necessária
        } else {
          await processDeposit(item)
        }

        await prisma.webhookQueue.update({
          where: { id: item.id },
          data:  { processed: true, processedAt: new Date(), error: null },
        })
        processed++
      } catch (err: any) {
        await prisma.webhookQueue.update({
          where: { id: item.id },
          data:  { error: String(err.message).substring(0, 1000) },
        })
        errors++
      }
    }

    // Reconciliação após processar fila
    await reconcile()

    return reply.send({ success: true, processed, errors, total: items.length })
  })

  // ── Status do pagamento (com polling Simplify como fallback após 15s) ───────
  app.get('/status/:depositId', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { return reply.status(401).send({ success: false, message: 'Não autenticado.' }) }

    const { id: userId } = request.user as { id: number }
    const { depositId }  = request.params as { depositId: string }

    const deposit = await prisma.deposit.findFirst({
      where: { id: Number(depositId), userId },
    })
    if (!deposit) return reply.status(404).send({ success: false })

    // Polling Simplify: se pending há mais de 15s e temos o transactionId
    if (deposit.status === 'pending' && deposit.transactionId) {
      const ageMs = Date.now() - deposit.createdAt.getTime()
      if (ageMs > 15_000) {
        try {
          const data   = await gateway.getDepositStatus(deposit.transactionId)
          const status = String(data?.status ?? '').toLowerCase()
          let event: string | null = null
          if (['approved', 'paid'].includes(status))                                          event = 'deposit.paid'
          else if (['cancelled', 'canceled', 'expired', 'failed', 'refused'].includes(status)) event = 'deposit.cancelled'

          if (event && deposit.externalId) {
            await prisma.webhookQueue.upsert({
              where:  { event_externalId: { event, externalId: deposit.externalId } },
              create: { event, externalId: deposit.externalId, internalId: deposit.transactionId, status: data?.status ?? '', payload: data ?? {} },
              update: {},
            })
          }
        } catch { /* Simplify indisponível — retorna status local */ }
      }
    }

    // Relê após possível upsert (o cron processará em seguida; retorna o status atual)
    const fresh = await prisma.deposit.findUnique({ where: { id: deposit.id } })
    return reply.send({ success: true, status: fresh?.status ?? deposit.status })
  })

  // ── Extrato de transações (depósitos + saques, últimos 50) ────────────────────
  app.get('/transactions', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { return reply.status(401).send({ success: false, message: 'Não autenticado.' }) }

    const { id: userId } = request.user as { id: number }

    const [deposits, withdrawals] = await Promise.all([
      prisma.deposit.findMany({
        where:   { userId, OR: [{ type: null }, { type: 'deposit' }] },
        orderBy: { createdAt: 'desc' },
        take:    40,
        select:  { id: true, amount: true, status: true, createdAt: true },
      }),
      prisma.withdrawal.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        take:    40,
        select:  { id: true, amount: true, status: true, createdAt: true },
      }),
    ])

    const all = [
      ...deposits.map(d => ({ kind: 'deposit', ...d })),
      ...withdrawals.map(w => ({ kind: 'withdrawal', ...w })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50)

    return reply.send({ success: true, transactions: all })
  })

  // ── Saque demo (influenciador / gerente) ──────────────────────────────────────
  app.post('/withdraw-demo', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { return reply.status(401).send({ success: false, message: 'Não autenticado.' }) }

    const { id: userId } = request.user as { id: number }

    const schema = z.object({ amount: z.number().positive() })
    const body   = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Valor inválido.' })

    const { amount } = body.data

    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { saldoDemo: true, isInfluencer: true, role: true },
    })
    if (!user || (!user.isInfluencer && user.role !== 'manager')) {
      return reply.status(403).send({ success: false, message: 'Acesso negado.' })
    }
    if (Number(user.saldoDemo) < amount) {
      return reply.status(400).send({ success: false, message: 'Saldo demo insuficiente.' })
    }

    await prisma.user.update({
      where: { id: userId },
      data:  { saldoDemo: { decrement: amount } },
    })

    const fresh = await prisma.user.findUnique({ where: { id: userId }, select: { saldoDemo: true } })
    return reply.send({ success: true, message: 'Saque confirmado!', new_saldo: Number(fresh?.saldoDemo ?? 0) })
  })

  // ── Solicitar saque ───────────────────────────────────────────────────────────
  app.post('/withdraw', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { return reply.status(401).send({ success: false, message: 'Não autenticado.' }) }

    const { id: userId } = request.user as { id: number }

    const schema = z.object({
      amount:     z.number().positive(),
      pixKey:     z.string().min(1),
      pixKeyType: z.enum(['CPF', 'EMAIL', 'TELEFONE', 'CHAVE_ALEATORIA']),
      walletType: z.enum(['real', 'revshare', 'manager_saldo']).default('real'),
      cpf_input:  z.string().optional(),
      telefone:   z.string().optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const { amount, pixKeyType, walletType } = body.data
    let { pixKey } = body.data

    const minWithCfg = await prisma.setting.findUnique({ where: { settingKey: 'min_withdrawal' } })
    const minWith    = Number(minWithCfg?.settingValue ?? 20)
    if (amount < minWith) {
      return reply.status(400).send({ success: false, message: `Saque mínimo: R$ ${minWith.toFixed(2)}` })
    }

    // Busca usuário com lock (via transaction)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const nome = (user.nomeCompleto ?? '').trim()
    if (nome.length < 3) {
      return reply.status(400).send({ success: false, message: 'Nome inválido. Atualize seu perfil.' })
    }

    // CPF: sempre obrigatório — permite correção a cada saque
    const cpfPost = (body.data.cpf_input ?? '').replace(/\D/g, '')
    if (cpfPost.length !== 11) {
      return reply.status(400).send({ success: false, message: 'CPF inválido. Informe os 11 dígitos corretamente.' })
    }
    await prisma.user.update({ where: { id: userId }, data: { cpf: cpfPost } })

    // Telefone obrigatório
    const telefone = (body.data.telefone ?? '').replace(/\D/g, '')
    if (telefone.length < 10 || telefone.length > 11) {
      return reply.status(400).send({ success: false, message: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).' })
    }
    await prisma.user.update({ where: { id: userId }, data: { telefone } })

    // Validação de chave PIX por tipo
    switch (pixKeyType) {
      case 'CPF':
        pixKey = pixKey.replace(/\D/g, '')
        if (pixKey.length !== 11) {
          return reply.status(400).send({ success: false, message: 'Chave PIX inválida: CPF deve ter 11 dígitos.' })
        }
        break
      case 'TELEFONE': {
        const digits = pixKey.replace(/\D/g, '')
        const d = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits
        if (d.length < 10 || d.length > 11) {
          return reply.status(400).send({ success: false, message: 'Chave PIX inválida: telefone deve ter 10 ou 11 dígitos com DDD.' })
        }
        pixKey = '+55' + d
        break
      }
      case 'EMAIL':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)) {
          return reply.status(400).send({ success: false, message: 'Chave PIX inválida: e-mail incorreto.' })
        }
        break
      case 'CHAVE_ALEATORIA':
        if (!/^[0-9a-fA-F-]{32,36}$/.test(pixKey.replace(/-/g, '').padEnd(32, '0').slice(0, 36))) {
          const clean = pixKey.replace(/-/g, '')
          if (!/^[0-9a-fA-F]{32}$/.test(clean)) {
            return reply.status(400).send({ success: false, message: 'Chave PIX inválida: chave aleatória deve ser um UUID válido.' })
          }
        }
        break
    }

    // Define carteira e saldo
    const isInfluencer = user.isInfluencer
    let campoSaldo: 'saldo' | 'saldoRevshare'
    let saldoAtual: number

    if (walletType === 'revshare') {
      if (!isInfluencer) {
        return reply.status(400).send({ success: false, message: 'Apenas influenciadores podem sacar da carteira de revshare.' })
      }
      campoSaldo = 'saldoRevshare'
      saldoAtual = Number(user.saldoRevshare)
    } else if (walletType === 'manager_saldo') {
      if (user.role !== 'manager') {
        return reply.status(400).send({ success: false, message: 'Apenas gerentes podem usar esta carteira.' })
      }
      campoSaldo = 'saldo'
      saldoAtual = Number(user.saldo)
    } else {
      campoSaldo = 'saldo'
      saldoAtual = Number(user.saldo)
    }

    if (saldoAtual < amount) {
      return reply.status(400).send({ success: false, message: 'Saldo insuficiente.' })
    }

    // Verificação de rollover (somente carteira real, não revshare/manager)
    if (walletType === 'real' && user.role !== 'manager') {
      const rolloverAtivo = await prisma.rolloverCampaign.findFirst({
        where: { userId, status: 'active' },
      })
      if (rolloverAtivo) {
        const [depAgg, betAgg] = await Promise.all([
          prisma.deposit.aggregate({
            where: { userId, status: 'paid', OR: [{ type: null }, { type: 'deposit' }] },
            _sum:  { amount: true },
          }),
          prisma.gameHistory.aggregate({
            where: { userId },
            _sum:  { betAmount: true },
          }),
        ])
        const multCfg = await prisma.setting.findUnique({ where: { settingKey: 'rollover_multiplier' } })
        const mult     = Number(multCfg?.settingValue ?? 1)
        const rollLeft = Math.max(0, Number(depAgg._sum.amount ?? 0) * mult - Number(betAgg._sum.betAmount ?? 0))
        return reply.status(400).send({
          success: false,
          message: `Você ainda precisa apostar R$ ${rollLeft.toFixed(2).replace('.', ',')} para liberar o saque.`,
        })
      }

      // Usuários de campanha de influenciador são isentos de rollover global
      const isFromCampaign = await prisma.campaignParticipant.count({ where: { userId } }) > 0

      if (!isFromCampaign) {
        const multCfg = await prisma.setting.findUnique({ where: { settingKey: 'rollover_multiplier' } })
        const mult     = Number(multCfg?.settingValue ?? 0)
        if (mult > 0) {
          const [depAgg, betAgg] = await Promise.all([
            prisma.deposit.aggregate({
              where: { userId, status: 'paid', OR: [{ type: null }, { type: 'deposit' }] },
              _sum:  { amount: true },
            }),
            prisma.gameHistory.aggregate({ where: { userId }, _sum: { betAmount: true } }),
          ])
          const remaining = Math.max(0, Number(depAgg._sum.amount ?? 0) * mult - Number(betAgg._sum.betAmount ?? 0))
          if (remaining > 0) {
            return reply.status(400).send({
              success: false,
              message: `Você ainda precisa apostar R$ ${remaining.toFixed(2).replace('.', ',')} para liberar o saque.`,
            })
          }
        }
      }
    }

    // Verificação de taxa de saque
    if (walletType === 'real' && user.role !== 'manager') {
      const taxSettings = await prisma.setting.findMany({
        where: { settingKey: { in: ['active_taxwithdraw', 'value_taxwithdraw'] } },
      })
      const taxMap      = Object.fromEntries(taxSettings.map(s => [s.settingKey, s.settingValue]))
      const isTaxActive = ['true', '1'].includes(taxMap['active_taxwithdraw'] ?? 'false')

      if (isTaxActive && !user.withdrawTaxPaid) {
        const taxValue = Number(taxMap['value_taxwithdraw'] ?? 0)
        if (taxValue > 0) {
          const clickId    = (request.cookies as any)['kwai_clickid'] ?? null
          const externalId = String(Date.now())

          const taxDeposit = await prisma.deposit.create({
            data: { userId, amount: taxValue, status: 'pending', type: 'withdraw_tax', externalId: 'tax_' + externalId, clickId },
          })

          try {
            const resp = await gateway.createDeposit(taxValue, nome, '', cpfPost, 'tax_' + externalId)
            const qrcode        = resp.qrcode      ?? null
            const transactionId = resp.internal_id ?? null
            if (qrcode) {
              await prisma.deposit.update({ where: { id: taxDeposit.id }, data: { qrcode, transactionId } })
            }
            return reply.send({
              success:       false,
              is_tax:        true,
              message:       'Taxa de saque pendente',
              tax_amount:    taxValue,
              qrcode,
              transactionId,
            })
          } catch {
            await prisma.deposit.delete({ where: { id: taxDeposit.id } })
            return reply.status(500).send({ success: false, message: 'Erro ao gerar cobrança de taxa. Tente novamente.' })
          }
        }
      }
    }

    // Debita saldo e cria saque pendente
    const withdrawal = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data:  { [campoSaldo]: { decrement: amount } },
      })
      return tx.withdrawal.create({
        data: {
          userId,
          amount,
          pixKey,
          pixKeyType,
          nome,
          cpf:        cpfPost,
          walletType,
          isSimulated: false,
          status:     'pending',
        },
      })
    })

    // Auto-saque
    let autoProcessed = false
    try {
      const autoSettings = await prisma.setting.findMany({
        where: { settingKey: { in: ['auto_withdraw_enabled', 'auto_withdraw_limit', 'auto_withdraw_roles'] } },
      })
      const autoMap     = Object.fromEntries(autoSettings.map(s => [s.settingKey, s.settingValue]))
      const autoEnabled = ['true', '1'].includes(autoMap['auto_withdraw_enabled'] ?? 'false')
      const autoLimit   = Number(autoMap['auto_withdraw_limit'] ?? 0)
      const autoRoles   = autoMap['auto_withdraw_roles'] ?? 'none'

      const userEligible =
        autoRoles === 'both'        ? (isInfluencer || user.role === 'manager') :
        autoRoles === 'influencer'  ? isInfluencer :
        autoRoles === 'manager'     ? user.role === 'manager' : false

      if (autoEnabled && autoLimit > 0 && amount <= autoLimit && userEligible) {
        const locked = await prisma.withdrawal.updateMany({
          where: { id: withdrawal.id, status: 'pending' },
          data:  { status: 'processing' },
        })

        if (locked.count > 0) {
          const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
          const result    = await gateway.sendWithdraw(
            amount, pixKeyType, pixKey, nome, cpfPost,
            freshUser.email, freshUser.telefone ?? '', withdrawal.id
          )
          const simplifyId = result.internal_id ?? null
          await prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { simplifyId } })
          autoProcessed = true
        }
      }
    } catch {
      // Se auto-saque falhou após marcar como processing, volta para pending
      await prisma.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'processing' },
        data:  { status: 'pending' },
      })
    }

    return reply.send({
      success: true,
      message: autoProcessed
        ? 'Saque enviado automaticamente! O pagamento será creditado em breve.'
        : 'Solicitação de saque enviada! O pagamento será processado após aprovação.',
    })
  })
}

// ── Processar saque (webhook) ─────────────────────────────────────────────────
async function processWithdrawal(item: {
  event: string; externalId: string; internalId: string | null
}) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: Number(item.externalId) },
  })
  if (!withdrawal) throw new Error(`Saque não encontrado: external_id=${item.externalId}`)

  if (['paid', 'refunded', 'dismissed'].includes(withdrawal.status)) return // Idempotente

  if (item.event === 'withdrawal.paid') {
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data:  { status: 'paid', simplifyId: item.internalId },
    })
  } else {
    // withdrawal.cancelled — apenas marca como failed
    // Admin decide manualmente (PATCH /admin/withdrawals/:id) se estorna ou descarta
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data:  { status: 'failed' },
    })
  }
}

// ── Processar depósito (webhook) ──────────────────────────────────────────────
async function processDeposit(item: {
  event: string; externalId: string; internalId: string | null; status: string | null
}) {
  const deposit = await prisma.deposit.findFirst({
    where: { externalId: item.externalId },
  })
  if (!deposit) throw new Error(`Depósito não encontrado: external_id=${item.externalId}`)
  if (deposit.status === 'paid') return // Idempotente

  const status   = String(item.status ?? '').toLowerCase()
  const isPaid   = item.event === 'deposit.paid' || ['approved', 'paid', 'aprovado'].includes(status)
  const isFailed = item.event === 'deposit.cancelled' || ['cancelled', 'canceled', 'expired', 'failed', 'refused'].includes(status)

  if (isPaid) {
    // ── Taxa de saque ────────────────────────────────────────────────────────
    if (deposit.type === 'withdraw_tax') {
      await prisma.$transaction([
        prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'paid', transactionId: item.internalId } }),
        prisma.user.update({ where: { id: deposit.userId }, data: { withdrawTaxPaid: true } }),
      ])
      return
    }

    // ── Depósito normal ──────────────────────────────────────────────────────
    const depositor = await prisma.user.findUniqueOrThrow({ where: { id: deposit.userId } })
    // Gerentes recebem em saldoDemo, usuários comuns em saldo
    const campo = depositor.role === 'manager' ? 'saldoDemo' : 'saldo'

    // Credita saldo + marca como pago em uma transação
    await prisma.$transaction([
      prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'paid', transactionId: item.internalId } }),
      prisma.user.update({ where: { id: deposit.userId }, data: { [campo]: { increment: deposit.amount } } }),
    ])

    // RevShare (fora da transação — falha aqui não reverte o saldo)
    try { await payAffiliateCommission(deposit.id) } catch {}

    // Adicionar à campanha de influenciador (se elegível)
    try { await tryAddToCampaign(deposit.userId) } catch {}

    // Rollover automático (apenas primeiro depósito, e apenas se não entrou em campanha)
    try { await tryCreateRolloverCampaign(deposit.id, deposit.userId, Number(deposit.amount)) } catch {}


  } else if (isFailed) {
    await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'failed' } })
  }
}

// ── Tenta adicionar usuário à campanha do influenciador ───────────────────────
async function tryAddToCampaign(userId: number) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isInfluencer: true, role: true, referredById: true },
  })
  if (!user || user.isInfluencer || user.role === 'manager') return
  if (!user.referredById) return

  // Já está em campanha ativa?
  const jaEmCampanha = await prisma.campaignParticipant.count({
    where: { userId, status: 'active', campaign: { status: 'active' } },
  })
  if (jaEmCampanha > 0) return

  // Já está em rollover ativo?
  const jaEmRollover = await prisma.rolloverCampaign.count({ where: { userId, status: 'active' } })
  if (jaEmRollover > 0) return

  // Busca campanha ativa do influenciador com vagas disponíveis
  const campanha = await prisma.influencerCampaign.findFirst({
    where:   { influencerId: user.referredById, status: 'active' },
    include: { _count: { select: { participants: true } } },
  })
  if (!campanha) return
  if (campanha._count.participants >= campanha.maxVagas) return

  const lossNeeded = Math.floor(Math.random() * 3) + 1

  await prisma.campaignParticipant.create({
    data: {
      campaignId:        campanha.id,
      userId,
      netGain:           0,
      status:            'active',
      phase:             'losing',
      consecutiveLosses: 0,
      lossesNeeded:      lossNeeded,
    },
  })
}

// ── Cria rollover no primeiro depósito ────────────────────────────────────────
async function tryCreateRolloverCampaign(depositId: number, userId: number, amount: number) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isInfluencer: true, role: true },
  })
  if (!user || user.isInfluencer || user.role === 'manager') return

  // Não cria rollover se usuário já está em campanha de influenciador ativa
  const emCampanha = await prisma.campaignParticipant.count({
    where: { userId, status: 'active', campaign: { status: 'active' } },
  })
  if (emCampanha > 0) return

  // Apenas primeiro depósito pago
  const priorPaid = await prisma.deposit.count({
    where: { userId, status: 'paid', id: { not: depositId }, OR: [{ type: null }, { type: 'deposit' }] },
  })
  if (priorPaid > 0) return

  // Não cria se já existe rollover para este usuário
  const existente = await prisma.rolloverCampaign.count({ where: { userId } })
  if (existente > 0) return

  const cfg = await prisma.setting.findMany({
    where: { settingKey: { in: ['rollover_multiplier', 'rollover_losses_min', 'rollover_losses_max'] } },
  })
  const cfgMap      = Object.fromEntries(cfg.map(s => [s.settingKey, Number(s.settingValue ?? 0)]))
  const multiplier  = cfgMap['rollover_multiplier'] ?? 0
  if (multiplier <= 0) return // Rollover desativado

  const lossesMin   = Math.max(1, cfgMap['rollover_losses_min'] ?? 1)
  const lossesMax   = Math.max(lossesMin, cfgMap['rollover_losses_max'] ?? 5)
  const lossesNeeded = Math.floor(Math.random() * (lossesMax - lossesMin + 1)) + lossesMin

  await prisma.rolloverCampaign.create({
    data: {
      userId,
      depositId,
      depositAmount:    amount,
      rolloverRequired: amount * multiplier,
      phase:            'winning', // sempre começa ganhando
      lossesNeeded,
      status:           'active',
    },
  })
}

// ── Reconciliação: consulta gateway para transações órfãs ─────────────────────
async function reconcile() {
  try {
    // Depósitos pending há mais de 2 minutos
    const cutoff = new Date(Date.now() - 2 * 60 * 1000)
    const orphanDeps = await prisma.deposit.findMany({
      where: {
        status:        'pending',
        transactionId: { not: null },
        createdAt:     { lt: cutoff },
        updatedAt:     { gt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        OR:            [{ type: null }, { type: 'deposit' }],
      },
      take: 15,
    })

    for (const dep of orphanDeps) {
      if (!dep.transactionId) continue
      try {
        const data   = await gateway.getDepositStatus(dep.transactionId)
        const status = String(data?.status ?? '').toLowerCase()
        let event: string | null = null
        if (['approved', 'paid'].includes(status))                              event = 'deposit.paid'
        else if (['cancelled', 'canceled', 'expired', 'failed', 'refused'].includes(status)) event = 'deposit.cancelled'
        if (event && dep.externalId) {
          await prisma.webhookQueue.upsert({
            where:  { event_externalId: { event, externalId: dep.externalId } },
            create: { event, externalId: dep.externalId, internalId: dep.transactionId, status: data.status, payload: data },
            update: { processed: false, attempts: 0, error: null, status: data.status, payload: data },
          })
        }
      } catch {}
    }

    // Saques em processing com simplifyId
    const cutoff3m = new Date(Date.now() - 3 * 60 * 1000)
    const orphanW  = await prisma.withdrawal.findMany({
      where: { status: 'processing', simplifyId: { not: null }, createdAt: { lt: cutoff3m } },
      take:  50,
    })

    for (const w of orphanW) {
      if (!w.simplifyId) continue
      try {
        const data   = await gateway.getWithdrawStatus(w.simplifyId)
        const status = String(data?.status ?? '').toLowerCase()
        let event: string | null = null
        if (['approved', 'paid'].includes(status))           event = 'withdrawal.paid'
        else if (['cancelled', 'canceled', 'failed', 'refused'].includes(status)) event = 'withdrawal.cancelled'
        if (event) {
          await prisma.webhookQueue.upsert({
            where:  { event_externalId: { event, externalId: String(w.id) } },
            create: { event, externalId: String(w.id), internalId: w.simplifyId, status: data.status, payload: data },
            update: { processed: false, attempts: 0, error: null, status: data.status, payload: data },
          })
        }
      } catch {}
    }
  } catch {}
}

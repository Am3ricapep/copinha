import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export async function affiliateRoutes(app: FastifyInstance) {

  app.addHook('onRequest', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { return reply.status(401).send({ success: false, message: 'Não autenticado.' }) }
  })

  // ── Dados do afiliado logado ─────────────────────────────────────────────────
  app.get('/data', async (request, reply) => {
    const { id: userId } = request.user as { id: number }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        affiliateCode:    true,
        comissao:         true,
        commissionType:   true,
        cpaValue:         true,
        saldoRevshare:    true,
        isInfluencer:     true,
        role:             true,
        managerId:        true,
      },
    })
    if (!user) return reply.status(404).send({ success: false })

    const isManager    = user.role === 'manager'
    const isInfluencer = user.isInfluencer

    if (!isInfluencer && !isManager) {
      return reply.status(403).send({ success: false, message: 'Acesso negado' })
    }

    const scheme  = process.env.APP_URL ?? 'https://seudominio.com.br'
    const link    = `${scheme}/?ref=${user.affiliateCode}`

    // Gerente puro (sem flag influenciador): retorna apenas o link
    if (isManager && !isInfluencer) {
      return reply.send({ success: true, link })
    }

    // ── onlyFirstDeposit: manager_recurring=0 do gerente desta influenciadora ──
    let onlyFirstDeposit = false
    if (user.managerId) {
      const mgr = await prisma.user.findUnique({
        where: { id: user.managerId, role: 'manager' },
        select: { managerRecurring: true },
      })
      if (mgr && !mgr.managerRecurring) onlyFirstDeposit = true
    }

    // ── Referrals ───────────────────────────────────────────────────────────────
    const referrals = await prisma.user.findMany({
      where: { referredById: userId },
      select: { id: true, nomeCompleto: true, createdAt: true },
    })
    const convidados = referrals.length

    // ── Depósitos elegíveis ─────────────────────────────────────────────────────
    // Se onlyFirstDeposit: apenas o primeiro depósito pago de cada indicado
    // Caso contrário: todos os depósitos pagos
    const referralIds = referrals.map(r => r.id)
    let depositsRaw: Array<{
      id: number; userId: number; amount: any; createdAt: Date;
      user: { nomeCompleto: string; telefone: string | null }
    }> = []

    if (referralIds.length > 0) {
      if (onlyFirstDeposit) {
        // Para cada indicado, pega o depósito pago mais antigo
        const firstDepIds = await prisma.$queryRawUnsafe<Array<{ min_id: number }>>(
          `SELECT MIN(id) as min_id FROM deposits
           WHERE user_id IN (${referralIds.join(',')})
             AND status = 'paid'
             AND (type IS NULL OR type = 'deposit')
           GROUP BY user_id`
        )
        if (firstDepIds.length > 0) {
          depositsRaw = await prisma.deposit.findMany({
            where: { id: { in: firstDepIds.map(r => r.min_id) } },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true, userId: true, amount: true, createdAt: true,
              user: { select: { nomeCompleto: true, telefone: true } },
            },
          }) as any
        }
      } else {
        depositsRaw = await prisma.deposit.findMany({
          where: {
            userId:  { in: referralIds },
            status:  'paid',
            OR:      [{ type: null }, { type: 'deposit' }],
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, userId: true, amount: true, createdAt: true,
            user: { select: { nomeCompleto: true, telefone: true } },
          },
        }) as any
      }
    }

    const depositantes    = new Set(depositsRaw.map(d => d.userId)).size
    const commType        = user.commissionType
    const cpaValue        = Number(user.cpaValue)
    const comissaoPct     = user.comissao

    // ganho_estimado: apenas no 1º depósito de cada indicado (lógica original)
    const processedUsers = new Set<number>()
    const depositosCompletos = depositsRaw.reverse().map(d => {
      let ganhoEstimado = 0
      if (!processedUsers.has(d.userId)) {
        ganhoEstimado = commType === 'cpa'
          ? cpaValue
          : Number(d.amount) * (comissaoPct / 100)
        processedUsers.add(d.userId)
      }
      return {
        data:             d.createdAt,
        nome_indicado:    d.user.nomeCompleto,
        telefone_indicado: d.user.telefone,
        valor:            Number(d.amount),
        ganho:            ganhoEstimado,
        indicado_id:      d.userId,
      }
    })

    // Total de ganhos efetivamente pagos (affiliate_logs)
    const totalComissoes = await prisma.affiliateLog.aggregate({
      where: { referrerId: userId, type: 'deposit_commission' },
      _sum: { amount: true },
    })

    return reply.send({
      success:              true,
      link,
      stats: {
        convidados,
        depositantes,
        ganhos: Number(totalComissoes._sum.amount ?? 0),
      },
      comissao_percentual:  comissaoPct,
      commission_type:      commType,
      cpa_value:            cpaValue,
      saldoRevshare:        user.saldoRevshare,
      depositos_completos:  depositosCompletos,
    })
  })
}

// ── Lógica de RevShare (chamada pelo cron de webhooks) ────────────────────────
export async function payAffiliateCommission(depositId: number) {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: {
      user: {
        include: {
          referredBy: { include: { manager: true } },
        },
      },
    },
  })

  if (!deposit || deposit.status !== 'paid') return
  if (!deposit.user.referredById) return

  const referrer      = deposit.user.referredBy!
  const depositAmount = Number(deposit.amount)

  // ── Controle de recorrência (PHP: useFirstOnly = manager_recurring=0 || referrer_recurring=0)
  const isInfluencerPath = referrer.isInfluencer
  const managerRecurring = isInfluencerPath
    ? (referrer.manager?.managerRecurring ?? true)
    : (referrer.managerRecurring ?? true)
  const referrerRecurring = referrer.revshareRecurring

  const useFirstOnly = !managerRecurring || (isInfluencerPath && !referrerRecurring)

  if (useFirstOnly) {
    const priorPaid = await prisma.deposit.count({
      where: {
        userId: deposit.userId,
        status: 'paid',
        id:     { not: depositId },
        OR:     [{ type: null }, { type: 'deposit' }],
      },
    })
    if (priorPaid > 0) return // Apenas primeiro depósito paga comissão
  }

  if (isInfluencerPath) {
    // ── Caso 1: indicado por influenciador ──────────────────────────────────
    const influencerPct = referrer.comissao       // e.g. 50 (%)
    const managerPool   = Number(referrer.manager?.managerPool ?? 0)  // e.g. 70 (%)

    if (influencerPct > 0) {
      const commInfluencer = Math.round(depositAmount * (influencerPct / 100) * 100) / 100
      await prisma.$transaction([
        prisma.user.update({
          where: { id: referrer.id },
          data:  { saldoRevshare: { increment: commInfluencer } },
        }),
        prisma.affiliateLog.create({
          data: {
            referrerId:    referrer.id,
            referredId:    deposit.userId,
            amount:        commInfluencer,
            type:          'deposit_commission',
            depositAmount,
          },
        }),
      ])
    }

    // Manager recebe a diferença (pool - influencerPct) do depósito
    if (referrer.managerId && referrer.manager && managerPool > influencerPct) {
      const commManager = Math.round(depositAmount * ((managerPool - influencerPct) / 100) * 100) / 100
      if (commManager > 0) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: referrer.managerId },
            data:  { saldo: { increment: commManager } },
          }),
          prisma.affiliateLog.create({
            data: {
              referrerId:    referrer.managerId,
              referredId:    deposit.userId,
              amount:        commManager,
              type:          'manager_commission',
              managerId:     referrer.managerId,
              depositAmount,
            },
          }),
        ])
      }
    }

  } else if (referrer.role === 'manager') {
    // ── Caso 2: indicado diretamente pelo gerente ──────────────────────────
    const managerPool = Math.min(Number(referrer.managerPool), 90)
    if (managerPool > 0) {
      const commManager = Math.round(depositAmount * (managerPool / 100) * 100) / 100
      if (commManager > 0) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: referrer.id },
            data:  { saldo: { increment: commManager } },
          }),
          prisma.affiliateLog.create({
            data: {
              referrerId:    referrer.id,
              referredId:    deposit.userId,
              amount:        commManager,
              type:          'manager_commission',
              managerId:     referrer.id,
              depositAmount,
            },
          }),
        ])
      }
    }
  }
}

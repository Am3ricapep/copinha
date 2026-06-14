import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { payAffiliateCommission } from '../affiliate/affiliate.routes'

export async function adminRoutes(app: FastifyInstance) {

  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'admin') {
        return reply.status(403).send({ success: false, message: 'Acesso negado.' })
      }
    } catch {
      return reply.status(401).send({ success: false, message: 'Não autenticado.' })
    }
  })

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  app.get('/dashboard', async (_request, reply) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalUsers,
      cadastrosHoje,
      saldoEmContas,
      totalDepositsAgg,
      totalWithdrawalsAgg,
      ftdHojeQtd,
      ftdAmountHojeAgg,
      pixPendentes,
      pixFalhados,
      totalTaxPaidAgg,
      avgWithdrawAgg,
      avgDepositAgg,
      recentDeposits,
      gateway,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'user' } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.aggregate({ _sum: { saldo: true } }),
      prisma.deposit.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: { in: ['approved', 'paid'] } }, _sum: { amount: true } }),
      prisma.deposit.count({ where: { status: 'paid', createdAt: { gte: today } } }),
      prisma.deposit.aggregate({ where: { status: 'paid', createdAt: { gte: today } }, _sum: { amount: true } }),
      prisma.deposit.count({ where: { status: 'pending' } }),
      prisma.deposit.count({ where: { status: 'failed' } }),
      prisma.withdrawal.aggregate({ where: { status: { in: ['approved', 'paid'] } }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: { in: ['approved', 'paid'] } }, _avg: { amount: true } }),
      prisma.deposit.aggregate({ where: { status: 'paid' }, _avg: { amount: true } }),
      prisma.deposit.findMany({
        where: { status: 'paid' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { email: true } } },
      }),
      prisma.gatewayConfig.findFirst({ where: { isActive: true } }),
    ])

    const totalDep = Number(totalDepositsAgg._sum.amount ?? 0)
    const totalWith = Number(totalWithdrawalsAgg._sum.amount ?? 0)

    return reply.send({
      success: true,
      data: {
        totalUsers,
        cadastrosHoje,
        saldoEmContas:   Number(saldoEmContas._sum.saldo ?? 0),
        totalDeposits:   totalDep,
        totalWithdrawals: totalWith,
        ftdHojeQtd,
        ftdAmountHoje:   Number(ftdAmountHojeAgg._sum.amount ?? 0),
        ftdTotal:        await prisma.user.count({ where: { deposits: { some: { status: 'paid' } } } }),
        pixPendentes,
        pixFalhados,
        netRevenue:      totalDep - totalWith,
        totalTaxPaid:    Number(totalTaxPaidAgg._sum.amount ?? 0),
        avgWithdrawTax:  Number(avgWithdrawAgg._avg.amount ?? 0),
        avgDeposit:      Number(avgDepositAgg._avg.amount ?? 0),
        gatewayAtivo:    gateway?.gatewayName ?? null,
        recentDeposits:  recentDeposits.map(d => ({
          id:        d.id,
          amount:    Number(d.amount),
          status:    d.status,
          createdAt: d.createdAt,
          userEmail: d.user.email,
        })),
      },
    })
  })

  // ── Usuários ──────────────────────────────────────────────────────────────────
  app.get('/users', async (request, reply) => {
    const query = z.object({
      search: z.string().optional(),
      page:   z.coerce.number().default(1),
      limit:  z.coerce.number().default(20),
    }).safeParse(request.query)

    const { search, page, limit } = query.success ? query.data : { search: '', page: 1, limit: 20 }
    const skip = (page - 1) * limit

    const where = search ? {
      OR: [
        { nomeCompleto: { contains: search } },
        { email:        { contains: search } },
        { cpf:          { contains: search } },
      ],
    } : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, nomeCompleto: true, email: true, cpf: true,
          saldo: true, role: true, isInfluencer: true, createdAt: true,
          _count: { select: { deposits: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({ success: true, users, total, page, pages: Math.ceil(total / limit) })
  })

  // ── Detalhes do usuário ───────────────────────────────────────────────────────
  app.get('/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      include: {
        deposits:    { orderBy: { createdAt: 'desc' }, take: 10 },
        withdrawals: { orderBy: { createdAt: 'desc' }, take: 10 },
        gameHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!user) return reply.status(404).send({ success: false })
    return reply.send({ success: true, user })
  })

  // ── Ações de promoção / gestão de usuários ────────────────────────────────────
  app.post('/promote', async (request, reply) => {
    const schema = z.discriminatedUnion('action', [
      z.object({
        action:      z.literal('promote_to_manager'),
        userId:      z.number(),
        managerPool: z.number().min(1).max(90),
      }),
      z.object({
        action:    z.literal('promote_to_influencer'),
        userId:    z.number(),
        comissao:  z.number().min(1).max(100),
        managerId: z.number().optional(),
      }),
      z.object({
        action:    z.literal('link_to_me'),
        userId:    z.number(),
        managerId: z.number(),
      }),
      z.object({
        action: z.literal('remove_influencer'),
        userId: z.number(),
      }),
      z.object({
        action:         z.literal('update_commission'),
        userId:         z.number(),
        comissao:       z.number().min(0).max(100),
        commissionType: z.enum(['rev', 'cpa']).optional(),
        cpaValue:       z.number().min(0).optional(),
      }),
      z.object({
        action:    z.literal('add_demo'),
        userId:    z.number(),
        saldoDemo: z.number().min(0),
      }),
      z.object({
        action:        z.literal('edit_commission_balance'),
        userId:        z.number(),
        saldo:         z.number().optional(),
        saldoRevshare: z.number().optional(),
      }),
      z.object({
        action:      z.literal('update_pool'),
        userId:      z.number(),
        managerPool: z.number().min(1).max(90),
      }),
      z.object({
        action: z.literal('demote_manager'),
        userId: z.number(),
      }),
      z.object({
        action:    z.literal('toggle_recurring'),
        userId:    z.number(),
        recurring: z.boolean(),
      }),
      z.object({
        action:    z.literal('toggle_manager_recurring'),
        userId:    z.number(),
        recurring: z.boolean(),
      }),
      z.object({
        action: z.literal('credit_deposit'),
        userId: z.number(),
        valor:  z.number().positive(),
      }),
      z.object({
        action: z.literal('delete_user'),
        userId: z.number(),
      }),
    ])

    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.', errors: body.error.issues })

    const user = await prisma.user.findFirst({ where: { id: body.data.userId } })
    if (!user) return reply.status(404).send({ success: false, message: 'Usuário não encontrado.' })

    const { action } = body.data

    // ── promote_to_manager ──────────────────────────────────────────────────────
    if (action === 'promote_to_manager') {
      const affiliateCode = user.affiliateCode ?? Math.random().toString(36).substring(2, 15)
      await prisma.user.update({
        where: { id: user.id },
        data:  {
          role:         'manager',
          managerPool:  body.data.managerPool,
          isInfluencer: false,
          managerId:    null,
          affiliateCode,
        },
      })
      return reply.send({ success: true })
    }

    // ── promote_to_influencer ───────────────────────────────────────────────────
    if (action === 'promote_to_influencer') {
      let managerId = body.data.managerId ?? null
      if (!managerId && user.referredById) {
        const referrer = await prisma.user.findUnique({ where: { id: user.referredById } })
        if (referrer?.role === 'manager')     managerId = referrer.id
        else if (referrer?.managerId)          managerId = referrer.managerId
      }

      // Valida que comissao <= managerPool do gerente
      if (managerId) {
        const manager = await prisma.user.findUnique({ where: { id: managerId } })
        if (manager && body.data.comissao > Number(manager.managerPool)) {
          return reply.status(400).send({
            success: false,
            message: `Comissão (${body.data.comissao}%) não pode ser maior que o pool do gerente (${manager.managerPool}%).`,
          })
        }
      }

      const affiliateCode = user.affiliateCode ?? Math.random().toString(36).substring(2, 15)

      // Herda revshare_recurring do gerente
      let revshareRecurring = true
      if (managerId) {
        const manager = await prisma.user.findUnique({ where: { id: managerId } })
        if (manager) revshareRecurring = manager.managerRecurring
      }

      await prisma.user.update({
        where: { id: user.id },
        data:  { isInfluencer: true, comissao: body.data.comissao, managerId, affiliateCode, revshareRecurring },
      })
      return reply.send({ success: true })
    }

    // ── link_to_me (gerente reivindica influenciador sem gerente) ───────────────
    if (action === 'link_to_me') {
      if (!user.isInfluencer) {
        return reply.status(400).send({ success: false, message: 'Usuário não é influenciador.' })
      }
      await prisma.user.update({
        where: { id: user.id },
        data:  { managerId: body.data.managerId },
      })
      return reply.send({ success: true })
    }

    // ── remove_influencer ───────────────────────────────────────────────────────
    if (action === 'remove_influencer') {
      await prisma.user.update({
        where: { id: user.id },
        data:  { isInfluencer: false, comissao: 0, managerId: null },
      })
      return reply.send({ success: true })
    }

    // ── update_commission ───────────────────────────────────────────────────────
    if (action === 'update_commission') {
      if (user.managerId && body.data.comissao > 0) {
        const manager = await prisma.user.findUnique({ where: { id: user.managerId } })
        if (manager && body.data.comissao > Number(manager.managerPool)) {
          return reply.status(400).send({
            success: false,
            message: `Comissão (${body.data.comissao}%) não pode ser maior que o pool do gerente (${manager.managerPool}%).`,
          })
        }
      }
      const updateData: Record<string, any> = { comissao: body.data.comissao }
      if (body.data.commissionType !== undefined) updateData['commissionType'] = body.data.commissionType
      if (body.data.cpaValue       !== undefined) updateData['cpaValue']       = body.data.cpaValue
      await prisma.user.update({ where: { id: user.id }, data: updateData })
      return reply.send({ success: true })
    }

    // ── add_demo (define saldo demo de influenciador/gerente) ───────────────────
    if (action === 'add_demo') {
      await prisma.user.update({
        where: { id: user.id },
        data:  { saldoDemo: body.data.saldoDemo },
      })
      return reply.send({ success: true })
    }

    // ── edit_commission_balance (admin edita saldo/saldoRevshare diretamente) ───
    if (action === 'edit_commission_balance') {
      const updateData: Record<string, number> = {}
      if (body.data.saldo         !== undefined) updateData['saldo']         = body.data.saldo
      if (body.data.saldoRevshare !== undefined) updateData['saldoRevshare'] = body.data.saldoRevshare

      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({ success: false, message: 'Nenhum campo para atualizar.' })
      }
      await prisma.user.update({ where: { id: user.id }, data: updateData })
      return reply.send({ success: true })
    }

    // ── update_pool ─────────────────────────────────────────────────────────────
    if (action === 'update_pool') {
      await prisma.user.update({
        where: { id: user.id },
        data:  { managerPool: body.data.managerPool },
      })
      return reply.send({ success: true })
    }

    // ── demote_manager ──────────────────────────────────────────────────────────
    if (action === 'demote_manager') {
      await prisma.user.update({
        where: { id: user.id },
        data:  { role: 'user', managerPool: 0, isInfluencer: false },
      })
      return reply.send({ success: true })
    }

    // ── toggle_recurring (influenciador) ────────────────────────────────────────
    if (action === 'toggle_recurring') {
      await prisma.user.update({
        where: { id: user.id },
        data:  { revshareRecurring: body.data.recurring },
      })
      return reply.send({ success: true })
    }

    // ── toggle_manager_recurring (gerente + cascade para influenciadores) ────────
    if (action === 'toggle_manager_recurring') {
      const { recurring } = body.data
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data:  { managerRecurring: recurring, revshareRecurring: recurring },
        }),
        // Cascata: atualiza todos os influenciadores deste gerente
        prisma.user.updateMany({
          where: { managerId: user.id, isInfluencer: true },
          data:  { revshareRecurring: recurring },
        }),
      ])
      return reply.send({ success: true })
    }

    // ── credit_deposit (crédito manual com RevShare completo) ───────────────────
    if (action === 'credit_deposit') {
      const { valor } = body.data
      const depositor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
      const campo     = depositor.role === 'manager' ? 'saldoDemo' : 'saldo'

      // Cria o depósito manual marcado como pago
      const externalId = 'manual_' + Date.now()
      const deposit = await prisma.deposit.create({
        data: {
          userId:     user.id,
          amount:     valor,
          status:     'paid',
          type:       'deposit',
          externalId,
        },
      })
      await prisma.user.update({
        where: { id: user.id },
        data:  { [campo]: { increment: valor } },
      })

      // RevShare fora da transação
      try { await payAffiliateCommission(deposit.id) } catch {}

      return reply.send({ success: true, message: 'Crédito aplicado com sucesso!' })
    }

    // ── delete_user ─────────────────────────────────────────────────────────────
    if (action === 'delete_user') {
      if (user.role === 'admin') {
        return reply.status(403).send({ success: false, message: 'Não é possível excluir um admin.' })
      }
      await prisma.user.delete({ where: { id: user.id } })
      return reply.send({ success: true })
    }

    return reply.status(400).send({ success: false, message: 'Ação inválida.' })
  })

  // ── Campanhas ─────────────────────────────────────────────────────────────────
  app.get('/campaigns', async (_request, reply) => {
    const [active, history] = await Promise.all([
      prisma.influencerCampaign.findMany({
        where: { status: 'active' },
        include: {
          influencer:   { select: { nomeCompleto: true, email: true } },
          participants: { include: { user: { select: { nomeCompleto: true, email: true, saldo: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.influencerCampaign.findMany({
        where: { status: { in: ['ended', 'cancelled'] } },
        include: {
          influencer: { select: { nomeCompleto: true } },
          _count: { select: { participants: true } },
        },
        orderBy: { endedAt: 'desc' },
        take: 20,
      }),
    ])
    return reply.send({ success: true, active, history })
  })

  app.post('/campaigns', async (request, reply) => {
    const schema = z.object({
      influencerId: z.number(),
      maxVagas:     z.number().min(1),
      targetGain:   z.number().positive(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const existing = await prisma.influencerCampaign.findFirst({
      where: { influencerId: body.data.influencerId, status: 'active' },
    })
    if (existing) {
      return reply.status(409).send({ success: false, message: 'Este influenciador já tem uma campanha ativa.' })
    }

    const campaign = await prisma.influencerCampaign.create({
      data: { ...body.data, status: 'active', activatedAt: new Date() },
    })
    return reply.send({ success: true, campaign })
  })

  app.delete('/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.$transaction([
      prisma.influencerCampaign.update({
        where: { id: Number(id) },
        data:  { status: 'cancelled', endedAt: new Date() },
      }),
      prisma.campaignParticipant.updateMany({
        where: { campaignId: Number(id), status: 'active' },
        data:  { status: 'expired', finishedAt: new Date() },
      }),
    ])
    return reply.send({ success: true })
  })

  // ── Saques ────────────────────────────────────────────────────────────────────
  app.get('/withdrawals', async (request, reply) => {
    const query = z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'processing', 'paid', 'failed', 'refunded', 'dismissed']).optional(),
      page:   z.coerce.number().default(1),
    }).safeParse(request.query)

    const { status, page } = query.success ? query.data : { status: undefined, page: 1 }
    const limit = 20
    const skip  = (page - 1) * limit
    const where = status ? { status } : {}

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { nomeCompleto: true, email: true, cpf: true } } },
      }),
      prisma.withdrawal.count({ where }),
    ])
    return reply.send({ success: true, withdrawals, total, pages: Math.ceil(total / limit) })
  })

  app.patch('/withdrawals/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const schema = z.object({
      action: z.enum(['approve', 'reject', 'refund', 'dismiss']),
      token:  z.string().optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const { action, token } = body.data

    // ── approve: verifica token, marca processing, chama Simplify ───────────────
    if (action === 'approve') {
      const bcrypt = await import('bcryptjs')
      const cfg = await prisma.setting.findUnique({ where: { settingKey: 'withdraw_approval_token' } })
      if (cfg?.settingValue) {
        const submitted = (token ?? '').trim()
        if (!submitted || !await bcrypt.default.compare(submitted, cfg.settingValue)) {
          return reply.status(403).send({ success: false, message: 'Token de segurança inválido.' })
        }
      }

      const withdrawal = await prisma.withdrawal.findFirst({
        where:   { id: Number(id), status: 'pending' },
        include: { user: { select: { email: true, telefone: true } } },
      })

      if (!withdrawal) {
        const existing = await prisma.withdrawal.findUnique({ where: { id: Number(id) } })
        if (!existing) return reply.status(404).send({ success: false, message: 'Saque não encontrado.' })
        const msgs: Record<string, string> = {
          processing: 'Este saque já foi enviado para a Simplify e está aguardando confirmação.',
          paid:       'Este saque já foi pago.',
        }
        return reply.status(400).send({ success: false, message: msgs[existing.status] ?? `Saque já processado (status: ${existing.status}).` })
      }

      // Trava atômica: só avança se status ainda for 'pending'
      const locked = await prisma.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'pending' },
        data:  { status: 'processing' },
      })
      if (locked.count === 0) {
        return reply.status(409).send({ success: false, message: 'Saque já está sendo processado.' })
      }

      try {
        const gateway = await import('../../lib/gateway.service')
        const result  = await gateway.sendWithdraw(
          Number(withdrawal.amount),
          withdrawal.pixKeyType ?? 'CPF',
          withdrawal.pixKey     ?? '',
          withdrawal.nome       ?? '',
          withdrawal.cpf        ?? '',
          withdrawal.user.email    ?? '',
          withdrawal.user.telefone ?? '',
          withdrawal.id,
        )
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data:  { simplifyId: result.internal_id },
        })
        return reply.send({ success: true, message: 'Saque enviado para a Simplify — aguardando confirmação de pagamento.' })
      } catch (err: any) {
        // Reverte para 'pending' se cURL falhou após marcar como 'processing'
        await prisma.withdrawal.updateMany({
          where: { id: withdrawal.id, status: 'processing' },
          data:  { status: 'pending' },
        })
        return reply.status(500).send({ success: false, message: 'Erro ao enviar para Simplify: ' + (err?.message ?? '') })
      }
    }

    // ── reject / refund / dismiss — operações rápidas ────────────────────────────
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: Number(id) } })
    if (!withdrawal) return reply.status(404).send({ success: false, message: 'Saque não encontrado.' })

    if (action === 'reject' && withdrawal.status === 'pending') {
      const campo = withdrawal.walletType === 'revshare' ? 'saldoRevshare' : 'saldo'
      await prisma.$transaction([
        prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'rejected' } }),
        prisma.user.update({ where: { id: withdrawal.userId }, data: { [campo]: { increment: withdrawal.amount } } }),
      ])
      return reply.send({ success: true, message: 'Saque rejeitado e valor estornado.' })
    }

    if (action === 'refund' && withdrawal.status === 'failed') {
      const campo = withdrawal.walletType === 'revshare' ? 'saldoRevshare' : 'saldo'
      await prisma.$transaction([
        prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'refunded' } }),
        prisma.user.update({ where: { id: withdrawal.userId }, data: { [campo]: { increment: withdrawal.amount } } }),
      ])
      return reply.send({ success: true, message: 'Saldo estornado ao usuário com sucesso.' })
    }

    if (action === 'dismiss' && withdrawal.status === 'failed') {
      await prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'dismissed' } })
      return reply.send({ success: true, message: 'Falha registrada sem estorno de saldo.' })
    }

    return reply.status(400).send({ success: false, message: 'Ação inválida ou saque já processado.' })
  })

  // ── Settings ──────────────────────────────────────────────────────────────────
  app.get('/settings', async (_request, reply) => {
    const settings = await prisma.setting.findMany()
    const map = Object.fromEntries(settings.map((s: { settingKey: string; settingValue: string | null }) => [s.settingKey, s.settingValue]))
    return reply.send({ success: true, data: map, settings: map })
  })

  app.put('/settings', async (request, reply) => {
    const body = request.body as Record<string, string>
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        prisma.setting.upsert({
          where:  { settingKey: key },
          create: { settingKey: key, settingValue: value },
          update: { settingValue: value },
        })
      )
    )
    return reply.send({ success: true })
  })

  // ── Gerentes ──────────────────────────────────────────────────────────────────
  app.get('/managers', async (request, reply) => {
    const query = z.object({
      search: z.string().optional(),
      page:   z.coerce.number().default(1),
    }).safeParse(request.query)

    const { search, page } = query.success ? query.data : { search: '', page: 1 }
    const limit = 10
    const skip  = (page - 1) * limit
    const where = {
      role: 'manager' as const,
      ...(search ? {
        OR: [{ nomeCompleto: { contains: search } }, { email: { contains: search } }],
      } : {}),
    }

    const [managers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, nomeCompleto: true, email: true, saldo: true,
          managerPool: true, managerRecurring: true, createdAt: true,
          _count: { select: { influencers: true } },
        },
      }),
      prisma.user.count({ where }),
    ])
    return reply.send({ success: true, managers, total, pages: Math.ceil(total / limit) })
  })

  // ── Buscar usuários (para promoção) ───────────────────────────────────────────
  app.get('/search-users', async (request, reply) => {
    const { q } = request.query as { q?: string }
    if (!q || q.length < 2) return reply.send({ users: [] })

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { nomeCompleto: { contains: q } },
          { email:        { contains: q } },
          { cpf:          { contains: q } },
        ],
      },
      take: 10,
      select: {
        id: true, nomeCompleto: true, email: true,
        role: true, isInfluencer: true, managerId: true, comissao: true,
      },
    })
    return reply.send({ users })
  })

  // ── Depósitos ─────────────────────────────────────────────────────────────────
  app.get('/deposits', async (request, reply) => {
    const query = z.object({
      page:      z.coerce.number().default(1),
      search:    z.string().optional(),
      startDate: z.string().optional(),
      endDate:   z.string().optional(),
    }).safeParse(request.query)

    const { page, search, startDate, endDate } = query.success ? query.data : { page: 1, search: undefined, startDate: undefined, endDate: undefined }
    const limit = 20
    const skip  = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.user = { OR: [{ nomeCompleto: { contains: search } }, { email: { contains: search } }] }
    }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate + 'T00:00:00')
      if (endDate)   where.createdAt.lte = new Date(endDate   + 'T23:59:59')
    }

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { nomeCompleto: true, email: true } } },
      }),
      prisma.deposit.count({ where }),
    ])
    return reply.send({ success: true, deposits, total, pages: Math.ceil(total / limit) })
  })

  // ── Atualizar perfil de usuário ───────────────────────────────────────────────
  app.put('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      nomeCompleto: z.string().min(3).optional(),
      email:        z.string().email().optional(),
      telefone:     z.string().optional(),
      status:       z.enum(['online', 'offline']).optional(),
      isInfluencer: z.boolean().optional(),
      senha:        z.string().min(6).optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const data: Record<string, any> = { ...body.data }
    if (body.data.senha) {
      const bcrypt = await import('bcryptjs')
      data.senha = await bcrypt.default.hash(body.data.senha, 10)
    }
    delete data.senha_plain

    await prisma.user.update({ where: { id: Number(id) }, data })
    return reply.send({ success: true })
  })

  // ── Gateway config ────────────────────────────────────────────────────────────
  app.get('/gateway', async (_request, reply) => {
    const cfg = await prisma.gatewayConfig.findFirst({ where: { gatewayName: 'simplify' } })
    return reply.send({ success: true, config: cfg ?? null })
  })

  app.put('/gateway', async (request, reply) => {
    const schema = z.object({
      clientId:       z.string().optional(),
      clientSecret:   z.string().optional(),
      splitUsername:  z.string().nullable().optional(),
      splitPercentage: z.number().min(0).max(90).optional(),
      isActive:       z.boolean().optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const existing = await prisma.gatewayConfig.findFirst({ where: { gatewayName: 'simplify' } })
    if (existing) {
      await prisma.gatewayConfig.update({ where: { id: existing.id }, data: body.data })
    } else {
      await prisma.gatewayConfig.create({
        data: { gatewayName: 'simplify', clientId: '', clientSecret: '', ...body.data },
      })
    }
    return reply.send({ success: true })
  })

  // ── Personalização (settings garra_*) ────────────────────────────────────────
  app.get('/personalization', async (_request, reply) => {
    const settings = await prisma.setting.findMany({ where: { settingKey: { startsWith: 'garra_' } } })
    // Retorna chaves completas (garra_*) sob `data` — formato que o frontend consome.
    const data = Object.fromEntries(settings.map(s => [s.settingKey, s.settingValue ?? '']))
    return reply.send({ success: true, data })
  })

  app.put('/personalization', async (request, reply) => {
    const schema = z.record(z.string(), z.string())
    const body   = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    for (const [key, value] of Object.entries(body.data)) {
      const settingKey = key.startsWith('garra_') ? key : `garra_${key}`
      await prisma.setting.upsert({
        where:  { settingKey },
        create: { settingKey, settingValue: value as string },
        update: { settingValue: value as string },
      })
    }
    return reply.send({ success: true })
  })

  // ── Máquinas ──────────────────────────────────────────────────────────────────
  app.get('/machines', async (_request, reply) => {
    const machines = await prisma.maquina.findMany({ orderBy: [{ ordem: 'asc' }, { id: 'asc' }] })
    return reply.send({ success: true, data: machines, machines })
  })

  app.post('/machines', async (request, reply) => {
    const schema = z.object({
      name:      z.string().min(1),
      price:     z.number().positive(),
      cardColor: z.string().default('#EAB308'),
      bgColor:   z.string().default('#171717'),
      ordem:     z.number().int().default(0),
      status:    z.enum(['active', 'inactive']).default('active'),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const machine = await prisma.maquina.create({ data: body.data })
    return reply.send({ success: true, machine })
  })

  app.put('/machines/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({
      name:      z.string().min(1).optional(),
      price:     z.number().positive().optional(),
      cardColor: z.string().optional(),
      bgColor:   z.string().optional(),
      ordem:     z.number().int().optional(),
      status:    z.enum(['active', 'inactive']).optional(),
      bannerUrl: z.string().nullable().optional(),
      fundoUrl:  z.string().nullable().optional(),
      valorUrl:  z.string().nullable().optional(),
      bgUrl:     z.string().nullable().optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    await prisma.maquina.update({ where: { id: Number(id) }, data: body.data })
    return reply.send({ success: true })
  })

  app.delete('/machines/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.maquina.delete({ where: { id: Number(id) } })
    return reply.send({ success: true })
  })

  // ── Probabilidades e Multiplicadores ─────────────────────────────────────────
  app.get('/probabilities', async (_request, reply) => {
    const [probs, mults, probsInf, multsInf] = await Promise.all([
      prisma.probabilidade.findMany({ orderBy: { valor: 'asc' } }),
      prisma.multiplicador.findMany({ orderBy: { valor: 'asc' } }),
      prisma.probabilidadeInfluencer.findMany({ orderBy: { valor: 'asc' } }),
      prisma.multiplicadorInfluencer.findMany({ orderBy: { valor: 'asc' } }),
    ])
    return reply.send({ success: true, probabilidades: probs, multiplicadores: mults, probabilidadesInfluencer: probsInf, multiplicadoresInfluencer: multsInf })
  })

  app.put('/probabilities', async (request, reply) => {
    const schema = z.object({
      multiplicadores:              z.array(z.object({ id: z.number(), chance: z.number() })).optional(),
      probabilidades:               z.array(z.object({ id: z.number(), chance: z.number() })).optional(),
      multiplicadoresInfluencer:    z.array(z.object({ id: z.number(), chance: z.number() })).optional(),
      probabilidadesInfluencer:     z.array(z.object({ id: z.number(), chance: z.number() })).optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const ops: any[] = []
    for (const m of body.data.multiplicadores ?? [])
      ops.push(prisma.multiplicador.update({ where: { id: m.id }, data: { chance: m.chance } }))
    for (const p of body.data.probabilidades ?? [])
      ops.push(prisma.probabilidade.update({ where: { id: p.id }, data: { chance: p.chance } }))
    for (const m of body.data.multiplicadoresInfluencer ?? [])
      ops.push(prisma.multiplicadorInfluencer.update({ where: { id: m.id }, data: { chance: m.chance } }))
    for (const p of body.data.probabilidadesInfluencer ?? [])
      ops.push(prisma.probabilidadeInfluencer.update({ where: { id: p.id }, data: { chance: p.chance } }))

    if (ops.length > 0) await prisma.$transaction(ops)
    return reply.send({ success: true })
  })

  // ── Afiliados (listagem admin) ────────────────────────────────────────────────
  app.get('/affiliates', async (request, reply) => {
    const query = z.object({ search: z.string().optional(), page: z.coerce.number().default(1) })
      .safeParse(request.query)
    const { search, page } = query.success ? query.data : { search: undefined, page: 1 }
    const limit = 15
    const skip  = (page - 1) * limit

    const where: any = {
      OR: [
        { affiliateCode: { not: null } },
        { referrals: { some: {} } },
      ],
    }
    if (search) {
      where.AND = [{
        OR: [
          { nomeCompleto: { contains: search } },
          { email:        { contains: search } },
          { affiliateCode: { contains: search } },
        ],
      }]
    }

    const [affiliates, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { id: 'desc' },
        select: {
          id: true, nomeCompleto: true, email: true, affiliateCode: true,
          comissao: true, isInfluencer: true, role: true, managerPool: true,
          revshareRecurring: true, managerId: true,
          manager:   { select: { nomeCompleto: true, email: true } },
          _count:    { select: { referrals: true } },
        },
      }),
      prisma.user.count({ where }),
    ])
    return reply.send({ success: true, affiliates, total, pages: Math.ceil(total / limit) })
  })

  // ── Detalhes de afiliado (usuários convidados) ────────────────────────────────
  app.get('/affiliates/:id', async (request, reply) => {
    const { id }      = request.params as { id: string }
    const affiliateId = Number(id)

    const user = await prisma.user.findUnique({ where: { id: affiliateId }, select: { id: true, nomeCompleto: true, managerId: true } })
    if (!user) return reply.status(404).send({ success: false })

    // onlyFirstDeposit via manager_recurring
    let onlyFirstDeposit = false
    if (user.managerId) {
      const mgr = await prisma.user.findUnique({ where: { id: user.managerId }, select: { managerRecurring: true } })
      if (mgr && !mgr.managerRecurring) onlyFirstDeposit = true
    }

    const referrals = await prisma.user.findMany({
      where:   { referredById: affiliateId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, nomeCompleto: true, email: true, createdAt: true,
        deposits: { where: { status: 'paid' }, select: { amount: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    const totalConvidados   = referrals.length
    const totalDepositantes = referrals.filter((r: typeof referrals[0]) => r.deposits.length > 0).length
    const totalTrazido      = referrals.reduce((acc: number, r: typeof referrals[0]) => {
      const total = r.deposits.reduce((s: number, d: { amount: any }) => s + Number(d.amount), 0)
      return acc + (onlyFirstDeposit ? (r.deposits.length > 0 ? Number(r.deposits[0].amount) : 0) : total)
    }, 0)

    return reply.send({ success: true, affiliateId, totalConvidados, totalDepositantes, totalTrazido, onlyFirstDeposit, referrals: referrals.map((r: typeof referrals[0]) => ({
      ...r,
      totalDeposits: r.deposits.reduce((s: number, d: { amount: any }) => s + Number(d.amount), 0),
      deposits: undefined,
    })) })
  })

  // ── Histórico de comissões ────────────────────────────────────────────────────
  app.get('/commission-history', async (request, reply) => {
    const query = z.object({
      search:    z.string().optional(),
      managerId: z.coerce.number().optional(),
      page:      z.coerce.number().default(1),
    }).safeParse(request.query)
    const { search, managerId, page } = query.success ? query.data : { search: undefined, managerId: undefined, page: 1 }
    const limit = 25
    const skip  = (page - 1) * limit

    const where: any = {}
    if (managerId) {
      where.OR = [
        { managerId },
        { type: 'deposit_commission', referrer: { managerId } },
      ]
    }
    if (search) {
      where.AND = [{
        OR: [
          { referrer: { nomeCompleto: { contains: search } } },
          { referrer: { email:        { contains: search } } },
          { referred: { nomeCompleto: { contains: search } } },
          { referred: { email:        { contains: search } } },
        ],
      }]
    }

    const [logs, total, totals] = await Promise.all([
      prisma.affiliateLog.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: {
          referrer: { select: { nomeCompleto: true, email: true, comissao: true, role: true, isInfluencer: true, saldoRevshare: true, manager: { select: { nomeCompleto: true, email: true } } } },
          referred: { select: { nomeCompleto: true, email: true } },
        },
      }),
      prisma.affiliateLog.count({ where }),
      prisma.affiliateLog.aggregate({ where, _sum: { amount: true } }),
    ])

    return reply.send({ success: true, logs, total, pages: Math.ceil(total / limit), totalPago: totals._sum.amount ?? 0 })
  })

  // ── Rollover campaigns ────────────────────────────────────────────────────────
  app.get('/rollover-campaigns', async (request, reply) => {
    const query = z.object({ status: z.string().optional() }).safeParse(request.query)
    const filtro = query.success ? (query.data.status ?? 'active') : 'active'

    const where: any = {}
    if (filtro !== 'all') where.status = filtro

    const [campaigns, stats] = await Promise.all([
      prisma.rolloverCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          user: { select: { nomeCompleto: true, email: true, saldo: true } },
        },
      }),
      prisma.rolloverCampaign.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ])

    const statsMap: Record<string, number> = {}
    for (const s of stats) statsMap[s.status] = s._count.id

    return reply.send({ success: true, campaigns, stats: statsMap })
  })

  // ── Webhook logs ──────────────────────────────────────────────────────────────
  app.get('/webhook-logs', async (request, reply) => {
    const query = z.object({
      filter: z.enum(['all', 'pending', 'processed', 'error']).default('all'),
      page:   z.coerce.number().default(1),
    }).safeParse(request.query)
    const { filter, page } = query.success ? query.data : { filter: 'all' as const, page: 1 }
    const limit = 20
    const skip  = (page - 1) * limit

    const where: any = {}
    if (filter === 'pending')   where.processed = false
    else if (filter === 'processed') where.processed = true
    else if (filter === 'error') { where.processed = false; where.error = { not: null } }

    const [items, total, stats] = await Promise.all([
      prisma.webhookQueue.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { receivedAt: 'desc' },
      }),
      prisma.webhookQueue.count({ where }),
      prisma.webhookQueue.groupBy({
        by: ['processed'],
        _count: { id: true },
      }),
    ])

    return reply.send({ success: true, items, total, pages: Math.ceil(total / limit), stats })
  })

  app.post('/webhook-logs/:id/reprocess', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.webhookQueue.updateMany({
      where: { id: Number(id), processed: false },
      data:  { attempts: 0, error: null },
    })
    return reply.send({ success: true })
  })

  // ── Histórico de jogos (global) ───────────────────────────────────────────────
  app.get('/game-history', async (request, reply) => {
    const query = z.object({
      search: z.string().optional(),
      page:   z.coerce.number().default(1),
      limit:  z.coerce.number().default(20),
    }).safeParse(request.query)

    const { search, page, limit } = query.success ? query.data : { search: '', page: 1, limit: 20 }
    const skip = (page - 1) * limit

    const where = search ? {
      user: {
        OR: [
          { nomeCompleto: { contains: search } },
          { email:        { contains: search } },
        ],
      },
    } : {}

    const [items, total] = await Promise.all([
      prisma.gameHistory.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { nomeCompleto: true, email: true, isInfluencer: true, role: true } },
        },
      }),
      prisma.gameHistory.count({ where }),
    ])

    return reply.send({ success: true, items, total, page, pages: Math.ceil(total / limit) })
  })

  // ── Verify withdraw token ─────────────────────────────────────────────────────
  app.post('/verify-withdraw-token', async (request, reply) => {
    const schema = z.object({
      action: z.enum(['check', 'generate', 'verify']),
      token:  z.string().optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const bcrypt = await import('bcryptjs')

    if (body.data.action === 'check') {
      const cfg = await prisma.setting.findUnique({ where: { settingKey: 'withdraw_approval_token' } })
      return reply.send({ has_token: !!(cfg?.settingValue) })
    }

    if (body.data.action === 'generate') {
      const existing = await prisma.setting.findUnique({ where: { settingKey: 'withdraw_approval_token' } })
      if (existing?.settingValue) return reply.status(409).send({ success: false, message: 'Token já existe.' })

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const parts = Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      )
      const token = parts.join('-')
      const hash  = await bcrypt.default.hash(token, 10)

      await prisma.setting.upsert({
        where:  { settingKey: 'withdraw_approval_token' },
        create: { settingKey: 'withdraw_approval_token', settingValue: hash },
        update: { settingValue: hash },
      })
      return reply.send({ success: true, token })
    }

    if (body.data.action === 'verify') {
      const submitted = (body.data.token ?? '').trim()
      const cfg       = await prisma.setting.findUnique({ where: { settingKey: 'withdraw_approval_token' } })
      if (!cfg?.settingValue) return reply.send({ valid: false, message: 'Nenhum token configurado.' })
      const valid = await bcrypt.default.compare(submitted, cfg.settingValue)
      return reply.send({ valid })
    }

    return reply.status(400).send({ success: false })
  })
}

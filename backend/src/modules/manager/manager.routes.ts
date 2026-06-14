import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

export async function managerRoutes(app: FastifyInstance) {

  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'manager' && role !== 'admin') {
        return reply.status(403).send({ success: false, message: 'Acesso negado.' })
      }
    } catch {
      return reply.status(401).send({ success: false, message: 'Não autenticado.' })
    }
  })

  // ── Dashboard do gerente ──────────────────────────────────────────────────────
  app.get('/dashboard', async (request, reply) => {
    const { id: managerId } = request.user as { id: number }

    const [influencersRaw, manager, totalComissoes] = await Promise.all([
      prisma.user.findMany({
        where: { managerId, isInfluencer: true },
        select: {
          id: true, nomeCompleto: true, email: true, comissao: true,
          saldoRevshare: true, saldoDemo: true, revshareRecurring: true,
          referrals: {
            select: {
              id: true,
              deposits: {
                where: { status: 'paid', OR: [{ type: null }, { type: 'deposit' }] },
                select: { id: true, amount: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: managerId },
        select: { saldo: true, managerPool: true, managerRecurring: true },
      }),
      prisma.affiliateLog.aggregate({
        where: { referrerId: managerId, type: 'manager_commission' },
        _sum: { amount: true },
      }),
    ])

    // Calcula total_dep e total_dep_first por influenciador (igual PHP get_manager_data.php)
    const influencers = influencersRaw.map(inf => {
      let totalDep = 0
      let totalDepFirst = 0
      for (const referral of inf.referrals) {
        for (const dep of referral.deposits) totalDep += Number(dep.amount)
        if (referral.deposits.length > 0) totalDepFirst += Number(referral.deposits[0].amount)
      }
      const { referrals, ...rest } = inf
      return { ...rest, totalIndicados: referrals.length, totalDep, totalDepFirst }
    })

    return reply.send({
      success: true,
      saldo:            manager?.saldo ?? 0,
      managerPool:      manager?.managerPool ?? 0,
      managerRecurring: manager?.managerRecurring ?? true,
      totalInfluencers: influencers.length,
      totalComissoes:   totalComissoes._sum.amount ?? 0,
      influencers,
    })
  })

  // ── Listar influenciadores ────────────────────────────────────────────────────
  app.get('/influencers', async (request, reply) => {
    const { id: managerId } = request.user as { id: number }

    const influencers = await prisma.user.findMany({
      where: { managerId, isInfluencer: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { referrals: true } },
      },
    })

    return reply.send({ success: true, influencers })
  })

  // ── Criar influenciador ───────────────────────────────────────────────────────
  app.post('/influencers', async (request, reply) => {
    const { id: managerId } = request.user as { id: number }

    const schema = z.object({
      userId:   z.number().int().positive(),
      comissao: z.number().min(1).max(100),
    })

    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const { userId, comissao } = body.data

    const user = await prisma.user.findFirst({ where: { id: userId, role: 'user' } })
    if (!user) return reply.status(404).send({ success: false, message: 'Usuário não encontrado.' })

    const affiliateCode = user.affiliateCode ?? Math.random().toString(36).substring(2, 15)

    await prisma.user.update({
      where: { id: userId },
      data: { isInfluencer: true, comissao, managerId, affiliateCode },
    })

    return reply.send({ success: true, message: 'Influenciador criado com sucesso!' })
  })

  // ── Editar influenciador ──────────────────────────────────────────────────────
  app.put('/influencers/:influencerId', async (request, reply) => {
    const { id: managerId } = request.user as { id: number }
    const { influencerId }  = request.params as { influencerId: string }

    const schema = z.object({ comissao: z.number().min(1).max(100) })
    const body   = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const influencer = await prisma.user.findFirst({
      where: { id: Number(influencerId), managerId, isInfluencer: true },
    })
    if (!influencer) return reply.status(404).send({ success: false, message: 'Influenciador não encontrado.' })

    await prisma.user.update({
      where: { id: influencer.id },
      data: { comissao: body.data.comissao },
    })

    return reply.send({ success: true })
  })

  // ── Definir saldo demo de influenciador ──────────────────────────────────────
  app.post('/influencers/:influencerId/demo', async (request, reply) => {
    const { id: managerId }  = request.user as { id: number }
    const { influencerId }   = request.params as { influencerId: string }

    const schema = z.object({ saldoDemo: z.number().min(0) })
    const body   = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const influencer = await prisma.user.findFirst({
      where: { id: Number(influencerId), managerId, isInfluencer: true },
    })
    if (!influencer) return reply.status(404).send({ success: false, message: 'Influenciador não encontrado.' })

    await prisma.user.update({
      where: { id: influencer.id },
      data:  { saldoDemo: body.data.saldoDemo },
    })

    return reply.send({ success: true })
  })

  // ── Toggle revshare recorrente do influenciador ──────────────────────────────
  app.patch('/influencers/:influencerId/recurring', async (request, reply) => {
    const { id: managerId } = request.user as { id: number }
    const { influencerId }  = request.params as { influencerId: string }

    const schema = z.object({ recurring: z.boolean() })
    const body   = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const influencer = await prisma.user.findFirst({
      where: { id: Number(influencerId), managerId, isInfluencer: true },
    })
    if (!influencer) return reply.status(404).send({ success: false, message: 'Influenciador não encontrado.' })

    await prisma.user.update({
      where: { id: influencer.id },
      data:  { revshareRecurring: body.data.recurring },
    })

    return reply.send({ success: true })
  })

  // ── Solicitar saque (gerente) ─────────────────────────────────────────────────
  app.post('/withdraw', async (request, reply) => {
    const { id: managerId } = request.user as { id: number }

    const schema = z.object({
      amount:     z.number().positive(),
      pixKey:     z.string().min(1),
      pixKeyType: z.enum(['CPF', 'EMAIL', 'TELEFONE', 'CHAVE_ALEATORIA']),
      cpf_input:  z.string().optional(),
      telefone:   z.string().optional(),
    })

    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, message: 'Dados inválidos.' })

    const { amount, pixKey, pixKeyType } = body.data

    const manager = await prisma.user.findUniqueOrThrow({ where: { id: managerId } })
    if (Number(manager.saldo) < amount) {
      return reply.status(400).send({ success: false, message: 'Saldo insuficiente.' })
    }

    // Atualiza CPF e telefone se fornecidos
    const cpfPost = (body.data.cpf_input ?? '').replace(/\D/g, '')
    if (cpfPost.length === 11) {
      await prisma.user.update({ where: { id: managerId }, data: { cpf: cpfPost } })
    }
    const telefone = (body.data.telefone ?? '').replace(/\D/g, '')
    if (telefone.length >= 10) {
      await prisma.user.update({ where: { id: managerId }, data: { telefone } })
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: managerId }, data: { saldo: { decrement: amount } } }),
      prisma.withdrawal.create({
        data: {
          userId:     managerId,
          amount,
          pixKey,
          pixKeyType,
          nome:       manager.nomeCompleto,
          cpf:        cpfPost.length === 11 ? cpfPost : (manager.cpf ?? undefined),
          walletType: 'manager_saldo',
          status:     'pending',
        },
      }),
    ])

    return reply.send({ success: true, message: 'Saque solicitado com sucesso!' })
  })

  // ── Candidatos para promoção (usuários da rede do gerente) ────────────────────
  app.get('/candidates', async (request, reply) => {
    const { id: managerId } = request.user as { id: number }

    // Influenciadores deste gerente
    const influencerIds = await prisma.user.findMany({
      where:  { managerId, isInfluencer: true },
      select: { id: true },
    }).then(rows => rows.map(r => r.id))

    // Usuários indicados diretamente pelo gerente OU por influenciadores deste gerente
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'admin' },
        OR: [
          { referredById: managerId },
          ...(influencerIds.length > 0 ? [{ referredById: { in: influencerIds } }] : []),
        ],
      },
      orderBy: { nomeCompleto: 'asc' },
      select: {
        id:           true,
        nomeCompleto: true,
        email:        true,
        role:         true,
        isInfluencer: true,
        managerId:    true,
        referredBy:   { select: { nomeCompleto: true } },
      },
    })

    return reply.send({ success: true, users, my_id: managerId })
  })
}

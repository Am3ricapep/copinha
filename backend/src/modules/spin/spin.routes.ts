import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { spinNormal, spinCampaign, spinRollover } from './spin.service'

export async function spinRoutes(app: FastifyInstance) {

  // Middleware: exige login
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ success: false, message: 'Não autenticado.' })
    }
  })

  // ── Start Spin (decide qual tipo de spin usar) ───────────────────────────────
  app.post('/start', async (request, reply) => {
    const schema = z.object({ boxId: z.number().int().positive() })
    const body   = schema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, message: 'Dados inválidos.' })
    }

    const { id: userId, isInfluencer, role } = request.user as {
      id: number; isInfluencer: boolean; role: string
    }
    const { boxId } = body.data
    const isSpecial = isInfluencer || role === 'manager'

    try {
      // Usuário comum — verifica se tem campanha ativa
      if (!isSpecial) {
        const hasCampaign = await prisma.campaignParticipant.findFirst({
          where: {
            userId,
            status: 'active',
            campaign: { status: 'active' },
          },
        })
        if (hasCampaign) {
          const result = await spinCampaign(userId, boxId)
          return reply.send({ success: true, ...result })
        }

        const hasRollover = await prisma.rolloverCampaign.findFirst({
          where: { userId, status: 'active' },
        })
        if (hasRollover) {
          const result = await spinRollover(userId, boxId)
          return reply.send({ success: true, ...result })
        }
      }

      // Spin normal (influencer, gerente ou usuário sem campanha)
      const result = await spinNormal(userId, boxId)
      return reply.send({ success: true, ...result })

    } catch (err: any) {
      return reply.status(400).send({ success: false, message: err.message ?? 'Erro no jogo.' })
    }
  })

  // ── Saldo atual ──────────────────────────────────────────────────────────────
  app.get('/saldo', async (request, reply) => {
    const { id: userId, isInfluencer, role } = request.user as {
      id: number; isInfluencer: boolean; role: string
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { saldo: true, saldoDemo: true, saldoRevshare: true },
    })

    if (!user) return reply.status(404).send({ success: false, message: 'Usuário não encontrado.' })

    const isSpecial = isInfluencer || role === 'manager'

    return reply.send({
      success: true,
      saldo:        Number(isSpecial ? user.saldoDemo : user.saldo),
      saldoRevshare: Number(user.saldoRevshare),
    })
  })

  // ── Histórico de jogadas ──────────────────────────────────────────────────────
  app.get('/history', async (request, reply) => {
    const { id: userId } = request.user as { id: number }
    const query = z.object({
      page:  z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
    }).safeParse(request.query)

    const { page, limit } = query.success ? query.data : { page: 1, limit: 20 }
    const skip = (page - 1) * limit

    const [history, total] = await Promise.all([
      prisma.gameHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gameHistory.count({ where: { userId } }),
    ])

    return reply.send({ success: true, history, total, page, pages: Math.ceil(total / limit) })
  })

  // ── Verificar rollover ativo ──────────────────────────────────────────────────
  app.get('/check-rollover', async (request, reply) => {
    const { id: userId } = request.user as { id: number }

    // Participantes de campanha de influenciador são isentos do rollover global
    const participantCount = await prisma.campaignParticipant.count({ where: { userId } })
    if (participantCount > 0) {
      return reply.send({ success: true, hasRollover: false, rolloverRequired: 0, rolloverRemaining: 0, progress: 100 })
    }

    const rollover = await prisma.rolloverCampaign.findFirst({
      where: { userId, status: 'active' },
    })

    const totalDeposits = await prisma.deposit.aggregate({
      where: { userId, status: 'paid', OR: [{ type: null }, { type: 'deposit' }] },
      _sum: { amount: true },
    })
    const totalBets = await prisma.gameHistory.aggregate({
      where: { userId },
      _sum: { betAmount: true },
    })

    const cfg = await prisma.setting.findUnique({ where: { settingKey: 'rollover_multiplier' } })
    const multiplier = Number(cfg?.settingValue ?? 1)
    const totalDep   = Number(totalDeposits._sum.amount ?? 0)
    const totalBet   = Number(totalBets._sum.betAmount ?? 0)
    const required   = totalDep * multiplier
    const remaining  = Math.max(0, required - totalBet)
    const progress   = required > 0 ? Math.min(100, (totalBet / required) * 100) : 100

    return reply.send({
      success: true,
      hasRollover: !!rollover,
      rolloverRequired: required,
      rolloverRemaining: remaining,
      progress: Math.round(progress),
    })
  })
}

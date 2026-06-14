import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

/**
 * Rotas públicas (sem autenticação) — usadas pela vitrine do site:
 * a home e a página do jogo precisam ler máquinas ativas e as configurações
 * de tema/limites SEM login. Antes essas leituras só existiam sob /api/admin/*
 * (guardado por role=admin), então o site público vinha vazio.
 *
 * Resposta sempre em { success, data } — formato que o frontend já consome.
 */

// Chaves de settings seguras para expor publicamente (tema + limites + copy).
// NÃO expõe tokens, segredos de gateway nem flags internas.
const PUBLIC_SETTING_PREFIXES = ['garra_']
const PUBLIC_SETTING_KEYS = new Set([
  'min_deposit',
  'min_withdrawal',
  'openDeposit',
])

function isPublicSetting(key: string): boolean {
  if (PUBLIC_SETTING_KEYS.has(key)) return true
  return PUBLIC_SETTING_PREFIXES.some(p => key.startsWith(p))
}

export async function publicRoutes(app: FastifyInstance) {
  // Máquinas ativas (price como number para o frontend)
  app.get('/machines', async (_request, reply) => {
    const machines = await prisma.maquina.findMany({
      where: { status: 'active' },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    })
    const data = machines.map(m => ({ ...m, price: Number(m.price) }))
    return reply.send({ success: true, data })
  })

  // Configurações públicas (tema, limites, copy do modal de depósito)
  app.get('/settings', async (_request, reply) => {
    const rows = await prisma.setting.findMany()
    const data = Object.fromEntries(
      rows
        .filter(s => isPublicSetting(s.settingKey))
        .map(s => [s.settingKey, s.settingValue ?? '']),
    )
    return reply.send({ success: true, data })
  })
}

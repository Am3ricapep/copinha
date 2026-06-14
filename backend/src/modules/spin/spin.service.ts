import { prisma } from '../../lib/prisma'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickWeighted(items: { valor: { toString(): string }; chance: { toString(): string } }[]): number {
  const total = items.reduce((sum, it) => sum + Number(it.chance), 0)
  if (total <= 0) return 0
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= Number(items[i].chance)
    if (r <= 0) return i
  }
  return items.length - 1
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { settingKey: { in: keys } } })
  return Object.fromEntries(rows.map(r => [r.settingKey, r.settingValue ?? '0']))
}

// ── Spin Normal ───────────────────────────────────────────────────────────────

export async function spinNormal(userId: number, boxId: number) {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
    const maquina = await tx.maquina.findFirst({ where: { id: boxId, status: 'active' } })
    if (!maquina) throw new Error('Máquina não encontrada.')

    const isInfluencer = user.isInfluencer
    const isManager    = user.role === 'manager'
    const isSpecial    = isInfluencer || isManager
    const campoSaldo   = isSpecial ? 'saldoDemo' : 'saldo'
    const saldoAtual   = Number(isSpecial ? user.saldoDemo : user.saldo)
    const price        = Number(maquina.price)

    if (saldoAtual < price) throw new Error('Saldo insuficiente.')

    const tableProb = isSpecial ? 'probabilidade_influencer' : 'probabilidade'
    const tableMult = isSpecial ? 'multiplicadores_influencer' : 'multiplicadores'

    const probs1 = isSpecial
      ? await tx.probabilidadeInfluencer.findMany({ orderBy: { id: 'asc' } })
      : await tx.probabilidade.findMany({ orderBy: { id: 'asc' } })

    const probs2 = isSpecial
      ? await tx.multiplicadorInfluencer.findMany({ orderBy: { id: 'asc' } })
      : await tx.multiplicador.findMany({ orderBy: { id: 'asc' } })

    let val1 = probs1.length > 0 ? Number(probs1[pickWeighted(probs1)].valor) : 0
    let val2 = probs2.length > 0 ? Number(probs2[pickWeighted(probs2)].valor) : 1

    // Consolação: val1=0 → chance de devolver 50% da aposta
    if (val1 === 0 && !isSpecial) {
      const cfg = await getSettings(['consolation_enabled', 'consolation_chance'])
      const enabled = ['true', '1'].includes(cfg['consolation_enabled'] ?? 'false')
      const chance  = Math.min(100, Math.max(0, Number(cfg['consolation_chance'] ?? 0)))
      if (enabled && chance > 0 && Math.random() * 100 < chance) {
        val1 = 0.5
        val2 = 1
      }
    }

    let winAmount = price * val1 * val2

    // Limite máximo de ganho
    if (!isSpecial && winAmount > 0) {
      const cfg = await getSettings(['max_win_common'])
      const maxWin = Number(cfg['max_win_common'] ?? 0)
      if (maxWin > 0 && winAmount > maxWin) {
        winAmount = 0
        val1 = 0
        val2 = 1
      }
    }

    const newBalance = saldoAtual - price + winAmount

    await tx.user.update({
      where: { id: userId },
      data: { [campoSaldo]: newBalance },
    })

    await tx.gameHistory.create({
      data: {
        userId,
        betAmount: price,
        winAmount,
        result: winAmount > 0 ? 'win' : 'loss',
      },
    })

    return { val1, val2, bet: price, win: winAmount, newBalance, baseWin: price * val1 }
  })
}

// ── Campaign Spin ─────────────────────────────────────────────────────────────

type Combo = { val1: number; val2: number; total: number }

function getCombinations(): Combo[] {
  const nums  = [2, 5, 10, 15, 20, 50, 100]
  const mults = [1, 2, 3, 4]
  const combos: Combo[] = []
  for (const v1 of nums) {
    for (const v2 of mults) {
      combos.push({ val1: v1, val2: v2, total: v1 * v2 })
    }
  }
  return combos.sort((a, b) => a.total - b.total)
}

function escolherCombinacao(aposta: number, restante: number): Combo | null {
  const combos = getCombinations()
  const partes = randInt(3, 5)
  const alvo   = restante / partes
  let exata: Combo | null = null
  let melhor: Combo | null = null

  for (const c of combos) {
    const ganhoLiquido = Math.round((aposta * (c.total - 1)) * 100) / 100
    if (ganhoLiquido <= 0) continue
    if (Math.abs(ganhoLiquido - restante) < 0.01) { exata = c; break }
    if (ganhoLiquido < restante) {
      if (!melhor) { melhor = c; continue }
      const melhorGanho = Math.round((aposta * (melhor.total - 1)) * 100) / 100
      if (Math.abs(ganhoLiquido - alvo) < Math.abs(melhorGanho - alvo)) melhor = c
    }
  }

  return exata ?? melhor
}

export async function spinCampaign(userId: number, boxId: number) {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.isInfluencer || user.role === 'manager') throw new Error('Erro no jogo.')

    const maquina = await tx.maquina.findFirst({ where: { id: boxId, status: 'active' } })
    if (!maquina) throw new Error('Máquina não encontrada.')

    const aposta = Number(maquina.price)
    const saldoAtual = Number(user.saldo)
    if (saldoAtual < aposta) throw new Error('Saldo insuficiente.')

    const participant = await tx.campaignParticipant.findFirst({
      where: {
        userId,
        status: 'active',
        campaign: { status: 'active' },
      },
      include: { campaign: true },
    })

    if (!participant) throw new Error('Campanha não encontrada.')

    const netGain    = Number(participant.netGain)
    const targetGain = Number(participant.campaign.targetGain)
    const restante   = Math.round((targetGain - netGain) * 100) / 100
    const phase      = participant.phase
    const consLosses = participant.consecutiveLosses
    const lossNeeded = participant.lossesNeeded

    const saldoAposAposta = saldoAtual - aposta
    await tx.user.update({ where: { id: userId }, data: { saldo: saldoAposAposta } })

    let forcaPerda    = false
    let combo: Combo | null = null
    let fechaCampanha = false

    if (restante <= 0) {
      forcaPerda = fechaCampanha = true
    } else {
      combo = escolherCombinacao(aposta, restante)
      if (!combo) {
        forcaPerda = true
      } else {
        const ganhoLiquido = Math.round((aposta * (combo.total - 1)) * 100) / 100
        const ehExata = Math.abs(ganhoLiquido - restante) < 0.01
        if (ehExata) {
          fechaCampanha = true
        } else if (phase === 'losing') {
          forcaPerda = true
        }
      }
    }

    let val1 = 0, val2 = 1, winAmount = 0
    if (!forcaPerda && combo) {
      val1 = combo.val1
      val2 = combo.val2
      winAmount = Math.round((aposta * combo.total) * 100) / 100
    }

    const finalBalance  = saldoAposAposta + winAmount
    const novoNetGain   = Math.round((netGain + winAmount - aposta) * 100) / 100

    if (winAmount > 0) {
      await tx.user.update({ where: { id: userId }, data: { saldo: finalBalance } })
    }

    let novaPhase      = phase
    let novoConsLosses = consLosses
    let novoLossNeeded = lossNeeded

    if (forcaPerda || winAmount <= 0) {
      novoConsLosses = consLosses + 1
      if (novoConsLosses >= lossNeeded) {
        novaPhase      = 'winning'
        novoConsLosses = 0
        novoLossNeeded = randInt(1, 3)
      }
    } else {
      novaPhase      = 'losing'
      novoConsLosses = 0
      novoLossNeeded = randInt(1, 3)
    }

    fechaCampanha = fechaCampanha || novoNetGain >= targetGain || finalBalance <= 0

    let novoStatus: 'active' | 'cap_reached' | 'expired' = 'active'
    let finishedAt: Date | null = null
    if (fechaCampanha) {
      novoStatus = (finalBalance <= 0 && novoNetGain < targetGain) ? 'expired' : 'cap_reached'
      finishedAt = new Date()
    }

    await tx.campaignParticipant.update({
      where: { id: participant.id },
      data: {
        netGain:          novoNetGain,
        phase:            novaPhase,
        consecutiveLosses: novoConsLosses,
        lossesNeeded:     novoLossNeeded,
        status:           novoStatus,
        finishedAt,
      },
    })

    // Fecha campanha se todos terminaram
    if (fechaCampanha) {
      const campInfo = await tx.campaignParticipant.groupBy({
        by: ['campaignId'],
        where: { campaignId: participant.campaignId },
        _count: { id: true },
      })
      const ativos = await tx.campaignParticipant.count({
        where: { campaignId: participant.campaignId, status: 'active' },
      })
      const campaign = await tx.influencerCampaign.findUniqueOrThrow({
        where: { id: participant.campaignId },
      })
      const total = campInfo[0]?._count.id ?? 0
      if (ativos === 0 && total >= campaign.maxVagas) {
        await tx.influencerCampaign.update({
          where: { id: participant.campaignId },
          data: { status: 'ended', endedAt: new Date() },
        })
      }
    }

    await tx.gameHistory.create({
      data: {
        userId,
        betAmount:  aposta,
        winAmount,
        result:     winAmount > 0 ? 'win' : 'loss',
        campaignId: participant.campaignId,
      },
    })

    return { val1, val2, bet: aposta, win: winAmount, newBalance: finalBalance, baseWin: aposta * val1 }
  })
}

// ── Rollover Spin ─────────────────────────────────────────────────────────────

function combosValidosParaGanho(aposta: number, netGanho: number, maxWin: number, maxNetGanho: number): Combo[] {
  const nums  = [2, 5, 10, 15, 20, 50, 100]
  const mults = [1, 2, 3, 4]
  const valid: Combo[] = []
  for (const v1 of nums) {
    for (const v2 of mults) {
      const winAmount = aposta * v1 * v2
      const winNet    = winAmount - aposta
      if (winAmount <= 0 || winAmount > maxWin) continue
      if (netGanho + winNet > maxNetGanho)       continue
      valid.push({ val1: v1, val2: v2, total: v1 * v2 })
    }
  }
  return valid
}

export async function spinRollover(userId: number, boxId: number) {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
    const maquina = await tx.maquina.findFirst({ where: { id: boxId, status: 'active' } })
    if (!maquina) throw new Error('Máquina não encontrada.')

    const aposta     = Number(maquina.price)
    const saldoAtual = Number(user.saldo)
    if (saldoAtual < aposta) throw new Error('Saldo insuficiente.')

    const campaign = await tx.rolloverCampaign.findFirst({
      where: { userId, status: 'active' },
    })
    if (!campaign) throw new Error('Campanha não encontrada. Recarregue a página.')

    const cfg = await getSettings(['rollover_multiplier', 'max_win_common', 'rollover_losses_min', 'rollover_losses_max'])
    const rollMultiplier = Number(cfg['rollover_multiplier'] ?? 1)
    const maxWin         = Number(cfg['max_win_common'] ?? 30)
    const lossesMin      = Math.max(1, Number(cfg['rollover_losses_min'] ?? 1))
    const lossesMax      = Math.max(lossesMin, Number(cfg['rollover_losses_max'] ?? 2))

    const totalDeposits = await tx.deposit.aggregate({
      where: { userId, status: 'paid', OR: [{ type: null }, { type: 'deposit' }] },
      _sum: { amount: true },
    })
    const totalBets = await tx.gameHistory.aggregate({
      where: { userId },
      _sum: { betAmount: true },
    })

    const totalDep      = Number(totalDeposits._sum.amount ?? 0)
    const totalBet      = Number(totalBets._sum.betAmount ?? 0)
    const netGanho      = saldoAtual - totalDep
    const rollReq       = totalDep * rollMultiplier
    const rollRestante  = Math.max(0, rollReq - totalBet)
    const depositAmount = Number(campaign.depositAmount)
    const drainThreshold = depositAmount * 0.3
    const inDrainMode   = rollRestante <= drainThreshold || (rollRestante > 0 && rollRestante <= aposta)

    let forcaPerda = false
    let combo: Combo | null = null

    if (inDrainMode || campaign.phase === 'losing') {
      forcaPerda = true
    } else {
      const maxNetGanhoPermitido = depositAmount * 0.3
      const combos = combosValidosParaGanho(aposta, netGanho, maxWin, maxNetGanhoPermitido)
      if (combos.length === 0) {
        forcaPerda = true
      } else {
        combos.sort((a, b) => a.total - b.total)
        const count    = combos.length
        const midStart = Math.floor(count / 3)
        const midEnd   = Math.ceil(count * 2 / 3)
        const slice    = combos.slice(midStart, Math.max(midStart + 1, midEnd))
        combo = slice[Math.floor(Math.random() * slice.length)]
      }
    }

    let val1 = 0, val2 = [1, 2, 3, 4][randInt(0, 3)], winAmount = 0
    if (!forcaPerda && combo) {
      val1 = combo.val1
      val2 = combo.val2
      winAmount = combo.val1 * combo.val2 * aposta
    }

    const finalBalance = saldoAtual - aposta + winAmount
    await tx.user.update({ where: { id: userId }, data: { saldo: finalBalance } })

    let novaPhase      = campaign.phase
    let novoConsLosses = campaign.consecutiveLosses
    let novoLossNeeded = campaign.lossesNeeded

    if (forcaPerda) {
      if (!inDrainMode && campaign.phase === 'losing') {
        novoConsLosses++
        if (novoConsLosses >= campaign.lossesNeeded) {
          novaPhase      = 'winning'
          novoConsLosses = 0
        }
      }
    } else {
      const progress = rollReq > 0 ? Math.min(1, (totalBet + aposta) / rollReq) : 1
      novoLossNeeded = progress < 0.40 ? 1 : progress < 0.75 ? randInt(2, 3) : randInt(3, 5)
      novaPhase      = 'losing'
      novoConsLosses = 0
    }

    const rollRestantePos = Math.max(0, rollReq - (totalBet + aposta))
    const netGanhoPos     = finalBalance - totalDep

    let novoStatus: 'active' | 'completed' | 'expired' = 'active'
    let completedAt: Date | null = null

    if (finalBalance <= 0) {
      novoStatus  = 'expired'
      completedAt = new Date()
    } else if (rollRestantePos <= 0 && netGanhoPos <= 0) {
      novoStatus  = 'completed'
      completedAt = new Date()
    }

    if (novoStatus !== 'active') {
      novaPhase      = 'losing'
      novoConsLosses = 0
      novoLossNeeded = randInt(lossesMin, lossesMax)
    }

    await tx.rolloverCampaign.update({
      where: { id: campaign.id },
      data: {
        phase:            novaPhase,
        consecutiveLosses: novoConsLosses,
        lossesNeeded:     novoLossNeeded,
        status:           novoStatus,
        finalNetGain:     novoStatus !== 'active' ? netGanhoPos : null,
        completedAt,
      },
    })

    await tx.gameHistory.create({
      data: { userId, betAmount: aposta, winAmount, result: winAmount > 0 ? 'win' : 'loss' },
    })

    return { val1, val2, bet: aposta, win: winAmount, newBalance: finalBalance, baseWin: aposta * val1 }
  })
}

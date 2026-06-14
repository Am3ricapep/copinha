import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

function makePrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  }).$extends({
    result: {
      user: {
        saldo:         { needs: { saldo: true },         compute: (u) => Number(u.saldo) },
        saldoDemo:     { needs: { saldoDemo: true },     compute: (u) => Number(u.saldoDemo) },
        saldoRevshare: { needs: { saldoRevshare: true }, compute: (u) => Number(u.saldoRevshare) },
        comissao:      { needs: { comissao: true },      compute: (u) => Number(u.comissao) },
        managerPool:   { needs: { managerPool: true },   compute: (u) => Number(u.managerPool) },
      },
      deposit: {
        amount: { needs: { amount: true }, compute: (d) => Number(d.amount) },
      },
      withdrawal: {
        amount: { needs: { amount: true }, compute: (w) => Number(w.amount) },
      },
      maquina: {
        price: { needs: { price: true }, compute: (m) => Number(m.price) },
      },
      gameHistory: {
        betAmount: { needs: { betAmount: true }, compute: (g) => Number(g.betAmount) },
        winAmount: { needs: { winAmount: true }, compute: (g) => Number(g.winAmount) },
      },
      affiliateLog: {
        amount: { needs: { amount: true }, compute: (a) => Number(a.amount) },
      },
      rolloverCampaign: {
        depositAmount:   { needs: { depositAmount: true },   compute: (r) => Number(r.depositAmount) },
        rolloverRequired: { needs: { rolloverRequired: true }, compute: (r) => Number(r.rolloverRequired) },
        finalNetGain:    { needs: { finalNetGain: true },    compute: (r) => r.finalNetGain !== null ? Number(r.finalNetGain) : null },
      },
    },
  })
}

type ExtendedPrisma = ReturnType<typeof makePrisma>

const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma }

export const prisma = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

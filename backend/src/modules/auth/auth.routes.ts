import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'

export async function authRoutes(app: FastifyInstance) {

  // ── Registro ────────────────────────────────────────────────────────────────
  app.post('/register', async (request, reply) => {
    const schema = z.object({
      nomeCompleto: z.string().min(3),
      email:        z.string().email(),
      cpf:          z.string().optional(),
      telefone:     z.string().optional(),
      senha:        z.string().min(6),
      affiliateRef: z.string().optional(),
    })

    const body = schema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, message: 'Dados inválidos.' })
    }

    const { nomeCompleto, email, cpf, telefone, senha, affiliateRef } = body.data

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return reply.status(409).send({ success: false, message: 'E-mail já cadastrado.' })
    }

    // Resolve quem indicou
    let referredById: number | null = null
    if (affiliateRef) {
      const referrer = await prisma.user.findUnique({ where: { affiliateCode: affiliateRef } })
      if (referrer) referredById = referrer.id
    }

    const hash = await bcrypt.hash(senha, 10)
    const affiliateCode = Math.random().toString(36).substring(2, 15)

    // CPF temporário gerado a partir do email (igual ao PHP: substr(md5($email.microtime()), 0, 11))
    const tempCpf = cpf
      ? cpf.replace(/\D/g, '')
      : crypto.createHash('md5').update(email + Date.now()).digest('hex').substring(0, 11)

    const user = await prisma.user.create({
      data: {
        nomeCompleto,
        email,
        cpf:      tempCpf,
        telefone,
        senha:    hash,
        affiliateCode,
        referredById,
      },
    })

    // openDeposit: lê da tabela de settings (frontend usa para abrir modal de depósito)
    const openDepositCfg = await prisma.setting.findUnique({ where: { settingKey: 'openDeposit' } })
    const openDeposit    = ['true', '1'].includes(openDepositCfg?.settingValue ?? 'false')

    const token = app.jwt.sign({ id: user.id, role: user.role, isInfluencer: user.isInfluencer })

    return reply
      .setCookie('token', token, { path: '/', httpOnly: true, sameSite: 'lax' })
      .send({
        success:      true,
        openDeposit,
        user: {
          id:            user.id,
          nomeCompleto:  user.nomeCompleto,
          email:         user.email,
          saldo:         Number(user.saldo),
          role:          user.role,
          isInfluencer:  user.isInfluencer,
          affiliateCode: user.affiliateCode,
        },
      })
  })

  // ── Login ───────────────────────────────────────────────────────────────────
  app.post('/login', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      senha: z.string().min(1),
    })

    const body = schema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, message: 'Dados inválidos.' })
    }

    const { email, senha } = body.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return reply.status(401).send({ success: false, message: 'E-mail ou senha incorretos.' })
    }

    const valid = await bcrypt.compare(senha, user.senha)
    if (!valid) {
      return reply.status(401).send({ success: false, message: 'E-mail ou senha incorretos.' })
    }

    // Atualiza status online
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'online', lastSeen: new Date() },
    })

    const token = app.jwt.sign({ id: user.id, role: user.role, isInfluencer: user.isInfluencer })

    return reply
      .setCookie('token', token, { path: '/', httpOnly: true, sameSite: 'lax' })
      .send({
        success: true,
        user: {
          id:           user.id,
          nomeCompleto: user.nomeCompleto,
          email:        user.email,
          saldo:        Number(user.saldo),
          saldoDemo:    Number(user.saldoDemo),
          role:         user.role,
          isInfluencer: user.isInfluencer,
          affiliateCode: user.affiliateCode,
        },
      })
  })

  // ── Login Admin ─────────────────────────────────────────────────────────────
  app.post('/admin/login', async (request, reply) => {
    const schema = z.object({
      username: z.string(),
      password: z.string(),
    })

    const body = schema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, message: 'Dados inválidos.' })
    }

    const { username, password } = body.data

    const admin = await prisma.admin.findUnique({ where: { username } })
    if (!admin) {
      return reply.status(401).send({ success: false, message: 'Credenciais inválidas.' })
    }

    const valid = await bcrypt.compare(password, admin.password)
    if (!valid) {
      return reply.status(401).send({ success: false, message: 'Credenciais inválidas.' })
    }

    const token = app.jwt.sign({ id: admin.id, role: 'admin' })

    // Usa o mesmo cookie 'token' que o plugin JWT lê (server.ts: cookieName: 'token').
    // Antes gravava 'admin_token', que jwtVerify() ignorava → todo endpoint admin dava 401.
    return reply
      .setCookie('token', token, { path: '/', httpOnly: true, sameSite: 'lax' })
      .send({ success: true })
  })

  // ── Me (dados do usuário logado) ────────────────────────────────────────────
  app.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ success: false, message: 'Não autenticado.' })
    }

    const { id } = request.user as { id: number }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id:           true,
        nomeCompleto: true,
        email:        true,
        cpf:          true,
        telefone:     true,
        saldo:        true,
        saldoDemo:    true,
        saldoRevshare: true,
        role:         true,
        isInfluencer: true,
        affiliateCode: true,
        managerId:    true,
      },
    })

    if (!user) {
      return reply.status(404).send({ success: false, message: 'Usuário não encontrado.' })
    }

    return reply.send({ success: true, user: { ...user, saldo: Number(user.saldo), saldoDemo: Number(user.saldoDemo), saldoRevshare: Number(user.saldoRevshare) } })
  })

  // ── Update status (heartbeat — seta online + last_seen) ────────────────────
  app.post('/update-status', async (request, reply) => {
    try { await request.jwtVerify() } catch { return reply.send({ success: true }) }
    const { id } = request.user as { id: number }
    await prisma.user.update({ where: { id }, data: { status: 'online', lastSeen: new Date() } }).catch(() => {})
    return reply.send({ success: true })
  })

  // ── Logout ──────────────────────────────────────────────────────────────────
  app.post('/logout', async (request, reply) => {
    try {
      await request.jwtVerify()
      const { id } = request.user as { id: number }
      await prisma.user.update({
        where: { id },
        data: { status: 'offline', lastSeen: new Date() },
      })
    } catch {}

    return reply
      .clearCookie('token', { path: '/' })
      .send({ success: true })
  })
}

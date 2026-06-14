import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'

import { authRoutes } from './modules/auth/auth.routes'
import { spinRoutes } from './modules/spin/spin.routes'
import { paymentRoutes } from './modules/payment/payment.routes'
import { affiliateRoutes } from './modules/affiliate/affiliate.routes'
import { adminRoutes } from './modules/admin/admin.routes'
import { managerRoutes } from './modules/manager/manager.routes'
import { publicRoutes } from './modules/public/public.routes'

const app = Fastify({ logger: true, ajv: { customOptions: { allowUnionTypes: true } } })

// Permite body vazio em requisições com Content-Type: application/json
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (!body || (body as string).trim() === '') return done(null, {})
  try { done(null, JSON.parse(body as string)) } catch (err: any) { done(err) }
})

// ── Plugins ──────────────────────────────────────────────────────────────────
app.register(helmet)

app.register(cors, {
  origin: process.env.APP_URL ?? 'http://localhost:3000',
  credentials: true,
})

app.register(cookie)

app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'changeme',
  cookie: { cookieName: 'token', signed: false },
})

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.register(publicRoutes,    { prefix: '/api/public' })
app.register(authRoutes,      { prefix: '/api/auth' })
app.register(spinRoutes,      { prefix: '/api/spin' })
app.register(paymentRoutes,   { prefix: '/api/payment' })
app.register(affiliateRoutes, { prefix: '/api/affiliate' })
app.register(adminRoutes,     { prefix: '/api/admin' })
app.register(managerRoutes,   { prefix: '/api/manager' })

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok' }))

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await app.listen({
      port: Number(process.env.PORT ?? 3333),
      host: process.env.HOST ?? '0.0.0.0',
    })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

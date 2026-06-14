import { prisma } from './prisma'

const BASE_URL = 'https://simplifybr.com/api/v1'

interface GatewayConfig {
  clientId: string
  clientSecret: string
  splitUsername: string | null
  splitPercentage: number
}

async function loadConfig(): Promise<GatewayConfig> {
  const cfg = await prisma.gatewayConfig.findFirst({
    where: { gatewayName: 'simplify' },
  })
  if (!cfg || !cfg.clientId || !cfg.clientSecret) {
    throw new Error('Client ID e Client Secret da Simplify não configurados.')
  }
  return {
    clientId:        cfg.clientId,
    clientSecret:    cfg.clientSecret,
    splitUsername:   cfg.splitUsername,
    splitPercentage: Number(cfg.splitPercentage),
  }
}

async function request(
  method: 'GET' | 'POST',
  endpoint: string,
  data?: object
): Promise<any> {
  const cfg = await loadConfig()
  const url = BASE_URL + endpoint

  const options: RequestInit = {
    method,
    headers: {
      'client-id':     cfg.clientId,
      'client-secret': cfg.clientSecret,
      'Content-Type':  'application/json',
    },
  }

  if (method === 'POST' && data) {
    options.body = JSON.stringify(data)
  }

  const finalUrl = method === 'GET' && data
    ? url + '?' + new URLSearchParams(data as Record<string, string>).toString()
    : url

  const res  = await fetch(finalUrl, options)
  const json = await res.json()

  if (!res.ok) {
    throw new Error('Erro Simplify: ' + JSON.stringify(json))
  }

  return json
}

export function getCallbackUrl(): string {
  const base = process.env.APP_URL ?? 'https://localhost:3000'
  return `${base}/api/payment/callback`
}

export async function createDeposit(
  amount: number,
  nome: string,
  email: string,
  cpf: string,
  externalId: string
): Promise<{ qrcode: string; internal_id: string }> {
  const cfg     = await loadConfig()
  const payload: Record<string, unknown> = {
    amount,
    payer: {
      name:     nome,
      email,
      document: cpf.replace(/\D/g, ''),
      phone:    '00000000000',
    },
    webhookURL:  getCallbackUrl(),
    external_id: externalId,
  }

  if (cfg.splitUsername && cfg.splitPercentage > 0) {
    payload['split'] = [
      { username: cfg.splitUsername, percentage: cfg.splitPercentage },
    ]
  }

  return request('POST', '/pix/deposit', payload)
}

export async function sendWithdraw(
  amount: number,
  pixKeyType: string,
  pixKey: string,
  nome: string,
  cpf: string,
  email: string,
  telefone: string,
  externalId: string | number
): Promise<{ internal_id: string }> {
  const typeMap: Record<string, string> = {
    CPF:             'cpf',
    CNPJ:            'cnpj',
    EMAIL:           'email',
    TELEFONE:        'phone',
    CHAVE_ALEATORIA: 'random',
    cpf:             'cpf',
    cnpj:            'cnpj',
    email:           'email',
    telefone:        'phone',
    aleatorio:       'random',
  }
  const pixType = typeMap[pixKeyType.toUpperCase()] ?? typeMap[pixKeyType] ?? 'cpf'

  const phone = telefone.replace(/\D/g, '')
  const doc   = cpf.replace(/\D/g, '').padEnd(11, '0')

  return request('POST', '/pix/withdraw', {
    amount,
    pix_type: pixType,
    pix_key:  pixKey,
    beneficiary: {
      name:     nome,
      document: doc,
      email:    email || 'noreply@pagamento.com',
      phone:    phone.length >= 10 ? phone : '00000000000',
    },
    webhookURL:  getCallbackUrl(),
    external_id: String(externalId),
  })
}

export async function getDepositStatus(internalId: string): Promise<any> {
  return request('GET', `/pix/deposit/${internalId}`)
}

export async function getWithdrawStatus(internalId: string): Promise<any> {
  return request('GET', `/pix/withdraw/${internalId}`)
}

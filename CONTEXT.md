# Projeto iGaming — Copa 98 II (fork de Garra da Sorte)

> Contexto vivo do projeto. Atualizado a cada sessão de desenvolvimento.
> Última atualização: 2026-06-12 (fork Copa 98 a partir do igaming - garra)

---

## Objetivo

**Copa 98 II** é um fork do projeto `igaming - garra`, reaproveitando **100% da mesma stack
e do mesmo motor econômico** (backend Fastify + Prisma + JWT, e todo o sistema de campanhas,
rollover, afiliados, gerentes e admin). A única diferença é o **jogo em si**: em vez da máquina
de garra, é o caça-níquel **Copa 98** — um tabuleiro em anel com bandeiras de países da Copa do
Mundo de 98, onde uma luz corre o anel e para num país, pagando `aposta × multiplicador`.

### O que muda em relação ao garra
- **Frontend do jogo** (`app/jogo/[id]/GameClient.tsx`): reescrito como tabuleiro Copa 98
  (anel 7×7 responsivo, luz girando, lâmpada de BÔNUS central, roda de bônus em overlay).
- **Tema público** (`globals.css`): campo de futebol verde + LED dourado/laranja. Tokens
  `--garra-primary` (dourado) e `--garra-bg` (verde) reaproveitados.
- **Assets**: copiados de `copa98-game/assets/` → `frontend/public/copa98/`.
- **Branding**: nome "Copa 98 II", logo `splash_logo.png`.

### O que NÃO muda (reaproveitado integralmente)
- **Backend inteiro** — nenhuma alteração de lógica. O spin continua retornando
  `{ val1, val2, win, base_win, new_balance }`. No tabuleiro Copa 98: `val1` = multiplicador
  do país (a luz para na célula cujo `pay` mais se aproxima de `val1`), `val2` = multiplicador
  da roda de bônus, `win` = total (server-authoritative).
- **Painel admin, painel gerente e modal de afiliado** — mesmo layout do garra (a pedido).
- Campanhas, rollover, comissões, gateway, saques — idênticos.

> O motor decide quanto o jogador ganha; o tabuleiro Copa 98 é só a camada de apresentação.

---

## Stack Escolhida

| Camada       | Tecnologia                              |
|--------------|-----------------------------------------|
| Runtime      | Node.js 22 + TypeScript                 |
| Framework    | Fastify 5                               |
| ORM          | Prisma 5 (MySQL)                        |
| Autenticação | JWT via `@fastify/jwt` (cookie httpOnly) |
| Senhas       | bcryptjs                                |
| Validação    | Zod                                     |
| Gateway PIX  | Simplify BR (`https://simplifybr.com/api/v1`) |
| Hosting      | Hetzner CX32 (4vCPU, 8GB RAM, €9/mês)  |
| CI/CD        | GitHub Actions → deploy automático      |
| Banco        | MySQL (mesmo do sistema original)       |

---

## Estrutura de Pastas

```
igaming - garra/
├── CONTEXT.md                  ← este arquivo
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       ← todos os modelos
│   ├── src/
│   │   ├── server.ts           ← entry point Fastify
│   │   ├── lib/
│   │   │   ├── prisma.ts           ← singleton PrismaClient
│   │   │   └── gateway.service.ts  ← wrapper Simplify BR
│   │   └── modules/
│   │       ├── auth/           ← registro, login, logout, /me, update-status
│   │       ├── spin/           ← start spin, saldo, histórico, rollover
│   │       ├── payment/        ← PIX, callback, cron, saque, saque-demo, transactions
│   │       ├── affiliate/      ← dados de afiliado, payAffiliateCommission()
│   │       ├── manager/        ← dashboard gerente, influenciadores, saque, candidates
│   │       └── admin/          ← dashboard, usuários, campanhas, saques, settings,
│   │                              gerentes, promote, gateway, machines, probabilities,
│   │                              affiliates, commission-history, rollover-campaigns,
│   │                              webhook-logs, game-history, verify-withdraw-token
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── .gitignore
└── frontend/                   ← Next.js 15 App Router (TypeScript + Tailwind v4)
    ├── app/
    │   ├── layout.tsx              ← Root layout (ToastProvider + AppProvider)
    │   ├── globals.css             ← Design system completo (garra + admin themes)
    │   ├── page.tsx                ← Home (server component, força dynamic)
    │   ├── HomeClient.tsx          ← Carrossel, grid de máquinas, winners, footer
    │   ├── jogo/[id]/
    │   │   ├── page.tsx            ← Server component (valida máquina)
    │   │   └── GameClient.tsx      ← Garra + animações + result modal
    │   ├── admin/
    │   │   ├── layout.tsx          ← Sidebar admin (15 nav items + mobile toggle)
    │   │   ├── login/page.tsx
    │   │   ├── page.tsx            ← Dashboard admin
    │   │   ├── saques/page.tsx     ← 4 ações (approve/reject/refund/dismiss)
    │   │   ├── depositos/page.tsx
    │   │   ├── usuarios/page.tsx + [id]/page.tsx
    │   │   ├── maquinas/page.tsx
    │   │   ├── settings/page.tsx
    │   │   ├── personalizacao/page.tsx
    │   │   ├── gateway/page.tsx
    │   │   ├── afiliados/page.tsx + [id]/page.tsx
    │   │   ├── campanhas/page.tsx
    │   │   ├── historico/page.tsx
    │   │   ├── webhooks/page.tsx
    │   │   ├── rollover/page.tsx
    │   │   ├── comissoes/page.tsx
    │   │   └── gerentes/page.tsx
    │   └── manager/
    │       ├── layout.tsx          ← Sidebar gerente
    │       ├── page.tsx            ← Dashboard gerente + CRUD influenciadores
    │       └── saques/page.tsx
    ├── components/
    │   ├── Toast.tsx               ← ToastProvider + useToast hook
    │   ├── Header.tsx              ← Header público (CSS vars de settings)
    │   ├── AuthModal.tsx           ← Login + registro com ?ref=
    │   ├── DepositModal.tsx        ← PIX + QR + polling 5s
    │   ├── WithdrawModal.tsx       ← Saque real/demo + validações
    │   ├── ProfileModal.tsx        ← Avatar, saldo, ações
    │   ├── HistoryModal.tsx        ← Extrato depósitos+saques
    │   ├── AffiliateModal.tsx      ← Painel resumido afiliado
    │   └── ModalHub.tsx            ← Roteador de modais pelo openModal state
    ├── lib/
    │   ├── api.ts                  ← Cliente HTTP + todos os endpoints + interfaces TS
    │   └── store.tsx               ← AppProvider (user, settings, openModal, logout)
    ├── next.config.ts              ← Rewrite /api/* → http://localhost:3333/api/*
    ├── .env.local                  ← BACKEND_URL=http://localhost:3333
    ├── package.json
    └── tsconfig.json
```

> **Nota:** `kwai.service.ts` foi removido — o projeto usa tracking próprio, não Kwai.

---

## Variáveis de Ambiente (`.env`)

```env
DATABASE_URL=mysql://USER:PASS@HOST:3306/DB_NAME
JWT_SECRET=segredo_jwt_aqui
CRON_SECRET=segredo_cron_aqui
APP_URL=https://seudominio.com.br
NODE_ENV=production
PORT=3333
```

---

## Rotas da API

### Auth (`/api/auth`)
| Método | Rota              | Descrição                                     |
|--------|-------------------|-----------------------------------------------|
| POST   | `/register`       | Cria conta, gera CPF temp, retorna JWT        |
| POST   | `/login`          | Login usuário, seta cookie JWT                |
| POST   | `/admin/login`    | Login admin                                   |
| GET    | `/me`             | Dados do usuário logado                       |
| POST   | `/update-status`  | Heartbeat: seta status=online, last_seen=now  |
| POST   | `/logout`         | Limpa cookie, status offline                  |

### Spin (`/api/spin`)
| Método | Rota              | Descrição                                  |
|--------|-------------------|--------------------------------------------|
| POST   | `/start`          | Roteia para campaign/rollover/normal spin  |
| GET    | `/saldo`          | Retorna saldo atual (demo se influencer)   |
| GET    | `/history`        | Histórico paginado de jogadas              |
| GET    | `/check-rollover` | Status do rollover (isento se participante de campanha) |

### Payment (`/api/payment`)
| Método | Rota                | Descrição                                                   |
|--------|---------------------|-------------------------------------------------------------|
| POST   | `/pix`              | Cria depósito PIX via Simplify                              |
| POST   | `/callback`         | Recebe webhook do gateway (salva na fila)                   |
| POST   | `/process-webhooks` | Cron: processa fila + reconciliação                         |
| GET    | `/status/:id`       | Status do depósito + polling Simplify após 15s              |
| GET    | `/transactions`     | Extrato combinado depósitos+saques (últimos 50)             |
| POST   | `/withdraw`         | Saque com todas as validações                               |
| POST   | `/withdraw-demo`    | Saque de saldo demo (influenciadores/gerentes)              |

### Affiliate (`/api/affiliate`)
| Método | Rota    | Descrição                                                           |
|--------|---------|---------------------------------------------------------------------|
| GET    | `/data` | Stats do afiliado: link, convidados, depositantes, ganhos, commission_type, cpa_value, depositos_completos |

### Manager (`/api/manager`)
| Método | Rota                           | Descrição                         |
|--------|--------------------------------|------------------------------------|
| GET    | `/dashboard`                   | Stats do gerente + totalDep/totalDepFirst por influenciador |
| GET    | `/influencers`                 | Lista influenciadores              |
| POST   | `/influencers`                 | Cria influenciador                 |
| PUT    | `/influencers/:id`             | Edita comissão                     |
| POST   | `/influencers/:id/demo`        | Define saldo demo                  |
| PATCH  | `/influencers/:id/recurring`   | Toggle revshare recorrente         |
| GET    | `/candidates`                  | Usuários da rede do gerente para promoção |
| POST   | `/withdraw`                    | Saque do gerente                   |

### Admin (`/api/admin`)
| Método | Rota                           | Descrição                                    |
|--------|--------------------------------|----------------------------------------------|
| GET    | `/dashboard`                   | Totais gerais                                |
| GET    | `/users`                       | Lista usuários paginado                      |
| GET    | `/users/:id`                   | Detalhes + histórico do usuário              |
| PUT    | `/users/:id`                   | Atualiza perfil (nome, email, senha, status) |
| POST   | `/promote`                     | Todas as ações de promoção (ver abaixo)      |
| GET    | `/campaigns`                   | Lista campanhas ativas e histórico           |
| POST   | `/campaigns`                   | Cria campanha de influenciador               |
| DELETE | `/campaigns/:id`               | Cancela campanha                             |
| GET    | `/withdrawals`                 | Lista saques por status (incluindo refunded/dismissed) |
| PATCH  | `/withdrawals/:id`             | Ações sobre saque (ver abaixo)               |
| GET    | `/settings`                    | Lê todas as configurações                    |
| PUT    | `/settings`                    | Atualiza configurações                       |
| GET    | `/managers`                    | Lista gerentes                               |
| GET    | `/search-users`                | Busca usuário para promoção                  |
| GET    | `/deposits`                    | Lista depósitos paginado + search + dateRange|
| GET    | `/gateway`                     | Lê config Simplify (client_id, split)        |
| PUT    | `/gateway`                     | Atualiza config Simplify                     |
| GET    | `/personalization`             | Lê settings garra_*                          |
| PUT    | `/personalization`             | Atualiza settings garra_*                    |
| GET    | `/machines`                    | Lista máquinas                               |
| POST   | `/machines`                    | Cria máquina                                 |
| PUT    | `/machines/:id`                | Edita máquina                                |
| DELETE | `/machines/:id`                | Remove máquina                               |
| GET    | `/probabilities`               | Lê prob./mult. (normal + influencer)         |
| PUT    | `/probabilities`               | Atualiza prob./mult.                         |
| GET    | `/affiliates`                  | Lista afiliados paginado                     |
| GET    | `/affiliates/:id`              | Detalhes de afiliado + indicados             |
| GET    | `/commission-history`          | Histórico de comissões pagas                 |
| GET    | `/rollover-campaigns`          | Listagem de rollovers com stats              |
| GET    | `/game-history`                | Histórico global de jogadas (paginado, search) |
| GET    | `/webhook-logs`                | Logs da fila de webhooks                     |
| POST   | `/webhook-logs/:id/reprocess`  | Reprocessar item da fila                     |
| POST   | `/verify-withdraw-token`       | Gerar/verificar token de aprovação de saque  |

#### Ações do `POST /api/admin/promote`
| `action`                   | O que faz                                                 |
|----------------------------|-----------------------------------------------------------|
| `promote_to_manager`       | Promove a gerente com pool %                              |
| `promote_to_influencer`    | Promove a influenciador com comissão %                    |
| `link_to_me`               | Gerente reivindica influenciador sem gerente              |
| `remove_influencer`        | Remove status de influenciador                            |
| `update_commission`        | Altera % comissão + commission_type + cpa_value           |
| `add_demo`                 | Define saldo demo de influenciador/gerente                |
| `edit_commission_balance`  | Admin edita saldo/saldo_revshare diretamente              |
| `update_pool`              | Altera pool % do gerente                                  |
| `demote_manager`           | Remove status de gerente                                  |
| `toggle_recurring`         | Toggle revshare_recurring do influenciador                |
| `toggle_manager_recurring` | Toggle manager_recurring + cascade p/ todos influenciadores |
| `credit_deposit`           | Crédito manual com RevShare completo                      |
| `delete_user`              | Exclui usuário (não admin)                                |

#### Ações do `PATCH /api/admin/withdrawals/:id`
| `action`   | Status exigido | O que faz                                                    |
|------------|----------------|--------------------------------------------------------------|
| `approve`  | `pending`      | Verifica token bcrypt → marca `processing` atomicamente → chama `gateway.sendWithdraw()` → salva `simplifyId`. Em falha reverte para `pending`. |
| `reject`   | `pending`      | Marca `rejected` + devolve saldo ao usuário                  |
| `refund`   | `failed`       | Devolve saldo ao usuário + marca `refunded`                  |
| `dismiss`  | `failed`       | Marca `dismissed` sem devolver saldo                         |

---

## Lógica de Negócio Crítica

### 3 Tipos de Spin
1. **Normal** — aleatório ponderado (tabelas `probabilidade` / `multiplicadores`)
2. **Campaign** — spin forçado em direção ao `target_gain`; fases losing→winning
3. **Rollover** — ganho limitado a 30% do depósito; modo drain; fases por progresso

### Prioridade do Spin
```
usuário comum
  ├─ tem CampaignParticipant ativo?  → spinCampaign
  ├─ tem RolloverCampaign ativo?     → spinRollover
  └─ senão                           → spinNormal

influenciador / gerente              → spinNormal (usa saldoDemo)
```

### Fórmula de Comissão (RevShare)
```
Caso 1 — indicado por influenciador:
  influenciador recebe: deposit × (influencerPct / 100)
  gerente recebe:       deposit × ((managerPool - influencerPct) / 100)

Caso 2 — indicado diretamente pelo gerente:
  gerente recebe: deposit × (managerPool / 100)

Recorrência (useFirstOnly):
  useFirstOnly = !managerRecurring || (isInfluencerPath && !referrerRecurring)
  → se true: comissão só no 1º depósito de cada indicado
```

### Tipos de Comissão (`commission_type`)
- `rev` — RevShare percentual (`comissao` %)
- `cpa` — Valor fixo por depositante (`cpa_value` R$)

### Rollover
- Criado automaticamente no **primeiro depósito** do usuário comum
- **Não cria** se usuário já está em campanha de influenciador ativa
- **Não entra** em campanha de influenciador se já tem rollover ativo
- Começa com `phase = 'winning'` (usuário sente vitória desde o início)
- Bloqueia saque enquanto ativo (`rollover_campaigns.status = 'active'`)
- Participantes de campanha (`campaign_participants`) são **isentos** do rollover global
- Quando webhook `withdrawal.cancelled` chega → apenas marca `failed`. Admin decide manualmente: `refund` ou `dismiss`

### onlyFirstDeposit (afiliados)
- Se `manager_recurring = false` no gerente do influenciador → afiliado só processa o primeiro depósito de cada indicado (tanto no cálculo de comissão quanto na listagem `depositos_completos`)

### Sistema de Taxa de Saque (`active_taxwithdraw`)
- Se ativa e o usuário não pagou (`withdraw_tax_paid = false`): gera um PIX de taxa antes de liberar o saque
- Após pagamento: `withdraw_tax_paid = true`, saque liberado

### Auto-Saque (`auto_withdraw_enabled`)
- Se ativo e valor ≤ `auto_withdraw_limit` e usuário elegível por role:
  - Chama `sendWithdraw` no Simplify automaticamente
  - Salva `simplify_id` no registro de saque

### Webhook / Callback
- Recebido em `POST /api/payment/callback`
- Salvo em `webhook_queue` com deduplicação `UNIQUE(event, external_id)`
- Processado pelo cron `POST /api/payment/process-webhooks` (header `x-cron-secret`)
- Polling fallback: `GET /api/payment/status/:id` consulta Simplify direto se pending > 15s
- Reconciliação automática: consulta Simplify para transações órfãs (sem webhook)

### Aprovação de Saque (admin)
- Token de segurança bcrypt armazenado em `settings.withdraw_approval_token`
- Fluxo: admin clica Aprovar → verifica token → `UPDATE SET status='processing' WHERE status='pending'` (atômico) → chama Simplify → salva `simplify_id`
- Se Simplify falhar: reverte para `pending`
- Webhook `withdrawal.paid` → `paid`; `withdrawal.cancelled` → `failed` (sem auto-refund)

---

## Banco de Dados — Modelos Principais

| Tabela                     | Finalidade                                          |
|----------------------------|-----------------------------------------------------|
| `users`                    | Usuários, influenciadores, gerentes (role + flags)  |
| `admins`                   | Administradores do sistema                          |
| `deposits`                 | Depósitos PIX (externalId, qrcode, transactionId)   |
| `withdrawals`              | Saques (walletType, simplifyId, nome, cpf, status)  |
| `game_history`             | Histórico de jogadas                                |
| `affiliate_logs`           | Log de comissões pagas                              |
| `maquinas`                 | Máquinas/slots (campos: cardColor, bgColor, ordem, bannerUrl, fundoUrl, valorUrl, bgUrl) |
| `probabilidade`            | Pesos de ganho para usuários comuns                 |
| `probabilidade_influencer` | Pesos para influenciadores/gerentes                 |
| `multiplicadores`          | Multiplicadores para usuários comuns                |
| `multiplicadores_influencer` | Multiplicadores para influenciadores/gerentes     |
| `settings`                 | Configurações gerais (key/value)                    |
| `influencer_campaigns`     | Campanhas de influenciador com target_gain          |
| `campaign_participants`    | Participantes de cada campanha (phase, netGain)     |
| `rollover_campaigns`       | Rollover por usuário/depósito                       |
| `webhook_queue`            | Fila de webhooks do gateway                         |
| `gateway_config`           | Credenciais + split + isActive da Simplify          |

### Enum `WithdrawalStatus`
`pending` | `approved` | `rejected` | `processing` | `paid` | `failed` | `refunded` | `dismissed`

---

## Settings Importantes (`settings` table)

| Chave                      | Descrição                                          |
|----------------------------|----------------------------------------------------|
| `min_deposit`              | Valor mínimo de depósito (default: 10)             |
| `min_withdrawal`           | Valor mínimo de saque (default: 20)                |
| `rollover_multiplier`      | Multiplicador de rollover (0 = desativado)         |
| `rollover_losses_min`      | Mínimo de perdas consecutivas no rollover          |
| `rollover_losses_max`      | Máximo de perdas consecutivas no rollover          |
| `max_win_common`           | Ganho máximo por jogada (usuário comum)            |
| `consolation_enabled`      | Ativa prêmio de consolação                         |
| `consolation_chance`       | Chance % do prêmio de consolação                   |
| `active_taxwithdraw`       | Ativa taxa de saque (true/false)                   |
| `value_taxwithdraw`        | Valor da taxa de saque                             |
| `auto_withdraw_enabled`    | Ativa auto-saque                                   |
| `auto_withdraw_limit`      | Limite de valor para auto-saque                    |
| `auto_withdraw_roles`      | Roles elegíveis: influencer / manager / both       |
| `openDeposit`              | Abre modal de depósito após registro (true/false)  |
| `withdraw_approval_token`  | Hash bcrypt do token de aprovação manual de saque  |
| `garra_site_name`          | Nome do site                                       |
| `garra_primary_color`      | Cor primária da UI                                 |
| `garra_background_color`   | Cor de fundo                                       |
| `garra_logo_url`           | URL da logo                                        |
| `garra_promo_bar_text`     | Texto da barra promocional                         |
| `garra_support_phone`      | Telefone de suporte                                |
| `garra_support_email`      | Email de suporte                                   |
| `garra_carousel_banners`   | JSON array de URLs dos banners do carrossel        |
| `garra_deposit_modal_first_copy`  | Copy do modal p/ 1º depósito               |
| `garra_deposit_modal_second_copy` | Copy do modal p/ 2º+ depósito              |
| `garra_deposit_modal_copy_color`  | Cor do copy do modal                        |

---

## Estado Atual do Projeto

### ✅ Concluído — Backend (sessões 1–4)
- [x] Setup: Fastify + TypeScript + Prisma 5 + JWT + bcrypt + Zod
- [x] Schema Prisma completo (todos modelos, WithdrawalStatus com refunded/dismissed)
- [x] Auth: registro (CPF temp, openDeposit), login, admin login, logout, /me, update-status
- [x] Spin: normal, campaign, rollover — lógica 100% portada do PHP, baseWin em todos os tipos
- [x] Gateway: wrapper Simplify BR (createDeposit, sendWithdraw, getStatus, reconciliation)
- [x] Payment: PIX com gateway real, callback com validação + deduplicação, cron com reconciliação
- [x] Payment status: polling Simplify como fallback após 15s de pending
- [x] Transactions: endpoint combinado depósitos + saques (últimos 50)
- [x] Withdraw-demo: saque de saldo demo para influenciadores/gerentes
- [x] Withdraw: wallet_type, CPF/telefone, validação PIX por tipo, rollover check, taxa, auto-saque
- [x] RevShare: fórmula correta, caso direto-gerente, controle de recorrência (OR logic idêntico ao PHP)
- [x] processWithdrawal: webhook cancelled → apenas `failed` (sem auto-refund, igual ao PHP)
- [x] Affiliate data: commission_type, cpa_value, depositos_completos, depositantes, onlyFirstDeposit
- [x] Admin: todas as rotas + 13 ações de promote (incluindo delete_user)
- [x] Admin withdrawals: 4 ações (approve→Simplify+token, reject, refund, dismiss)
- [x] Admin deposits: filtros search + startDate + endDate
- [x] Admin affiliates/:id: corrigido para usar deposits[0] (primeiro depósito, não último)
- [x] Admin promote update_commission: agora também atualiza commissionType e cpaValue
- [x] Admin extras: gateway CRUD, personalização garra_*, máquinas CRUD, probabilidades, afiliados, comissões, rollover-campaigns, webhook-logs, reprocessar, verify-withdraw-token, game-history, update user profile
- [x] Manager: dashboard, CRUD influenciadores, set demo, toggle recurring, saque, candidates
- [x] Kwai removido completamente (usa tracking próprio)
- [x] Build sem erros TypeScript (`tsc --noEmit` limpo)
- [x] Server sobe corretamente (`Fastify listening at :3333`)

### 🔲 Próximo — Backend
- [ ] Migração Prisma: gerar migration SQL para produção (`WithdrawalStatus` ganhou `refunded` e `dismissed`; `kwai_pixels` removida)

### ✅ Concluído — Frontend (sessão 5)
- [x] Next.js 15 App Router + TypeScript + Tailwind v4 + Google Fonts (Press Start 2P + Inter)
- [x] Design system completo em globals.css (CSS vars garra + admin, todos os componentes)
- [x] API client centralizado (lib/api.ts) — 50+ endpoints, interfaces TypeScript completas
- [x] AppProvider (React Context) — user, settings, openModal, refreshUser, heartbeat 60s
- [x] ToastProvider — auto-dismiss 3.5s, max 4, tipos success/error/info
- [x] Header — CSS vars de settings, perfil, saldo, bar promocional, variante game page
- [x] AuthModal — login + registro com ?ref=, abre DepositModal se openDeposit=true
- [x] DepositModal — PIX + QR code + polling 5s + chips rápidos + campo CPF condicional
- [x] WithdrawModal — real/demo toggle, rollover notice, validações PIX
- [x] ProfileModal, HistoryModal, AffiliateModal, ModalHub
- [x] Home page — carrossel rotativo 5s, grid de máquinas, winners (fake data = PHP), footer
- [x] Game page /jogo/[id] — animação da garra (hover/drop/grab/rise), result modal 4 fases, countUp, bonus wheel, sons, teclas Space/Esc
- [x] Admin panel — 15 páginas (dashboard, saques 4 ações, depósitos, usuários, máquinas, settings, personalização, gateway, afiliados+detalhe, campanhas, histórico, webhooks, rollover, comissões, gerentes)
- [x] Manager panel — dashboard + CRUD influenciadores + saque gerente
- [x] Build limpo: `tsc --noEmit` sem erros + `npm run build` 21 rotas, exit 0

### 🔲 Próximo
- [ ] Migração Prisma: gerar migration SQL para produção (`WithdrawalStatus` ganhou `refunded` e `dismissed`; `kwai_pixels` removida)
- [ ] Copiar assets do PHP (`garra/assets/`) para `frontend/public/assets/` (sons, imagens da garra)
- [ ] Testar integração frontend ↔ backend com backend rodando localmente

---

## Referência — Sistema Original (PHP)

| Arquivo PHP                           | Equivalente TypeScript                                     |
|---------------------------------------|-----------------------------------------------------------|
| `garra/api/auth.php`                  | `src/modules/auth/auth.routes.ts`                         |
| `garra/api/start_spin.php`            | `src/modules/spin/spin.routes.ts`                         |
| `garra/api/spin_lib.php`              | `src/modules/spin/spin.service.ts`                        |
| `garra/api/campaign_spin.php`         | `src/modules/spin/spin.service.ts:spinCampaign`           |
| `garra/api/rollover_spin.php`         | `src/modules/spin/spin.service.ts:spinRollover`           |
| `garra/api/payment.php`              | `src/modules/payment/payment.routes.ts` POST /pix         |
| `garra/api/withdraw.php`             | `src/modules/payment/payment.routes.ts` POST /withdraw    |
| `garra/api/withdraw_demo.php`        | `src/modules/payment/payment.routes.ts` POST /withdraw-demo |
| `garra/api/callback.php`             | `src/modules/payment/payment.routes.ts` POST /callback    |
| `garra/api/check_payment_status.php` | `src/modules/payment/payment.routes.ts` GET /status/:id   |
| `garra/api/get_transactions.php`     | `src/modules/payment/payment.routes.ts` GET /transactions  |
| `garra/api/cron_process_webhooks.php`| `src/modules/payment/payment.routes.ts` POST /process-webhooks |
| `garra/api/gerapix.php`              | `src/lib/gateway.service.ts`                              |
| `garra/api/kwai_helper.php`          | ~~removido~~ (usa tracking próprio)                       |
| `garra/api/get_affiliate_data.php`   | `src/modules/affiliate/affiliate.routes.ts` GET /data     |
| `garra/api/get_manager_data.php`     | `src/modules/manager/manager.routes.ts` GET /dashboard    |
| `garra/api/get_manager_candidates.php` | `src/modules/manager/manager.routes.ts` GET /candidates  |
| `garra/api/promote_user.php`         | `src/modules/admin/admin.routes.ts` POST /promote         |
| `garra/api/search_users.php`         | `src/modules/admin/admin.routes.ts` GET /search-users     |
| `garra/admin/gateway.php`            | `src/modules/admin/admin.routes.ts` GET+PUT /gateway      |
| `garra/admin/kwai_config.php`        | ~~removido~~ (usa tracking próprio)                       |
| `garra/admin/maquinas.php`           | `src/modules/admin/admin.routes.ts` /machines + /personalization + /probabilities |
| `garra/admin/withdrawals.php`        | `src/modules/admin/admin.routes.ts` GET+PATCH /withdrawals |
| `garra/admin/verify_withdraw_token.php` | `src/modules/admin/admin.routes.ts` POST /verify-withdraw-token |
| `garra/admin/rollover_campaigns.php` | `src/modules/admin/admin.routes.ts` GET /rollover-campaigns |
| `garra/admin/affiliates.php`         | `src/modules/admin/admin.routes.ts` GET /affiliates       |
| `garra/admin/affiliate_details.php`  | `src/modules/admin/admin.routes.ts` GET /affiliates/:id   |
| `garra/admin/commission_history.php` | `src/modules/admin/admin.routes.ts` GET /commission-history |
| `garra/admin/webhook_logs.php`       | `src/modules/admin/admin.routes.ts` GET /webhook-logs     |
| `garra/admin/game_history.php`       | `src/modules/admin/admin.routes.ts` GET /game-history     |
| `garra/admin/user_details.php`       | `src/modules/admin/admin.routes.ts` GET /users/:id + PUT /users/:id |
| `garra/admin/campanhas.php`          | `src/modules/admin/admin.routes.ts` /campaigns            |
| `garra/admin/managers.php`           | `src/modules/admin/admin.routes.ts` /managers             |
| `garra/admin/settings.php`           | `src/modules/admin/admin.routes.ts` /settings             |
| `garra/admin/deposits.php`           | `src/modules/admin/admin.routes.ts` GET /deposits         |
| `garra/admin/users.php`              | `src/modules/admin/admin.routes.ts` GET /users + POST /promote |
| `garra/db.php`                       | `src/lib/prisma.ts` + `.env`                              |
| `garra/visitas/visitasapi.php`       | `src/modules/auth/auth.routes.ts` POST /update-status     |
| `garra/includes/personalization.php` | `src/modules/admin/admin.routes.ts` GET /personalization  |

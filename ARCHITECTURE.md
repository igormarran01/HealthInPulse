# Arquitetura — HealthInPulse v7

Como o sistema está montado: camadas, fluxos críticos, modelo de dados, design
system e decisões técnicas que sustentam o demo.

---

## Visão de alto nível

```
┌─────────────────────────────────────────────────────────────────────┐
│  Navegador                                                          │
│  ┌─────────────────┐         ┌────────────────────┐                 │
│  │  Vite/React     │ HTTP    │  AuthContext       │                 │
│  │  + Tailwind     │◄────────┤  SocketContext     │                 │
│  │  + Recharts     │  REST   │  hooks + services  │                 │
│  └────────┬────────┘         └────────────────────┘                 │
└───────────┼─────────────────────────────────────────────────────────┘
            │ /api/*  /uploads/*   (proxy Vite ⇒ :3000)
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Express  (porta 3000)                                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  middlewares: helmet · cors · morgan · rate-limit (prod)     │   │
│  │              · auth (JWT) · validation · error handler      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  routes ──► controllers ──► services ──► Prisma Client ──► SQLite   │
│                                  │                                  │
│                                  └─► openaiService                  │
│                                       ├─ HAS_KEY ? GPT-4o           │
│                                       └─ else: aiSimulator (local)  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Camadas do backend

A pasta `backend/src/` segue a separação clássica em 4 camadas com **regra
estrita**: a camada superior só pode chamar a camada imediatamente abaixo.

| Camada            | Responsabilidade                                               | Pasta                |
|-------------------|----------------------------------------------------------------|----------------------|
| **Routes**        | declarar HTTP paths, validation rules, role guards             | `routes/`            |
| **Controllers**   | extrair input do `req`, despachar para service, formatar `res` | `controllers/`       |
| **Services**      | regras de negócio puras (não conhecem HTTP)                    | `services/`          |
| **Data**          | Prisma Client + utilitários de serialização JSON               | `config/database.js`, `utils/jsonField.js` |

Algumas rotas pequenas (gamificação, recompensas, notificações, wearable,
appointments, ai-reports) usam **route-as-controller** — o handler fica no
arquivo de rotas direto, sem controller separado. É consciente: o controller só
faria delega + tratamento de erro repetitivo.

### Convenções importantes

- **Erros como objetos**: services lançam `throw Object.assign(new Error('...'), { status: 404 })`. O `errorMiddleware` no fim da chain captura e devolve o status correto.
- **Transações Prisma**: usadas em qualquer operação que envolva crédito/débito
  de coins, conclusão de meta, ou resgate de recompensa — evitam saldo
  inconsistente. Veja `coinService.credit/debit` e `rewardService.redeem`.
- **Paginação coercida**: todo endpoint que aceita `?page=&limit=` passa por
  `Number(page)` / `Number(limit)` antes de chegar no Prisma (que é
  estrito-de-tipo a partir da v5).

### Serviços (`backend/src/services/`)

| Service           | Responsabilidade                                                    |
|-------------------|---------------------------------------------------------------------|
| `authService`     | register/login/refresh/logout/changePassword + auditoria            |
| `patientService`  | perfil + sinais vitais + dashboard (com 30d de tendência)           |
| `doctorService`   | perfil + pacientes vinculados + dashboard + consolidated + history  |
| `examService`     | upload + processamento async (OCR + IA) + listagem                  |
| `triageService`   | banco de perguntas + submit + análise async + geração de metas      |
| `goalService`     | CRUD de metas + cálculo de progresso + geração via triagem          |
| `coinService`     | credit/debit/balance/history (sempre em transação)                  |
| `rewardService`   | catálogo + redeem (transacional)                                    |
| `openaiService`   | wrapper que escolhe entre GPT-4o e simulador local                  |
| `aiSimulator`     | análise local determinística (keywords) com suporte a `INCONCLUSIVE`|

### Rotas registradas (`app.js`)

```
/api/auth          → register, login, refresh, logout, me, change-password
/api/patient       → perfil + sinais vitais + dashboard do paciente
/api/doctor        → perfil + pacientes + dashboard + consolidated + history
/api/exams         → upload + listagem + acesso médico
/api/triage        → questions + submit + history + getOne
/api/notifications → list + unread-count + markRead + markAllRead
/api/ai-reports    → list/get (paciente) + generate/get (médico)
/api/appointments  → create + list + updateStatus
/api/wearables     → devices CRUD + ingest + history  (legacy, ainda exposto)
/api/goals         → CRUD + updateProgress + coins/balance + coins/transactions
/api/rewards       → list + redeem + my/redemptions
/health            → health check
```

---

## Frontend

### Camadas

```
main.jsx
  └─ <AuthProvider>            ← guarda user + healthCoins, expõe login/logout/refreshCoins
       └─ <SocketProvider>     ← Socket.io client (autenticado via JWT)
            └─ <BrowserRouter>
                 └─ <AppRoutes>        ← lazy load + Guards por role
                      ├─ <PublicRoute>  → Login / Register
                      ├─ <RoleRoute role="PATIENT">  → PatientLayout
                      └─ <RoleRoute role="DOCTOR">   → DoctorLayout
                                                       (Outlet → cada página)
```

### Contextos

- **`AuthContext`**: estado global do usuário logado. Persiste `accessToken` e
  `refreshToken` em `localStorage`; chama `/auth/me` no mount. Expõe
  `refreshCoins()` para atualizar o saldo após resgate/meta concluída.
- **`SocketContext`**: conecta Socket.io autenticado com o JWT atual. Embora os
  emits do backend existam, **nenhuma página consome o socket** hoje — a
  pulseira é simulada no frontend (ver `useLiveVitals`). Fica pronto para o
  futuro evoluir pra dados realmente em tempo real entre paciente↔médico.

### Hooks customizados (`src/hooks/`)

| Hook              | Função                                                                |
|-------------------|-----------------------------------------------------------------------|
| `useFetch(fn, deps)` | Wrapper sobre Promise: loading/error/data/refetch                  |
| `useAsync(fn)`       | Wrapper imperativo: `await run(args)` com loading/error            |
| `useDebounce(v, ms)` | Debounce simples (usado na busca de pacientes)                     |
| `useLocalStorage(k)` | Persiste estado em localStorage                                    |
| `useLiveVitals`      | **Simulador da pulseira Care Plus** — gera leitura a cada 1s        |
| `useCountUp`         | Interpola animadamente entre valores (números nos cards de vitais) |

### Páginas

```
src/pages/
├── auth/
│   ├── LoginPage.jsx        ← 3 cards demo + form clássico
│   └── RegisterPage.jsx     ← cadastro role-aware (paciente/médico)
├── patient/
│   ├── Dashboard.jsx        ← hero + score animado + 5 vitais + gráficos 30d
│   ├── Goals.jsx            ← metas com barras de progresso + confetti
│   ├── Rewards.jsx          ← loja Care Plus (catálogo + meus resgates)
│   ├── Exams.jsx            ← upload + lista com status async
│   ├── Triage.jsx           ← wizard de 10 perguntas + resultado IA
│   ├── Reports.jsx          ← lista de relatórios IA + modal
│   ├── Appointments.jsx     ← lista de consultas
│   └── Profile.jsx
├── doctor/
│   ├── Dashboard.jsx        ← KPIs + donut de risco + bar 7d + pacientes em alerta
│   ├── Patients.jsx         ← lista filtrada da médica (sem botão "Vincular")
│   ├── PatientDetail.jsx    ← detalhe clínico + gráfico FC
│   ├── Wearable.jsx         ← seletor + consolidado dos últimos dados
│   ├── Reports.jsx          ← seletor + síntese IA + gerar nova
│   ├── History.jsx          ← seletor + timeline filtrada por tipo
│   ├── Appointments.jsx     ← agenda + ações (confirmar/cancelar/concluir)
│   ├── Reference.jsx        ← Base Clínica (do livro de fisiologia)
│   ├── Profile.jsx
│   └── PatientSelector.jsx  ← componente shared para Wearable/Reports/History
```

---

## Fluxos críticos

### 1. Login + refresh token

```
LoginPage → AuthContext.login(email, pass)
            └─ POST /api/auth/login
                 └─ authService.login
                      ├─ bcrypt.compare
                      ├─ AuditLog (LOGIN)
                      └─ issueTokenPair  → grava RefreshToken (7d)
            ◄── { user, accessToken, refreshToken }
            ├─ localStorage.setItem(accessToken)
            ├─ localStorage.setItem(refreshToken)
            └─ setUser(user)  ← inclui healthCoins se for paciente
```

Quando uma chamada autenticada retorna **401**, o axios interceptor
(`services/api.js`) faz refresh transparente:

```
api.request --401-→ interceptor
                    ├─ enfileira chamadas concorrentes
                    ├─ POST /api/auth/refresh { refreshToken }
                    │     └─ rotaciona: deleta o antigo, cria novo par
                    ├─ atualiza accessToken/refreshToken no localStorage
                    └─ reenvia todas as chamadas enfileiradas
```

### 2. Pulseira Care Plus (live vitals)

A pulseira é **simulada no frontend**, não há hardware ou Bluetooth.

```
PatientDashboard
  └─ useLiveVitals(initialVitals, initialTrend)
       └─ setInterval(1000ms):
            └─ next(prev, baseline, jitter, min, max)
                 ├─ drift  = (baseline - prev) * 0.06   ← reversão à média
                 └─ noise  = ±jitter                     ← ruído controlado
       ↳ retorna { current, spark[30] }                 ← janela deslizante
```

- **Baseline** vem do `latestVital` real do paciente no banco. Para o João
  (caso grave), parte de PA ~148/94, glicemia ~186, SpO₂ 93. Para Marina, parte
  de valores normais-limítrofes.
- **Min/max** acomodam casos extremos: SpO₂ aceita 88-100, glicemia 75-230,
  sistólica 95-175.
- Cada tick avança o `recordedAt` e empurra um ponto na janela de 30 leituras
  → atualiza os sparklines em tempo real.
- `useCountUp` interpola os números mostrados (700ms, ease-out) para a UI ficar
  fluida sem saltos.

Os **gráficos grandes de 30 dias** (PA + glicose) não são "live" — usam dados
históricos persistidos no banco. Coerente: histórico não muda a cada segundo.

### 3. Triagem com IA (com fallback)

```
PatientTriage submit(answers)
  └─ POST /api/triage  { answers: [{questionId, answer}, ...] }
       └─ triageService.submitTriage
            ├─ cria TriageAnswer status=IN_PROGRESS
            └─ processTriageAnalysis (async, não bloqueia)
                 ├─ openaiService.analyzeTriageAnswers
                 │   ├─ HAS_KEY? → GPT-4o
                 │   └─ else    → aiSimulator (keywords + heurística)
                 ├─ atualiza TriageAnswer: COMPLETED + riskLevel + score
                 ├─ cria AiReport (type=triage)
                 ├─ goalService.generateGoalsFromTriage  ← cria 4-5 metas
                 ├─ coinService.credit +20 (bônus triagem)
                 └─ Socket.io emit triage:completed
       ◄── 202 { triage }

PatientTriage então faz polling a /api/triage/:id até riskLevel ficar setado
(até 10 tentativas com 800ms) → mostra modal de resultado com confetti.
```

O simulador local **distingue** 4 níveis de risco:
- `LOW`     — sem queixas relevantes
- `MODERATE` — sintomas comuns (febre, náusea, dor de cabeça)
- `HIGH`    — sinais de alarme (dor no peito, falta de ar grave)
- `INCONCLUSIVE` — respostas insuficientes / texto curto demais

Quando `INCONCLUSIVE`, a UI mostra mensagem amigável e a meta gerada é
"refazer triagem em 7 dias".

### 4. Gamificação (metas → coins → recompensas)

```
Meta atualizada (PATCH /api/goals/:id/progress)
  └─ goalService.updateProgress
       ├─ computeProgress(current)  ← lógica por targetCmp (lte/gte/between)
       ├─ se progress === 100 e status === ACTIVE
       │   ├─ goal.status = DONE
       │   └─ coinService.credit(coinsReward)   ← em transação
       └─ retorna { goal, justCompleted: true }
        ↳ frontend: confetti + toast + refreshCoins()

Resgate de recompensa (POST /api/rewards/:id/redeem)
  └─ rewardService.redeem  (Prisma $transaction)
       ├─ valida saldo
       ├─ cria RewardRedemption (status=PENDING)
       ├─ cria HealthCoinTx delta=-costCoins
       └─ Patient.healthCoins -= costCoins
        ↳ frontend: confetti + atualiza saldo + entra em "Meus resgates"
```

O **saldo desnormalizado** (`Patient.healthCoins`) é a fonte de verdade para
leitura rápida. A integridade é mantida pela atomicidade das transações que
incluem tanto a `HealthCoinTx` quanto o `update` do paciente.

### 5. Painel do médico — consolidado e histórico

```
DoctorWearable / DoctorReports / DoctorHistory
  └─ PatientSelector (dropdown persistido em localStorage)
       └─ doctorService.getConsolidated(patientId)  → bundle de 30d
       │   └─ assertLink → 403 se não vinculado
       └─ doctorService.getHistory(patientId)       → linha do tempo
           └─ agrega: appointments + exams + aiReports + goals DONE +
                      triages + notifications ALERT/CRITICAL
              ordenado por data desc, agrupado por dia no frontend
```

---

## Modelo de dados

Diagrama lógico (relações 1:n omitidas para facilitar leitura):

```
User ─┬─ 1:1 ─ Patient ─┬─ 1:n ─ VitalSign
      │                  ├─ 1:n ─ Exam ─ 1:1 ─ ExamResult
      │                  ├─ 1:n ─ TriageAnswer ─ 1:1 ─ AiReport
      │                  ├─ 1:n ─ AiReport
      │                  ├─ 1:n ─ Device ─ 1:n ─ WearableData
      │                  ├─ 1:n ─ Appointment
      │                  ├─ 1:n ─ HealthGoal
      │                  ├─ 1:n ─ HealthCoinTx
      │                  ├─ 1:n ─ RewardRedemption
      │                  └─ n:m ─ Doctor       (via DoctorPatient)
      ├─ 1:1 ─ Doctor
      ├─ 1:n ─ Notification
      ├─ 1:n ─ AuditLog
      └─ 1:n ─ RefreshToken

Reward ─ 1:n ─ RewardRedemption
```

### Particularidades do SQLite

O Prisma **não suporta enums nem `Json` nativos em SQLite**. Para destravar o
projeto sem mudar de banco, fizemos:

- Enums (`Role`, `RiskLevel`, `ExamStatus`, etc.) viraram **`String`** com
  validação no service.
- Arrays e Json (`Patient.allergies`, `ExamResult.findings`, `TriageAnswer.answers`,
  `AiReport.suggestions`, `Notification.metadata`, `WearableData.payload`)
  viraram **`String`** com JSON serializado.
- Os helpers em `backend/src/utils/jsonField.js` fazem `JSON.stringify` na
  escrita e `JSON.parse` na leitura, retornando para o frontend os arrays e
  objetos esperados.

---

## Tema / design system

### Paleta Care Plus

Definida em `frontend/tailwind.config.js`:

```
brand   (azul navy corporativo)
  brand-50  #eef4fa  brand-100 #d4e3f1  ... brand-700 #003F7E ← primary
accent  (ciano de destaque — links, hover, indicador "ao vivo")
  accent-50 #e6f7fd  accent-500 #00A0DC
surface (cinzas / fundos)
  surface-50 #F7F9FC ← bg geral
  surface-900 #0F172A ← texto
```

### Classes utilitárias (`frontend/src/index.css`)

- `.glass` — card branco com borda + sombra suave (substitui o antigo "glass"
  escuro do dark theme original)
- `.card-hover` — interação de hover (lift + sombra)
- `.btn-primary` — botão azul navy Care Plus
- `.btn-accent` — botão ciano
- `.btn-ghost` — botão transparente
- `.input` / `.label` — formulários
- `.badge-{low,moderate,high,critical}` — badges de risco clínico
- `.live-dot` — indicador pulsante ciano (pulseira em tempo real)

### Animações

Definidas no Tailwind: `fade-in`, `slide-up`, `pulse-ring`. Usadas em entradas
de página, modais e cards "ao vivo".

---

## Decisões arquiteturais relevantes

| Decisão                                | Por quê                                                              |
|----------------------------------------|----------------------------------------------------------------------|
| **SQLite em arquivo**                  | Demo acadêmico — zero dependência externa. Schema usa String para enums/Json. |
| **Pulseira simulada no front**         | Sem hardware. Determinístico ao baseline do paciente, sem latência. |
| **Fallback de IA local**               | Apresentação offline. O sistema funciona sem OpenAI key.            |
| **Saldo de coins desnormalizado**      | Performance de leitura. Integridade via transações.                 |
| **Route-as-controller** em alguns módulos | Casos pequenos não merecem 3 arquivos.                            |
| **Hooks no topo do componente**        | Regras do React. Aprendido na marra com 2 incidentes de tela branca. |
| **Polling após submit de triagem**     | Análise IA é async (200ms-2s). Polling simples evita complicar com socket. |

---

## Onde olhar para entender uma feature

| Quero entender...                       | Comece por...                                              |
|-----------------------------------------|------------------------------------------------------------|
| Como o login funciona ponta-a-ponta     | `services/index.js` → `services/authService.js`            |
| A pulseira em tempo real                | `hooks/useLiveVitals.js`                                   |
| Como uma meta é concluída e coins entram| `services/goalService.js::updateProgress`                  |
| Como a triagem gera metas               | `services/triageService.js::processTriageAnalysis`         |
| A linha do tempo do paciente            | `services/doctorService.js::getPatientHistory`             |
| O design system                         | `frontend/tailwind.config.js` + `frontend/src/index.css`   |
| As referências clínicas                 | `frontend/src/pages/doctor/Reference.jsx` + `Docs/*.docx`  |

Para regras clínicas detalhadas, veja **[BUSINESS_RULES.md](./BUSINESS_RULES.md)**.

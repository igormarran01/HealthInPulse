# Regras de negócio — Backend HealthInPulse v7

Este documento descreve em detalhes **todas** as regras de negócio
implementadas hoje no backend, organizadas por domínio. Sempre que possível
referencia o arquivo/função responsável.

---

## 1. Autenticação e autorização

### 1.1 Cadastro (`POST /api/auth/register`)

Implementado em `services/authService.js::register`.

- E-mail deve ser único (HTTP 409 se existir).
- Senha mínima de **8 caracteres** (validado em `routes/authRoutes.js`).
- Role aceita **`PATIENT`** ou **`DOCTOR`** apenas (admin não é criado via API).
- Senha é guardada como hash bcrypt com **12 rounds**.
- O perfil específico (`Patient` ou `Doctor`) é criado em **transação única**
  junto com o `User`.
- Imediatamente após cadastrar, o backend emite o par de tokens — o usuário já
  sai logado.

### 1.2 Login (`POST /api/auth/login`)

- E-mail e senha são obrigatórios.
- Usuário precisa estar com `isActive=true`.
- Comparação de senha via `bcrypt.compare`.
- **Em todo login bem-sucedido**: registra um `AuditLog` com `action='LOGIN'`.
- Devolve `{ user, accessToken, refreshToken }` — `user.fullName` e
  `user.healthCoins` (paciente) já incluídos.

### 1.3 Tokens JWT

- **Access token**: validade **15 minutos** (configurável via `JWT_ACCESS_EXPIRY`).
- **Refresh token**: validade **7 dias** (`JWT_REFRESH_EXPIRY`), persistido em
  `RefreshToken` no banco.
- **Rotação de refresh**: a cada `POST /api/auth/refresh`, o token apresentado
  é **deletado** e um novo par é emitido. Reuso de refresh token é
  automaticamente bloqueado.
- Mudança de senha (`POST /api/auth/change-password`) **invalida TODOS** os
  refresh tokens do usuário, forçando login novamente em todos os dispositivos.

### 1.4 Autorização por role

Middleware `authorize('PATIENT')` ou `authorize('DOCTOR')` em
`middlewares/authMiddleware.js`. Aplicado prefixo-a-prefixo em rotas:

- `/api/patient/*` → só `PATIENT`
- `/api/doctor/*`  → só `DOCTOR`
- `/api/goals/*`   → só `PATIENT`
- `/api/rewards/*` → só `PATIENT`
- `/api/triage/*`  → só `PATIENT`
- `/api/exams`     → upload e gestão por `PATIENT`; leitura específica por `DOCTOR`
- `/api/auth/me`   → qualquer autenticado

### 1.5 Vínculo médico↔paciente

Tabela `DoctorPatient` (relação n:m). **Regras**:

- Apenas pacientes vinculados aparecem em `GET /api/doctor/patients`.
- Toda rota do médico que acessa dados de um paciente específico chama
  `assertLink(doctorId, patientId)` no `doctorService.js`. Se não houver
  vínculo, retorna **HTTP 403 "Paciente não vinculado"**.
- Em produção, o vínculo seria criado quando o paciente compartilha código de
  convite com o médico. **No demo, os 2 pacientes são pré-vinculados via
  seed**. O endpoint `POST /api/doctor/patients` ainda existe mas não tem mais
  UI exposta.

### 1.6 Rate-limit

Em **produção** (`NODE_ENV=production`), o endpoint `/api/auth` aceita
no máximo **30 tentativas em 15 minutos** por IP. Em desenvolvimento, fica
**desativado** para facilitar testes manuais (definido em `src/app.js`).

---

## 2. Pacientes e sinais vitais

### 2.1 Estrutura do perfil

`Patient` tem campos cadastrais (CPF único, data de nascimento, sexo, tipo
sanguíneo, altura, peso), contato de emergência e os arrays JSON-serializados:

- **`allergies`** — lista de strings (ex: `["Penicilina", "Dipirona"]`)
- **`chronicConds`** — condições crônicas (ex: `["Hipertensão", "DM2"]`)

Esses arrays são desserializados automaticamente quando saem da API (via
`utils/jsonField.js::parsePatient`).

### 2.2 Faixas normais (base clínica)

Definidas no frontend em `pages/patient/Dashboard.jsx` (constante `RANGES`) e
documentadas em `pages/doctor/Reference.jsx`. **Origem**: livro de fisiologia
do projeto (ver `Docs/Dados do Livro.docx`).

| Vital              | Normal           | Atenção              |
|--------------------|------------------|----------------------|
| Frequência cardíaca| 60–100 bpm       | <60 bradi · >100 taqui |
| Pressão sistólica  | 90–130 mmHg      | >130 limítrofe       |
| SpO₂               | 95–99%           | <95% atenção         |
| Temperatura        | 35,8–37,3 °C     | ≥37,5 °C febre       |
| Glicose            | 70–110 mg/dL     | >130 atenção         |

> Esses limites são usados para classificar status de cada vital ("normal /
> acima / abaixo") e para calcular o **score de saúde** do paciente.

### 2.3 Score de saúde (Dashboard do paciente)

Calculado em runtime no frontend:

```
score = (vitais dentro da faixa / vitais lidos) * 100, arredondado
```

Categorias:
- `>= 80` → "Bom estado" (verde)
- `>= 60` → "Atenção" (âmbar)
- `<  60` → "Crítico" (vermelho)
- sem dados → "—"

O score recalcula automaticamente a cada tick da pulseira (1s).

### 2.4 Pulseira simulada

`hooks/useLiveVitals.js` gera leituras 1×/s. **Regras**:

- Cada vital tem `baseline` (vem do último vital real do banco), `jitter`
  (amplitude do ruído) e `[min, max]` (clamp absoluto).
- Cada tick: `next = clamp(prev + drift(baseline) + noise, min, max)`
  com **drift = 6% em direção ao baseline** (reversão à média).
- Os números **não fogem da fisiologia** mesmo após muitos ticks.
- A janela deslizante (`spark`) mantém as últimas 30 leituras para
  alimentar os sparklines dos cards.

### 2.5 Sinais vitais persistidos (`VitalSign`)

- Pode ter origem `manual` (registro pelo paciente) ou `wearable` (pulseira).
- Campos opcionais: HR, sistólica, diastólica, SpO₂, temperatura, glicose, peso, freq. respiratória.
- Indexado por `(patientId, recordedAt)` para queries rápidas de tendência.

> No demo, a tela de "Sinais Vitais" foi **removida** da navegação do paciente
> porque os dados chegam via pulseira. Os endpoints continuam existindo para
> ingestão programática (`/api/wearables/ingest`).

---

## 3. Exames

### 3.1 Upload (`POST /api/exams`)

- Tipo aceito: **PDF**, **JPEG**, **PNG**, **WebP**.
- Tamanho máximo: **10 MB**.
- Arquivo salvo em `backend/src/uploads/exams/`.
- Status inicial: `PENDING` → muda para `PROCESSING` ao iniciar análise.
- Processamento é **assíncrono**: responde 202 imediatamente, IA roda em
  background.

### 3.2 Análise pela IA

`services/examService.js::processExam`:

1. Lê arquivo, codifica em base64.
2. Chama `openaiService.analyzeExam`:
   - Com `OPENAI_API_KEY` → GPT-4o-vision com prompt estruturado retornando JSON.
   - Sem chave → retorna placeholder com `riskLevel='INCONCLUSIVE'`.
3. Persiste `ExamResult` (summary, findings JSON, riskLevel).
4. Atualiza `Exam.status='DONE'` (ou `ERROR` em caso de falha).
5. Emite Socket.io `exam:processed`.

### 3.3 Acesso

- **Paciente** vê só seus próprios exames (`/api/exams`).
- **Médico** acessa `/api/exams/doctor/:examId` — exige vínculo com o paciente
  dono do exame (HTTP 403 caso contrário).

---

## 4. Triagem e IA

### 4.1 Banco de perguntas

Lista estática em `services/triageService.js`:

| ID  | Pergunta                                        | Tipo                |
|-----|--------------------------------------------------|---------------------|
| q1  | Qual é a sua queixa principal hoje?              | text                |
| q2  | Há quanto tempo está com esse sintoma?           | select (4 opções)   |
| q3  | Intensidade da dor/desconforto (0-10)            | scale 0-10          |
| q4  | Está com febre?                                  | boolean             |
| q5  | Está com falta de ar?                            | boolean             |
| q6  | Apresenta dor no peito?                          | boolean             |
| q7  | Tem náusea ou vômito?                            | boolean             |
| q8  | Tem alguma doença crônica relevante?             | text                |
| q9  | Está tomando alguma medicação?                   | text                |
| q10 | Tem alergia a algum medicamento?                 | text                |

### 4.2 Fluxo de submissão

`POST /api/triage` com `{ answers: [{questionId, answer}, ...] }`:

1. Cria `TriageAnswer` com `status='IN_PROGRESS'`.
2. Dispara `processTriageAnalysis` em **background** (não bloqueia resposta).
3. Retorna **HTTP 202** com o registro inicial.

Em paralelo, no background:

4. `openaiService.analyzeTriageAnswers` retorna `{ riskLevel, score, summary, suggestions, urgency }`.
5. `TriageAnswer.status='COMPLETED'`, `riskLevel` e `score` preenchidos.
6. Cria `AiReport` (type=`triage`) com summary e suggestions.
7. **Gera metas automaticamente** via `goalService.generateGoalsFromTriage` (ver §5).
8. Credita **+20 health-coins** pelo bônus de triagem.
9. Emite Socket.io `triage:completed` (e `triage:alert` para médicos se risco HIGH/CRITICAL).

### 4.3 Níveis de risco

| Nível          | Quando ocorre (simulador local)                              | Score      |
|----------------|---------------------------------------------------------------|------------|
| `LOW`          | Sem queixas relevantes ou apenas estado normal                | 15–35      |
| `MODERATE`     | Sintomas comuns: febre, náusea, dor de cabeça, fadiga         | 45–70      |
| `HIGH`         | Sinais de alarme: dor no peito, falta de ar grave, paralisia  | 78–90      |
| `CRITICAL`     | (reservado para emergências graves — produção pode usar mais granular) | — |
| `INCONCLUSIVE` | Resposta vazia ou muito curta (< 8 chars somando tudo)         | `null`     |

Com `OPENAI_API_KEY` configurada, o GPT-4o tem maior nuance, mas o contrato
de saída é o mesmo (validamos os 4-5 níveis aceitos).

### 4.4 Simulador local de IA

Implementado em `services/aiSimulator.js`. **Estratégia**:

1. **Concatena** todas as respostas em uma string lowercase.
2. **Bandeira vermelha** (sintomas críticos):
   - `dor no peito`, `dor de peito`, `pressão no peito`
   - `falta de ar grave`, `dispneia`, `sufoco`
   - `sangramento`, `tontura forte`, `desmaio`
   - `paralisia`, `fala enrolada`
3. **Bandeira amarela** (sintomas comuns):
   - `febre`, `náusea`, `vômito`, `tontura`
   - `dor de cabeça`, `cefaleia`, `fraqueza`
   - `cansaço`, `fadiga`, `palpitação`
4. Se texto for muito curto (< 8 chars) → `INCONCLUSIVE`.
5. Sem nenhuma das bandeiras → `LOW`.
6. Score, sugestões e urgência são gerados em função do nível.

### 4.5 Sugestões geradas

| Nível        | Sugestões padrão                                                  |
|--------------|-------------------------------------------------------------------|
| `HIGH`       | Procurar atendimento em 24h · pronto-socorro se piorar · manter pulseira |
| `MODERATE`   | Agendar consulta em 7 dias · hidratação e descanso · acompanhar pulseira |
| `LOW`        | Sinais normais · manter rotina e hábitos saudáveis                |
| `INCONCLUSIVE` | Refazer triagem em 3–7 dias · continuar monitorando              |

---

## 5. Gamificação

### 5.1 Metas de saúde (`HealthGoal`)

- Cada meta tem um **`metric`** (`heartRate`, `systolic`, `glucose`, `weight`,
  `steps`, `spo2` ou `custom`) e um **`targetCmp`** (`lte`, `gte`, `between`).
- Combinações típicas:
  - "Reduzir glicemia" → `metric='glucose'`, `targetCmp='lte'`, `targetValue=130`
  - "Caminhar 7000 passos" → `metric='steps'`, `targetCmp='gte'`, `targetValue=7000`
  - "Dormir 7-9h" → `metric='custom'`, `targetCmp='between'`, `rangeMin=7`, `rangeMax=9`
- **`progress`** (0–100) é calculado por `goalService.computeProgress`:
  - `lte`: progresso é proporcional à distância percorrida do baseline (rangeMax) até o target.
  - `gte`: idem, mas crescendo.
  - `between`: cheio quando está na faixa; cai proporcionalmente à distância do centro.
- **`status`**: `ACTIVE` → `DONE` (atingiu 100%) ou `EXPIRED` (não usado ainda).
- **`coinsReward`**: padrão **50**, ajustável por meta (universais valem ~30-50, adaptadas a HAS/DM2 valem 60-80).
- **`source`**: `triage` (geradas automaticamente) ou `manual` (criação direta).

### 5.2 Atualização de progresso

`PATCH /api/goals/:id/progress { current }`:

1. Valida que a meta pertence ao paciente autenticado.
2. Recalcula `progress`.
3. Se progresso atinge **100% e status era `ACTIVE`**:
   - Marca `status='DONE'` e `completedAt=now()`.
   - Credita `coinsReward` (em transação atômica).
4. Retorna `{ goal, justCompleted: boolean }`.

### 5.3 Geração automática a partir da triagem

`goalService.generateGoalsFromTriage(patientId, analysis, triageId)`:

**Sempre cria 2 metas universais**:
- Hidratação diária (≥7 copos) — 30 coins
- Caminhar 7000 passos/dia — 50 coins

**Adapta com base no risco**:

| Risco         | Metas adicionais                                                    |
|---------------|---------------------------------------------------------------------|
| `HIGH` / `CRITICAL` | Controlar PA sist. ≤130 (80c) · Reduzir glicemia ≤130 (80c)  |
| `MODERATE`    | Estabilizar glicemia ≤110 (60c) · PA sist. ≤125 (60c)              |
| `LOW`         | Manter sono entre 7-9h (40c)                                       |
| `INCONCLUSIVE`| Refazer triagem em 7 dias (25c)                                    |

Total típico: **4–5 metas geradas por triagem**.

### 5.4 Health Coins

Modelo: tabela `HealthCoinTx` (movimentações) + `Patient.healthCoins` (saldo
desnormalizado).

**Regras invariantes**:
- Todo crédito/débito **sempre** cria uma `HealthCoinTx` E atualiza o saldo na mesma transação.
- Saldo desnormalizado existe só para performance de leitura — recalculável pelo somatório das transações.
- Saldo nunca pode ficar negativo. Tentativa de débito sem saldo → HTTP 400 "Saldo insuficiente".

**`HealthCoinTx.refType`** distingue origem:
- `goal` → conclusão de meta
- `redemption` → resgate de recompensa (delta negativo)
- `triage` → bônus de triagem (+20)
- `bonus` → bônus manual (boas-vindas, sequência de dias, etc.)

### 5.5 Catálogo de recompensas (`Reward`)

Populado no seed. 6 itens iniciais:

| Item                              | Tipo          | Custo (coins) |
|-----------------------------------|---------------|---------------|
| Guia nutricional personalizado    | item          | 50            |
| Desconto de 20% em exames lab.    | discount      | 150           |
| Kit fitness Care Plus             | item          | 200           |
| Consulta com nutricionista        | consultation  | 300           |
| Consulta com especialista         | consultation  | 500           |
| Check-up cardiológico completo    | exam          | 800           |

`Reward.available` permite desativar item sem deletar.

### 5.6 Resgate (`POST /api/rewards/:id/redeem`)

Implementado em `rewardService.redeem` — **toda lógica em uma transação**:

1. Valida que reward existe e está disponível.
2. Verifica saldo do paciente ≥ custo. Se não, HTTP 400.
3. Cria `RewardRedemption` (status `PENDING`).
4. Cria `HealthCoinTx` com `delta = -costCoins`.
5. Decrementa `Patient.healthCoins`.

Status do resgate evolui:
- `PENDING` → recém resgatado, aguardando aprovação interna Care Plus
- `APPROVED` → benefício liberado (mudaria via painel admin não exposto)
- `DENIED` → recusado (com refund manual de coins — não automatizado)

> O fluxo de aprovação não é parte do MVP demo. Resgates ficam em `PENDING`
> mesmo. O paciente vê o status em "Meus resgates".

---

## 6. Relatórios de IA (`AiReport`)

### 6.1 Tipos

- **`triage`** — gerado automaticamente após cada triagem submetida.
- **`full`** — relatório completo solicitado pelo médico.
- (`vitals`, `exam` reservados, não em uso ativo).

### 6.2 Geração de relatório completo (`POST /api/ai-reports/generate/:patientId`)

Apenas médicos vinculados. Em `aiReportRoutes.js::generateFullReport`:

1. `assertLink` — médico precisa estar vinculado ao paciente.
2. Carrega contexto: paciente, últimos 10 vitais, últimos 5 exames com
   resultado, últimas 3 triagens completas.
3. Chama `openaiService.generateHealthReport`:
   - Com chave → GPT-4o monta markdown estruturado.
   - Sem chave → **fallback determinístico** que monta markdown com seções
     fixas (Resumo, Vitais, Exames, Triagens, Conclusão) e classifica risco
     com base em heurística:
     - SpO₂ < 94 OR sistólica > 140 OR glicemia > 160 → `HIGH`
     - SpO₂ < 96 OR sistólica > 130 OR glicemia > 130 → `MODERATE`
     - caso contrário → `LOW`
4. Salva `AiReport` com `type='full'`, `doctorId`, `content`, `riskLevel`, `suggestions`.

### 6.3 Acesso aos relatórios

- **Paciente** lista os seus em `GET /api/ai-reports` e abre detalhe em
  `/my/:reportId`.
- **Médico** abre o detalhe de um relatório do seu paciente em
  `/doctor/:reportId` (com `assertLink`).

---

## 7. Consultas (`Appointment`)

### 7.1 Agendamento

Em `appointmentRoutes.js::create`:

- Apenas paciente vinculado ao médico pode agendar com ele (HTTP 403 caso
  contrário).
- **Conflito de agenda do médico**: se já houver consulta `SCHEDULED` ou
  `CONFIRMED` em janela de ±`duration` minutos, retorna HTTP 409.
- `duration` padrão é 30 min (entre 15 e 120, validado).

### 7.2 Mudança de status

- `SCHEDULED` → `CONFIRMED` (paciente ou médico)
- `SCHEDULED`/`CONFIRMED` → `CANCELLED` (ambos)
- `CONFIRMED` → `COMPLETED` (médico, após a consulta)
- Notas (`notes`) podem ser anexadas em qualquer transição.

### 7.3 Listagem

- **Paciente**: `GET /api/appointments/my` — só suas consultas.
- **Médico**: `GET /api/appointments/doctor` — toda a agenda dele.
- Dashboards filtram por `{ status: ['SCHEDULED', 'CONFIRMED'] }` e
  `scheduledAt >= now` para mostrar só as próximas.

---

## 8. Notificações

### 8.1 Tipos

`Notification.type`:
- `ALERT` — alerta clínico moderado (ex: tendência de glicemia em alta)
- `CRITICAL` — alerta crítico (ex: SpO₂ baixa em série)
- `INFO` — info geral (ex: exame processado, novo relatório)
- `REMINDER` — lembrete (ex: consulta em 2 dias)

### 8.2 Geração

- Pulseira → `wearableRoutes.js::analyzeAndAlert` cria notificação quando a
  IA classifica vital como severidade `medium` ou `high`.
- Triagem com risco HIGH/CRITICAL → potencialmente notifica todos os médicos
  vinculados (via Socket.io, sem persistência hoje).
- Exames processados → notificação INFO ao paciente.

### 8.3 Leitura

- `GET /api/notifications` — listagem (com paginação).
- `GET /api/notifications/unread-count` — contagem não lidas (badge no sino do topbar).
- `PATCH /api/notifications/:id/read` — marca uma como lida.
- `PATCH /api/notifications/read-all` — marca todas.

---

## 9. Painel médico

### 9.1 Dashboard (`GET /api/doctor/dashboard`)

Agrega em uma única chamada:

- `totalPatients` — pacientes vinculados
- `criticalAlerts` — relatórios HIGH/CRITICAL nas últimas 24h
- `todayAppointments` — consultas SCHEDULED/CONFIRMED hoje
- `upcomingAppointments` — próximas 5 consultas
- `recentReports` — últimos 5 relatórios IA gerados
- `riskDistribution` — contagem de pacientes por nível do **último** relatório
- `appointmentsByDay` — agenda dos próximos 7 dias (count por dia)
- `criticalPatients` — pacientes com último relatório HIGH/CRITICAL

### 9.2 Consolidado por paciente (`GET /api/doctor/patients/:id/consolidated`)

Bundle usado pela aba **Wearable**:

- Identidade do paciente (nome, sexo, condições crônicas, alergias)
- Último vital persistido
- 30 dias de vitais (para os 3 mini-gráficos)
- Últimos 5 exames com resultado
- Últimos 3 relatórios IA
- Todas as metas (ativas + concluídas)
- Última triagem completa

Acesso requer vínculo (HTTP 403 se não vinculado).

### 9.3 Histórico (`GET /api/doctor/patients/:id/history`)

Agregação cronológica usada na aba **Histórico** (timeline). **Eventos
unificados**:

| Tipo (`kind`)      | Origem                                       |
|--------------------|----------------------------------------------|
| `appointment`      | Tabela `Appointment` (qualquer status)       |
| `exam`             | Tabela `Exam` (+ resultado se disponível)    |
| `aiReport`         | Tabela `AiReport`                            |
| `goal`             | `HealthGoal` com `status='DONE'`             |
| `triage`           | `TriageAnswer` com `status='COMPLETED'`      |
| `alert`            | `Notification` tipo `ALERT`                  |
| `critical`         | `Notification` tipo `CRITICAL`               |

Todos ordenados por data desc, **agrupados por dia** no frontend.

---

## 10. Wearables / Pulseira (legacy)

Embora a UI de "Dispositivos" tenha sido removida do menu do paciente, o
backend continua mantendo o endpoint **`POST /api/wearables/ingest`** com
payload genérico:

```json
{ "deviceId": "...", "payload": { "heart_rate": 92, "spo2": 96, ... } }
```

Em `wearableRoutes.js::ingestWearableData`:

1. Persiste payload bruto em `WearableData`.
2. Extrai sinais vitais conhecidos via `extractVitalsFromPayload` (mapeamento
   tolerante: `heart_rate`/`heartRate`/`spo2`/`oxygen_sat`/etc.).
3. Se algum vital extraído, cria `VitalSign` com `source='wearable'`.
4. Chama `analyzeAndAlert` que pode disparar notificação.
5. Atualiza `lastSyncAt` do `Device`.

Útil para integração externa futura (sem mexer na UI atual).

---

## 11. Auditoria

`AuditLog` registra eventos sensíveis. **Atualmente** só LOGIN e LOGOUT
são logados:

```js
{ userId, action: 'LOGIN', entity: 'User', entityId: userId, ip, userAgent, createdAt }
```

O schema suporta também `CREATE`, `UPDATE`, `DELETE`, `VIEW`, `EXPORT` para
expansão futura.

---

## 12. Persistência e particularidades do SQLite

### 12.1 Campos JSON-serializados

Como SQLite via Prisma não suporta `Json` nativo, os campos abaixo são
`String` no banco e (de)serializados em runtime pelos helpers em
`utils/jsonField.js`:

| Tabela           | Campo          | Tipo lógico  |
|------------------|----------------|--------------|
| `Patient`        | `allergies`    | string[]     |
| `Patient`        | `chronicConds` | string[]     |
| `ExamResult`     | `findings`     | object[]     |
| `TriageAnswer`   | `answers`      | object[]     |
| `AiReport`       | `suggestions`  | object[]     |
| `Notification`   | `metadata`     | object       |
| `WearableData`   | `payload`      | object       |

A API **sempre devolve esses campos já desserializados** (arrays/objetos).

### 12.2 Enums lógicos

Não há enums no SQLite — campos são `String`. As constantes lógicas estão
documentadas no topo do `schema.prisma`. As regras de validação ficam por
conta da camada de service e dos validators das rotas.

### 12.3 Paginação

Todo endpoint paginado aceita `?page=` e `?limit=`. **Os services convertem
explicitamente para `Number(...)` antes de passar ao Prisma**, porque o
Prisma 5 rejeita strings em `skip`/`take`.

---

## 13. Resumo das invariantes críticas

| Invariante                                                                 | Como é garantida                                      |
|----------------------------------------------------------------------------|-------------------------------------------------------|
| Saldo de coins nunca negativo                                              | `coinService.debit` valida e `rewardService.redeem` em transação |
| Saldo desnormalizado = soma das transações                                 | Toda alteração de saldo está dentro de `$transaction` com `HealthCoinTx` |
| Apenas médico vinculado vê dados do paciente                               | `doctorService.assertLink` em todo endpoint sensível  |
| Refresh token usado é invalidado                                           | `authService.refresh` faz delete + insert na mesma chamada |
| Mudança de senha desloga em todos os dispositivos                          | `authService.changePassword` deleta `RefreshToken` do user |
| Conflito de agenda do médico bloqueia novo agendamento                     | `appointmentRoutes.create` testa janela ±duration     |
| Triagem com risco HIGH/CRITICAL avisa médicos                              | Socket.io `triage:alert` para sala `doctors`          |
| Sem `OPENAI_API_KEY` o sistema continua funcional                          | `openaiService` tem fallbacks em todos os 4 métodos   |
| Score, sparklines e cards refletem a pulseira em 1s                        | `useLiveVitals` + `useCountUp` no frontend            |

---

## 14. Onde encontrar cada regra no código

| Domínio              | Arquivo principal                                        |
|----------------------|----------------------------------------------------------|
| Autenticação         | `backend/src/services/authService.js`                    |
| Pacientes/Vitais     | `backend/src/services/patientService.js`                 |
| Médico/Painel        | `backend/src/services/doctorService.js`                  |
| Exames               | `backend/src/services/examService.js`                    |
| Triagem              | `backend/src/services/triageService.js`                  |
| Metas                | `backend/src/services/goalService.js`                    |
| Coins                | `backend/src/services/coinService.js`                    |
| Recompensas          | `backend/src/services/rewardService.js`                  |
| Relatórios IA        | `backend/src/routes/aiReportRoutes.js`                   |
| IA real e fallback   | `backend/src/services/openaiService.js` + `aiSimulator.js` |
| Consultas            | `backend/src/routes/appointmentRoutes.js`                |
| Notificações         | `backend/src/routes/notificationRoutes.js`               |
| Wearable ingest      | `backend/src/routes/wearableRoutes.js`                   |
| JWT                  | `backend/src/config/jwt.js`                              |
| Schema do banco      | `backend/src/prisma/schema.prisma`                       |
| Dados demo (seed)    | `backend/src/prisma/seed.js`                             |

# HealthInPulse v7

Plataforma acadêmica de saúde digital integrada à pulseira **Care Plus**: o
paciente acompanha sinais vitais em tempo real, recebe metas personalizadas via
triagem com IA e troca **health-coins** por benefícios; o(a) médico(a) tem
painel consolidado, relatórios automáticos, linha do tempo clínica e base
clínica de referência.

> Aplicação **demo/acadêmica**. Não usar com dados reais de pacientes.

---

## Stack

| Camada       | Tecnologia                                                 |
|--------------|------------------------------------------------------------|
| Backend      | Node 20 · Express 4 · Prisma 5 · SQLite · Socket.io · JWT  |
| Frontend     | React 18 · Vite 5 · Tailwind 3 · React Router 6 · Recharts |
| IA           | OpenAI GPT-4o (opcional) · fallback local (`aiSimulator`)  |
| Auth         | JWT access + refresh com rotação                           |

---

## Pré-requisitos

- **Node.js 20 ou superior** (`node --version` → `v20.x.x`)
- **npm 10+** (vem junto com o Node)
- Nada mais: SQLite é em arquivo (`backend/src/prisma/dev.db`), sem Postgres ou
  Docker

> Em sistemas antigos basta instalar `nvm` e fazer `nvm install 20`.

---

## Setup inicial (primeira vez)

### 1. Clonar

```bash
git clone https://github.com/igormarran01/heathinpulse.git
cd heathinpulse
```

### 2. Backend

```bash
cd backend
cp .env.example .env             # edite os JWT secrets (ver abaixo)

npm install
npx prisma generate              # gera o client do Prisma
npx prisma db push               # cria as tabelas no SQLite
npm run db:seed                  # popula 2 pacientes + médica + metas + rewards
```

### Preencher `.env`

O arquivo `.env.example` lista todas as variáveis. As **únicas obrigatórias**
para rodar localmente são os dois JWT secrets. Gere com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

E cole em:

```env
JWT_ACCESS_SECRET=<a-saída-do-comando>
JWT_REFRESH_SECRET=<outra-saída-do-comando>
```

`OPENAI_API_KEY` é **opcional**. Sem ela o sistema usa o simulador local de IA
(determinístico baseado em palavras-chave) — bom para apresentação offline.

### 3. Frontend

```bash
cd ../frontend
npm install
```

Não precisa de `.env` no frontend — o `vite.config.js` faz proxy de `/api`
e `/uploads` para `http://localhost:3000`.

---

## Como rodar (dia a dia)

**Em dois terminais**:

```bash
# terminal 1
cd backend
npm run dev               # http://localhost:3000 (com nodemon)

# terminal 2
cd frontend
npm run dev               # http://localhost:5173 (com hot reload)
```

Abra **http://localhost:5173** no navegador.

---

## Credenciais demo

A tela de login tem **3 cards "Demo · clique para entrar"** que logam
diretamente. Ou digite manualmente:

| Perfil                        | E-mail                          | Senha         | Tipo                                       |
|------------------------------|---------------------------------|---------------|--------------------------------------------|
| 🩺 **João Carlos Mendes**     | `joao@healthinpulse.dev`        | `Joao@123`    | Paciente · caso grave (HAS + DM2)          |
| ✨ **Marina Azevedo Lima**    | `marina@healthinpulse.dev`      | `Marina@123`  | Paciente · preventivo (pré-diabetes)       |
| 🧑‍⚕️ **Dra. Ana Beatriz Souza** | `doctor@healthinpulse.dev`      | `Doctor@123`  | Médica · vinculada aos 2 pacientes acima   |

---

## Scripts disponíveis

### Backend (`/backend`)

| Comando            | O que faz                                                |
|--------------------|----------------------------------------------------------|
| `npm run dev`      | Sobe o servidor em modo dev (nodemon)                    |
| `npm start`        | Sobe o servidor em modo produção                         |
| `npm run db:generate` | Regenera o Prisma Client                              |
| `npm run db:migrate`  | Cria migration (em SQLite preferimos `prisma db push`)|
| `npm run db:studio`   | Abre o Prisma Studio (GUI do banco) em :5555          |
| `npm run db:seed`     | Popula o banco com dados demo                         |
| `npm run db:reset`    | Reseta migrations (use só se houver migrations)       |

**Comandos úteis avulsos:**

```bash
# Resetar o banco SQLite e re-popular do zero
npx prisma db push --force-reset --skip-generate --accept-data-loss
npm run db:seed
```

### Frontend (`/frontend`)

| Comando         | O que faz                                |
|-----------------|------------------------------------------|
| `npm run dev`     | Sobe Vite em modo dev (hot reload)       |
| `npm run build`   | Build de produção em `dist/`             |
| `npm run preview` | Serve o build de produção localmente     |

---

## Estrutura de pastas (resumo)

```
heathinpulse/
├── backend/
│   ├── src/
│   │   ├── app.js              # Express app (middlewares + rotas)
│   │   ├── server.js           # bootstrap HTTP + Socket.io
│   │   ├── config/             # database, jwt, socket, multer
│   │   ├── middlewares/        # auth, validation, errors
│   │   ├── controllers/        # camada HTTP
│   │   ├── services/           # regras de negócio
│   │   ├── routes/             # rotas Express
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # schema do banco
│   │   │   ├── seed.js         # dados demo
│   │   │   └── dev.db          # SQLite (gitignored)
│   │   ├── utils/              # logger, jsonField (helpers SQLite)
│   │   └── uploads/            # arquivos enviados (gitignored)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx            # entrypoint
│   │   ├── index.css           # tailwind + design system
│   │   ├── contexts/           # AuthContext, SocketContext
│   │   ├── hooks/              # useFetch, useLiveVitals, useCountUp...
│   │   ├── services/           # cliente axios + chamadas por domínio
│   │   ├── routes/             # AppRoutes + Guards
│   │   ├── components/layout/  # PatientLayout, DoctorLayout
│   │   └── pages/
│   │       ├── auth/           # Login, Register
│   │       ├── patient/        # Dashboard, Goals, Rewards, Exams...
│   │       └── doctor/         # Dashboard, Patients, Wearable, Reports...
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
├── Docs/                       # docx de pacientes-demo e referência clínica
├── ARCHITECTURE.md             # como o sistema está montado
├── BUSINESS_RULES.md           # regras de negócio detalhadas
└── README.md                   # este arquivo
```

---

## Troubleshooting

**❌ "Token expirado / inválido" depois de muitos refreshes**
Limpe o `localStorage` no DevTools (F12 → Application → Storage → Clear site
data) e faça login de novo. O refresh-token rotation pode ter sido invalidado
após reset do banco.

**❌ "Many tentativas. Tente novamente em 15 minutos"**
Era o `express-rate-limit` no `/api/auth`. Em modo `NODE_ENV=development` ele
fica desativado — verifique se está rodando `npm run dev` (que injeta o
`.env`).

**❌ Dashboard em branco após login**
Quase sempre violação das Regras de Hooks do React. Abra o DevTools (F12 →
Console) e procure por "Rendered fewer hooks than expected". Recarregue com
`Ctrl+Shift+R`.

**❌ Backend não sobe — `MODULE_NOT_FOUND`**
Rode `npm install` no `backend/`. Se persistir, apague `node_modules` e
`package-lock.json` e tente de novo.

**❌ Prisma diz "schema.prisma not found"**
O `package.json` do backend aponta `prisma.schema` para
`src/prisma/schema.prisma`. Rode os comandos `npx prisma ...` **dentro de
`backend/`**.

**❌ "Argument `take`: Expected Int, provided String"**
Significa que algum endpoint paginado não normalizou `req.query.limit` para
número. Já corrigido em todos os services atuais, mas se voltar a ocorrer,
basta envolver em `Number(...)`.

**❌ Erro 401 em todas as chamadas, mesmo após login**
Confira no DevTools → Network se o backend está rodando em
`http://localhost:3000` e se o `Authorization: Bearer ...` está sendo
enviado. O Vite faz proxy via `/api`.

---

## Próximas leituras

- [ARCHITECTURE.md](./ARCHITECTURE.md) — como o sistema está organizado em
  camadas, fluxos principais e modelo de dados
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) — regras de negócio detalhadas do
  backend (autenticação, gamificação, triagem IA, sinais vitais, etc.)

---

## Licença e uso

Projeto **acadêmico** para apresentação à **Care Plus**. Pacientes, exames e
dados clínicos são fictícios. Nenhuma decisão médica deve ser tomada com base
nesta aplicação.

# HealthInPulse v7 — Backend

API REST + WebSocket para o sistema de saúde digital HealthInPulse.

---

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 4
- **Banco**: PostgreSQL 16 via Prisma ORM
- **Realtime**: Socket.io
- **IA**: OpenAI GPT-4o
- **Auth**: JWT (access + refresh token com rotação)

---

## Setup rápido

### 1. Banco de dados (Docker)
```bash
docker-compose up -d postgres
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edite o .env com seus valores

npm install

# Gera o Prisma Client
npm run db:generate

# Cria as tabelas
npm run db:migrate

# Popula dados de desenvolvimento
npm run db:seed

# Inicia em modo dev
npm run dev
```

---

## Endpoints principais

| Método | Rota                          | Descrição                        | Role     |
|--------|-------------------------------|----------------------------------|----------|
| POST   | /api/auth/register            | Cadastro                         | Público  |
| POST   | /api/auth/login               | Login                            | Público  |
| POST   | /api/auth/refresh             | Novo access token                | Público  |
| POST   | /api/auth/logout              | Logout                           | Auth     |
| GET    | /api/patient                  | Perfil do paciente               | PATIENT  |
| GET    | /api/patient/dashboard        | Dashboard do paciente            | PATIENT  |
| POST   | /api/patient/vitals           | Registrar sinal vital            | PATIENT  |
| GET    | /api/doctor/dashboard         | Dashboard do médico              | DOCTOR   |
| GET    | /api/doctor/patients          | Lista pacientes vinculados       | DOCTOR   |
| POST   | /api/exams                    | Upload de exame (multipart)      | PATIENT  |
| POST   | /api/triage                   | Submeter triagem                 | PATIENT  |
| POST   | /api/ai-reports/generate/:id  | Gerar relatório completo (IA)    | DOCTOR   |
| POST   | /api/wearables/ingest         | Ingestão de dados de wearable    | PATIENT  |
| GET    | /api/appointments/my          | Consultas do paciente            | PATIENT  |
| GET    | /api/appointments/doctor      | Agenda do médico                 | DOCTOR   |
| GET    | /api/notifications            | Notificações do usuário          | Auth     |
| GET    | /health                       | Health check                     | Público  |

---

## Credenciais de desenvolvimento (seed)

| Role    | Email                          | Senha       |
|---------|--------------------------------|-------------|
| Médico  | doctor@healthinpulse.dev       | Doctor@123  |
| Paciente| patient@healthinpulse.dev      | Patient@123 |

---

## Eventos Socket.io

| Evento              | Direção         | Descrição                           |
|---------------------|-----------------|-------------------------------------|
| `vital:new`         | Server → Doctor | Novo sinal vital registrado         |
| `vital:alert`       | Server → Patient| Alerta de sinal vital anormal       |
| `patient:critical`  | Server → Doctors| Paciente em estado crítico          |
| `exam:processed`    | Server → Patient| Exame processado pela IA            |
| `triage:completed`  | Server → Patient| Análise de triagem concluída        |
| `triage:alert`      | Server → Doctors| Triagem com risco alto/crítico      |
| `appointment:new`   | Server → Doctor | Nova consulta agendada              |
| `appointment:updated`| Server → Both  | Status de consulta alterado         |
| `notification:new`  | Server → User   | Nova notificação em tempo real      |

---

## Estrutura de pastas

```
backend/src/
├── config/         # database, jwt, socket, multer
├── controllers/    # camada HTTP (req/res)
├── middlewares/    # auth, error, validation
├── prisma/         # schema.prisma, seed.js
├── routes/         # rotas + controller inline quando pequeno
├── services/       # lógica de negócio
├── uploads/        # arquivos de usuários (gitignored)
└── utils/          # logger
```

# HealthInPulse v7 — Frontend

Interface React do sistema de saúde digital HealthInPulse.

---

## Stack

- **Framework**: React 18 + Vite
- **Estilo**: Tailwind CSS com design system próprio (navy + teal)
- **Roteamento**: React Router v6 com guards por role
- **HTTP**: Axios com refresh automático de JWT
- **Realtime**: Socket.io-client
- **Gráficos**: Recharts
- **Forms**: React Hook Form + validações inline
- **UX**: react-hot-toast, react-dropzone, lucide-react

---

## Setup

```bash
cd frontend
npm install
npm run dev
```

O frontend roda em `http://localhost:5173` e faz proxy automático para o backend em `localhost:3000`.

---

## Estrutura

```
src/
├── components/
│   └── layout/         # PatientLayout, DoctorLayout (sidebar + topbar)
├── contexts/
│   ├── AuthContext.jsx  # estado global de auth + login/logout
│   └── SocketContext.jsx# conexão Socket.io global
├── hooks/
│   └── index.js         # useFetch, useAsync, useDebounce, useLocalStorage
├── pages/
│   ├── auth/            # Login, Register
│   ├── patient/         # Dashboard, Vitals, Exams, Triage, Reports, Devices, Appointments, Profile
│   └── doctor/          # Dashboard, Patients, PatientDetail, Appointments, Profile
├── routes/
│   ├── AppRoutes.jsx    # mapa de rotas com lazy loading
│   └── Guards.jsx       # PrivateRoute, RoleRoute, PublicRoute
├── services/
│   ├── api.js           # axios com interceptors de auth + refresh automático
│   └── index.js         # serviços por domínio (auth, patient, doctor, exams…)
└── main.jsx             # entrada da aplicação
```

---

## Rotas

| Path                          | Componente         | Role    |
|-------------------------------|--------------------|---------|
| /login                        | LoginPage          | Público |
| /register                     | RegisterPage       | Público |
| /patient                      | Dashboard          | PATIENT |
| /patient/vitals               | Vitals             | PATIENT |
| /patient/exams                | Exams              | PATIENT |
| /patient/triage               | Triage             | PATIENT |
| /patient/reports              | Reports            | PATIENT |
| /patient/devices              | Devices            | PATIENT |
| /patient/appointments         | Appointments       | PATIENT |
| /patient/profile              | Profile            | PATIENT |
| /doctor                       | Dashboard          | DOCTOR  |
| /doctor/patients              | Patients           | DOCTOR  |
| /doctor/patients/:patientId   | PatientDetail      | DOCTOR  |
| /doctor/appointments          | Appointments       | DOCTOR  |
| /doctor/profile               | Profile            | DOCTOR  |

---

## Eventos Socket.io recebidos

| Evento              | Onde é exibido                          |
|---------------------|-----------------------------------------|
| `vital:new`         | Dashboard médico (atualização ao vivo)  |
| `vital:alert`       | Toast de alerta ao paciente             |
| `exam:processed`    | Badge de status atualizado nos exames   |
| `triage:completed`  | Tela de triagem — resultado exibido     |
| `notification:new`  | Contador no sino do topbar              |
| `appointment:updated`| Recarrega lista de consultas           |

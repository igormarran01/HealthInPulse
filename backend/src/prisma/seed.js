const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DAY  = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const lerp  = (a, b, t) => a + (b - a) * t;
const noise = (amp) => (Math.random() - 0.5) * 2 * amp;
const round = (v, d = 0) => Number(v.toFixed(d));

async function main() {
  console.log('🌱 Iniciando seed...');

  const hash = (pw) => bcrypt.hash(pw, 12);

  // ─── Limpa o seed anterior ────────────────────────────────
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'doctor@healthinpulse.dev',
          'patient@healthinpulse.dev', // Carlos (legado)
          'joao@healthinpulse.dev',
          'marina@healthinpulse.dev',
        ],
      },
    },
  });

  // ─── Médica ────────────────────────────────────────────────
  const doctorUser = await prisma.user.create({
    data: {
      email:         'doctor@healthinpulse.dev',
      passwordHash:  await hash('Doctor@123'),
      role:          'DOCTOR',
      emailVerified: true,
      doctor: {
        create: {
          fullName:  'Dra. Ana Beatriz Souza',
          crm:       'CRM-SP 123456',
          specialty: 'Clínica Geral',
          phone:     '11 91234-5678',
          bio:       'Médica clínica geral com foco em medicina preventiva e saúde digital.',
        },
      },
    },
    include: { doctor: true },
  });
  const doctorId = doctorUser.doctor.id;

  // ─── Paciente 1: João Carlos Mendes (caso grave) ──────────
  console.log('  → João Carlos Mendes (caso grave)');
  const joaoUser = await prisma.user.create({
    data: {
      email:         'joao@healthinpulse.dev',
      passwordHash:  await hash('Joao@123'),
      role:          'PATIENT',
      emailVerified: true,
      patient: {
        create: {
          fullName:       'João Carlos Mendes',
          dateOfBirth:    new Date('1968-04-12'),
          gender:         'MALE',
          cpf:            '321.654.987-00',
          phone:          '11 98800-1100',
          bloodType:      'A+',
          height:         174,
          weight:         96,
          allergies:      JSON.stringify([]),
          chronicConds:   JSON.stringify(['Hipertensão', 'Diabetes tipo 2', 'Colesterol alto']),
          emergencyName:  'Lúcia Mendes',
          emergencyPhone: '11 98800-1101',
        },
      },
    },
    include: { patient: true },
  });
  const joaoId = joaoUser.patient.id;
  await prisma.doctorPatient.create({ data: { doctorId, patientId: joaoId } });

  // 30 dias de leituras "ruim" do João (HAS + DM2 descompensados)
  for (let i = 29; i >= 0; i--) {
    for (let s = 0; s < 2; s++) {
      const recordedAt = new Date(Date.now() - i * DAY + s * 10 * HOUR);
      await prisma.vitalSign.create({
        data: {
          patientId: joaoId,
          heartRate:   round(94  + noise(4)),
          systolic:    round(146 + noise(6)),
          diastolic:   round(92  + noise(4)),
          oxygenSat:   round(93.5 + noise(0.8), 1),
          temperature: round(36.8 + noise(0.2), 1),
          glucose:     round(184 + noise(12)),
          source:      'wearable',
          recordedAt,
        },
      });
    }
  }

  // Exames do João
  const examMet = await prisma.exam.create({
    data: {
      patientId: joaoId,
      title:       'Painel metabólico',
      description: 'Glicemia em jejum, HbA1c, perfil lipídico',
      fileUrl:     '/uploads/exams/seed-joao-metabolico.pdf',
      fileType:    'pdf',
      status:      'DONE',
      ocrText:     'Glicemia jejum 186 mg/dL. HbA1c 8.2%. LDL 168. Trig 241.',
      uploadedAt:  new Date(Date.now() - 10 * DAY),
      processedAt: new Date(Date.now() - 10 * DAY + 90000),
    },
  });
  await prisma.examResult.create({
    data: {
      examId:    examMet.id,
      summary:   'Controle metabólico inadequado. Hiperglicemia em jejum, HbA1c elevada e dislipidemia.',
      findings:  JSON.stringify([
        { name: 'Glicemia em jejum', value: '186', unit: 'mg/dL', status: 'alto' },
        { name: 'HbA1c',              value: '8.2', unit: '%',     status: 'alto' },
        { name: 'LDL colesterol',     value: '168', unit: 'mg/dL', status: 'alto' },
        { name: 'Triglicerídeos',     value: '241', unit: 'mg/dL', status: 'alto' },
      ]),
      riskLevel: 'HIGH',
    },
  });

  const examRenal = await prisma.exam.create({
    data: {
      patientId: joaoId,
      title:       'Função renal',
      description: 'Creatinina sérica e ureia',
      fileUrl:     '/uploads/exams/seed-joao-renal.pdf',
      fileType:    'pdf',
      status:      'DONE',
      ocrText:     'Creatinina 1.25 mg/dL. Ureia 48 mg/dL.',
      uploadedAt:  new Date(Date.now() - 8 * DAY),
      processedAt: new Date(Date.now() - 8 * DAY + 80000),
    },
  });
  await prisma.examResult.create({
    data: {
      examId:    examRenal.id,
      summary:   'Função renal limítrofe — sugere acompanhamento pelo risco de nefropatia diabética.',
      findings:  JSON.stringify([
        { name: 'Creatinina', value: '1.25', unit: 'mg/dL', status: 'atenção' },
        { name: 'Ureia',      value: '48',   unit: 'mg/dL', status: 'normal'  },
      ]),
      riskLevel: 'MODERATE',
    },
  });

  const examSono = await prisma.exam.create({
    data: {
      patientId: joaoId,
      title:       'Polissonografia',
      description: 'Estudo do sono',
      fileUrl:     '/uploads/exams/seed-joao-sono.pdf',
      fileType:    'pdf',
      status:      'DONE',
      ocrText:     'IAH 22 eventos/h. Eficiência 68%. Despertares 8. Tempo total 5h42min.',
      uploadedAt:  new Date(Date.now() - 5 * DAY),
      processedAt: new Date(Date.now() - 5 * DAY + 110000),
    },
  });
  await prisma.examResult.create({
    data: {
      examId:    examSono.id,
      summary:   'Apneia obstrutiva do sono moderada. Indicação de avaliação para CPAP.',
      findings:  JSON.stringify([
        { name: 'IAH',                value: '22',     unit: 'eventos/h', status: 'alto'    },
        { name: 'Eficiência do sono', value: '68',     unit: '%',         status: 'baixo'   },
        { name: 'Tempo total',        value: '5h42',   unit: '',          status: 'baixo'   },
        { name: 'Despertares',        value: '8',      unit: '',          status: 'alto'    },
      ]),
      riskLevel: 'MODERATE',
    },
  });

  // Relatório IA do João
  await prisma.aiReport.create({
    data: {
      patientId:  joaoId,
      doctorId,
      type:       'full',
      content:    `# Avaliação clínica — João Carlos Mendes

## Resumo
Paciente masculino, 58 anos, com múltiplos fatores de risco cardiometabólico já estabelecidos. Os dados coletados pela pulseira Care Plus e exames laboratoriais sugerem **síndrome metabólica avançada com diabetes tipo 2 descompensado** e **provável apneia obstrutiva do sono**.

## Achados principais
- Pressão arterial média de **148/94 mmHg** (HAS descompensada)
- Glicemia em jejum **186 mg/dL** e HbA1c **8.2%** (controle inadequado)
- LDL **168 mg/dL** e triglicerídeos **241 mg/dL** (dislipidemia)
- SpO₂ basal **93%** com IAH de **22 eventos/h** (apneia moderada)
- Sono fragmentado: eficiência de 68%, 8 despertares por noite

## Probabilidades clínicas estimadas
- Diabetes tipo 2 descompensado — **86%**
- Hipertensão descompensada — **84%**
- Síndrome metabólica — **78%**
- Apneia obstrutiva do sono — **71%**
- Risco cardiovascular aumentado — **69%**

## Conclusão
Recomenda-se acompanhamento médico contínuo, ajuste terapêutico para controle glicêmico e pressórico, avaliação cardiológica e investigação formal do sono. O HealthInPulse seguirá monitorando os sinais vitais via pulseira Care Plus.`,
      riskLevel:  'HIGH',
      suggestions: JSON.stringify([
        { type: 'medication', text: 'Avaliar ajuste de Metformina + adicionar inibidor SGLT2' },
        { type: 'medication', text: 'Reavaliar terapia anti-hipertensiva (associar IECA + diurético)' },
        { type: 'exam',       text: 'Solicitar microalbuminúria e fundo de olho (rastreio de complicações)' },
        { type: 'specialist', text: 'Encaminhar para cardiologia e medicina do sono' },
        { type: 'lifestyle',  text: 'Plano nutricional individualizado + atividade física supervisionada' },
      ]),
      generatedAt: new Date(Date.now() - 1 * DAY),
    },
  });

  // Consultas do João
  await prisma.appointment.create({
    data: {
      patientId: joaoId, doctorId,
      scheduledAt: new Date(Date.now() - 12 * DAY),
      duration: 45, status: 'COMPLETED',
      notes: 'Avaliação inicial — solicitação de exames laboratoriais e polissonografia',
    },
  });
  await prisma.appointment.create({
    data: {
      patientId: joaoId, doctorId,
      scheduledAt: new Date(Date.now() + 2 * DAY + 10 * HOUR),
      duration: 30, status: 'CONFIRMED',
      notes: 'Retorno — revisão dos exames e ajuste medicamentoso',
    },
  });

  // Notificações do João
  await prisma.notification.createMany({
    data: [
      {
        userId: joaoUser.id, type: 'CRITICAL',
        title:   'Pressão arterial elevada',
        message: 'Sua pressão média nas últimas 24h foi de 148/94 mmHg',
        read: false,
        metadata: JSON.stringify({ severity: 'high' }),
        createdAt: new Date(Date.now() - 6 * HOUR),
      },
      {
        userId: joaoUser.id, type: 'ALERT',
        title:   'Saturação de O₂ baixa durante o sono',
        message: 'SpO₂ atingiu 89% em 4 momentos da última noite',
        read: false,
        metadata: JSON.stringify({ severity: 'high' }),
        createdAt: new Date(Date.now() - 14 * HOUR),
      },
      {
        userId: joaoUser.id, type: 'INFO',
        title:   'Exame processado',
        message: 'Painel metabólico analisado pela IA — resultado disponível',
        read: true,
        metadata: JSON.stringify({}),
        createdAt: new Date(Date.now() - 10 * DAY + 90000),
      },
    ],
  });

  // ─── Paciente 2: Marina Azevedo Lima (preventivo) ─────────
  console.log('  → Marina Azevedo Lima (caso preventivo)');
  const marinaUser = await prisma.user.create({
    data: {
      email:         'marina@healthinpulse.dev',
      passwordHash:  await hash('Marina@123'),
      role:          'PATIENT',
      emailVerified: true,
      patient: {
        create: {
          fullName:       'Marina Azevedo Lima',
          dateOfBirth:    new Date('1992-09-23'),
          gender:         'FEMALE',
          cpf:            '987.123.654-00',
          phone:          '11 99700-2200',
          bloodType:      'O+',
          height:         166,
          weight:         70,
          allergies:      JSON.stringify([]),
          chronicConds:   JSON.stringify([]),
          emergencyName:  'Pedro Lima',
          emergencyPhone: '11 99700-2201',
        },
      },
    },
    include: { patient: true },
  });
  const marinaId = marinaUser.patient.id;
  await prisma.doctorPatient.create({ data: { doctorId, patientId: marinaId } });

  // 60 dias da Marina com tendência crescente de piora metabólica
  // dia 60..40 saudável | 40..20 transição | 20..0 alerta
  for (let i = 59; i >= 0; i--) {
    for (let s = 0; s < 2; s++) {
      const recordedAt = new Date(Date.now() - i * DAY + s * 11 * HOUR);
      const t = 1 - (i / 59);  // 0 → 1 ao longo de 60 dias
      // Interpola entre saudável (t=0) e alerta (t=1)
      const hr  = lerp(70,  84,  t) + noise(2);
      const sys = lerp(114, 128, t) + noise(3);
      const dia = lerp(74,  84,  t) + noise(2);
      const o2  = lerp(98.5, 97,  t) + noise(0.3);
      const glu = lerp(90,  112, t) + noise(4);
      await prisma.vitalSign.create({
        data: {
          patientId: marinaId,
          heartRate:   round(hr),
          systolic:    round(sys),
          diastolic:   round(dia),
          oxygenSat:   round(o2, 1),
          temperature: round(36.7 + noise(0.15), 1),
          glucose:     round(glu),
          source:      'wearable',
          recordedAt,
        },
      });
    }
  }

  // Exames da Marina — inicial (60 dias) vs atual (3 dias)
  const examIni = await prisma.exam.create({
    data: {
      patientId: marinaId,
      title:       'Painel metabólico inicial',
      description: 'Linha de base ao iniciar acompanhamento',
      fileUrl:     '/uploads/exams/seed-marina-inicial.pdf',
      fileType:    'pdf',
      status:      'DONE',
      ocrText:     'Glicemia jejum 88 mg/dL. HbA1c 5.2%. LDL 118.',
      uploadedAt:  new Date(Date.now() - 58 * DAY),
      processedAt: new Date(Date.now() - 58 * DAY + 70000),
    },
  });
  await prisma.examResult.create({
    data: {
      examId:    examIni.id,
      summary:   'Perfil metabólico dentro da normalidade. Sem indícios de doença.',
      findings:  JSON.stringify([
        { name: 'Glicemia em jejum', value: '88',  unit: 'mg/dL', status: 'normal' },
        { name: 'HbA1c',              value: '5.2', unit: '%',     status: 'normal' },
        { name: 'LDL colesterol',     value: '118', unit: 'mg/dL', status: 'normal' },
      ]),
      riskLevel: 'LOW',
    },
  });

  const examAtual = await prisma.exam.create({
    data: {
      patientId: marinaId,
      title:       'Painel metabólico (revisão)',
      description: 'Reavaliação após detecção de tendência de piora pela pulseira',
      fileUrl:     '/uploads/exams/seed-marina-atual.pdf',
      fileType:    'pdf',
      status:      'DONE',
      ocrText:     'Glicemia jejum 112 mg/dL. HbA1c 5.9%. LDL 132. Trig 158.',
      uploadedAt:  new Date(Date.now() - 3 * DAY),
      processedAt: new Date(Date.now() - 3 * DAY + 80000),
    },
  });
  await prisma.examResult.create({
    data: {
      examId:    examAtual.id,
      summary:   'Glicemia e HbA1c em faixa de pré-diabetes. Perfil lipídico em atenção. Recomenda-se intervenção precoce.',
      findings:  JSON.stringify([
        { name: 'Glicemia em jejum', value: '112', unit: 'mg/dL', status: 'atenção' },
        { name: 'HbA1c',              value: '5.9', unit: '%',     status: 'atenção' },
        { name: 'LDL colesterol',     value: '132', unit: 'mg/dL', status: 'atenção' },
        { name: 'Triglicerídeos',     value: '158', unit: 'mg/dL', status: 'atenção' },
      ]),
      riskLevel: 'MODERATE',
    },
  });

  // Relatório IA da Marina
  await prisma.aiReport.create({
    data: {
      patientId:  marinaId,
      doctorId,
      type:       'full',
      content:    `# Avaliação preventiva — Marina Azevedo Lima

## Resumo
Paciente do sexo feminino, 34 anos, previamente saudável, iniciou o uso do HealthInPulse com perfil metabólico normal. Ao longo de 60 dias de monitoramento contínuo pela pulseira Care Plus, foram detectados **sinais discretos e progressivos de piora metabólica** que justificam intervenção precoce.

## Tendência observada nos 60 dias
- Ganho de peso: 64 kg → **70 kg** (+6 kg; IMC 23.2 → 25.4)
- Glicemia em jejum: 88 → **112 mg/dL** (passou para faixa de pré-diabetes)
- HbA1c: 5.2 → **5.9%** (pré-diabetes)
- Frequência cardíaca de repouso média: 70 → **84 bpm**
- Pressão arterial média: 114/74 → **128/84 mmHg**
- Qualidade do sono caiu de boa para regular (eficiência 76%)

## Probabilidades clínicas estimadas
- Pré-diabetes — **62%**
- Síndrome metabólica inicial — **48%**
- Hipertensão futura — **36%**
- Risco cardiovascular aumentado — **31%**
- Apneia do sono — **18%**

## Conclusão
A detecção precoce permite intervenção **antes** da evolução para um quadro grave. Recomenda-se ajuste de estilo de vida (dieta + atividade física), monitoramento mantido pela pulseira e reavaliação em 3 meses.`,
      riskLevel:  'MODERATE',
      suggestions: JSON.stringify([
        { type: 'lifestyle',  text: 'Reduzir carboidratos refinados e açúcar — encaminhar para nutricionista' },
        { type: 'lifestyle',  text: 'Atividade física aeróbica 150 min/semana + treino de força 2x/semana' },
        { type: 'exam',       text: 'Reavaliar HbA1c e perfil lipídico em 90 dias' },
        { type: 'info',       text: 'Manter monitoramento contínuo via pulseira Care Plus' },
      ]),
      generatedAt: new Date(Date.now() - 1 * DAY),
    },
  });

  // Consultas Marina
  await prisma.appointment.create({
    data: {
      patientId: marinaId, doctorId,
      scheduledAt: new Date(Date.now() - 58 * DAY),
      duration: 30, status: 'COMPLETED',
      notes: 'Avaliação preventiva inicial — paciente saudável buscando monitoramento',
    },
  });
  await prisma.appointment.create({
    data: {
      patientId: marinaId, doctorId,
      scheduledAt: new Date(Date.now() + 4 * DAY + 15 * HOUR),
      duration: 30, status: 'SCHEDULED',
      notes: 'Revisão dos exames recentes e plano de intervenção precoce',
    },
  });

  // Notificações Marina
  await prisma.notification.createMany({
    data: [
      {
        userId: marinaUser.id, type: 'ALERT',
        title:   'Tendência de glicemia em alta',
        message: 'Sua glicemia média subiu 24% em 60 dias',
        read: false,
        metadata: JSON.stringify({ severity: 'medium' }),
        createdAt: new Date(Date.now() - 4 * DAY),
      },
      {
        userId: marinaUser.id, type: 'INFO',
        title:   'Novo relatório disponível',
        message: 'Análise preventiva da pulseira Care Plus pronta para visualização',
        read: false,
        metadata: JSON.stringify({}),
        createdAt: new Date(Date.now() - 1 * DAY),
      },
    ],
  });

  // ─── Catálogo de recompensas ──────────────────────────────
  console.log('  → catálogo de recompensas');
  const rewards = await Promise.all([
    prisma.reward.create({ data: {
      title: 'Guia nutricional personalizado', type: 'item',
      description: 'PDF com plano alimentar adaptado ao seu perfil',
      costCoins: 50,
    }}),
    prisma.reward.create({ data: {
      title: 'Desconto de 20% em exames laboratoriais', type: 'discount',
      description: 'Cupom para usar na rede credenciada Care Plus',
      costCoins: 150,
    }}),
    prisma.reward.create({ data: {
      title: 'Kit fitness Care Plus', type: 'item',
      description: 'Garrafa, faixa elástica e podômetro',
      costCoins: 200,
    }}),
    prisma.reward.create({ data: {
      title: 'Consulta com nutricionista', type: 'consultation',
      description: 'Sessão de 45 min com profissional credenciado',
      costCoins: 300,
    }}),
    prisma.reward.create({ data: {
      title: 'Consulta com especialista', type: 'consultation',
      description: 'Endocrinologia, cardiologia ou medicina do sono',
      costCoins: 500,
    }}),
    prisma.reward.create({ data: {
      title: 'Check-up cardiológico completo', type: 'exam',
      description: 'Eletrocardiograma + ecocardiograma + holter 24h',
      costCoins: 800,
    }}),
  ]);

  // ─── Metas iniciais e coins ───────────────────────────────
  console.log('  → metas iniciais e saldo de coins');

  // João — caso grave, metas focadas em controle pressórico e glicemia
  const joaoGoals = [
    {
      title: 'Reduzir pressão sistólica',
      description: 'Manter sistólica abaixo de 130 mmHg',
      metric: 'systolic', targetCmp: 'lte', targetValue: 130,
      rangeMax: 160, current: 146, progress: 30, coinsReward: 80, source: 'triage',
    },
    {
      title: 'Controlar glicemia',
      description: 'Glicemia em jejum abaixo de 130 mg/dL',
      metric: 'glucose', targetCmp: 'lte', targetValue: 130,
      rangeMax: 200, current: 184, progress: 23, coinsReward: 80, source: 'triage',
    },
    {
      title: 'Caminhar 30 min/dia',
      description: 'Atividade aeróbica leve, 5x por semana',
      metric: 'steps', targetCmp: 'gte', targetValue: 7000,
      rangeMin: 0, current: 3200, progress: 46, coinsReward: 50, source: 'triage',
    },
    {
      title: 'Hidratação diária',
      description: 'Pelo menos 2 litros de água por dia',
      metric: 'custom', targetCmp: 'gte', targetValue: 7,
      rangeMin: 0, current: 5, progress: 71, coinsReward: 30, source: 'triage',
    },
  ];
  for (const g of joaoGoals) {
    await prisma.healthGoal.create({ data: { patientId: joaoId, ...g, status: 'ACTIVE' } });
  }
  // Uma meta já concluída pra mostrar progresso
  await prisma.healthGoal.create({ data: {
    patientId: joaoId,
    title: 'Iniciar acompanhamento',
    description: 'Primeira consulta + exames de rotina',
    metric: 'custom', targetCmp: 'gte', targetValue: 1,
    current: 1, progress: 100,
    status: 'DONE', coinsReward: 40, source: 'manual',
    completedAt: new Date(Date.now() - 11 * DAY),
  }});

  // Marina — preventivo, metas mais leves
  const marinaGoals = [
    {
      title: 'Estabilizar glicemia',
      description: 'Glicemia média abaixo de 110 mg/dL',
      metric: 'glucose', targetCmp: 'lte', targetValue: 110,
      rangeMax: 130, current: 112, progress: 90, coinsReward: 60, source: 'triage',
    },
    {
      title: 'Manter pressão saudável',
      description: 'Sistólica abaixo de 125 mmHg',
      metric: 'systolic', targetCmp: 'lte', targetValue: 125,
      rangeMax: 140, current: 128, progress: 80, coinsReward: 60, source: 'triage',
    },
    {
      title: 'Caminhar 30 min/dia',
      description: 'Atividade aeróbica leve, 5x por semana',
      metric: 'steps', targetCmp: 'gte', targetValue: 7000,
      rangeMin: 0, current: 6200, progress: 88, coinsReward: 50, source: 'triage',
    },
    {
      title: 'Dormir 7-9h por noite',
      description: 'Higiene do sono e qualidade de descanso',
      metric: 'custom', targetCmp: 'between',
      rangeMin: 7, rangeMax: 9, current: 6.3, progress: 70, coinsReward: 40, source: 'triage',
    },
  ];
  for (const g of marinaGoals) {
    await prisma.healthGoal.create({ data: { patientId: marinaId, ...g, status: 'ACTIVE' } });
  }
  await prisma.healthGoal.create({ data: {
    patientId: marinaId,
    title: 'Triagem inicial',
    description: 'Completar primeira triagem do sistema',
    metric: 'custom', targetCmp: 'gte', targetValue: 1,
    current: 1, progress: 100,
    status: 'DONE', coinsReward: 20, source: 'manual',
    completedAt: new Date(Date.now() - 50 * DAY),
  }});

  // Transações iniciais de coins
  const joaoCoins = 220;
  await prisma.healthCoinTx.createMany({ data: [
    { patientId: joaoId, delta: 100, reason: 'Bônus: bem-vindo ao HealthInPulse', refType: 'bonus',
      createdAt: new Date(Date.now() - 12 * DAY) },
    { patientId: joaoId, delta: 20,  reason: 'Bônus: triagem concluída', refType: 'triage',
      createdAt: new Date(Date.now() - 5  * DAY) },
    { patientId: joaoId, delta: 40,  reason: 'Meta concluída: Iniciar acompanhamento', refType: 'goal',
      createdAt: new Date(Date.now() - 11 * DAY) },
    { patientId: joaoId, delta: 30,  reason: 'Dia de adesão completa ao monitoramento', refType: 'bonus',
      createdAt: new Date(Date.now() - 2  * DAY) },
    { patientId: joaoId, delta: 30,  reason: '7 dias consecutivos de uso da pulseira', refType: 'bonus',
      createdAt: new Date(Date.now() - 1  * DAY) },
  ]});
  await prisma.patient.update({ where: { id: joaoId }, data: { healthCoins: joaoCoins } });

  const marinaCoins = 410;
  await prisma.healthCoinTx.createMany({ data: [
    { patientId: marinaId, delta: 100, reason: 'Bônus: bem-vindo ao HealthInPulse', refType: 'bonus',
      createdAt: new Date(Date.now() - 58 * DAY) },
    { patientId: marinaId, delta: 20,  reason: 'Meta concluída: Triagem inicial', refType: 'goal',
      createdAt: new Date(Date.now() - 50 * DAY) },
    { patientId: marinaId, delta: 50,  reason: 'Bônus: 30 dias consecutivos de uso', refType: 'bonus',
      createdAt: new Date(Date.now() - 28 * DAY) },
    { patientId: marinaId, delta: 30,  reason: 'Bônus: atividade física semanal', refType: 'bonus',
      createdAt: new Date(Date.now() - 20 * DAY) },
    { patientId: marinaId, delta: 50,  reason: 'Bônus: 60 dias consecutivos de uso', refType: 'bonus',
      createdAt: new Date(Date.now() - 2  * DAY) },
    { patientId: marinaId, delta: 60,  reason: 'Bônus: hábitos saudáveis semanais', refType: 'bonus',
      createdAt: new Date(Date.now() - 7  * DAY) },
    { patientId: marinaId, delta: 100, reason: 'Promoção: paciente preventivo', refType: 'bonus',
      createdAt: new Date(Date.now() - 1  * DAY) },
  ]});
  await prisma.patient.update({ where: { id: marinaId }, data: { healthCoins: marinaCoins } });

  // Um resgate antigo da Marina (pra mostrar histórico de loja)
  await prisma.rewardRedemption.create({
    data: {
      patientId: marinaId,
      rewardId:  rewards[0].id,
      costCoins: rewards[0].costCoins,
      status:    'APPROVED',
      redeemedAt: new Date(Date.now() - 25 * DAY),
    },
  });
  await prisma.healthCoinTx.create({ data: {
    patientId: marinaId, delta: -rewards[0].costCoins,
    reason: `Resgate: ${rewards[0].title}`, refType: 'redemption',
    createdAt: new Date(Date.now() - 25 * DAY),
  }});
  // Saldo real da Marina após esse resgate
  await prisma.patient.update({
    where: { id: marinaId },
    data:  { healthCoins: marinaCoins - rewards[0].costCoins },
  });

  console.log('✅ Seed concluído!');
  console.log('');
  console.log('  👩‍⚕️ Médica:  doctor@healthinpulse.dev  / Doctor@123  (Dra. Ana Beatriz)');
  console.log('  🧑 João:    joao@healthinpulse.dev    / Joao@123    (caso grave)');
  console.log('  👩 Marina:  marina@healthinpulse.dev  / Marina@123  (preventivo)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

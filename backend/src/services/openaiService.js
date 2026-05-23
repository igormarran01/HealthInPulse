const OpenAI = require('openai');
const aiSimulator = require('./aiSimulator');

const HAS_KEY = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-'));
const client = HAS_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// ─── Análise de exame (OCR + interpretação) ──────────────────

const analyzeExam = async ({ base64, mimeType }) => {
  if (!HAS_KEY) {
    // Sem chave: não conseguimos OCR — devolve resultado neutro
    return {
      ocrText:  '[Análise de IA indisponível — chave OpenAI não configurada]',
      summary:  'Exame recebido e armazenado. Análise automática requer configuração da IA.',
      findings: [],
      riskLevel: 'INCONCLUSIVE',
    };
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um assistente médico especializado em interpretação de exames.
Analise o documento fornecido e retorne APENAS um JSON com a estrutura:
{
  "ocrText": "texto extraído do documento",
  "summary": "resumo clínico em linguagem simples para o paciente",
  "findings": [
    { "name": "nome do marcador", "value": "valor encontrado", "unit": "unidade", "status": "normal|alto|baixo|critico" }
  ],
  "riskLevel": "LOW|MODERATE|HIGH|CRITICAL"
}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
          { type: 'text', text: 'Analise este exame médico.' },
        ],
      },
    ],
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

// ─── Análise de triagem ──────────────────────────────────────

const analyzeTriageAnswers = async (answers, patientContext) => {
  if (!HAS_KEY) {
    // Sem OPENAI_API_KEY → simulador local (determinístico baseado em keywords)
    return aiSimulator.analyzeTriage(answers, patientContext);
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um assistente de triagem médica. Com base nas respostas do paciente,
avalie o risco e forneça orientações. Retorne APENAS JSON com:
{
  "riskLevel": "LOW|MODERATE|HIGH|CRITICAL",
  "score": 0-100,
  "summary": "avaliação resumida",
  "suggestions": [
    { "type": "action|warning|info", "text": "orientação" }
  ],
  "urgency": "pode aguardar|consultar em breve|urgente|emergência"
}`,
      },
      {
        role: 'user',
        content: `Contexto do paciente: ${JSON.stringify(patientContext)}
Respostas da triagem: ${JSON.stringify(answers)}`,
      },
    ],
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

// ─── Relatório completo de saúde ────────────────────────────

const generateHealthReport = async ({ patient, vitals, exams, triageAnswers }) => {
  if (!HAS_KEY) {
    // Fallback simulado — gera síntese estruturada com base nos vitais e exames recentes
    const latest = vitals?.[0];
    const examLines = (exams || []).slice(0, 3).map((e) => `- ${e.title}: ${e.examResult?.summary || 'aguardando análise'}`).join('\n');
    const triageLine = (triageAnswers || []).length > 0
      ? `Triagens registradas: ${triageAnswers.length} sessão(ões)`
      : 'Sem triagens recentes';

    // Heurística de risco
    let level = 'LOW';
    if (latest?.systolic > 140 || latest?.glucose > 160 || latest?.oxygenSat < 94) level = 'HIGH';
    else if (latest?.systolic > 130 || latest?.glucose > 130 || latest?.oxygenSat < 96) level = 'MODERATE';

    const content = `# Síntese clínica — ${patient?.fullName || 'paciente'}

## Resumo
Relatório gerado com base nas leituras recentes da pulseira Care Plus e exames disponíveis. A análise considera vitais dos últimos 30 dias e os exames mais recentes.

## Sinais vitais mais recentes
${latest ? `- Frequência cardíaca: **${latest.heartRate} bpm**
- Pressão arterial: **${latest.systolic}/${latest.diastolic} mmHg**
- SpO₂: **${latest.oxygenSat}%**
- Glicemia: **${latest.glucose} mg/dL**` : '- Sem leituras recentes registradas'}

## Exames recentes
${examLines || '- Sem exames recentes'}

## Triagens
${triageLine}

## Conclusão
${level === 'HIGH'
  ? 'Os indicadores apontam quadro de **risco elevado**. Recomenda-se intervenção médica e acompanhamento contínuo.'
  : level === 'MODERATE'
    ? 'Quadro em **atenção moderada** — sinais que pedem ajuste de hábitos e acompanhamento mais próximo.'
    : 'Quadro **estável**. Manter rotina de monitoramento e hábitos saudáveis.'}`;

    return {
      content,
      riskLevel: level,
      suggestions: level === 'HIGH'
        ? [
            { type: 'medication', text: 'Avaliar ajuste medicamentoso' },
            { type: 'exam',       text: 'Solicitar exames complementares (perfil lipídico, função renal)' },
            { type: 'specialist', text: 'Encaminhar para especialista' },
          ]
        : level === 'MODERATE'
        ? [
            { type: 'lifestyle',  text: 'Reduzir carboidratos refinados, aumentar atividade física' },
            { type: 'exam',       text: 'Reavaliar em 90 dias' },
          ]
        : [
            { type: 'lifestyle',  text: 'Manter rotina atual' },
            { type: 'info',       text: 'Continuar monitoramento via pulseira' },
          ],
    };
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um médico assistente. Gere um relatório de saúde detalhado baseado nos dados fornecidos.
Retorne APENAS JSON com:
{
  "content": "relatório completo em markdown",
  "riskLevel": "LOW|MODERATE|HIGH|CRITICAL",
  "suggestions": [
    { "type": "lifestyle|medication|exam|specialist", "text": "recomendação" }
  ]
}`,
      },
      {
        role: 'user',
        content: JSON.stringify({ patient, vitals, exams, triageAnswers }),
      },
    ],
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

// ─── Análise de vitais em tempo real ────────────────────────

const analyzeVitalSign = async (vital, patientContext) => {
  if (!HAS_KEY) {
    // Heurística simples
    let severity = 'none';
    const msgs = [];
    if (vital.oxygenSat != null && vital.oxygenSat < 92) { severity = 'high';   msgs.push(`SpO₂ ${vital.oxygenSat}% — saturação baixa`); }
    else if (vital.oxygenSat != null && vital.oxygenSat < 95) { severity = 'medium'; msgs.push(`SpO₂ ${vital.oxygenSat}% — atenção`); }
    if (vital.systolic > 160) { severity = 'high';   msgs.push(`Sistólica ${vital.systolic} mmHg — pressão muito alta`); }
    else if (vital.systolic > 140) { severity = severity === 'high' ? 'high' : 'medium'; msgs.push(`Sistólica ${vital.systolic} mmHg`); }
    if (vital.glucose > 250)  { severity = 'high';   msgs.push(`Glicemia ${vital.glucose} mg/dL — descompensada`); }
    return {
      alert:    severity !== 'none',
      severity,
      message:  msgs.join('. ') || 'Sinais dentro da normalidade',
    };
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini', // modelo mais rápido para tempo real
    messages: [
      {
        role: 'system',
        content: `Analise o sinal vital e determine se há algum alerta.
Retorne APENAS JSON: { "alert": boolean, "severity": "none|low|medium|high", "message": "descrição" }`,
      },
      {
        role: 'user',
        content: `Paciente: ${JSON.stringify(patientContext)}\nSinal vital: ${JSON.stringify(vital)}`,
      },
    ],
    max_tokens: 200,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
};

module.exports = { analyzeExam, analyzeTriageAnswers, generateHealthReport, analyzeVitalSign };

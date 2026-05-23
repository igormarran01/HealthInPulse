// Helpers para campos que guardam JSON serializado em SQLite.

const parseJson = (val, fallback = null) => {
  if (val == null) return fallback;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return fallback; }
};

const stringifyJson = (val) => {
  if (val == null) return val;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
};

const parsePatient = (p) => p && ({
  ...p,
  allergies:    parseJson(p.allergies,    []),
  chronicConds: parseJson(p.chronicConds, []),
});

const parseAiReport = (r) => r && ({
  ...r,
  suggestions: parseJson(r.suggestions, null),
});

const parseExamResult = (er) => er && ({
  ...er,
  findings: parseJson(er.findings, []),
});

const parseExam = (e) => e && ({
  ...e,
  examResult: parseExamResult(e.examResult),
});

const parseTriage = (t) => t && ({
  ...t,
  answers:  parseJson(t.answers,  []),
  aiReport: parseAiReport(t.aiReport),
});

const parseWearable = (w) => w && ({
  ...w,
  payload: parseJson(w.payload, {}),
});

const parseNotification = (n) => n && ({
  ...n,
  metadata: parseJson(n.metadata, null),
});

module.exports = {
  parseJson, stringifyJson,
  parsePatient, parseAiReport, parseExam, parseExamResult,
  parseTriage, parseWearable, parseNotification,
};

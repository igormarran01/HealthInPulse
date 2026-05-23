import { useState, useEffect, useRef } from 'react';

// Simulador de pulseira: gera uma nova leitura a cada tick a partir
// da leitura anterior, com pequena reversão à média e ruído controlado.
// Calibrado para parecer realista em um adulto com pressão limítrofe.

const DEFAULTS = {
  heartRate:   { jitter: 1.6,  min: 50,   max: 130, round: 0 },
  systolic:    { jitter: 1.4,  min: 95,   max: 175, round: 0 },
  diastolic:   { jitter: 1.0,  min: 60,   max: 110, round: 0 },
  oxygenSat:   { jitter: 0.20, min: 88,   max: 100, round: 1 },
  temperature: { jitter: 0.05, min: 35.5, max: 38.0, round: 1 },
  glucose:     { jitter: 2.0,  min: 75,   max: 230, round: 0 },
};

const FALLBACK = {
  heartRate: 78, systolic: 128, diastolic: 84,
  oxygenSat: 97.5, temperature: 36.6, glucose: 110,
};

const clamp   = (v, min, max) => Math.min(Math.max(v, min), max);
const roundTo = (v, d) => Number(v.toFixed(d));

function next(prev, baseline, cfg) {
  const drift = (baseline - prev) * 0.06;
  const noise = (Math.random() - 0.5) * 2 * cfg.jitter;
  return roundTo(clamp(prev + drift + noise, cfg.min, cfg.max), cfg.round);
}

function extractSparkPoint(v) {
  return {
    recordedAt: v.recordedAt,
    heartRate:  v.heartRate,
    systolic:   v.systolic,
    diastolic:  v.diastolic,
    oxygenSat:  v.oxygenSat,
    glucose:    v.glucose,
  };
}

export function useLiveVitals(initialVitals, initialTrend, {
  intervalMs = 1000,
  sparkSize  = 30,
} = {}) {
  const baselines = useRef({ ...FALLBACK });
  const seededRef = useRef(false);

  const [data, setData] = useState(() => ({
    current: { ...FALLBACK, recordedAt: new Date().toISOString() },
    spark:   [],
  }));

  // Quando o fetch inicial chega, ancora baselines e reseta estado
  useEffect(() => {
    if (seededRef.current || !initialVitals) return;
    seededRef.current = true;

    for (const k of Object.keys(DEFAULTS)) {
      if (initialVitals[k] != null) baselines.current[k] = initialVitals[k];
    }

    const seedSpark = (initialTrend || []).slice(-sparkSize).map(extractSparkPoint);
    setData({
      current: {
        ...FALLBACK,
        ...initialVitals,
        recordedAt: new Date().toISOString(),
      },
      spark: seedSpark,
    });
  }, [initialVitals, initialTrend, sparkSize]);

  // Tick principal
  useEffect(() => {
    const id = setInterval(() => {
      setData(({ current, spark }) => {
        const out = { recordedAt: new Date().toISOString() };
        for (const [k, cfg] of Object.entries(DEFAULTS)) {
          out[k] = next(current[k] ?? baselines.current[k], baselines.current[k], cfg);
        }
        const newSpark = [...spark.slice(-(sparkSize - 1)), extractSparkPoint(out)];
        return { current: out, spark: newSpark };
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, sparkSize]);

  return data;
}

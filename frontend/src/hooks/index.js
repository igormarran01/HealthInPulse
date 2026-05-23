import { useState, useEffect, useCallback } from 'react';

// ─── useFetch — busca dados com loading/error ─────────────────
export function useFetch(fn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn();
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── useAsync — executa ações com feedback ────────────────────
export function useAsync(fn) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      return result;
    } catch (e) {
      const msg = e.response?.data?.error || 'Erro inesperado';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [fn]);

  return { run, loading, error };
}

// ─── useDebounce ──────────────────────────────────────────────
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── useLocalStorage ─────────────────────────────────────────
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial; }
    catch { return initial; }
  });

  const set = useCallback((v) => {
    setValue(v);
    localStorage.setItem(key, JSON.stringify(v));
  }, [key]);

  return [value, set];
}

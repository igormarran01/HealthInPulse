import { useState, useEffect, useRef } from 'react';

// Interpola suavemente entre o valor anterior e o novo valor.
// Ideal para números que mudam com frequência (ex: vitais ao vivo).
export function useCountUp(value, { duration = 800, decimals = 0 } = {}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (value == null) { setDisplay(null); return; }
    fromRef.current = display ?? value;
    startRef.current = null;

    const tick = (t) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(Number(next.toFixed(decimals)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, decimals]);

  return display;
}

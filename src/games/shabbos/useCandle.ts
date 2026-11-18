import { useEffect, useState } from 'react';
import { load, save } from '../../shared/storage';
import { HEBCAL_URL, estimateCandleLighting, isCurrent, parseHebcal, type CandleInfo } from './logic/hebcal';
import { meta } from './meta';

export type CandleStatus = { info: CandleInfo; loading: boolean; note: string };

function noteFor(info: CandleInfo): string {
  if (info.source === 'hebcal') return 'Live from Hebcal';
  if (info.source === 'cache') return 'Offline: using the last time we fetched from Hebcal';
  return 'Offline: estimated from Tel Aviv sunset (18 min before)';
}

/** This week's Tel Aviv candle-lighting time: Hebcal, else a cached copy, else an estimate. */
export function useCandle(): CandleStatus {
  const [state, setState] = useState<CandleStatus>(() => {
    const now = Date.now();
    const cached = load<CandleInfo | null>(meta.id, 'candles', null);
    const info: CandleInfo = isCurrent(cached, now) ? { ...cached, source: 'cache' } : estimateCandleLighting(now);
    return { info, loading: true, note: 'Checking Hebcal...' };
  });

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch(HEBCAL_URL, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: unknown) => {
        const info = parseHebcal(json);
        if (!info) throw new Error('no candle-lighting item');
        // Hebcal may already show next week on Saturday night; either way it's the upcoming one.
        save(meta.id, 'candles', info);
        if (alive) setState({ info, loading: false, note: noteFor(info) });
      })
      .catch(() => {
        if (alive) setState((s) => ({ info: s.info, loading: false, note: noteFor(s.info) }));
      })
      .finally(() => clearTimeout(timer));
    return () => {
      alive = false;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  return state;
}

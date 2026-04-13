import { useEffect, useMemo, useState } from 'react';
import { LuClock } from 'react-icons/lu';
import { apiJson } from '@/utils/api';

const pad2 = n => String(n).padStart(2, '0');

const formatTime = (d, { timeZone, offsetMinutes }) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      ...(timeZone ? { timeZone } : {}),
    }).format(d);
  } catch {
    const baseMs = d.getTime();
    const ms = baseMs + (Number.isFinite(offsetMinutes) ? offsetMinutes : 0) * 60 * 1000;
    const shifted = new Date(ms);
    return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
  }
};

const DigitalClock = ({ className = '' }) => {
  const [pulse, setPulse] = useState(0);
  const [sync, setSync] = useState(null);

  const syncFromServer = async () => {
    const data = await apiJson('/time/');
    const epochMs =
      typeof data?.epoch_ms === 'number'
        ? data.epoch_ms
        : typeof data?.now === 'string'
          ? Date.parse(data.now)
          : NaN;

    setSync({
      epochMs: Number.isFinite(epochMs) ? epochMs : 0,
      perfMs: typeof performance !== 'undefined' ? performance.now() : 0,
      timeZone: data?.time_zone || null,
      offsetMinutes: typeof data?.offset_minutes === 'number' ? data.offset_minutes : 0,
    });
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        await syncFromServer();
      } catch {
        if (!mounted) return;
        setSync({
          epochMs: 0,
          perfMs: typeof performance !== 'undefined' ? performance.now() : 0,
          timeZone: null,
          offsetMinutes: 0,
        });
      }
    };

    load();
    const resync = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(resync);
    };
  }, []);

  useEffect(() => {
    if (!sync) return;
    const t = setInterval(() => setPulse(x => (x + 1) % 1_000_000), 1000);
    return () => clearInterval(t);
  }, [sync]);

  const now = useMemo(() => {
    if (!sync) return null;
    const elapsed = typeof performance !== 'undefined' ? performance.now() - sync.perfMs : 0;
    return new Date(sync.epochMs + elapsed);
  }, [sync, pulse]);

  const label = useMemo(() => {
    if (!sync || !now || !sync.epochMs) return '--:--:--';
    return formatTime(now, sync);
  }, [now, sync]);

  return (
    <div
      className={[
        'hidden lg:flex items-center gap-2 rounded-full px-3 py-1.5',
        'bg-slate-950/70 text-cyan-100 ring-1 ring-cyan-400/25',
        'shadow-[0_0_18px_rgba(34,211,238,0.25)] backdrop-blur',
        className,
      ].join(' ')}
      aria-label={`Current time ${label}`}
      title="Live time"
    >
      <LuClock className="size-4 text-cyan-200/90" />
      <span className="font-mono text-sm tracking-[0.18em] tabular-nums">{label}</span>
    </div>
  );
};

export default DigitalClock;

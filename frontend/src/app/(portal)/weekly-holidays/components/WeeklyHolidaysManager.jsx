import { useEffect, useMemo, useState } from 'react';
import { LuRefreshCw } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const weekDays = [
  { value: 0, label: 'Saturday' },
  { value: 1, label: 'Sunday' },
  { value: 2, label: 'Monday' },
  { value: 3, label: 'Tuesday' },
  { value: 4, label: 'Wednesday' },
  { value: 5, label: 'Thursday' },
  { value: 6, label: 'Friday' },
];

const WeeklyHolidaysManager = () => {
  const [flash, setFlash] = useState('');
  const [weekly, setWeekly] = useState({
    id: null,
    title: 'Weekly Holiday',
    description: '',
    is_active: true,
    days: [],
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setError('');
    try {
      const data = await apiJson('/weekly-holidays/current/');
      setWeekly({
        id: data?.id ?? null,
        title: data?.title || 'Weekly Holiday',
        description: data?.description || '',
        is_active: Boolean(data?.is_active ?? true),
        days: Array.isArray(data?.days) ? data.days : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load weekly holidays.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDays = useMemo(() => new Set((weekly.days || []).map(n => Number(n))), [weekly.days]);

  const toggleDay = dayValue => {
    const v = Number(dayValue);
    setWeekly(prev => {
      const next = new Set((prev.days || []).map(n => Number(n)));
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return { ...prev, days: Array.from(next).filter(n => Number.isFinite(n)).sort((a, b) => a - b) };
    });
  };

  const save = async () => {
    setIsSaving(true);
    setError('');
    setFlash('');
    try {
      await apiJson('/weekly-holidays/current/', {
        method: 'POST',
        body: {
          title: weekly.title,
          description: weekly.description,
          is_active: weekly.is_active,
          days: weekly.days,
        },
      });
      setFlash('Weekly holidays saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save weekly holidays.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <h6 className="card-title">Weekly Holidays</h6>
        <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isSaving}>
          <LuRefreshCw className="size-4" /> Refresh
        </button>
      </div>

      <div className="p-5">
        {flash ? (
          <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-default-800">
            {flash}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="inline-block mb-2 text-base font-medium">Title</label>
            <input
              className="form-input"
              value={weekly.title}
              onChange={e => setWeekly(w => ({ ...w, title: e.target.value }))}
              disabled={isSaving}
            />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input
              id="weekly-active"
              type="checkbox"
              className="form-checkbox rounded"
              checked={Boolean(weekly.is_active)}
              onChange={e => setWeekly(w => ({ ...w, is_active: e.target.checked }))}
              disabled={isSaving}
            />
            <label htmlFor="weekly-active" className="text-sm text-default-700">
              Active
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="inline-block mb-2 text-base font-medium">Weekly Holiday Days</label>
          <div className="flex flex-wrap gap-3">
            {weekDays.map(d => (
              <label key={d.value} className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="form-checkbox rounded-full"
                  checked={selectedDays.has(d.value)}
                  onChange={() => toggleDay(d.value)}
                  disabled={isSaving}
                />
                <span className="text-sm text-default-700">{d.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 text-xs text-default-500">These days will show as “Break for Holiday” in Live Class calendar and Attendance.</div>
        </div>

        <div className="mt-4">
          <label className="inline-block mb-2 text-base font-medium">Description (optional)</label>
          <textarea
            className="form-input"
            rows={3}
            value={weekly.description}
            onChange={e => setWeekly(w => ({ ...w, description: e.target.value }))}
            disabled={isSaving}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" className="btn bg-primary text-white" onClick={save} disabled={isSaving}>
            Save Weekly Holidays
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyHolidaysManager;


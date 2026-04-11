import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const PortalExamPromotions = () => {
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [bulk, setBulk] = useState({
    academic_year: '',
    from_class: '',
    from_section: '',
    to_class: '',
    to_section: '',
    student_ids: '',
    exam: '',
  });

  const canUseApi = Boolean(authStorage.getAccess());

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const [data, classSimple] = await Promise.all([apiJson('/promotions/'), apiJson('/academic-classes/simple/')]);
      const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(rows);
      setClasses(Array.isArray(classSimple) ? classSimple : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load promotions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const submitBulk = async e => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    try {
      const ids = String(bulk.student_ids || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => Number(s))
        .filter(n => Number.isFinite(n) && n > 0);

      const payload = {
        academic_year: bulk.academic_year,
        from_class: Number(bulk.from_class),
        from_section: bulk.from_section,
        to_class: Number(bulk.to_class),
        to_section: bulk.to_section,
        student_ids: ids,
        exam: bulk.exam ? Number(bulk.exam) : null,
      };
      await apiJson('/promotions/bulk/', { method: 'POST', body: payload });
      setFlash('Students promoted.');
      setBulk({ academic_year: '', from_class: '', from_section: '', to_class: '', to_section: '', student_ids: '', exam: '' });
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to promote students.');
    }
  };

  if (!canUseApi) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Promotions" />
      <main>
        <PageBreadcrumb title="Promotions" subtitle="Exam" />

        <div className="card mb-6">
          <div className="card-header">
            <h6 className="card-title">Bulk Promotion</h6>
          </div>
          <div className="card-body">
            {flash ? <div className="mb-3 text-sm text-primary">{flash}</div> : null}
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            <form onSubmit={submitBulk} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-default-700">Academic Year</label>
                <input
                  className="form-input w-full"
                  value={bulk.academic_year}
                  onChange={e => setBulk(b => ({ ...b, academic_year: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-default-700">From Class</label>
                <select
                  className="form-select w-full"
                  value={bulk.from_class}
                  onChange={e => setBulk(b => ({ ...b, from_class: e.target.value }))}
                  required
                >
                  <option value="">Select</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-default-700">From Section</label>
                <input className="form-input w-full" value={bulk.from_section} onChange={e => setBulk(b => ({ ...b, from_section: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-default-700">To Class</label>
                <select className="form-select w-full" value={bulk.to_class} onChange={e => setBulk(b => ({ ...b, to_class: e.target.value }))} required>
                  <option value="">Select</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-default-700">To Section</label>
                <input className="form-input w-full" value={bulk.to_section} onChange={e => setBulk(b => ({ ...b, to_section: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-default-700">Exam ID (optional)</label>
                <input className="form-input w-full" value={bulk.exam} onChange={e => setBulk(b => ({ ...b, exam: e.target.value }))} />
              </div>
              <div className="md:col-span-3">
                <label className="text-sm text-default-700">Student IDs (comma separated)</label>
                <input className="form-input w-full" value={bulk.student_ids} onChange={e => setBulk(b => ({ ...b, student_ids: e.target.value }))} required />
              </div>
              <div className="md:col-span-3">
                <button className="btn bg-primary text-white" type="submit">
                  Promote
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Promotion History</h6>
            <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }}>
              Refresh
            </button>
          </div>
          <div className="card-body">
            {isLoading ? <div className="text-sm">Loading...</div> : null}
            {!isLoading && items.length === 0 ? <div className="text-sm text-default-600">No promotions found.</div> : null}
            {items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="font-semibold whitespace-nowrap">
                    <tr className="text-sm text-default-800 divide-x divide-default-200">
                      <th className="px-3.5 py-3 text-start">Student</th>
                      <th className="px-3.5 py-3 text-start">From</th>
                      <th className="px-3.5 py-3 text-start">To</th>
                      <th className="px-3.5 py-3 text-start">Year</th>
                      <th className="px-3.5 py-3 text-start">At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {items.map(p => (
                      <tr key={p.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                        <td className="px-3.5 py-3 text-sm">{p.student_name}</td>
                        <td className="px-3.5 py-3 text-sm">
                          {p.from_class_label}
                          {p.from_section ? ` (${p.from_section})` : ''}
                        </td>
                        <td className="px-3.5 py-3 text-sm">
                          {p.to_class_label}
                          {p.to_section ? ` (${p.to_section})` : ''}
                        </td>
                        <td className="px-3.5 py-3 text-sm">{p.academic_year}</td>
                        <td className="px-3.5 py-3 text-sm">{String(p.promoted_at || '').slice(0, 19).replace('T', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
};

export default PortalExamPromotions;


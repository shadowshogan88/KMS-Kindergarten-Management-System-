import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiForm, apiJson } from '@/utils/api';
import { authStorage, getApiBaseUrl } from '@/utils/auth';

const keyOf = (studentId, subjectId) => `${studentId}:${subjectId}`;

const PortalExamMarks = () => {
  const canUseApi = Boolean(authStorage.getAccess());

  const [examId, setExamId] = useState('');
  const [sheet, setSheet] = useState(null);
  const [cells, setCells] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [file, setFile] = useState(null);

  const marksMap = useMemo(() => {
    const map = {};
    const rows = Array.isArray(sheet?.marks) ? sheet.marks : [];
    for (const m of rows) {
      map[keyOf(m.student_id, m.subject_id)] = m;
    }
    return map;
  }, [sheet]);

  const loadSheet = async () => {
    if (!canUseApi) return;
    if (!examId) {
      setError('Exam ID is required.');
      return;
    }
    setIsLoading(true);
    setError('');
    setFlash('');
    try {
      const data = await apiJson(`/marks/sheet/?exam=${encodeURIComponent(examId)}`);
      setSheet(data);
      const nextCells = {};
      for (const m of Array.isArray(data?.marks) ? data.marks : []) {
        nextCells[keyOf(m.student_id, m.subject_id)] = m.marks_obtained ?? '';
      }
      setCells(nextCells);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marks sheet.');
      setSheet(null);
      setCells({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // no auto-load
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const onChangeCell = (studentId, subjectId, value) => {
    setCells(prev => ({ ...prev, [keyOf(studentId, subjectId)]: value }));
  };

  const save = async () => {
    if (!sheet?.exam?.id) return;
    if (sheet?.exam?.status === 'PUBLISHED') {
      setError('Marks are locked because results are published.');
      return;
    }
    const students = Array.isArray(sheet?.students) ? sheet.students : [];
    const subjects = Array.isArray(sheet?.subjects) ? sheet.subjects : [];
    if (!students.length || !subjects.length) {
      setError('No students/subjects found for this exam.');
      return;
    }

    setIsSaving(true);
    setError('');
    setFlash('');
    try {
      const items = [];
      for (const st of students) {
        for (const sub of subjects) {
          const k = keyOf(st.id, sub.id);
          const raw = cells[k];
          const existing = marksMap[k];
          const hasValue = raw !== undefined && String(raw).trim() !== '';
          const shouldSend = hasValue || Boolean(existing);
          if (!shouldSend) continue;

          const marksObtained = hasValue ? Number(raw) : null;
          items.push({
            student: st.id,
            subject: sub.id,
            marks_obtained: Number.isFinite(marksObtained) ? marksObtained : null,
            remarks: '',
          });
        }
      }

      const res = await apiJson('/marks/bulk-upload/', { method: 'POST', body: { exam: sheet.exam.id, items } });
      setFlash(`Saved. Created: ${res.created || 0}, Updated: ${res.updated || 0}`);
      await loadSheet();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save marks.');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadSample = async () => {
    if (!examId) {
      setError('Exam ID is required to download the sample.');
      return;
    }
    setError('');
    try {
      const token = authStorage.getAccess();
      const url = `${getApiBaseUrl()}/marks/sample-excel/?exam=${encodeURIComponent(examId)}`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.detail || `Download failed (HTTP ${res.status})`;
        throw new Error(msg);
      }
      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = `marks_upload_exam_${examId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download sample.');
    }
  };

  const uploadExcel = async () => {
    if (!examId) {
      setError('Exam ID is required to upload.');
      return;
    }
    if (!file) {
      setError('Please choose an Excel file.');
      return;
    }
    setError('');
    setFlash('');
    try {
      const formData = new FormData();
      formData.append('exam', examId);
      formData.append('file', file);
      const res = await apiForm('/marks/import-excel/', { method: 'POST', formData });
      setFlash(`Imported. Created: ${res.created || 0}, Updated: ${res.updated || 0}`);
      setFile(null);
      await loadSheet();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import Excel.');
    }
  };

  if (!canUseApi) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  const subjects = Array.isArray(sheet?.subjects) ? sheet.subjects : [];
  const students = Array.isArray(sheet?.students) ? sheet.students : [];

  return (
    <>
      <PageMeta title="Marks Entry" />
      <main>
        <PageBreadcrumb title="Marks Entry" subtitle="Exam" />

        <div className="card mb-6">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Load Exam</h6>
            <div className="flex items-center gap-2">
              <input className="form-input w-40" placeholder="Exam ID" value={examId} onChange={e => setExamId(e.target.value)} />
              <button className="btn btn-sm bg-primary text-white" onClick={e => { e.preventDefault(); loadSheet(); }} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Load Sheet'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {flash ? <div className="mb-3 text-sm text-primary">{flash}</div> : null}
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}

            <div className="flex flex-wrap gap-2 items-center">
              <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); downloadSample(); }}>
                Download Excel Sample
              </button>
              <input
                type="file"
                accept=".xlsx"
                onChange={e => setFile(e.target.files && e.target.files.length ? e.target.files[0] : null)}
              />
              <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); uploadExcel(); }}>
                Upload Excel
              </button>
              {sheet?.exam ? (
                <span className="text-xs text-default-600">
                  Exam: <b>{sheet.exam.exam_name}</b> | Class: <b>{sheet.exam.classroom_label}</b> | Status:{' '}
                  <b>{sheet.exam.status}</b>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Marks Sheet</h6>
            <button className="btn btn-sm bg-primary text-white" onClick={e => { e.preventDefault(); save(); }} disabled={!sheet || isSaving}>
              {isSaving ? 'Saving...' : 'Save Marks'}
            </button>
          </div>
          <div className="card-body">
            {!sheet ? <div className="text-sm text-default-600">Load an exam to start marks entry.</div> : null}

            {sheet && (!students.length || !subjects.length) ? (
              <div className="text-sm text-default-600">No students/subjects found for this exam.</div>
            ) : null}

            {sheet && students.length && subjects.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="font-semibold whitespace-nowrap">
                    <tr className="text-sm text-default-800 divide-x divide-default-200">
                      <th className="px-3.5 py-3 text-start">Student</th>
                      {subjects.map(s => (
                        <th key={s.id} className="px-3.5 py-3 text-start">
                          <div className="text-xs text-default-600">{s.code}</div>
                          <div className="text-sm">{s.name}</div>
                          <div className="text-[11px] text-default-500">
                            Full: {s.full_marks} | Pass: {s.pass_marks}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {students.map(st => (
                      <tr key={st.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                        <td className="px-3.5 py-3 text-sm">{st.name}</td>
                        {subjects.map(sub => {
                          const k = keyOf(st.id, sub.id);
                          const existing = marksMap[k];
                          const grade = existing?.grade || '';
                          return (
                            <td key={sub.id} className="px-3.5 py-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  className="form-input w-24"
                                  value={cells[k] ?? ''}
                                  onChange={e => onChangeCell(st.id, sub.id, e.target.value)}
                                  min="0"
                                  step="0.01"
                                  disabled={sheet?.exam?.status === 'PUBLISHED'}
                                />
                                <span className="text-xs text-default-500">{grade}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <p className="mt-4 text-xs text-default-600">
              API: <code className="px-1">GET /api/v1/marks/sheet/?exam=</code> |{' '}
              <code className="px-1">POST /api/v1/marks/bulk-upload/</code> |{' '}
              <code className="px-1">GET /api/v1/marks/sample-excel/?exam=</code> |{' '}
              <code className="px-1">POST /api/v1/marks/import-excel/</code>
            </p>
          </div>
        </div>
      </main>
    </>
  );
};

export default PortalExamMarks;


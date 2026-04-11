import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const examTypes = [
  { value: 'CLASS_TEST', label: 'Class Test' },
  { value: 'MIDTERM', label: 'Midterm' },
  { value: 'FINAL', label: 'Final' },
  { value: 'MODEL_TEST', label: 'Model Test' },
];

const PortalExams = () => {
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [form, setForm] = useState({
    exam_name: '',
    classroom: '',
    subject: '',
    exam_type: 'FINAL',
    start_date: '',
    end_date: '',
  });

  const canUseApi = Boolean(authStorage.getAccess());

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const [examsData, classOptions] = await Promise.all([
        apiJson('/exams/'),
        apiJson('/academic-classes/options/'),
      ]);
      const exams = Array.isArray(examsData?.results) ? examsData.results : Array.isArray(examsData) ? examsData : [];
      setItems(exams);
      setClasses(Array.isArray(classOptions) ? classOptions : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load exams.');
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

  const classroomParsed = useMemo(() => {
    const raw = String(form.classroom || '').trim();
    if (!raw) return { classId: '', section: '' };
    const [classId, section] = raw.split(':', 2);
    return { classId, section: section || '' };
  }, [form.classroom]);

  const loadSubjects = async () => {
    if (!canUseApi) return;
    if (!classroomParsed.classId) {
      setSubjects([]);
      return;
    }
    try {
      const qs = new URLSearchParams();
      qs.set('school_class', classroomParsed.classId);
      if (classroomParsed.section) qs.set('section', classroomParsed.section);
      const data = await apiJson(`/subjects/options/?${qs.toString()}`);
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
    }
  };

  useEffect(() => {
    setForm(f => ({ ...f, subject: '' }));
    loadSubjects();
  }, [classroomParsed.classId, classroomParsed.section]);

  const createExam = async e => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    try {
      const payload = {
        exam_name: form.exam_name,
        class_name: Number(classroomParsed.classId),
        section: classroomParsed.section,
        subject: form.subject ? Number(form.subject) : null,
        exam_type: form.exam_type,
        start_date: form.start_date,
        end_date: form.end_date,
        status: 'DRAFT',
      };
      const created = await apiJson('/exams/', { method: 'POST', body: payload });
      setItems(prev => [created, ...prev]);
      setForm({ exam_name: '', classroom: '', subject: '', exam_type: 'FINAL', start_date: '', end_date: '' });
      setFlash('Exam created.');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to create exam.');
    }
  };

  const generate = async examId => {
    setError('');
    try {
      await apiJson(`/exams/${examId}/generate-results/`, { method: 'POST', body: { require_all_marks: true } });
      setFlash('Results generated.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate results.');
    }
  };

  const publish = async examId => {
    setError('');
    try {
      await apiJson(`/exams/${examId}/publish/`, { method: 'POST', body: { note: 'Published from portal' } });
      setFlash('Results published.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish results.');
    }
  };

  if (!canUseApi) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Exams" />
      <main>
        <PageBreadcrumb title="Exams" subtitle="Exam" />

        <div className="card mb-6">
          <div className="card-header">
            <h6 className="card-title">Create Exam</h6>
          </div>
          <div className="card-body">
            {flash ? <div className="mb-3 text-sm text-primary">{flash}</div> : null}
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            <form onSubmit={createExam} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-default-700">Exam Name</label>
                <input
                  className="form-input w-full"
                  value={form.exam_name}
                  onChange={e => setForm(f => ({ ...f, exam_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-default-700">Classroom</label>
                <select
                  className="form-select w-full"
                  value={form.classroom}
                  onChange={e => setForm(f => ({ ...f, classroom: e.target.value }))}
                  required
                >
                  <option value="">Select class</option>
                  {classes.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-default-700">Subject (Optional)</label>
                <select
                  className="form-select w-full"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  disabled={!classroomParsed.classId}
                >
                  <option value="">All subjects (full exam)</option>
                  {subjects.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-default-500 mt-1">Select a subject to make this a true subject-wise exam/class test.</div>
              </div>
              <div>
                <label className="text-sm text-default-700">Exam Type</label>
                <select
                  className="form-select w-full"
                  value={form.exam_type}
                  onChange={e => setForm(f => ({ ...f, exam_type: e.target.value }))}
                >
                  {examTypes.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-default-700">Start Date</label>
                <input
                  type="date"
                  className="form-input w-full"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-default-700">End Date</label>
                <input
                  type="date"
                  className="form-input w-full"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  required
                />
              </div>
              <div className="flex items-end">
                <button className="btn bg-primary text-white" type="submit">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Exam List</h6>
            <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }}>
              Refresh
            </button>
          </div>
          <div className="card-body">
            {isLoading ? <div className="text-sm">Loading...</div> : null}
            {!isLoading && items.length === 0 ? <div className="text-sm text-default-600">No exams found.</div> : null}
            {items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="font-semibold whitespace-nowrap">
                    <tr className="text-sm text-default-800 divide-x divide-default-200">
                      <th className="px-3.5 py-3 text-start">ID</th>
                      <th className="px-3.5 py-3 text-start">Exam</th>
                      <th className="px-3.5 py-3 text-start">Class</th>
                      <th className="px-3.5 py-3 text-start">Subject</th>
                      <th className="px-3.5 py-3 text-start">Type</th>
                      <th className="px-3.5 py-3 text-start">Dates</th>
                      <th className="px-3.5 py-3 text-start">Status</th>
                      <th className="px-3.5 py-3 text-start">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {items.map(exam => (
                      <tr key={exam.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                        <td className="px-3.5 py-3 text-sm">{exam.id}</td>
                        <td className="px-3.5 py-3 text-sm">{exam.exam_name}</td>
                        <td className="px-3.5 py-3 text-sm">{exam.classroom_label || exam.class_label}</td>
                        <td className="px-3.5 py-3 text-sm">{exam.subject_label ? `${exam.subject_code ? `${exam.subject_code} - ` : ''}${exam.subject_label}` : '—'}</td>
                        <td className="px-3.5 py-3 text-sm">{exam.exam_type}</td>
                        <td className="px-3.5 py-3 text-sm">
                          {exam.start_date} → {exam.end_date}
                        </td>
                        <td className="px-3.5 py-3 text-sm">{exam.status}</td>
                        <td className="px-3.5 py-3 text-sm">
                          <div className="flex gap-2">
                            <button
                              className="btn btn-xs bg-default-200"
                              onClick={e => { e.preventDefault(); generate(exam.id); }}
                              disabled={exam.status === 'PUBLISHED'}
                            >
                              Generate
                            </button>
                            <button
                              className="btn btn-xs bg-default-200"
                              onClick={e => { e.preventDefault(); publish(exam.id); }}
                              disabled={exam.status !== 'FINALIZED'}
                            >
                              Publish
                            </button>
                          </div>
                        </td>
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

export default PortalExams;

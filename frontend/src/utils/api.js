import { authStorage, getApiBaseUrl, refreshAccess } from '@/utils/auth';

const parseErrorMessage = (data, res) => {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const fieldErrorKeys = ['detail', 'message', 'non_field_errors'];
    for (const key of fieldErrorKeys) {
      const value = data[key];
      if (typeof value === 'string' && value) return value;
      if (Array.isArray(value) && value.length && typeof value[0] === 'string') return value[0];
    }
    const firstKey = Object.keys(data)[0];
    const firstValue = firstKey ? data[firstKey] : null;
    if (Array.isArray(firstValue) && firstValue.length && typeof firstValue[0] === 'string') return `${firstKey}: ${firstValue[0]}`;
    if (typeof firstValue === 'string' && firstValue) return `${firstKey}: ${firstValue}`;
  }
  return data?.detail || data?.message || (typeof data === 'string' ? data : '') || `Request failed (HTTP ${res.status})`;
};

const shouldTryRefresh = (res, data) => {
  if (res.status !== 401) return false;
  const code = data?.code;
  const detail = data?.detail;
  return code === 'token_not_valid' || detail === 'Given token not valid for any token type';
};

const parsePath = path => {
  const [pathname = '', query = ''] = String(path || '').split('?', 2);
  return {
    pathname: pathname.endsWith('/') ? pathname : `${pathname}/`,
    searchParams: new URLSearchParams(query),
  };
};

const buildPath = (pathname, searchParams) => {
  const query = searchParams?.toString?.() || '';
  return query ? `${pathname}?${query}` : pathname;
};

const makePagination = (items, searchParams) => {
  const page = Number(searchParams.get('page') || 1) || 1;
  const pageSize = Number(searchParams.get('page_size') || searchParams.get('pageSize') || 20) || 20;
  const start = Math.max(page - 1, 0) * pageSize;
  const results = items.slice(start, start + pageSize);
  return {
    count: items.length,
    next: start + pageSize < items.length ? page + 1 : null,
    previous: page > 1 ? page - 1 : null,
    results,
  };
};

const safeUpper = value => String(value || '').trim().toUpperCase();
const safeLower = value => String(value || '').trim().toLowerCase();
const randomDigits = length => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

const jsonRequest = async (path, { method = 'GET', body, headers } = {}, retried = false) => {
  const token = authStorage.getAccess();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;

  if (!retried && shouldTryRefresh(res, data)) {
    const refresh = authStorage.getRefresh();
    if (!refresh) {
      authStorage.clear();
      throw new Error('Session expired. Please sign in again.');
    }
    try {
      const next = await refreshAccess(refresh);
      authStorage.setAccess(next.access);
      return jsonRequest(path, { method, body, headers }, true);
    } catch {
      authStorage.clear();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  throw new Error(parseErrorMessage(data, res));
};

const formRequest = async (path, { method = 'POST', formData, headers } = {}, retried = false) => {
  const token = authStorage.getAccess();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;

  if (!retried && shouldTryRefresh(res, data)) {
    const refresh = authStorage.getRefresh();
    if (!refresh) {
      authStorage.clear();
      throw new Error('Session expired. Please sign in again.');
    }
    try {
      const next = await refreshAccess(refresh);
      authStorage.setAccess(next.access);
      return formRequest(path, { method, formData, headers }, true);
    } catch {
      authStorage.clear();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  throw new Error(parseErrorMessage(data, res));
};

const fetchAllPages = async path => {
  const { pathname, searchParams } = parsePath(path);
  let page = 1;
  let items = [];

  while (true) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(page));
    nextParams.set('page_size', '200');
    const data = await jsonRequest(buildPath(pathname, nextParams));
    if (Array.isArray(data)) return data;
    const rows = Array.isArray(data?.results) ? data.results : [];
    items = items.concat(rows);
    if (!data?.next && items.length >= (Number(data?.count) || 0)) break;
    if (!rows.length) break;
    page += 1;
  }

  return items;
};

const getClassRows = async () => fetchAllPages('/academic-classes/');

const toClassSimple = row => ({
  ...row,
  id: row.id,
  name: row.name,
  sections: Array.isArray(row.sections) ? row.sections : [],
});

const toClassOptions = rows =>
  rows.flatMap(row => {
    const sections = Array.isArray(row.sections) ? row.sections : [];
    if (!sections.length) {
      return [{ value: String(row.id), label: row.name, id: row.id, name: row.name, sections }];
    }
    return sections.map(section => ({
      value: `${row.id}:${section}`,
      label: `${row.name} (${section})`,
      id: row.id,
      name: row.name,
      section,
      sections,
    }));
  });

const buildHolidayEntries = ({ holidays = [], weekly_holidays = [] }, searchParams) => {
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const out = [];

  for (const holiday of Array.isArray(holidays) ? holidays : []) {
    if (!holiday?.date) continue;
    out.push({ date: holiday.date, title: holiday.title || 'Holiday', description: holiday.description || '', is_holiday: true });
  }

  const weekly = (Array.isArray(weekly_holidays) ? weekly_holidays : []).find(item => item?.is_active);
  if (!weekly || !start || !end) return out;

  const activeDays = Array.isArray(weekly.days) ? weekly.days.map(Number) : [];
  const cursor = new Date(start);
  const limit = new Date(end);
  while (!Number.isNaN(cursor.getTime()) && cursor <= limit) {
    const jsDay = cursor.getDay();
    const weeklyDay = (jsDay + 1) % 7;
    if (activeDays.includes(weeklyDay)) {
      const iso = cursor.toISOString().slice(0, 10);
      out.push({ date: iso, title: weekly.title || 'Weekly Holiday', description: weekly.description || '', is_holiday: true });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

const fetchHolidayCalendar = async searchParams => {
  const raw = await jsonRequest(buildPath('/holiday-calendar/', searchParams));
  if (Array.isArray(raw)) return raw;
  return buildHolidayEntries(raw || {}, searchParams);
};

const normalizeStudentRow = (row, classMap, userMap = new Map()) => {
  const schoolClass = classMap.get(Number(row.school_class));
  const linkedUser = userMap.get(Number(row.user));
  return {
    ...row,
    school_class_label: schoolClass?.name || row.school_class_label || '',
    user_username: row.user_username || linkedUser?.username || '',
    user_email: row.user_email || linkedUser?.email || row.email || '',
  };
};

const normalizeNoticeRow = (row, classMap) => {
  const ids = Array.isArray(row.school_classes) ? row.school_classes : [];
  return {
    ...row,
    school_classes_detail: ids.map(id => classMap.get(Number(id))).filter(Boolean),
  };
};

const buildAttendanceSheet = async searchParams => {
  const classId = Number(searchParams.get('class') || searchParams.get('school_class'));
  const section = safeUpper(searchParams.get('section'));
  const date = searchParams.get('date') || '';
  if (!classId || !date) return null;

  const [classes, students, records, holidays] = await Promise.all([
    getClassRows(),
    fetchAllPages('/students/'),
    fetchAllPages('/academic-attendance/'),
    fetchHolidayCalendar(new URLSearchParams([['start', date], ['end', date]])),
  ]);

  const schoolClass = classes.find(row => Number(row.id) === classId) || null;
  const isHoliday = holidays.find(item => item.date === date) || null;
  const filteredStudents = students
    .filter(row => Number(row.school_class) === classId)
    .filter(row => !section || safeUpper(row.section) === section)
    .sort((a, b) => Number(a.roll_no || 0) - Number(b.roll_no || 0) || String(a.first_name || '').localeCompare(String(b.first_name || '')));

  const recordMap = new Map(
    records
      .filter(row => Number(row.school_class) === classId)
      .filter(row => safeUpper(row.section) === section)
      .filter(row => row.date === date)
      .map(row => [Number(row.student), row])
  );

  return {
    school_class: classId,
    section,
    date,
    school_class_label: schoolClass?.name || '',
    teacher: null,
    is_holiday: Boolean(isHoliday),
    holiday: isHoliday,
    attendance_disabled: Boolean(isHoliday),
    students: filteredStudents.map(student => {
      const record = recordMap.get(Number(student.id));
      return {
        id: student.id,
        name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student ${student.id}`,
        roll_no: student.roll_no,
        status: record?.status || '',
        note: record?.note || '',
      };
    }),
  };
};

const buildAttendanceCalendar = async searchParams => {
  const classId = Number(searchParams.get('class') || searchParams.get('school_class'));
  const section = safeUpper(searchParams.get('section'));
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';
  if (!classId || !start || !end) return [];

  const records = await fetchAllPages('/academic-attendance/');
  const countByDate = new Map();
  for (const row of records) {
    if (Number(row.school_class) !== classId) continue;
    if (safeUpper(row.section) !== section) continue;
    if (row.date < start || row.date > end) continue;
    countByDate.set(row.date, (countByDate.get(row.date) || 0) + 1);
  }

  return Array.from(countByDate.entries()).map(([date, count]) => ({ date, count }));
};

const upsertAcademicAttendance = async body => {
  const classId = Number(body.class || body.school_class);
  const section = safeUpper(body.section);
  const date = body.date;
  const items = Array.isArray(body.items) ? body.items : [];
  const existing = await fetchAllPages('/academic-attendance/');
  const scoped = existing.filter(
    row => Number(row.school_class) === classId && safeUpper(row.section) === section && String(row.date) === String(date)
  );
  const map = new Map(scoped.map(row => [Number(row.student), row]));

  const tasks = items.map(async item => {
    const current = map.get(Number(item.student));
    const payload = {
      school_class: classId,
      section,
      student: Number(item.student),
      date,
      status: item.status,
      note: item.note || '',
    };
    if (current?.id) return jsonRequest(`/academic-attendance/${current.id}/`, { method: 'PATCH', body: payload });
    return jsonRequest('/academic-attendance/', { method: 'POST', body: payload });
  });

  await Promise.all(tasks);
  return { detail: 'Attendance updated.' };
};

const buildMarksSheet = async searchParams => {
  const examId = Number(searchParams.get('exam'));
  if (!examId) throw new Error('Exam ID is required.');

  const [exam, students, subjects, marks] = await Promise.all([
    jsonRequest(`/exams/${examId}/`),
    fetchAllPages('/students/'),
    fetchAllPages('/subjects/'),
    fetchAllPages('/marks/'),
  ]);

  const section = safeUpper(exam.section);
  const subjectRows = subjects.filter(row => {
    if (Number(row.school_class) !== Number(exam.class_name)) return false;
    if (section && safeUpper(row.section) !== section) return false;
    if (exam.subject && Number(row.id) !== Number(exam.subject)) return false;
    return true;
  });

  const studentRows = students.filter(row => {
    if (Number(row.school_class) !== Number(exam.class_name)) return false;
    if (section && safeUpper(row.section) !== section) return false;
    return true;
  });

  const markRows = marks
    .filter(row => Number(row.exam) === examId)
    .map(row => ({
      ...row,
      student_id: row.student,
      subject_id: row.subject,
    }));

  const classRows = await getClassRows();
  const schoolClass = classRows.find(row => Number(row.id) === Number(exam.class_name));

  return {
    exam: {
      ...exam,
      classroom_label: schoolClass ? `${schoolClass.name}${section ? ` (${section})` : ''}` : '',
      subject_label: subjectRows.find(row => Number(row.id) === Number(exam.subject))?.name || '',
      subject_code: subjectRows.find(row => Number(row.id) === Number(exam.subject))?.code || '',
    },
    students: studentRows.map(row => ({
      id: row.id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || `Student ${row.id}`,
    })),
    subjects: subjectRows.map(row => ({
      id: row.id,
      name: row.name,
      code: row.code,
      full_marks: row.full_marks,
      pass_marks: row.pass_marks,
    })),
    marks: markRows,
  };
};

const bulkUpsertMarks = async body => {
  const examId = Number(body.exam);
  const items = Array.isArray(body.items) ? body.items : [];
  const existing = await fetchAllPages('/marks/');
  const scoped = existing.filter(row => Number(row.exam) === examId);
  const map = new Map(scoped.map(row => [`${row.student}:${row.subject}`, row]));
  let created = 0;
  let updated = 0;

  for (const item of items) {
    const key = `${Number(item.student)}:${Number(item.subject)}`;
    const current = map.get(key);
    const payload = {
      exam: examId,
      student: Number(item.student),
      subject: Number(item.subject),
      marks_obtained: item.marks_obtained === '' || item.marks_obtained == null ? null : Number(item.marks_obtained),
      remarks: item.remarks || '',
    };
    if (current?.id) {
      await jsonRequest(`/marks/${current.id}/`, { method: 'PATCH', body: payload });
      updated += 1;
    } else {
      await jsonRequest('/marks/', { method: 'POST', body: payload });
      created += 1;
    }
  }

  return { created, updated };
};

const reorderSubmissionImages = async body => {
  const ids = Array.isArray(body.ordered_image_ids) ? body.ordered_image_ids : [];
  if (!ids.length) return { detail: 'No images to reorder.' };

  const submissionId = Number(body?.submission);
  let tempStart = 1000 + ids.length;
  if (Number.isFinite(submissionId) && submissionId > 0) {
    const current = await jsonRequest(`/submission-images/?submission=${submissionId}`);
    const rows = Array.isArray(current?.results) ? current.results : Array.isArray(current) ? current : [];
    const maxPage = rows.reduce((max, row) => Math.max(max, Number(row?.page_number) || 0), 0);
    tempStart = maxPage + ids.length + 100;
  }

  // Two-pass reorder prevents unique(submission, page_number) collisions.
  for (let i = 0; i < ids.length; i += 1) {
    await jsonRequest(`/submission-images/${ids[i]}/`, {
      method: 'PATCH',
      body: { page_number: tempStart + i + 1 },
    });
  }
  for (let i = 0; i < ids.length; i += 1) {
    await jsonRequest(`/submission-images/${ids[i]}/`, {
      method: 'PATCH',
      body: { page_number: i + 1 },
    });
  }
  return { detail: 'Page order updated.' };
};

const parseMarksInput = value => {
  const text = String(value || '').trim();
  if (!text) return { teacher_marks: null, teacher_total_marks: null };
  if (text.includes('/')) {
    const [obtained, total] = text.split('/', 2).map(part => Number(String(part || '').trim()));
    return {
      teacher_marks: Number.isFinite(obtained) ? obtained : null,
      teacher_total_marks: Number.isFinite(total) ? total : null,
    };
  }
  const numberValue = Number(text);
  return {
    teacher_marks: Number.isFinite(numberValue) ? numberValue : null,
    teacher_total_marks: null,
  };
};

const generateStudentUsername = async firstName => {
  const allUsers = await fetchAllPages('/users/');
  const yy = new Date().getFullYear().toString().slice(-2);
  let username = '';
  do {
    username = `sid${yy}${randomDigits(5)}`;
  } while (allUsers.some(user => String(user.username) === username));
  return username;
};

const handleSpecialJson = async (path, options) => {
  const method = String(options?.method || 'GET').toUpperCase();
  const body = options?.body;
  const { pathname, searchParams } = parsePath(path);

  if (method === 'GET' && pathname === '/academic-classes/simple/') {
    return (await getClassRows()).map(toClassSimple);
  }

  if (method === 'GET' && pathname === '/academic-classes/options/') {
    return toClassOptions(await getClassRows());
  }

  if (method === 'GET' && pathname === '/subject-teachers/options/') {
    const rows = await fetchAllPages('/subject-teachers/');
    return rows.map(row => ({
      value: row.id,
      label: `${row.teacher_code ? `${row.teacher_code} - ` : ''}${row.name || `Teacher ${row.id}`}`,
      email: row.email || '',
      phone: row.phone || '',
    }));
  }

  if (method === 'GET' && pathname === '/subjects/options/') {
    const rows = await fetchAllPages('/subjects/');
    const classId = Number(searchParams.get('class') || searchParams.get('school_class') || searchParams.get('class_name'));
    const section = safeUpper(searchParams.get('section'));
    const q = safeLower(searchParams.get('q'));
    return rows
      .filter(row => !classId || Number(row.school_class) === classId)
      .filter(row => !section || safeUpper(row.section) === section)
      .filter(row => !q || safeLower(`${row.name} ${row.code}`).includes(q))
      .map(row => ({
        value: row.id,
        label: `${row.code ? `${row.code} - ` : ''}${row.name}`,
        subject_teacher: row.subject_teacher || null,
      }));
  }

  if (method === 'GET' && pathname === '/students/filter-options/') {
    const rows = await fetchAllPages('/students/');
    const years = Array.from(new Set(rows.map(row => String(row.created_at || '').slice(0, 4)).filter(Boolean))).sort().reverse();
    return { years: years.length ? years : [String(new Date().getFullYear())] };
  }

  if (method === 'GET' && pathname === '/holiday-calendar/') {
    return fetchHolidayCalendar(searchParams);
  }

  if (method === 'GET' && pathname === '/academic-attendance/sheet/') {
    return buildAttendanceSheet(searchParams);
  }

  if (method === 'GET' && pathname === '/academic-attendance/calendar/') {
    return buildAttendanceCalendar(searchParams);
  }

  if (method === 'POST' && pathname === '/academic-attendance/bulk/') {
    return upsertAcademicAttendance(body || {});
  }

  if (method === 'GET' && pathname === '/marks/sheet/') {
    return buildMarksSheet(searchParams);
  }

  if (method === 'POST' && pathname === '/marks/bulk-upload/') {
    return bulkUpsertMarks(body || {});
  }

  if (method === 'GET' && pathname === '/marks/sample-excel/') {
    throw new Error('Excel sample download is not available in the simplified backend yet.');
  }

  if (method === 'POST' && pathname === '/students/') {
    const payloadBody = body || {};
    const generatedUsername = payloadBody.username || (await generateStudentUsername(payloadBody.first_name));
    const generatedPassword = payloadBody.password || `Stu${randomDigits(6)}`;
    const user = await jsonRequest('/users/', {
      method: 'POST',
      body: {
        username: generatedUsername,
        password: generatedPassword,
        email: payloadBody.email || '',
        first_name: payloadBody.first_name || '',
        last_name: payloadBody.last_name || '',
        phone: payloadBody.phone || '',
        role: 'STUDENT',
        is_active: true,
        must_change_password: true,
      },
    });
    const student = await jsonRequest('/students/', {
      method: 'POST',
      body: {
        ...payloadBody,
        user: user.id,
        create_user: undefined,
        username: undefined,
        password: undefined,
      },
    });
    return {
      ...student,
      generated_username: generatedUsername,
      generated_password: generatedPassword,
      user_username: generatedUsername,
      user_email: payloadBody.email || '',
    };
  }

  if (method === 'POST' && /^\/students\/\d+\/change-roll\/$/.test(pathname)) {
    const id = pathname.split('/')[2];
    return jsonRequest(`/students/${id}/`, { method: 'PATCH', body: { roll_no: body?.roll_no } });
  }

  if (method === 'POST' && /^\/notices\/\d+\/pin\/$/.test(pathname)) {
    const id = pathname.split('/')[2];
    const payload = {
      is_pinned: Boolean(body?.is_pinned),
      pinned_at: body?.is_pinned ? new Date().toISOString() : null,
    };
    return jsonRequest(`/notices/${id}/`, { method: 'PATCH', body: payload });
  }

  if (method === 'POST' && /^\/homeworks\/\d+\/publish\/$/.test(pathname)) {
    const id = pathname.split('/')[2];
    return jsonRequest(`/homeworks/${id}/`, { method: 'PATCH', body: { status: 'PUBLISHED' } });
  }

  if (method === 'POST' && /^\/submissions\/\d+\/submit\/$/.test(pathname)) {
    const id = pathname.split('/')[2];
    return jsonRequest(`/submissions/${id}/`, {
      method: 'PATCH',
      body: { status: 'SUBMITTED', submitted_at: new Date().toISOString() },
    });
  }

  if (method === 'POST' && /^\/submissions\/\d+\/grade\/$/.test(pathname)) {
    const id = pathname.split('/')[2];
    const marks = parseMarksInput(body?.marks);
    return jsonRequest(`/submissions/${id}/`, {
      method: 'PATCH',
      body: {
        ...marks,
        teacher_feedback: body?.feedback || '',
        status: 'GRADED',
      },
    });
  }

  if (method === 'POST' && pathname === '/submission-images/reorder/') {
    return reorderSubmissionImages(body || {});
  }

  if (method === 'POST' && /^\/exams\/\d+\/generate-results\/$/.test(pathname)) {
    const id = pathname.split('/')[2];
    return jsonRequest(`/exams/${id}/`, { method: 'PATCH', body: { status: 'FINALIZED' } });
  }

  if (method === 'POST' && /^\/exams\/\d+\/publish\/$/.test(pathname)) {
    const id = pathname.split('/')[2];
    return jsonRequest(`/exams/${id}/`, { method: 'PATCH', body: { status: 'PUBLISHED' } });
  }

  return null;
};

const normalizeStandardResponse = async (path, method, data) => {
  const { pathname, searchParams } = parsePath(path);

  if (method === 'GET' && pathname === '/students/') {
    const [classRows, userRows] = await Promise.all([getClassRows(), fetchAllPages('/users/')]);
    const classMap = new Map(classRows.map(row => [Number(row.id), row]));
    const userMap = new Map(userRows.map(user => [Number(user.id), user]));
    const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    const filtered = rows
      .map(row => normalizeStudentRow(row, classMap, userMap))
      .filter(row => {
        const year = searchParams.get('year');
        const classId = searchParams.get('class');
        const section = safeUpper(searchParams.get('section'));
        if (year && String(row.created_at || '').slice(0, 4) !== String(year)) return false;
        if (classId && String(row.school_class) !== String(classId)) return false;
        if (section && safeUpper(row.section) !== section) return false;
        return true;
      });
    return makePagination(filtered, searchParams);
  }

  if (method === 'GET' && /^\/students\/\d+\/$/.test(pathname)) {
    const [classRows, userRows] = await Promise.all([getClassRows(), fetchAllPages('/users/')]);
    const classMap = new Map(classRows.map(row => [Number(row.id), row]));
    const userMap = new Map(userRows.map(user => [Number(user.id), user]));
    return normalizeStudentRow(data, classMap, userMap);
  }

  if (method === 'GET' && pathname === '/notices/') {
    const classRows = await getClassRows();
    const classMap = new Map(classRows.map(row => [Number(row.id), row]));
    const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    const filtered = rows
      .map(row => normalizeNoticeRow(row, classMap))
      .filter(row => {
        const q = safeLower(searchParams.get('q'));
        const audience = searchParams.get('audience');
        const classId = searchParams.get('class');
        if (q && !safeLower(`${row.title} ${row.description} ${row.content_html}`).includes(q)) return false;
        if (audience && String(row.audience) !== audience) return false;
        if (classId && !(Array.isArray(row.school_classes) && row.school_classes.map(String).includes(String(classId)))) return false;
        return true;
      });
    return makePagination(filtered, searchParams);
  }

  if (method === 'GET' && /^\/notices\/\d+\/$/.test(pathname)) {
    const classRows = await getClassRows();
    const classMap = new Map(classRows.map(row => [Number(row.id), row]));
    return normalizeNoticeRow(data, classMap);
  }

  if (method === 'GET' && pathname === '/homeworks/') {
    const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    const filtered = rows.filter(row => {
      const q = safeLower(searchParams.get('q'));
      const classId = searchParams.get('class');
      const section = safeUpper(searchParams.get('section'));
      const subject = searchParams.get('subject');
      const date = searchParams.get('date');
      const type = searchParams.get('type');
      if (q && !safeLower(`${row.title} ${row.short_description} ${row.description}`).includes(q)) return false;
      if (classId && String(row.class_name) !== String(classId)) return false;
      if (section && safeUpper(row.section) !== section) return false;
      if (subject && String(row.subject) !== String(subject)) return false;
      if (date && String(row.class_date) !== String(date)) return false;
      if (type && String(row.homework_type) !== String(type)) return false;
      return true;
    });
    return makePagination(filtered, searchParams);
  }

  return data;
};

export const apiJson = async (path, options = {}) => {
  const method = String(options?.method || 'GET').toUpperCase();
  const special = await handleSpecialJson(path, options);
  if (special !== null) return special;
  const data = await jsonRequest(path, options);
  return normalizeStandardResponse(path, method, data);
};

export const apiForm = async (path, options = {}) => {
  const { pathname } = parsePath(path);
  if (pathname === '/marks/import-excel/') {
    throw new Error('Excel import is not available in the simplified backend yet.');
  }
  return formRequest(path, options);
};

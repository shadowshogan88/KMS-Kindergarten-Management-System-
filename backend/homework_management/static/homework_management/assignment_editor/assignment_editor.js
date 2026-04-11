/* global CKEDITOR */

/**
 * Canvas-style assignment submission editor demo.
 *
 * This is production-architecture friendly:
 * - Single config object controls labels/colors/text
 * - Autosave draft to localStorage (every 10s) + manual Save draft
 * - Attempt selector switches draft scope
 * - Upload tab stores attachment metadata locally (wire to Django API)
 * - Fullscreen mode
 * - Responsive: toolbar offcanvas on mobile (moves toolbar DOM)
 *
 * HOW TO CHANGE:
 * - Theme colors: `assignmentConfig.theme` or CSS vars in assignment_editor.css
 * - Title/labels/buttons: `assignmentConfig.ui`
 * - Toolbar items: `window.assignmentCkeditorConfig` in ckeditor_config.js
 */

(function initAssignmentEditor() {
  const assignmentConfig = {
    id: 'demo-assignment-001',
    title: 'Module 4 Assignment',
    dueDate: 'Jul 25, 2026',
    points: 10,
    pointsMax: 10,
    status: 'In Progress',
    nextStep: 'Submit Assignment',
    attempts: [
      { id: 1, label: 'Attempt 1 (In Progress)' },
      { id: 2, label: 'Attempt 2' },
    ],
    theme: {
      primary: '#6f42c1',
      primary600: '#5b34a6',
    },
    ui: {
      backLabel: 'Back',
      dueLabel: 'Due',
      pointsLabel: 'pts',
      scoreLabel: 'Points',
      feedbackBtn: 'Feedback',
      attemptLabel: 'Attempt',
      nextStepPrefix: 'Next step:',
      fullscreenBtn: 'Full screen',
      fullscreenExitBtn: 'Exit full screen',
      textTab: 'Text',
      uploadTab: 'Upload',
      wordCountLabel: 'Word count',
      draftIdle: 'Draft not saved yet',
      draftSaved: 'Draft saved',
      draftSaving: 'Saving…',
      toolbarBtn: 'Toolbar',
      toolbarTitle: 'Editor toolbar',
      uploadTitle: 'Upload your files',
      uploadHint: 'Drag & drop here, or choose files. (Max size/allowed types enforced on server.)',
      attachmentsTitle: 'Attachments',
      attachmentsHint: 'Files are stored locally in this demo. Wire this to your Django API to persist.',
      clearUploadsBtn: 'Clear',
      saveDraftBtn: 'Save draft',
      submitBtn: 'Submit Assignment',
      attemptShortLabel: 'Attempt',
      submitSuccess: 'Submitted (demo). Hook this to your API.',
    },
  };

  // Apply theme vars (optional override without touching CSS).
  const root = document.documentElement;
  if (assignmentConfig.theme?.primary) root.style.setProperty('--lms-primary', assignmentConfig.theme.primary);
  if (assignmentConfig.theme?.primary600) root.style.setProperty('--lms-primary-600', assignmentConfig.theme.primary600);

  const $ = sel => document.querySelector(sel);

  const uiBindings = {
    title: assignmentConfig.title,
    dueDate: assignmentConfig.dueDate,
    points: String(assignmentConfig.points),
    pointsMax: String(assignmentConfig.pointsMax),
    status: assignmentConfig.status,
    nextStep: assignmentConfig.nextStep,
    ...assignmentConfig.ui,
  };
  for (const [key, value] of Object.entries(uiBindings)) {
    const nodes = document.querySelectorAll(`[data-ui="${key}"]`);
    for (const n of nodes) n.textContent = String(value);
  }

  const shell = $('#lms-shell');
  const attemptSelect = $('#attemptSelect');
  const attemptShort = $('#attemptShort');

  const btnFullscreen = $('#btn-fullscreen');
  const btnSaveDraft = $('#btn-save-draft');
  const btnSubmit = $('#btn-submit');
  const btnFeedback = $('#btn-feedback');
  const btnClearUploads = $('#btn-clear-uploads');

  const wordCountEl = $('#wordCount');
  const draftStatus = $('#draftStatus');
  const draftStatusFooter = $('#draftStatusFooter');
  const draftDot = $('#draftDot');
  const draftDotFooter = $('#draftDotFooter');

  const uploadDrop = $('#uploadDrop');
  const uploadInput = $('#uploadInput');
  const uploadList = $('#uploadList');

  const toolbarContainer = $('#toolbar-container');
  const toolbarSkeleton = $('#toolbar-skeleton');
  const toolbarOffcanvasSlot = $('#toolbar-offcanvas-slot');

  const storageKey = (attemptId, suffix) => `lms.assignment.${assignmentConfig.id}.attempt.${attemptId}.${suffix}`;

  const bytesLabel = bytes => {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const computeWords = html => {
    const div = document.createElement('div');
    div.innerHTML = String(html || '');
    const text = (div.textContent || '').trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  };

  const setDraftIndicator = ({ state, label }) => {
    // state: idle|dirty|saving|saved
    const dotClass = state === 'saved' ? 'is-saved' : state === 'dirty' || state === 'saving' ? 'is-dirty' : '';
    draftDot.className = `lms-dot ${dotClass}`.trim();
    draftDotFooter.className = `lms-dot ${dotClass}`.trim();
    draftStatus.textContent = label || '';
    draftStatusFooter.textContent = label || '';
  };

  // Attempt selector
  const renderAttemptOptions = () => {
    attemptSelect.innerHTML = '';
    for (const a of assignmentConfig.attempts) {
      const opt = document.createElement('option');
      opt.value = String(a.id);
      opt.textContent = a.label || `Attempt ${a.id}`;
      attemptSelect.appendChild(opt);
    }
  };

  let currentAttemptId = assignmentConfig.attempts?.[0]?.id || 1;
  renderAttemptOptions();
  attemptSelect.value = String(currentAttemptId);
  attemptShort.textContent = String(currentAttemptId);

  // Upload attachments (local demo)
  const loadUploads = attemptId => {
    try {
      const raw = localStorage.getItem(storageKey(attemptId, 'uploads')) || '[]';
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };
  const saveUploads = (attemptId, items) => {
    localStorage.setItem(storageKey(attemptId, 'uploads'), JSON.stringify(items || []));
  };
  const renderUploads = attemptId => {
    const items = loadUploads(attemptId);
    uploadList.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'text-secondary small';
      empty.textContent = 'No attachments.';
      uploadList.appendChild(empty);
      return;
    }
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'lms-upload-item';
      row.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="min-w-0">
            <div class="lms-upload-item-name text-truncate">${escapeHtml(it.name || 'file')}</div>
            <div class="lms-upload-item-meta">${escapeHtml(it.type || 'unknown')} • ${escapeHtml(bytesLabel(it.size))}</div>
          </div>
          <button class="btn btn-sm lms-btn-outline" type="button" data-remove="${escapeHtml(String(it.id))}">Remove</button>
        </div>
      `;
      uploadList.appendChild(row);
    }
  };

  const escapeHtml = s =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  uploadList.addEventListener('click', e => {
    const btn = e.target?.closest?.('button[data-remove]');
    if (!btn) return;
    const id = btn.getAttribute('data-remove');
    const items = loadUploads(currentAttemptId).filter(x => String(x.id) !== String(id));
    saveUploads(currentAttemptId, items);
    renderUploads(currentAttemptId);
  });

  const addUploadsFromFiles = files => {
    const existing = loadUploads(currentAttemptId);
    const next = existing.slice();
    for (const f of Array.from(files || [])) {
      next.push({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: f.name,
        size: f.size,
        type: f.type,
        addedAt: new Date().toISOString(),
      });
    }
    saveUploads(currentAttemptId, next);
    renderUploads(currentAttemptId);
    uploadInput.value = '';
  };

  uploadInput.addEventListener('change', e => addUploadsFromFiles(e.target.files));

  const setDropState = on => uploadDrop.classList.toggle('is-dragover', Boolean(on));
  uploadDrop.addEventListener('dragenter', e => {
    e.preventDefault();
    setDropState(true);
  });
  uploadDrop.addEventListener('dragover', e => {
    e.preventDefault();
    setDropState(true);
  });
  uploadDrop.addEventListener('dragleave', () => setDropState(false));
  uploadDrop.addEventListener('drop', e => {
    e.preventDefault();
    setDropState(false);
    if (e.dataTransfer?.files?.length) addUploadsFromFiles(e.dataTransfer.files);
  });

  btnClearUploads.addEventListener('click', () => {
    saveUploads(currentAttemptId, []);
    renderUploads(currentAttemptId);
  });

  // Fullscreen toggle
  const setFullscreen = on => {
    const next = Boolean(on);
    shell.classList.toggle('is-fullscreen', next);
    document.body.style.overflow = next ? 'hidden' : '';
    btnFullscreen.textContent = next ? assignmentConfig.ui.fullscreenExitBtn : assignmentConfig.ui.fullscreenBtn;
  };
  btnFullscreen.addEventListener('click', () => setFullscreen(!shell.classList.contains('is-fullscreen')));

  // Fake feedback button
  btnFeedback.addEventListener('click', () => {
    window.alert('Feedback panel (demo). Hook this to your grading/feedback UI.');
  });

  // Editor
  let editor = null;
  let isDirty = false;
  let lastSavedAt = '';
  let autosaveTimer = null;

  const loadDraftHtml = attemptId => localStorage.getItem(storageKey(attemptId, 'draftHtml')) || '';
  const saveDraftHtml = (attemptId, html) => localStorage.setItem(storageKey(attemptId, 'draftHtml'), String(html || ''));
  const saveDraftMeta = attemptId => {
    lastSavedAt = new Date().toISOString();
    localStorage.setItem(storageKey(attemptId, 'draftSavedAt'), lastSavedAt);
  };
  const loadDraftMeta = attemptId => localStorage.getItem(storageKey(attemptId, 'draftSavedAt')) || '';

  const updateWordCount = () => {
    if (!editor) return;
    const words = computeWords(editor.getData());
    wordCountEl.textContent = String(words);
  };

  const flushDraftStatus = () => {
    if (isDirty) {
      setDraftIndicator({ state: 'dirty', label: 'Unsaved changes' });
      return;
    }
    const savedAt = loadDraftMeta(currentAttemptId);
    if (!savedAt) {
      setDraftIndicator({ state: 'idle', label: assignmentConfig.ui.draftIdle });
      return;
    }
    const time = new Date(savedAt);
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    setDraftIndicator({ state: 'saved', label: `${assignmentConfig.ui.draftSaved} • ${hh}:${mm}` });
  };

  const doSaveDraft = async () => {
    if (!editor) return;
    setDraftIndicator({ state: 'saving', label: assignmentConfig.ui.draftSaving });
    const html = editor.getData();
    saveDraftHtml(currentAttemptId, html);
    saveDraftMeta(currentAttemptId);
    isDirty = false;
    flushDraftStatus();
  };

  btnSaveDraft.addEventListener('click', () => doSaveDraft());

  btnSubmit.addEventListener('click', async () => {
    if (!editor) return;
    await doSaveDraft();
    window.alert(assignmentConfig.ui.submitSuccess);
  });

  const setAttempt = async attemptId => {
    currentAttemptId = Number(attemptId) || 1;
    attemptShort.textContent = String(currentAttemptId);
    renderUploads(currentAttemptId);

    const html = loadDraftHtml(currentAttemptId);
    if (editor) {
      editor.setData(html || '');
      isDirty = false;
      updateWordCount();
      flushDraftStatus();
    }
  };

  attemptSelect.addEventListener('change', e => setAttempt(e.target.value));

  const initEditor = async () => {
    toolbarSkeleton.textContent = 'Loading editor…';
    if (!window.CKEDITOR?.DecoupledEditor) {
      toolbarSkeleton.textContent = 'CKEditor failed to load. Check CDN connectivity.';
      return;
    }
    const config = window.assignmentCkeditorConfig || {};

    editor = await window.CKEDITOR.DecoupledEditor.create($('#editor'), config);
    isDirty = false;

    // Mount toolbar above editor surface.
    toolbarContainer.innerHTML = '';
    toolbarContainer.appendChild(editor.ui.view.toolbar.element);

    // Update word count + dirty state
    editor.model.document.on('change:data', () => {
      isDirty = true;
      updateWordCount();
      flushDraftStatus();
    });

    // Load initial draft
    await setAttempt(currentAttemptId);

    // Autosave every 10 seconds
    if (autosaveTimer) clearInterval(autosaveTimer);
    autosaveTimer = setInterval(() => {
      if (!editor) return;
      if (!isDirty) return;
      void doSaveDraft();
    }, 10000);

    flushDraftStatus();
  };

  // Mobile toolbar offcanvas: move toolbar DOM into offcanvas when opened.
  const offcanvasEl = $('#toolbarOffcanvas');
  if (offcanvasEl) {
    offcanvasEl.addEventListener('show.bs.offcanvas', () => {
      if (!editor) return;
      toolbarOffcanvasSlot.innerHTML = '';
      toolbarOffcanvasSlot.appendChild(editor.ui.view.toolbar.element);
    });
    offcanvasEl.addEventListener('hidden.bs.offcanvas', () => {
      if (!editor) return;
      toolbarContainer.innerHTML = '';
      toolbarContainer.appendChild(editor.ui.view.toolbar.element);
    });
  }

  // Initial render
  renderUploads(currentAttemptId);
  setDraftIndicator({ state: 'idle', label: assignmentConfig.ui.draftIdle });

  void initEditor().catch(() => {
    toolbarSkeleton.textContent = 'Editor initialization failed.';
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (autosaveTimer) clearInterval(autosaveTimer);
  });
})();


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import DecoupledEditor from '@ckeditor/ckeditor5-build-decoupled-document';
import 'ckeditor5/ckeditor5.css';

import './editor.css';

const DocumentEditor = ({
  value,
  onChange,
  disabled = false,
  data = '<h1>Welcome Boss</h1><p>This is your document editor.</p>',
  variant = 'canvas',
  menubar = true,
  menubarItems = ['Edit', 'View', 'Insert', 'Format', 'Tools', 'Table'],
} = {}) => {
  const toolbarRef = useRef(null);
  const editorRef = useRef(null);
  const wrapperRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);

  const closeMenu = () => setOpenMenu(null);

  useEffect(() => {
    const onDocDown = e => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(e.target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', onDocDown, { capture: true });
    return () => document.removeEventListener('mousedown', onDocDown, { capture: true });
  }, []);

  const run = (name, ...args) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.editing.view.focus();
    editor.execute(name, ...args);
  };

  const commandEnabled = name => {
    const editor = editorRef.current;
    const cmd = editor?.commands?.get?.(name);
    if (!cmd) return false;
    return Boolean(cmd.isEnabled);
  };

  const hasCommand = name => {
    const editor = editorRef.current;
    return Boolean(editor?.commands?.get?.(name));
  };

  const menus = useMemo(
    () => ({
      Edit: [
        { label: 'Undo', cmd: 'undo' },
        { label: 'Redo', cmd: 'redo' },
      ],
      View: [],
      Insert: [
        {
          label: 'Link…',
          action: () => {
            if (!hasCommand('link')) return;
            const url = window.prompt('Enter link URL');
            if (!url) return;
            run('link', url.trim());
          },
        },
        { label: 'Unlink', cmd: 'unlink' },
        {
          label: 'Insert table (2×2)',
          action: () => {
            if (!hasCommand('insertTable')) return;
            run('insertTable', { rows: 2, columns: 2 });
          },
        },
        {
          label: 'Embed media…',
          action: () => {
            if (!hasCommand('mediaEmbed')) return;
            const url = window.prompt('Enter media URL (YouTube/Vimeo, etc.)');
            if (!url) return;
            run('mediaEmbed', url.trim());
          },
        },
      ],
      Format: [
        { label: 'Bold', cmd: 'bold' },
        { label: 'Italic', cmd: 'italic' },
        { label: 'Underline', cmd: 'underline' },
        { label: 'Strikethrough', cmd: 'strikethrough' },
        { label: 'Block quote', cmd: 'blockQuote' },
        { label: 'Bulleted list', cmd: 'bulletedList' },
        { label: 'Numbered list', cmd: 'numberedList' },
        { label: 'Indent', cmd: 'indent' },
        { label: 'Outdent', cmd: 'outdent' },
      ],
      Tools: [
        {
          label: 'Clear formatting',
          cmd: 'removeFormat',
        },
      ],
      Table: [
        {
          label: 'Insert table (2×2)',
          action: () => {
            if (!hasCommand('insertTable')) return;
            run('insertTable', { rows: 2, columns: 2 });
          },
        },
      ],
    }),
    []
  );

  return (
    <div ref={wrapperRef} className={`editor-wrapper editor-wrapper--${variant}`}>
      {menubar ? (
        <div className="editor-menubar" role="navigation" aria-label="Editor menu">
          {menubarItems.map(label => {
            const items = menus[label] || [];
            const isOpen = openMenu === label;
            const hasItems = items.length > 0;
            return (
              <div key={label} className="editor-menu">
                <button
                  type="button"
                  className="editor-menubar__item"
                  disabled={disabled || !hasItems}
                  aria-haspopup={hasItems ? 'menu' : undefined}
                  aria-expanded={hasItems ? isOpen : undefined}
                  onClick={() => setOpenMenu(v => (v === label ? null : label))}
                >
                  {label}
                </button>
                {hasItems && isOpen ? (
                  <div className="editor-menu__dropdown" role="menu" aria-label={`${label} menu`}>
                    {items
                      .filter(it => (it.cmd ? hasCommand(it.cmd) : true))
                      .map(it => (
                        <button
                          key={it.label}
                          type="button"
                          className="editor-menu__item"
                          role="menuitem"
                          disabled={disabled || (it.cmd ? !commandEnabled(it.cmd) : false)}
                          onClick={() => {
                            if (disabled) return;
                            try {
                              if (typeof it.action === 'function') it.action();
                              else if (it.cmd) run(it.cmd);
                            } finally {
                              closeMenu();
                            }
                          }}
                        >
                          {it.label}
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      <div ref={toolbarRef} id="toolbar-container" />

      <div className="document-editor-container">
        <CKEditor
          editor={DecoupledEditor}
          data={value ?? data}
          disabled={disabled}
          onReady={editor => {
            editorRef.current = editor;
            const toolbarEl = editor?.ui?.view?.toolbar?.element;
            if (!toolbarEl || !toolbarRef.current) return;
            toolbarRef.current.innerHTML = '';
            toolbarRef.current.appendChild(toolbarEl);

            try {
              editor.editing.view.change(writer => {
                writer.addClass(`document-editor__editable--${variant}`, editor.editing.view.document.getRoot());
              });
            } catch {}
          }}
          onChange={(_, editor) => {
            if (typeof onChange === 'function') onChange(editor.getData());
          }}
        />
      </div>
    </div>
  );
};

export default DocumentEditor;

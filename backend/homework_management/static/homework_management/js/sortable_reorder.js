// Minimal reorder helper (no external deps).
// For full SortableJS integration, install SortableJS and replace this file.
export function wireSimpleReorder(listEl) {
  if (!listEl) return;
  let dragged = null;
  listEl.querySelectorAll('[data-draggable="true"]').forEach(item => {
    item.draggable = true;
    item.addEventListener('dragstart', e => {
      dragged = item;
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragged || dragged === item) return;
      const rect = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      item.parentNode.insertBefore(dragged, after ? item.nextSibling : item);
    });
  });
}


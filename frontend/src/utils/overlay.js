export const closeOverlay = selector => {
  try {
    const hs = window?.HSOverlay;
    if (!hs) return;

    const instanceOrItem = hs.getInstance?.(selector, true);
    if (instanceOrItem?.element?.close) {
      instanceOrItem.element.close();
      return;
    }
    if (instanceOrItem?.close) {
      instanceOrItem.close();
      return;
    }
    hs.close?.(selector);
  } catch {}
};

export const openOverlay = selector => {
  try {
    const hs = window?.HSOverlay;
    if (!hs) return;

    const instanceOrItem = hs.getInstance?.(selector, true);
    if (instanceOrItem?.element?.open) {
      instanceOrItem.element.open();
      return;
    }
    if (instanceOrItem?.open) {
      instanceOrItem.open();
      return;
    }
    hs.open?.(selector);
  } catch {}
};

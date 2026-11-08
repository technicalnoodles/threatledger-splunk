/** Size the embedded workspace below Splunk's navigation, whose height can change. */
export function installSplunkLayout(root: HTMLElement): () => void {
  const update = () => {
    const offset = `${Math.max(0, Math.round(root.getBoundingClientRect().top))}px`;
    if (root.style.getPropertyValue('--threatledger-top-offset') !== offset) {
      root.style.setProperty('--threatledger-top-offset', offset);
    }
  };
  update();
  window.addEventListener('resize', update);
  const container = root.closest('.dashboard-body');
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
  if (container) observer?.observe(container);
  return () => { window.removeEventListener('resize', update); observer?.disconnect(); };
}

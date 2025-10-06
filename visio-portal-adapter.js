// VISIOPLUS portal adapter: export/apply state via postMessage with the portal.
// This runs inside the VISOPLUS page (index.html) when embedded in portal.html.

function postToParent(type, payload) {
  try {
    if (window.parent) window.parent.postMessage({ type, payload }, '*');
  } catch (e) {
    console.warn('[VISOPLUS adapter] postMessage failed', e);
  }
}

function safeExport() {
  try {
    if (window.VISOPLUS?.exportJson) {
      const str = window.VISOPLUS.exportJson();
      return JSON.parse(str);
    }
  } catch (e) {
    console.warn('[VISOPLUS adapter] exportJson failed, falling back', e);
  }
  const m = window.VISOPLUS?.model || window.model;
  if (m) {
    const shapes = [...(m.shapes?.values?.() || [])].map(s => ({ ...s }));
    const connectors = [...(m.connectors?.values?.() || [])].map(c => ({ ...c }));
    const meta = m.meta ? { ...m.meta } : {};
    return { version: meta.version || 1, shapes, connectors, meta };
  }
  console.warn('[VISOPLUS adapter] No export method or model found.');
  return null;
}

function safeImport(payload) {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (window.VISOPLUS?.importJsonString) {
    window.VISOPLUS.importJsonString(str, { replace: true });
    return;
  }
  // Fallback: direct model replacement if available
  try {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const m = window.VISOPLUS?.model || window.model;
    if (!m) throw new Error('VISOPLUS.model missing');
    m.shapes?.clear?.();
    m.connectors?.clear?.();
    for (const s of data.shapes || []) m.shapes.set(s.id, s);
    for (const c of data.connectors || []) m.connectors.set(c.id, c);
    if (data.meta) Object.assign(m.meta || (m.meta = {}), data.meta);
    window.dispatchEvent?.(new Event('model:changed'));
  } catch (e) {
    console.error('[VISOPLUS adapter] Failed to import state', e);
  }
}

window.addEventListener('message', (e) => {
  const msg = e.data || {};
  if (msg.type === 'portal:getDesignerState') {
    const payload = safeExport();
    postToParent('portal:designerState', payload);
  } else if (msg.type === 'portal:applyHarnessState') {
    safeImport(msg.payload);
    postToParent('portal:designerAppliedHarnessState');
  }
});

window.addEventListener('load', () => {
  postToParent('portal:designerReady');
});
// Steps Designer portal adapter: respond to portal:getHarnessState with a
// VISOPLUS-compatible JSON payload. This is a template — wire it to your Steps
// data model. Include this in StepsDesigner/index.html:
//   <script type="module" src="./steps-portal-adapter.js"></script>

function postToParent(type, payload) {
  try {
    if (window.parent) window.parent.postMessage({ type, payload }, '*');
  } catch (e) {
    console.warn('[Steps adapter] postMessage failed', e);
  }
}

function readStepsModel() {
  // Replace with your actual Steps model access
  // Expected structure:
  //   window.STEPS = {
  //     nodes: [{ id, label, x?, y?, w?, h?, type?, style? }],
  //     edges: [{ id, from, to, label?, points?, style? }]
  //   }
  const S = window.STEPS || { nodes: [], edges: [] };
  return { nodes: S.nodes || [], edges: S.edges || [] };
}

function layoutIfNeeded(nodes) {
  const allHavePos = nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y));
  if (allHavePos) return nodes;
  const cols = Math.ceil(Math.sqrt(nodes.length || 1));
  const spacingX = 240, spacingY = 160, startX = 160, startY = 120;
  return nodes.map((n, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    return { ...n, x: startX + col * spacingX, y: startY + row * spacingY };
  });
}

function mapType(stepType) {
  // Map your step types to VISOPLUS shapes; adjust as needed
  switch ((stepType || '').toLowerCase()) {
    case 'decision':
    case 'diamond':
      return 'diamond';
    case 'terminator':
    case 'pill':
      return 'pill';
    case 'ellipse':
    case 'start':
    case 'end':
      return 'ellipse';
    case 'note':
      return 'note';
    default:
      return 'rect';
  }
}

function stepsToVisioJson() {
  const { nodes, edges } = readStepsModel();
  const laidOut = layoutIfNeeded(nodes);

  const idMap = new Map();
  const shapes = laidOut.map((n, i) => {
    const srcId = n.id ?? i;
    const id = `s_${srcId}`;
    idMap.set(srcId, id);
    const style = n.style || {};
    return {
      id,
      type: mapType(n.type),
      x: n.x, y: n.y,
      w: Number.isFinite(n.w) ? n.w : 160,
      h: Number.isFinite(n.h) ? n.h : 80,
      text: n.label ?? String(srcId),
      style: {
        fill: style.fill,
        stroke: style.stroke,
        text: style.text
      }
    };
  });

  const connectors = (edges || []).map((e, i) => {
    const id = `c_${e.id ?? i}`;
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    if (!from || !to) return null;
    const style = e.style || {};
    return {
      id, from, to,
      points: Array.isArray(e.points) ? e.points : [],
      label: e.label || '', // VISOPLUS can render this once connector labels are added
      style: {
        stroke: style.stroke,
        width: style.width,
        startArrow: style.startArrow,
        endArrow: style.endArrow
      }
    };
  }).filter(Boolean);

  return {
    version: 1,
    meta: { pan: { x: 0, y: 0 }, zoom: 1 },
    shapes,
    connectors
  };
}

window.addEventListener('message', (e) => {
  const msg = e.data || {};
  if (msg.type === 'portal:getHarnessState') {
    const payload = stepsToVisioJson();
    postToParent('portal:harnessState', payload);
  } else if (msg.type === 'portal:applyDesignerState') {
    // Optional: handle VISOPLUS -> Steps mapping here.
    postToParent('portal:harnessAppliedDesignerState');
  }
});

window.addEventListener('load', () => postToParent('portal:harnessReady'));
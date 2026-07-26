/**
 * utils.js — Shared utilities
 * Transportation Designer by NetFormosa
 */

// ── ID generator ─────────────────────────────────────────────────────────────
export function generateId(prefix = 'obj') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Path routing ─────────────────────────────────────────────────────────────
/**
 * Converts an array of {x,y} points into an SVG <path> d string
 * using the given routing mode.
 * @param {Array<{x:number,y:number}>} pts
 * @param {'straight'|'45deg'|'90deg'|'bezier'} mode
 */
export function routePath(pts, mode = '45deg') {
  if (pts.length < 2) return '';

  switch (mode) {
    case 'straight': return straightPath(pts);
    case '90deg':    return orthogonalPath(pts);
    case 'bezier':   return roundedPath(pts);
    case '45deg':
    default:         return diagonalPath(pts);
  }
}

function straightPath(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/**
 * 45° routing: goes diagonally then straight (or vice-versa)
 * Classic transit map style.
 */
function diagonalPath(pts) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const diag = Math.min(Math.abs(dx), Math.abs(dy));
    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;

    // Prefer horizontal exit: diagonal first, then horizontal
    const mx = prev.x + sx * diag;
    const my = prev.y + sy * diag;
    d += ` L ${mx} ${my} L ${curr.x} ${curr.y}`;
  }
  return d;
}

/**
 * 90° routing: always horizontal then vertical (Manhattan routing)
 */
function orthogonalPath(pts) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const midX = (prev.x + curr.x) / 2;
    d += ` L ${midX} ${prev.y} L ${midX} ${curr.y} L ${curr.x} ${curr.y}`;
  }
  return d;
}

/**
 * True circular rounded corner routing for smooth turns.
 */
function roundedPath(pts, radius = 50) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];

    const v1x = p0.x - p1.x, v1y = p0.y - p1.y;
    const v2x = p2.x - p1.x, v2y = p2.y - p1.y;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);

    if (l1 === 0 || l2 === 0) {
      d += ` L ${p1.x} ${p1.y}`;
      continue;
    }

    const u1x = v1x / l1, u1y = v1y / l1;
    const u2x = v2x / l2, u2y = v2y / l2;

    const dot = u1x * u2x + u1y * u2y;
    // Collinear check
    if (dot > 0.999 || dot < -0.999) {
      d += ` L ${p1.x} ${p1.y}`;
      continue;
    }

    let dist = radius * Math.sqrt((1 + dot) / (1 - dot));
    let actualRadius = radius;
    
    // Prevent the curve from overlapping other segments
    const maxDist = Math.min(l1 / 2, l2 / 2);
    if (dist > maxDist) {
      dist = maxDist;
      actualRadius = dist * Math.sqrt((1 - dot) / (1 + dot));
    }

    const sx = p1.x + u1x * dist;
    const sy = p1.y + u1y * dist;
    const ex = p1.x + u2x * dist;
    const ey = p1.y + u2y * dist;

    const cross = u1x * u2y - u1y * u2x;
    const sweep = cross < 0 ? 1 : 0;

    d += ` L ${sx} ${sy} A ${actualRadius} ${actualRadius} 0 0 ${sweep} ${ex} ${ey}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// ── Nearest station snapping ──────────────────────────────────────────────────
export function nearestStation(pt, stations, threshold = 20) {
  let best = null, bestDist = Infinity;
  for (const st of stations) {
    const d = Math.hypot(st.x - pt.x, st.y - pt.y);
    if (d < threshold && d < bestDist) { best = st; bestDist = d; }
  }
  return best;
}

// ── Color utilities ───────────────────────────────────────────────────────────
export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Style presets ─────────────────────────────────────────────────────────────
export const STYLE_PRESETS = {
  trtc: {
    name: '台北捷運',
    canvasBg: '#F5F0E8',
    lineDefaults: { width: 10, routingMode: '45deg' },
    stationDefaults: { shape: 'circle', size: 10, color: '#FFFFFF', strokeWidth: 3 },
    labelColor: '#1a1d23',
    suggestedLines: [
      { name: '板南線', code: 'BL', color: '#0070BD' },
      { name: '淡水信義線', code: 'R', color: '#E3002C' },
      { name: '中和新蘆線', code: 'O', color: '#F8A31C' },
      { name: '松山新店線', code: 'G', color: '#008659' },
      { name: '文湖線', code: 'BR', color: '#C48B2F' },
    ],
  },
  tokyo: {
    name: '東京 Metro',
    canvasBg: '#FFFFFF',
    lineDefaults: { width: 8, routingMode: '45deg' },
    stationDefaults: { shape: 'circle', size: 8, color: '#FFFFFF', strokeWidth: 2.5 },
    labelColor: '#1a1a1a',
    suggestedLines: [
      { name: '銀座線', code: 'G', color: '#FF9500' },
      { name: '丸ノ内線', code: 'M', color: '#E60012' },
      { name: '日比谷線', code: 'H', color: '#9B7CB6' },
      { name: '東西線', code: 'T', color: '#009BBF' },
      { name: '千代田線', code: 'C', color: '#00BB85' },
    ],
  },
  london: {
    name: '倫敦地鐵',
    canvasBg: '#F2F2F2',
    lineDefaults: { width: 12, routingMode: '45deg' },
    stationDefaults: { shape: 'circle', size: 6, color: '#FFFFFF', strokeWidth: 2 },
    labelColor: '#0F0F0F',
    suggestedLines: [
      { name: 'Bakerloo', code: 'B', color: '#AE6017' },
      { name: 'Central', code: 'C', color: '#DC241F' },
      { name: 'Circle', code: 'Y', color: '#FFD329' },
      { name: 'District', code: 'D', color: '#007D32' },
      { name: 'Jubilee', code: 'J', color: '#7B868C' },
      { name: 'Victoria', code: 'V', color: '#009FE0' },
    ],
  },
};

// Expose to window for shortcuts.js paste
window._utils = { generateId };

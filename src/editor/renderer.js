/**
 * renderer.js — SVG Renderer
 * Draws all objects (lines, stations, texts) into the SVG layers.
 * Transportation Designer by NetFormosa
 */

import { generateId, routePath } from '../utils.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export class Renderer {
  constructor(state, canvas) {
    this.state  = state;
    this.canvas = canvas;
    this._stationInteractionSetup = new Set(); // track which IDs have events bound
  }

  init() {
    // Layers already in DOM from index.html
  }

  // ── Full Re-render ────────────────────────────────────────────────────────
  renderAll() {
    this.renderOsmBackground();
    this.renderLines();
    this.renderStations();
    this.renderTexts();
    this.renderSelection();
    this._applyLayerVisibility();
  }

  // ── OSM Background ────────────────────────────────────────────────────────
  renderOsmBackground() {
    // Map background is fetched live via OpenStreetMap Overpass API and rendered directly into #layer-map
  }

  // ── Lines ─────────────────────────────────────────────────────────────────
  renderLines() {
    const layer = document.getElementById('layer-lines');
    layer.innerHTML = '';

    for (const line of this.state.data.lines) {
      const g = svgEl('g', {
        id: `line-${line.id}`,
        class: 'metro-line' + (this.state.selection.has(line.id) ? ' selected' : ''),
        'data-id': line.id,
      });

      if (line.pathNodes && line.pathNodes.length >= 2) {
        const d = routePath(line.pathNodes, line.routingMode || '45deg');

        const strokeDash = line.style === 'dashed' ? '16,8'
                         : line.style === 'dotted' ? '4,8'
                         : line.style === 'dash-dot' ? '16,8,4,8'
                         : line.style === 'double'  ? '0'
                         : '0';

        if (line.style === 'double') {
          // Double line: two parallel paths
          const p1 = svgEl('path', { d, stroke: line.color, 'stroke-width': line.width + 4,
            fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            opacity: line.opacity ?? 1 });
          const p2 = svgEl('path', { d, stroke: 'var(--bg-canvas)', 'stroke-width': line.width - 4,
            fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            opacity: line.opacity ?? 1 });
          g.appendChild(p1);
          g.appendChild(p2);
        } else {
          const path = svgEl('path', {
            d,
            stroke: line.color,
            'stroke-width': line.width,
            fill: 'none',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-dasharray': strokeDash,
            opacity: line.opacity ?? 1,
          });
          g.appendChild(path);
        }

        // Invisible wider hit area
        const hit = svgEl('path', { d, stroke: 'transparent', 'stroke-width': Math.max(line.width + 10, 16), fill: 'none', 'stroke-linecap': 'round' });
        g.appendChild(hit);
      }

      this._bindLineEvents(g, line);
      layer.appendChild(g);
    }

    // Render endpoint handles on top (in selection layer)
    this._renderLineEndpoints();
  }

  // ── Line Endpoint Handles ─────────────────────────────────────────────────
  _renderLineEndpoints() {
    // Remove old handles
    document.getElementById('layer-selection')
      ?.querySelectorAll('.line-endpoint-handle').forEach(el => el.remove());

    // Only show when line tool is active
    if (this.state.activeTool !== 'line') return;

    const selLayer = document.getElementById('layer-selection');
    const drawing  = this.state.lineDrawing;

    for (const line of this.state.data.lines) {
      if (!line.pathNodes || line.pathNodes.length < 1) continue;
      // Don't show handles on the line currently being drawn
      if (drawing.active && drawing.lineId === line.id) continue;

      const nodes  = line.pathNodes;
      const first  = nodes[0];
      const last   = nodes[nodes.length - 1];
      const r      = 6;

      const endpoints = [{ pt: first, role: 'start' }];
      if (nodes.length > 1 && (first.x !== last.x || first.y !== last.y)) {
        endpoints.push({ pt: last, role: 'end' });
      }

      for (const { pt } of endpoints) {
        const handle = svgEl('circle', {
          cx: pt.x,
          cy: pt.y,
          r,
          fill: 'var(--bg-canvas)',
          stroke: line.color || '#4A9EFF',
          'stroke-width': 2.5,
          class: 'line-endpoint-handle',
          style: 'pointer-events:none;',
        });

        const ring = svgEl('circle', {
          cx: pt.x,
          cy: pt.y,
          r: r + 4,
          fill: 'none',
          stroke: line.color || '#4A9EFF',
          'stroke-width': 1.5,
          opacity: 0.5,
          class: 'line-endpoint-handle',
          style: 'pointer-events:none;',
        });

        selLayer.appendChild(ring);
        selLayer.appendChild(handle);
      }
    }
  }

  // ── Stations ──────────────────────────────────────────────────────────────
  renderStations() {
    const layer = document.getElementById('layer-stations');
    const labelLayer = document.getElementById('layer-labels');
    layer.innerHTML = '';
    labelLayer.innerHTML = '';

    for (const st of this.state.data.stations) {
      const isSelected = this.state.selection.has(st.id);
      const g = svgEl('g', {
        id: `station-${st.id}`,
        class: 'metro-station' + (isSelected ? ' selected' : ''),
        'data-id': st.id,
        transform: `translate(${st.x},${st.y})`,
      });

      // Selection ring
      const ring = svgEl('circle', {
        class: 'selection-ring',
        r: (st.style?.size || 10) + 6,
        fill: 'none',
        stroke: '#4A9EFF',
        'stroke-width': 2,
        'stroke-dasharray': '4 3',
        opacity: 0.8,
      });
      g.appendChild(ring);

      // Body shape
      const body = this._makeStationBody(st);
      body.classList.add('station-body');
      g.appendChild(body);

      this._bindStationEvents(g, st);
      layer.appendChild(g);

      // Labels (in label layer)
      if (st.name || st.englishName) {
        this._renderStationLabel(labelLayer, st);
      }
    }
  }

  _makeStationBody(st) {
    const shape = st.style?.shape || 'circle';
    const size  = st.style?.size  || 10;
    const fill  = st.style?.color       || '#FFFFFF';
    const stroke = st.style?.strokeColor || '#0070BD';
    const sw    = st.style?.strokeWidth  || 3;

    let body;
    if (shape === 'circle') {
      body = svgEl('circle', { r: size, fill, stroke, 'stroke-width': sw, opacity: st.style?.opacity ?? 1 });
    } else if (shape === 'rect') {
      const s2 = size * 1.5;
      body = svgEl('rect', { x: -s2, y: -s2, width: s2*2, height: s2*2, rx: 3, fill, stroke, 'stroke-width': sw, opacity: st.style?.opacity ?? 1 });
    } else if (shape === 'diamond') {
      const s2 = size * 1.4;
      body = svgEl('polygon', { points: `0,${-s2} ${s2},0 0,${s2} ${-s2},0`, fill, stroke, 'stroke-width': sw, opacity: st.style?.opacity ?? 1 });
    } else if (shape === 'transfer') {
      // Transfer station: rounded rect
      const w = size * 2.5, h = size * 1.5;
      body = svgEl('rect', { x: -w/2, y: -h/2, width: w, height: h, rx: h/2, fill, stroke, 'stroke-width': sw, opacity: st.style?.opacity ?? 1 });
    } else {
      body = svgEl('circle', { r: size, fill, stroke, 'stroke-width': sw });
    }
    return body;
  }

  _renderStationLabel(labelLayer, st) {
    const g = svgEl('g', {
      id: `label-${st.id}`,
      class: 'metro-text',
      transform: `translate(${st.x},${st.y})`,
      'data-id': `label-${st.id}`,
    });

    const size = st.style?.size || 10;
    const offsetX = st.labelOffset?.x ?? (size + 6);
    const offsetY = st.labelOffset?.y ?? 0;

    if (st.name) {
      const t = svgEl('text', {
        x: offsetX, y: offsetY - 2,
        'font-family': "'Noto Sans TC', 'Inter', sans-serif",
        'font-size': '12',
        'font-weight': '700',
        fill: st.labelColor || '#e8eaf0',
        'dominant-baseline': 'auto',
      });
      t.textContent = st.name;
      g.appendChild(t);
    }

    if (st.englishName) {
      const t = svgEl('text', {
        x: offsetX, y: offsetY + 11,
        'font-family': "'Inter', 'Noto Sans TC', sans-serif",
        'font-size': '9',
        'font-weight': '400',
        fill: st.labelColor ? st.labelColor + 'aa' : '#9aa0b2',
        'dominant-baseline': 'auto',
      });
      t.textContent = st.englishName;
      g.appendChild(t);
    }

    if (st.stationCode) {
      const t = svgEl('text', {
        x: 0, y: offsetY - size - 6,
        'font-family': "'Inter', monospace",
        'font-size': '8',
        'font-weight': '600',
        fill: st.style?.strokeColor || '#4A9EFF',
        'text-anchor': 'middle',
      });
      t.textContent = st.stationCode;
      g.appendChild(t);
    }

    labelLayer.appendChild(g);
  }

  // ── Texts ─────────────────────────────────────────────────────────────────
  renderTexts() {
    const layer = document.getElementById('layer-labels');
    // Remove standalone texts (not station labels)
    layer.querySelectorAll('.metro-standalone-text').forEach(el => el.remove());

    for (const tx of this.state.data.texts) {
      const isSelected = this.state.selection.has(tx.id);
      const g = svgEl('g', {
        id: `text-${tx.id}`,
        class: 'metro-text metro-standalone-text' + (isSelected ? ' selected' : ''),
        'data-id': tx.id,
        transform: `translate(${tx.x},${tx.y}) rotate(${tx.rotate || 0})`,
      });

      const t = svgEl('text', {
        'font-family': tx.font || "'Noto Sans TC', sans-serif",
        'font-size': tx.size || 14,
        'font-weight': tx.weight || 400,
        fill: tx.color || '#e8eaf0',
        'dominant-baseline': 'hanging',
      });
      t.textContent = tx.content || '';
      g.appendChild(t);

      if (isSelected) {
        const bbox = { x: -4, y: -4, width: (tx.content?.length || 4) * (tx.size || 14) * 0.6 + 8, height: (tx.size || 14) + 8 };
        const rect = svgEl('rect', { ...bbox, fill: 'rgba(74,158,255,0.08)', stroke: '#4A9EFF', 'stroke-width': 1, rx: 2 });
        g.insertBefore(rect, t);
      }

      this._bindTextEvents(g, tx);
      layer.appendChild(g);
    }
  }

  // ── Selection Overlay ─────────────────────────────────────────────────────
  renderSelection() {
    // Re-render to reflect selected state classes
    this.renderLines();
    this.renderStations();
    this.renderTexts();
  }

  // ── Layer visibility ──────────────────────────────────────────────────────
  _applyLayerVisibility() {
    for (const [key, cfg] of Object.entries(this.state.layers)) {
      const el = document.getElementById(`layer-${key}`);
      if (!el) continue;
      el.style.display  = cfg.visible ? '' : 'none';
      el.style.opacity  = cfg.opacity;
    }
  }

  // ── Drag Interaction helpers ───────────────────────────────────────────────
  // 共用：將 Touch 轉換為简单 mouse-like 物件
  _touchToClient(touch) {
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  _bindStationEvents(g, st) {
    let dragStart = null, origPos = null, moved = false;

    const startDrag = (clientX, clientY, shiftKey) => {
      const pt = this.canvas.screenToCanvas(clientX, clientY);
      dragStart = pt;
      origPos   = { x: st.x, y: st.y };
      moved     = false;
      if (!shiftKey && !this.state.selection.has(st.id)) {
        this.state.selection.clear();
      }
      this.state.selection.add(st.id);
      this.state.emit('selectionChange');
    };

    const doDrag = (clientX, clientY) => {
      if (!dragStart) return;
      const cur = this.canvas.screenToCanvas(clientX, clientY);
      const dx = cur.x - dragStart.x;
      const dy = cur.y - dragStart.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      if (moved) {
        const snapped = this.canvas.snapPoint({ x: origPos.x + dx, y: origPos.y + dy });
        st.x = snapped.x; st.y = snapped.y;
        g.setAttribute('transform', `translate(${st.x},${st.y})`);
        const labelG = document.getElementById(`label-${st.id}`);
        if (labelG) labelG.setAttribute('transform', `translate(${st.x},${st.y})`);
        this.state.markDirty();
      }
    };

    const endDrag = () => {
      if (moved) this.state.emit('objectsChange');
      dragStart = null;
    };

    // ── Mouse ────────────────────────────────────────────────────────────────
    g.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.state.activeTool === 'line') return;
      e.stopPropagation();
      startDrag(e.clientX, e.clientY, e.shiftKey);

      const onMove = (ev) => doDrag(ev.clientX, ev.clientY);
      const onUp   = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        endDrag();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // ── Touch ────────────────────────────────────────────────────────────────
    g.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (this.state.activeTool === 'line') return;
      e.stopPropagation();
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY, false);
    }, { passive: true });

    g.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1 || !dragStart) return;
      e.preventDefault();
      e.stopPropagation();
      const t = e.touches[0];
      doDrag(t.clientX, t.clientY);
    }, { passive: false });

    g.addEventListener('touchend', (e) => {
      e.stopPropagation();
      if (moved) e.preventDefault();
      endDrag();
    }, { passive: false });
  }

  _bindLineEvents(g, line) {
    const handleSelect = (shiftKey) => {
      if (!shiftKey) this.state.selection.clear();
      this.state.selection.add(line.id);
      this.state.emit('selectionChange');
    };

    g.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.state.activeTool === 'line') return;
      e.stopPropagation();
      handleSelect(e.shiftKey);
    });

    // Touch: tap on line to select (or continue drawing in line tool)
    g.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (this.state.activeTool === 'line') return; // line tool 下不預先選取
      e.stopPropagation();
    }, { passive: true });

    g.addEventListener('touchend', (e) => {
      if (this.state.activeTool === 'line') return;
      e.stopPropagation();
      const t = e.changedTouches[0];
      const start = window._toolbarTouchStart;
      const dist = start ? Math.hypot(t.clientX - start.x, t.clientY - start.y) : 0;
      if (dist > 12) return;
      handleSelect(false);
    }, { passive: true });
  }

  _bindTextEvents(g, tx) {
    let dragStart = null, origPos = null, moved = false;

    const startDrag = (clientX, clientY) => {
      dragStart = this.canvas.screenToCanvas(clientX, clientY);
      origPos   = { x: tx.x, y: tx.y };
      moved     = false;
    };

    const doDrag = (clientX, clientY) => {
      if (!dragStart) return;
      const cur = this.canvas.screenToCanvas(clientX, clientY);
      const dx = cur.x - dragStart.x, dy = cur.y - dragStart.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      if (moved) {
        const snapped = this.canvas.snapPoint({ x: origPos.x + dx, y: origPos.y + dy });
        tx.x = snapped.x; tx.y = snapped.y;
        g.setAttribute('transform', `translate(${tx.x},${tx.y}) rotate(${tx.rotate || 0})`);
        this.state.markDirty();
      }
    };

    const endDrag = () => {
      if (moved) this.state.emit('objectsChange');
      dragStart = null;
    };

    // ── Mouse ──
    g.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      if (!e.shiftKey) this.state.selection.clear();
      this.state.selection.add(tx.id);
      this.state.emit('selectionChange');
      startDrag(e.clientX, e.clientY);

      const onMove = (ev) => doDrag(ev.clientX, ev.clientY);
      const onUp   = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        endDrag();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // ── Touch ──
    g.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      this.state.selection.clear();
      this.state.selection.add(tx.id);
      this.state.emit('selectionChange');
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    }, { passive: true });

    g.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1 || !dragStart) return;
      e.preventDefault();
      e.stopPropagation();
      const t = e.touches[0];
      doDrag(t.clientX, t.clientY);
    }, { passive: false });

    g.addEventListener('touchend', (e) => {
      e.stopPropagation();
      if (moved) e.preventDefault();
      endDrag();
    }, { passive: false });
  }

  // ── Line-draw preview ─────────────────────────────────────────────────────
  showLinePreview(points, currentPt, color, width, routing) {
    let prev = document.getElementById('line-draw-preview');
    if (!prev) {
      prev = document.createElementNS(NS, 'path');
      prev.id = 'line-draw-preview';
      prev.classList.add('line-preview');
      document.getElementById('layer-selection').appendChild(prev);
    }
    const allPts = [...points, currentPt];
    if (allPts.length < 2) { prev.removeAttribute('d'); return; }
    prev.setAttribute('d', routePath(allPts, routing));
    prev.setAttribute('stroke', color || '#4A9EFF');
    prev.setAttribute('stroke-width', width || 8);
    prev.setAttribute('fill', 'none');
    prev.setAttribute('stroke-linecap', 'round');
    prev.setAttribute('stroke-linejoin', 'round');
  }

  hideLinePreview() {
    document.getElementById('line-draw-preview')?.remove();
  }

  // ── Snap indicator ────────────────────────────────────────────────────────
  showSnapIndicator(pt) {
    let el = document.getElementById('snap-indicator');
    if (!el) {
      el = document.createElementNS(NS, 'circle');
      el.id = 'snap-indicator';
      el.classList.add('snap-indicator');
      el.setAttribute('r', 5);
      document.getElementById('layer-selection').appendChild(el);
    }
    el.setAttribute('cx', pt.x);
    el.setAttribute('cy', pt.y);
  }

  hideSnapIndicator() {
    document.getElementById('snap-indicator')?.remove();
  }
}

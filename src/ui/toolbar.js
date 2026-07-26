/**
 * toolbar.js — Left Toolbar Controller
 * Handles tool switching and canvas interaction per tool.
 * Transportation Designer by NetFormosa
 */

import { generateId, nearestStation } from '../utils.js';

export class Toolbar {
  constructor(state, canvas) {
    this.state = state;
    this.canvas = canvas;
    this._renderer = null; // injected lazily
  }

  init() {
    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.state.setTool(tool);
      });
    });

    // Canvas interaction per tool
    const svgEl = document.getElementById('main-canvas');
    svgEl.addEventListener('mousedown', (e) => this._onCanvasMouseDown(e));
    svgEl.addEventListener('mousemove', (e) => this._onCanvasMouseMove(e));
    svgEl.addEventListener('mouseup', (e) => this._onCanvasMouseUp(e));
    svgEl.addEventListener('dblclick', (e) => this._onCanvasDblClick(e));
    svgEl.addEventListener('click', (e) => this._onCanvasClick(e));

    // ── Touch support ────────────────────────────────────────────────────
    this._lastTapTime   = 0;
    this._touchStartPos = null;

    svgEl.addEventListener('touchstart', (e) => this._onCanvasTouchStart(e), { passive: false });
    svgEl.addEventListener('touchmove',  (e) => this._onCanvasTouchMove(e),  { passive: false });
    svgEl.addEventListener('touchend',   (e) => this._onCanvasTouchEnd(e),   { passive: false });
  }

  setActiveTool(tool) {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    // Re-render line endpoints when switching to/from line tool
    const renderer = window._appRenderer;
    if (renderer) {
      renderer._renderLineEndpoints();
    }
  }

  _getRenderer() {
    // Lazy-resolve renderer from global
    if (!this._renderer) {
      this._renderer = window._appRenderer;
    }
    return this._renderer;
  }

  // ── Canvas Events ─────────────────────────────────────────────────────────
  _onCanvasMouseDown(e) {
    if (e.button !== 0) return;
    const tool = this.state.activeTool;

    // Don't intercept if clicking existing object or endpoint handles
    if (e.target.closest('.metro-station') || e.target.closest('.metro-line') || e.target.closest('.metro-text')) return;
    if (e.target.classList.contains('line-endpoint-handle')) return;

    const pt = this.canvas.screenToCanvas(e.clientX, e.clientY);

    if (tool === 'station') {
      this._placeStation(pt, e);
    } else if (tool === 'text') {
      this._placeText(pt, e);
    }
  }

  _findEndpointNear(pt, threshold = 25) {
    let best = null;
    let minD = threshold;

    for (const line of this.state.data.lines) {
      if (!line.pathNodes || line.pathNodes.length === 0) continue;
      const first = line.pathNodes[0];
      const last = line.pathNodes[line.pathNodes.length - 1];

      const dStart = Math.hypot(first.x - pt.x, first.y - pt.y);
      if (dStart < minD) {
        minD = dStart;
        best = { lineObj: line, role: 'start', pt: first };
      }

      const dEnd = Math.hypot(last.x - pt.x, last.y - pt.y);
      if (dEnd < minD) {
        minD = dEnd;
        best = { lineObj: line, role: 'end', pt: last };
      }
    }

    return best;
  }

  _onCanvasClick(e) {
    if (e.button !== 0) return;
    const tool = this.state.activeTool;
    if (tool !== 'line') return;

    const pt = this.canvas.screenToCanvas(e.clientX, e.clientY);

    // 若尚未處於繪圖中
    if (!this.state.lineDrawing.active) {
      // 1. 優先檢查是否點擊在已有路線的端點上（或附近的端點/端點車站）
      const hitEndpoint = this._findEndpointNear(pt, 25);
      if (hitEndpoint) {
        const { lineObj, role } = hitEndpoint;
        if (role === 'start') {
          lineObj.pathNodes = [...lineObj.pathNodes].reverse();
        }
        this.state.lineDrawing.active = true;
        this.state.lineDrawing.lineId = lineObj.id;
        this.state.lineDrawing.points = [...lineObj.pathNodes];

        this.state.selection.clear();
        this.state.selection.add(lineObj.id);
        this.state.emit('selectionChange');
        window._appRenderer?._renderLineEndpoints();
        window.showToast?.(`從「${lineObj.name || '路線'}」端點繼續繪製（雙擊結束）`, 'info', 2000);
        return;
      }

      // 2. 檢查是否點擊在已有路線本體上
      const lineEl = e.target.closest('.metro-line');
      if (lineEl) {
        const lineId = lineEl.dataset.id;
        const lineObj = this.state.data.lines.find(l => l.id === lineId);
        if (lineObj && lineObj.pathNodes.length > 0) {
          const first = lineObj.pathNodes[0];
          const last = lineObj.pathNodes[lineObj.pathNodes.length - 1];
          const dFirst = Math.hypot(first.x - pt.x, first.y - pt.y);
          const dLast = Math.hypot(last.x - pt.x, last.y - pt.y);
          if (dFirst < dLast) {
            lineObj.pathNodes = [...lineObj.pathNodes].reverse();
          }
          this.state.lineDrawing.active = true;
          this.state.lineDrawing.lineId = lineId;
          this.state.lineDrawing.points = [...lineObj.pathNodes];

          this.state.selection.clear();
          this.state.selection.add(lineId);
          this.state.emit('selectionChange');
          window._appRenderer?._renderLineEndpoints();
          window.showToast?.(`繼續繪製路線（雙擊結束）`, 'info', 2000);
          return;
        }
      }
    }

    const snap = this.canvas.snapPoint(pt);
    this._addLinePoint(snap, e);
  }

  _onCanvasMouseMove(e) {
    const tool = this.state.activeTool;
    if (tool !== 'line') return;

    const pt = this.canvas.screenToCanvas(e.clientX, e.clientY);
    const snap = this.canvas.snapPoint(pt);
    const renderer = window._appRenderer;
    if (!renderer) return;

    // 搜尋吸附：優先車站，其次路線端點 (與對齊格線連動)
    const snapOn = this.state.canvas.snapToGrid !== false;
    const nearSt = snapOn ? nearestStation(pt, this.state.data.stations, 20) : null;
    const nearEp = snapOn ? this._findEndpointNear(pt, 25) : null;
    const usePt = nearSt ? { x: nearSt.x, y: nearSt.y }
      : (nearEp ? nearEp.pt : snap);

    if (this.state.lineDrawing.active) {
      const drawing = this.state.lineDrawing;
      const lineObj = this.state.data.lines.find(l => l.id === drawing.lineId);
      if (!lineObj) return;

      renderer.showLinePreview(drawing.points, usePt, lineObj.color, lineObj.width, lineObj.routingMode);
    }

    if (nearSt || nearEp) renderer.showSnapIndicator(usePt);
    else renderer.hideSnapIndicator();
  }

  _onCanvasMouseUp(e) { }

  // ── Touch Canvas Handlers ────────────────────────────────────────────────────
  _onCanvasTouchStart(e) {
    if (e.touches.length !== 1) return; // 雙指由 canvas.js pinch handler 處理
    const touch = e.touches[0];
    this._touchStartPos = { x: touch.clientX, y: touch.clientY };

    // 路線工具：發送 mousemove，更新預覽線
    const tool = this.state.activeTool;
    if (tool === 'line') {
      const pt = this.canvas.screenToCanvas(touch.clientX, touch.clientY);
      const snap = this.canvas.snapPoint(pt);
      const renderer = window._appRenderer;
      if (renderer && this.state.lineDrawing.active) {
        const drawing = this.state.lineDrawing;
        const lineObj = this.state.data.lines.find(l => l.id === drawing.lineId);
        if (lineObj) {
          renderer.showLinePreview(drawing.points, snap, lineObj.color, lineObj.width, lineObj.routingMode);
        }
      }
    }
  }

  _onCanvasTouchMove(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const tool = this.state.activeTool;

    // 在路線工具下，更新預覽線（类似 mousemove）
    if (tool === 'line') {
      e.preventDefault();
      const fakeEv = { clientX: touch.clientX, clientY: touch.clientY };
      this._onCanvasMouseMove(fakeEv);
    }

    // 選取工具：單指拖曳登記到 canvas.js 的 pan（非 pan 工具下由 canvas.js 處理）
  }

  _onCanvasTouchEnd(e) {
    if (e.changedTouches.length !== 1) return;
    if (e.touches.length > 0) return; // 還有其他手指在畫面上

    const touch = e.changedTouches[0];
    const start = this._touchStartPos;
    if (!start) return;

    // 判斷是否為短距離（tap）而非滑動
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 12) return; // 滑動距離太遠，不觸發

    // 檢測雙擊（300ms 內兩次 tap）
    const now = Date.now();
    const isDoubleTap = (now - this._lastTapTime) < 300;
    this._lastTapTime = now;

    // 不要讓瀏覽器再產生 click 事件（防止重複）
    e.preventDefault();

    const fakeEv = {
      button: 0,
      clientX: touch.clientX,
      clientY: touch.clientY,
      target: e.target,
      shiftKey: false,
      closest: (sel) => e.target.closest?.(sel),
    };

    if (isDoubleTap) {
      this._onCanvasDblClick(fakeEv);
    } else {
      this._onCanvasClick(fakeEv);
      // station/text 工具：_onCanvasMouseDown 內用 button===0 判斷
      if (this.state.activeTool === 'station' || this.state.activeTool === 'text') {
        if (!e.target.closest('.metro-station') &&
            !e.target.closest('.metro-line') &&
            !e.target.closest('.metro-text')) {
          this._onCanvasMouseDown(fakeEv);
        }
      }
    }
  }

  _onCanvasDblClick(e) {
    const tool = this.state.activeTool;
    if (tool === 'line' && this.state.lineDrawing.active) {
      this._finishLine();
    }
  }

  // ── Station Placement ─────────────────────────────────────────────────────
  _placeStation(pt, e) {
    const snap = this.canvas.snapPoint(pt);
    const preset = window._appPreset || {};
    const sd = preset.stationDefaults || {};

    const st = {
      id: generateId('station'),
      name: '',
      englishName: '',
      stationCode: '',
      x: snap.x,
      y: snap.y,
      labelOffset: { x: 20, y: 0 },
      labelColor: '#e8eaf0',
      style: {
        shape: 'circle',
        size: 16,
        color: '#FFFFFF',
        strokeColor: '#0070BD',
        strokeWidth: 4,
        opacity: 1.0,
      },
    };

    this.state.data.stations.push(st);
    this.state.selection.clear();
    this.state.selection.add(st.id);
    this.state.markDirty();
    this.state.emit('objectsChange');
    this.state.emit('selectionChange');

    window._appHistory?.push();
  }

  // ── Line Drawing ──────────────────────────────────────────────────────────
  _addLinePoint(pt, e) {
    const drawing = this.state.lineDrawing;

    // Snap to nearby station (與對齊格線連動)
    const snapOn = this.state.canvas.snapToGrid !== false;
    const near = snapOn ? nearestStation(pt, this.state.data.stations, 20) : null;
    const usePt = near ? { x: near.x, y: near.y } : pt;

    if (!drawing.active) {
      // Start new line
      const lineId = generateId('line');
      const preset = window._appPreset || {};
      const ld = preset.lineDefaults || {};

      const lineObj = {
        id: lineId,
        name: '新路線',
        code: 'L',
        color: '#4A9EFF',
        width: 14,
        style: 'solid',
        opacity: 1.0,
        routingMode: '45deg',
        pathNodes: [usePt],
      };

      this.state.data.lines.push(lineObj);
      drawing.active = true;
      drawing.lineId = lineId;
      drawing.points = [usePt];

      this.state.selection.clear();
      this.state.selection.add(lineId);
      this.state.emit('selectionChange');
    } else {
      // Continue line
      drawing.points.push(usePt);
      const lineObj = this.state.data.lines.find(l => l.id === drawing.lineId);
      if (lineObj) {
        lineObj.pathNodes = [...drawing.points];
        this.state.emit('objectsChange');
      }
    }
  }

  _finishLine() {
    const drawing = this.state.lineDrawing;
    if (!drawing.active) return;

    window._appRenderer?.hideLinePreview();
    window._appRenderer?.hideSnapIndicator();

    drawing.active = false;
    drawing.lineId = null;
    drawing.points = [];

    this.state.markDirty();
    this.state.emit('objectsChange');
    window._appHistory?.push();

    // Re-render endpoints so they appear again after finishing
    window._appRenderer?._renderLineEndpoints();

    window.showToast?.('路線繪製完成', 'info', 2000);
  }

  // ── Text Placement ────────────────────────────────────────────────────────
  _placeText(pt, e) {
    const snap = this.canvas.snapPoint(pt);
    const tx = {
      id: generateId('text'),
      content: '文字',
      x: snap.x,
      y: snap.y,
      font: "'Noto Sans TC', sans-serif",
      size: 16,
      weight: 400,
      color: '#e8eaf0',
      rotate: 0,
    };

    this.state.data.texts.push(tx);
    this.state.selection.clear();
    this.state.selection.add(tx.id);
    this.state.markDirty();
    this.state.emit('objectsChange');
    this.state.emit('selectionChange');
    window._appHistory?.push();
  }
}

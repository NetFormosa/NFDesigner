/**
 * selection.js — Selection Manager (rubber-band, multi-select)
 * Transportation Designer by NetFormosa
 */

export class SelectionManager {
  constructor(state, canvas, renderer) {
    this.state    = state;
    this.canvas   = canvas;
    this.renderer = renderer;

    this._band = document.getElementById('rubber-band');
    this._bandStart = null;

    this._bindEvents();
  }

  _bindEvents() {
    const svgEl = document.getElementById('main-canvas');

    // ── Mouse: rubber-band ─────────────────────────────────────────────
    svgEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.state.activeTool !== 'select') return;
      if (e.target !== svgEl && !e.target.closest('#layer-grid') && !e.target.closest('#canvas-transform')) {
        // clicked on an object — handled by renderer
        if (!e.target.closest('#canvas-transform')) return;
        if (e.target.closest('.metro-station') || e.target.closest('.metro-line') || e.target.closest('.metro-text')) return;
      }
      if (e.target.closest('.metro-station') || e.target.closest('.metro-line') || e.target.closest('.metro-text')) return;

      // Start rubber-band
      if (!e.shiftKey) {
        this.state.selection.clear();
        this.state.emit('selectionChange');
      }
      this._startBand(e);
    });

    // ── Touch: single-finger drag on blank canvas = rubber-band (select tool) / pan (pan tool) ──
    svgEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (this.state.activeTool !== 'select') return;

      const t = e.touches[0];
      // 如果觸到物件，不啟動橡皮筋
      if (e.target.closest('.metro-station') || e.target.closest('.metro-line') || e.target.closest('.metro-text')) return;

      // 在空白區域開始橡皮筋選取
      this.state.selection.clear();
      this.state.emit('selectionChange');
      this._startBandTouch(t);
    }, { passive: true });
  }

  _startBand(e) {
    const rect = document.getElementById('main-canvas').getBoundingClientRect();
    this._bandStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this._band.style.display = 'block';
    this._band.style.left   = `${this._bandStart.x}px`;
    this._band.style.top    = `${this._bandStart.y}px`;
    this._band.style.width  = '0px';
    this._band.style.height = '0px';

    const onMove = (ev) => {
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const x = Math.min(cx, this._bandStart.x);
      const y = Math.min(cy, this._bandStart.y);
      const w = Math.abs(cx - this._bandStart.x);
      const h = Math.abs(cy - this._bandStart.y);
      this._band.style.left   = `${x}px`;
      this._band.style.top    = `${y}px`;
      this._band.style.width  = `${w}px`;
      this._band.style.height = `${h}px`;
    };

    const onUp = (ev) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this._endBand(ev, rect);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Touch rubber-band ─────────────────────────────────────────────────────
  _startBandTouch(touch) {
    const rect = document.getElementById('main-canvas').getBoundingClientRect();
    this._bandStart = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    this._band.style.display = 'block';
    this._band.style.left   = `${this._bandStart.x}px`;
    this._band.style.top    = `${this._bandStart.y}px`;
    this._band.style.width  = '0px';
    this._band.style.height = '0px';

    const onMove = (ev) => {
      if (ev.touches.length !== 1) return;
      ev.preventDefault();
      const t = ev.touches[0];
      const cx = t.clientX - rect.left;
      const cy = t.clientY - rect.top;
      const x = Math.min(cx, this._bandStart.x);
      const y = Math.min(cy, this._bandStart.y);
      const w = Math.abs(cx - this._bandStart.x);
      const h = Math.abs(cy - this._bandStart.y);
      this._band.style.left   = `${x}px`;
      this._band.style.top    = `${y}px`;
      this._band.style.width  = `${w}px`;
      this._band.style.height = `${h}px`;
    };

    const onEnd = (ev) => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      if (ev.changedTouches.length > 0) {
        const fakeEv = {
          clientX: ev.changedTouches[0].clientX,
          clientY: ev.changedTouches[0].clientY,
        };
        this._endBand(fakeEv, rect);
      } else {
        this._band.style.display = 'none';
      }
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: false });
  }

  _endBand(e, rect) {
    this._band.style.display = 'none';

    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (Math.abs(cx - this._bandStart.x) < 4 && Math.abs(cy - this._bandStart.y) < 4) return;

    // Convert band to canvas space
    const tl = this.canvas.screenToCanvas(
      rect.left + Math.min(cx, this._bandStart.x),
      rect.top  + Math.min(cy, this._bandStart.y));
    const br = this.canvas.screenToCanvas(
      rect.left + Math.max(cx, this._bandStart.x),
      rect.top  + Math.max(cy, this._bandStart.y));

    // Select all stations within band
    for (const st of this.state.data.stations) {
      if (st.x >= tl.x && st.x <= br.x && st.y >= tl.y && st.y <= br.y) {
        this.state.selection.add(st.id);
      }
    }

    // Select all texts within band
    for (const tx of this.state.data.texts) {
      if (tx.x >= tl.x && tx.x <= br.x && tx.y >= tl.y && tx.y <= br.y) {
        this.state.selection.add(tx.id);
      }
    }

    this.state.emit('selectionChange');
  }

  selectAll() {
    for (const st of this.state.data.stations) this.state.selection.add(st.id);
    for (const ln of this.state.data.lines)    this.state.selection.add(ln.id);
    for (const tx of this.state.data.texts)    this.state.selection.add(tx.id);
    this.state.emit('selectionChange');
  }

  clearSelection() {
    this.state.selection.clear();
    this.state.emit('selectionChange');
  }

  deleteSelected() {
    const ids = [...this.state.selection];
    if (!ids.length) return;

    this.state.data.stations = this.state.data.stations.filter(s => !ids.includes(s.id));
    this.state.data.lines    = this.state.data.lines.filter(l => !ids.includes(l.id));
    this.state.data.texts    = this.state.data.texts.filter(t => !ids.includes(t.id));

    this.state.selection.clear();
    this.state.markDirty();
    this.state.emit('objectsChange');
    this.state.emit('selectionChange');
    if (window._appHistory) window._appHistory.push();
    window.showToast?.(`已刪除 ${ids.length} 個物件`, 'info');
  }
}

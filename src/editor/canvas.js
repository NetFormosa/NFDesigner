/**
 * canvas.js — Canvas management (pan, zoom, coordinate transforms, grid)
 * Transportation Designer by NetFormosa
 */

export class Canvas {
  constructor(state, history) {
    this.state   = state;
    this.history = history;

    this.svgEl       = null;
    this.transformEl = null;
    this.container   = null;
    this.gridLines   = null;

    this._isDragging   = false;
    this._panStart     = { x: 0, y: 0 };
    this._panOrigin    = { x: 0, y: 0 };
    this._isPanning    = false;
    this._spaceHeld    = false;

    // Touch
    this._touchPanActive = false;
    this._pinchActive    = false;
    this._pinchDist      = 0;
    this._pinchMidpoint  = { x: 0, y: 0 };

    // Min / max zoom
    this.MIN_SCALE = 0.05;
    this.MAX_SCALE = 20;
  }

  init() {
    this.svgEl       = document.getElementById('main-canvas');
    this.transformEl = document.getElementById('canvas-transform');
    this.container   = document.getElementById('canvas-container');
    this.gridLines   = document.getElementById('grid-lines');

    this._bindEvents();
    this._fitToView();
  }

  // ── Coordinate utilities ──────────────────────────────────────────────────
  screenToCanvas(sx, sy) {
    const rect  = this.svgEl.getBoundingClientRect();
    const { x, y, scale } = this.state.transform;
    return {
      x: (sx - rect.left - x) / scale,
      y: (sy - rect.top  - y) / scale,
    };
  }

  canvasToScreen(cx, cy) {
    const { x, y, scale } = this.state.transform;
    return { x: cx * scale + x, y: cy * scale + y };
  }

  snapPoint(pt) {
    if (!this.state.canvas.snapToGrid) return { x: pt.x, y: pt.y };
    const gs = this.state.canvas.gridSize;
    return {
      x: Math.round(pt.x / gs) * gs,
      y: Math.round(pt.y / gs) * gs,
    };
  }

  // ── Apply transform ───────────────────────────────────────────────────────
  _applyTransform() {
    const { x, y, scale } = this.state.transform;
    this.transformEl.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
    this.state.emit('zoomChange');
  }

  setZoom(newScale, originX, originY) {
    const { x, y, scale } = this.state.transform;
    const clampedScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, newScale));

    // Zoom towards origin point (in screen space)
    const rect = this.svgEl.getBoundingClientRect();
    const ox = (originX !== undefined ? originX : rect.left + rect.width / 2)  - rect.left;
    const oy = (originY !== undefined ? originY : rect.top  + rect.height / 2) - rect.top;

    const factor = clampedScale / scale;
    this.state.transform.x = ox - factor * (ox - x);
    this.state.transform.y = oy - factor * (oy - y);
    this.state.transform.scale = clampedScale;
    this._applyTransform();
  }

  zoomIn()  { this.setZoom(this.state.transform.scale * 1.2); }
  zoomOut() { this.setZoom(this.state.transform.scale / 1.2); }

  _fitToView() {
    const rect = this.container.getBoundingClientRect();
    const { width, height } = this.state.canvas;
    const scale  = Math.min(rect.width / width, rect.height / height) * 0.85;
    const px = (rect.width  - width  * scale) / 2;
    const py = (rect.height - height * scale) / 2;
    this.state.transform = { x: px, y: py, scale };
    this._applyTransform();
  }

  fitToView() { this._fitToView(); }

  setTool(tool) {
    this.container.className = '';
    if (tool) this.container.classList.add(`tool-${tool}`);
  }

  // ── Events ────────────────────────────────────────────────────────────────
  _bindEvents() {
    // Zoom via wheel
    this.svgEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.setZoom(this.state.transform.scale * factor, e.clientX, e.clientY);
    }, { passive: false });

    // Space-bar panning
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        if (!this._spaceHeld) {
          this._spaceHeld = true;
          this.container.classList.add('tool-pan');
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._spaceHeld = false;
        this.setTool(this.state.activeTool);
      }
    });

    // Mouse down — route to pan or tool handler
    this.svgEl.addEventListener('mousedown', (e) => {
      if (e.button === 1 || this._spaceHeld || this.state.activeTool === 'pan') {
        this._startPan(e);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this._isPanning) this._doPan(e);
    });
    document.addEventListener('mouseup', (e) => {
      if (this._isPanning) this._endPan();
    });

    // Status bar zoom buttons
    document.getElementById('status-zoom-in-btn').addEventListener('click',  () => this.zoomIn());
    document.getElementById('status-zoom-out-btn').addEventListener('click', () => this.zoomOut());
    document.getElementById('tool-zoom-in').addEventListener('click',  () => this.zoomIn());
    document.getElementById('tool-zoom-out').addEventListener('click', () => this.zoomOut());
    document.getElementById('btn-zoom-fit-tool').addEventListener('click', () => this._fitToView());

    // ── Touch support ───────────────────────────────────────────────────────
    this.svgEl.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    this.svgEl.addEventListener('touchmove',  (e) => this._onTouchMove(e),  { passive: false });
    this.svgEl.addEventListener('touchend',   (e) => this._onTouchEnd(e),   { passive: false });
    this.svgEl.addEventListener('touchcancel',(e) => this._onTouchEnd(e),   { passive: false });
  }

  // ── Touch Handlers ────────────────────────────────────────────────────────
  _onTouchStart(e) {
    if (e.touches.length === 1) {
      const tool = this.state.activeTool;
      // pan 工具：直接平移
      // station/text/line 工具且觸碰到空白區域：也允許平移（手機無空白鍵）
      const onBlank = !e.target.closest('.metro-station') &&
                      !e.target.closest('.metro-line') &&
                      !e.target.closest('.metro-text');
      if (tool === 'pan' || this._spaceHeld ||
          ((tool === 'station' || tool === 'text' || tool === 'line') && onBlank)) {
        // 對 station/text/line 工具，平移開始後工具欄的 touchend 會偵測到移動距離 > 12px 而不觸發放置
        this._startPanTouch(e.touches[0]);
        e.preventDefault();
      }
    } else if (e.touches.length === 2) {
      // Cancel any single-finger pan
      this._touchPanActive = false;
      this._pinchActive = true;
      this._pinchDist = this._getTouchDist(e.touches);
      this._pinchMidpoint = this._getTouchMidpoint(e.touches);
      e.preventDefault();
    }
  }

  _onTouchMove(e) {
    if (this._pinchActive && e.touches.length === 2) {
      const newDist = this._getTouchDist(e.touches);
      const mid     = this._getTouchMidpoint(e.touches);
      if (this._pinchDist > 0) {
        const factor = newDist / this._pinchDist;
        this.setZoom(this.state.transform.scale * factor, mid.x, mid.y);
      }
      this._pinchDist = newDist;
      this._pinchMidpoint = mid;
      e.preventDefault();
    } else if (this._touchPanActive && e.touches.length === 1) {
      this._doPanTouch(e.touches[0]);
      e.preventDefault();
    }
  }

  _onTouchEnd(e) {
    if (e.touches.length < 2) {
      this._pinchActive = false;
      this._pinchDist = 0;
    }
    if (e.touches.length === 0) {
      this._touchPanActive = false;
      this._endPan();
    }
  }

  _startPanTouch(touch) {
    this._touchPanActive = true;
    this._isPanning = true;
    this._panStart  = { x: touch.clientX, y: touch.clientY };
    this._panOrigin = { ...this.state.transform };
    this.container.classList.add('panning');
  }

  _doPanTouch(touch) {
    const dx = touch.clientX - this._panStart.x;
    const dy = touch.clientY - this._panStart.y;
    this.state.transform.x = this._panOrigin.x + dx;
    this.state.transform.y = this._panOrigin.y + dy;
    this._applyTransform();
  }

  _getTouchDist(touches) {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.hypot(dx, dy);
  }

  _getTouchMidpoint(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  _startPan(e) {
    this._isPanning = true;
    this._panStart  = { x: e.clientX, y: e.clientY };
    this._panOrigin = { ...this.state.transform };
    this.container.classList.add('panning');
    e.preventDefault();
  }

  _doPan(e) {
    const dx = e.clientX - this._panStart.x;
    const dy = e.clientY - this._panStart.y;
    this.state.transform.x = this._panOrigin.x + dx;
    this.state.transform.y = this._panOrigin.y + dy;
    this._applyTransform();
  }

  _endPan() {
    this._isPanning = false;
    this.container.classList.remove('panning');
  }
}

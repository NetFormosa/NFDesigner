/**
 * propertyPanel.js — Right Property Panel Controller
 * Dynamically shows the appropriate property form based on selection.
 * Transportation Designer by NetFormosa
 */

export class PropertyPanel {
  constructor(state, renderer, history) {
    this.state    = state;
    this.renderer = renderer;
    this.history  = history;
    this._updating = false; // prevent feedback loops
  }

  init() {
    this._bindStationProps();
    this._bindLineProps();
    this._bindTextProps();
    this.update();
  }

  update() {
    const selected = this.state.getSelectedObjects();
    const propEmpty   = document.getElementById('prop-empty');
    const propStation = document.getElementById('prop-station');
    const propLine    = document.getElementById('prop-line');
    const propText    = document.getElementById('prop-text');

    propEmpty.style.display   = 'none';
    propStation.style.display = 'none';
    propLine.style.display    = 'none';
    propText.style.display    = 'none';

    if (!selected.length) {
      propEmpty.style.display = 'flex';
      return;
    }

    const obj = selected[0];
    if (obj.id.startsWith('station')) {
      propStation.style.display = 'block';
      this._fillStation(obj);
    } else if (obj.id.startsWith('line')) {
      propLine.style.display = 'block';
      this._fillLine(obj);
    } else if (obj.id.startsWith('text')) {
      propText.style.display = 'block';
      this._fillText(obj);
    } else {
      propEmpty.style.display = 'flex';
    }
  }

  // ── Station ───────────────────────────────────────────────────────────────
  _fillStation(st) {
    this._updating = true;
    document.getElementById('prop-station-name').value  = st.name        || '';
    document.getElementById('prop-station-en').value    = st.englishName || '';
    document.getElementById('prop-station-code').value  = st.stationCode || '';
    document.getElementById('prop-station-shape').value = st.style?.shape || 'circle';
    this._setSlider('prop-station-size', 'prop-station-size-num', st.style?.size || 10);
    document.getElementById('prop-station-fill').value  = st.style?.color       || '#FFFFFF';
    document.getElementById('prop-station-fill-hex').value = st.style?.color    || '#FFFFFF';
    document.getElementById('prop-station-stroke').value = st.style?.strokeColor || '#0070BD';
    document.getElementById('prop-station-stroke-hex').value = st.style?.strokeColor || '#0070BD';
    this._setSlider('prop-station-sw', 'prop-station-sw-num', st.style?.strokeWidth || 3);
    document.getElementById('prop-station-x').value = Math.round(st.x);
    document.getElementById('prop-station-y').value = Math.round(st.y);
    this._updating = false;
  }

  _bindStationProps() {
    const fields = [
      { id: 'prop-station-name',       key: 'name' },
      { id: 'prop-station-en',         key: 'englishName' },
      { id: 'prop-station-code',       key: 'stationCode' },
    ];
    fields.forEach(f => {
      document.getElementById(f.id).addEventListener('input', (e) => {
        if (this._updating) return;
        const obj = this._selectedStation(); if (!obj) return;
        obj[f.key] = e.target.value;
        this._pushChange();
      });
    });

    document.getElementById('prop-station-shape').addEventListener('change', (e) => {
      const obj = this._selectedStation(); if (!obj) return;
      obj.style.shape = e.target.value;
      this._pushChange();
    });

    this._bindSlider('prop-station-size', 'prop-station-size-num', (v) => {
      const obj = this._selectedStation(); if (!obj) return;
      obj.style.size = +v; this._pushChange();
    });

    this._bindColorPair('prop-station-fill', 'prop-station-fill-hex', (hex) => {
      const obj = this._selectedStation(); if (!obj) return;
      obj.style.color = hex; this._pushChange();
    });

    this._bindColorPair('prop-station-stroke', 'prop-station-stroke-hex', (hex) => {
      const obj = this._selectedStation(); if (!obj) return;
      obj.style.strokeColor = hex; this._pushChange();
    });

    this._bindSlider('prop-station-sw', 'prop-station-sw-num', (v) => {
      const obj = this._selectedStation(); if (!obj) return;
      obj.style.strokeWidth = +v; this._pushChange();
    });

    ['prop-station-x', 'prop-station-y'].forEach(id => {
      document.getElementById(id).addEventListener('change', (e) => {
        const obj = this._selectedStation(); if (!obj) return;
        if (id.endsWith('-x')) obj.x = +e.target.value;
        else obj.y = +e.target.value;
        this._pushChange();
      });
    });

    document.getElementById('prop-station-delete').addEventListener('click', () => {
      window._appSelection?.deleteSelected();
    });
  }

  _selectedStation() {
    const obj = this.state.getSelectedObjects()[0];
    return obj?.id.startsWith('station') ? obj : null;
  }

  // ── Line ──────────────────────────────────────────────────────────────────
  _fillLine(ln) {
    this._updating = true;
    document.getElementById('prop-line-name').value    = ln.name    || '';
    document.getElementById('prop-line-code').value    = ln.code    || '';
    document.getElementById('prop-line-color').value   = ln.color   || '#4A9EFF';
    document.getElementById('prop-line-color-hex').value = ln.color || '#4A9EFF';
    this._setSlider('prop-line-width', 'prop-line-width-num', ln.width || 8);
    document.getElementById('prop-line-routing').value = ln.routingMode || '45deg';
    document.getElementById('prop-line-style').value   = ln.style || 'solid';
    const opPct = Math.round((ln.opacity ?? 1) * 100);
    this._setSlider('prop-line-opacity', 'prop-line-opacity-num', opPct);
    this._updating = false;
  }

  _bindLineProps() {
    ['prop-line-name', 'prop-line-code'].forEach(id => {
      document.getElementById(id).addEventListener('input', (e) => {
        if (this._updating) return;
        const obj = this._selectedLine(); if (!obj) return;
        obj[id === 'prop-line-name' ? 'name' : 'code'] = e.target.value;
        this._pushChange();
      });
    });

    this._bindColorPair('prop-line-color', 'prop-line-color-hex', (hex) => {
      const obj = this._selectedLine(); if (!obj) return;
      obj.color = hex; this._pushChange();
    });

    this._bindSlider('prop-line-width', 'prop-line-width-num', (v) => {
      const obj = this._selectedLine(); if (!obj) return;
      obj.width = +v; this._pushChange();
    });

    document.getElementById('prop-line-routing').addEventListener('change', (e) => {
      const obj = this._selectedLine(); if (!obj) return;
      obj.routingMode = e.target.value; this._pushChange();
    });

    document.getElementById('prop-line-style').addEventListener('change', (e) => {
      const obj = this._selectedLine(); if (!obj) return;
      obj.style = e.target.value; this._pushChange();
    });

    this._bindSlider('prop-line-opacity', 'prop-line-opacity-num', (v) => {
      const obj = this._selectedLine(); if (!obj) return;
      obj.opacity = +v / 100; this._pushChange();
    });

    document.getElementById('prop-line-delete').addEventListener('click', () => {
      window._appSelection?.deleteSelected();
    });
  }

  _selectedLine() {
    const obj = this.state.getSelectedObjects()[0];
    return obj?.id.startsWith('line') ? obj : null;
  }

  // ── Text ──────────────────────────────────────────────────────────────────
  _fillText(tx) {
    this._updating = true;
    document.getElementById('prop-text-content').value = tx.content || '';
    document.getElementById('prop-text-font').value    = tx.font    || "'Noto Sans TC', sans-serif";
    document.getElementById('prop-text-size').value    = tx.size    || 14;
    document.getElementById('prop-text-weight').value  = tx.weight  || 400;
    document.getElementById('prop-text-color').value   = tx.color   || '#e8eaf0';
    document.getElementById('prop-text-color-hex').value = tx.color || '#e8eaf0';
    this._setSlider('prop-text-rotate', 'prop-text-rotate-num', tx.rotate || 0);
    this._updating = false;
  }

  _bindTextProps() {
    document.getElementById('prop-text-content').addEventListener('input', (e) => {
      if (this._updating) return;
      const obj = this._selectedText(); if (!obj) return;
      obj.content = e.target.value; this._pushChange();
    });

    ['prop-text-font', 'prop-text-weight'].forEach(id => {
      document.getElementById(id).addEventListener('change', (e) => {
        const obj = this._selectedText(); if (!obj) return;
        obj[id === 'prop-text-font' ? 'font' : 'weight'] = e.target.value;
        this._pushChange();
      });
    });

    document.getElementById('prop-text-size').addEventListener('input', (e) => {
      if (this._updating) return;
      const obj = this._selectedText(); if (!obj) return;
      obj.size = +e.target.value; this._pushChange();
    });

    this._bindColorPair('prop-text-color', 'prop-text-color-hex', (hex) => {
      const obj = this._selectedText(); if (!obj) return;
      obj.color = hex; this._pushChange();
    });

    this._bindSlider('prop-text-rotate', 'prop-text-rotate-num', (v) => {
      const obj = this._selectedText(); if (!obj) return;
      obj.rotate = +v; this._pushChange();
    });

    document.getElementById('prop-text-delete').addEventListener('click', () => {
      window._appSelection?.deleteSelected();
    });
  }

  _selectedText() {
    const obj = this.state.getSelectedObjects()[0];
    return obj?.id.startsWith('text') ? obj : null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _pushChange() {
    this.renderer.renderAll();
    this.state.markDirty();
    // Debounce history push
    clearTimeout(this._historyTimer);
    this._historyTimer = setTimeout(() => this.history.push(), 600);
  }

  _setSlider(sliderId, numId, value) {
    document.getElementById(sliderId).value = value;
    document.getElementById(numId).value    = value;
  }

  _bindSlider(sliderId, numId, callback) {
    const slider = document.getElementById(sliderId);
    const numIn  = document.getElementById(numId);
    slider.addEventListener('input', () => {
      if (this._updating) return;
      numIn.value = slider.value;
      callback(slider.value);
    });
    numIn.addEventListener('input', () => {
      if (this._updating) return;
      slider.value = numIn.value;
      callback(numIn.value);
    });
  }

  _bindColorPair(colorId, hexId, callback) {
    const colorEl = document.getElementById(colorId);
    const hexEl   = document.getElementById(hexId);
    colorEl.addEventListener('input', () => {
      if (this._updating) return;
      hexEl.value = colorEl.value;
      callback(colorEl.value);
    });
    hexEl.addEventListener('change', () => {
      if (this._updating) return;
      const val = hexEl.value.startsWith('#') ? hexEl.value : '#' + hexEl.value;
      colorEl.value = val;
      callback(val);
    });
  }
}

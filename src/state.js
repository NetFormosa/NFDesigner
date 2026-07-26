/**
 * state.js — Global Application State (Event Emitter)
 * Transportation Designer by NetFormosa
 */

export class AppState {
  constructor() {
    this._listeners = {};

    // ── Transform (pan / zoom) ─────────────────────────────────────────────
    this.transform = { x: 0, y: 0, scale: 1 };

    // ── Active tool ───────────────────────────────────────────────────────
    this.activeTool = 'select'; // select | station | line | text | pan | map

    // ── Selection ─────────────────────────────────────────────────────────
    this.selection = new Set(); // Set of object ids

    // ── Canvas settings ───────────────────────────────────────────────────
    this.canvas = {
      width:  3840,
      height: 2160,
      backgroundColor: '#FFFFFF',
      gridSize: 20,
      showGrid: true,
      snapToGrid: true,
      snapThreshold: 10,
    };

    // ── Project data ──────────────────────────────────────────────────────
    this.data = {
      version: '1.0',
      project: '未命名專案',
      stations: [],   // Station[]
      lines: [],      // Line[]
      texts: [],      // Text[]
    };

    // ── Layer visibility ──────────────────────────────────────────────────
    this.layers = {
      map:      { visible: true, opacity: 1.0 },
      lines:    { visible: true, opacity: 1.0 },
      stations: { visible: true, opacity: 1.0 },
      icons:    { visible: true, opacity: 1.0 },
      labels:   { visible: true, opacity: 1.0 },
    };

    // ── Clipboard ─────────────────────────────────────────────────────────
    this.clipboard = [];

    // ── Line drawing state ────────────────────────────────────────────────
    this.lineDrawing = {
      active: false,
      lineId: null,
      points: [],
    };

    // ── Style preset ──────────────────────────────────────────────────────
    this.activePreset = 'trtc';

    // ── Unsaved changes flag ──────────────────────────────────────────────
    this.isDirty = false;
  }

  // ── Event bus ─────────────────────────────────────────────────────────────
  on(event, listener) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(listener);
  }

  off(event, listener) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(l => l !== listener);
  }

  emit(event, payload) {
    (this._listeners[event] || []).forEach(l => l(payload));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getObjectById(id) {
    return this.data.stations.find(s => s.id === id)
        || this.data.lines.find(l => l.id === id)
        || this.data.texts.find(t => t.id === id)
        || null;
  }

  getSelectedObjects() {
    return [...this.selection].map(id => this.getObjectById(id)).filter(Boolean);
  }

  setTool(tool) {
    if (this.activeTool === tool) return;
    this.activeTool = tool;
    this.emit('toolChange', tool);
  }

  markDirty() {
    this.isDirty = true;
    const name = this.data.project;
    document.getElementById('project-name-display').textContent =
      name + (this.isDirty ? ' •' : '');
  }

  markClean() {
    this.isDirty = false;
    document.getElementById('project-name-display').textContent = this.data.project;
  }

  // ── Serialise / Deserialise ───────────────────────────────────────────────
  toJSON() {
    return {
      version: this.data.version,
      project: this.data.project,
      settings: { ...this.canvas },
      layers: this.layers,
      stations: this.data.stations,
      lines: this.data.lines,
      texts: this.data.texts,
    };
  }

  loadJSON(obj) {
    this.data.project = obj.project || '未命名專案';
    this.data.version = obj.version || '1.0';
    if (obj.settings) Object.assign(this.canvas, obj.settings);
    if (obj.layers)   Object.assign(this.layers, obj.layers);
    this.data.stations = obj.stations || [];
    this.data.lines    = obj.lines    || [];
    this.data.texts    = obj.texts    || [];
    this.selection.clear();
    this.emit('objectsChange');
    this.emit('selectionChange');
    this.markClean();
  }
}

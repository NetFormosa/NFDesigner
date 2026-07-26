/**
 * shortcuts.js — Keyboard shortcut manager
 * Transportation Designer by NetFormosa
 */

export class ShortcutManager {
  constructor(state, canvas, renderer, history, selection) {
    this.state     = state;
    this.canvas    = canvas;
    this.renderer  = renderer;
    this.history   = history;
    this.selection = selection;
  }

  init() {
    document.addEventListener('keydown', (e) => this._handle(e));
  }

  _handle(e) {
    const tag = document.activeElement?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Tool shortcuts (only when not in input)
    if (!inInput) {
      switch (e.key) {
        case 'v': case 'V': this.state.setTool('select'); return;
        case 's': case 'S': this.state.setTool('station'); return;
        case 'l': case 'L': this.state.setTool('line');   return;
        case 't': case 'T': this.state.setTool('text');   return;
        case 'Delete': case 'Backspace':
          this.selection.deleteSelected();
          return;
        case 'Escape':
          this.state.lineDrawing.active = false;
          this.state.lineDrawing.points = [];
          this.renderer.hideLinePreview();
          this.selection.clearSelection();
          return;
        case '+': case '=': this.canvas.zoomIn();  return;
        case '-':           this.canvas.zoomOut(); return;
      }
    }

    // Ctrl / Cmd combos
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    switch (e.key) {
      case 'z':
        e.preventDefault();
        if (e.shiftKey) this.history.redo();
        else            this.history.undo();
        break;
      case 'Z':
        e.preventDefault();
        this.history.redo();
        break;
      case 's':
        e.preventDefault();
        document.getElementById('btn-save').click();
        break;
      case 'a':
        e.preventDefault();
        if (!inInput) this.selection.selectAll();
        break;
      case 'c':
        if (!inInput) {
          e.preventDefault();
          this._copy();
        }
        break;
      case 'v':
        if (!inInput) {
          e.preventDefault();
          this._paste();
        }
        break;
      case 'g':
        e.preventDefault();
        // Group selected — placeholder
        window.showToast?.('群組功能即將推出', 'info');
        break;
      case '0':
        e.preventDefault();
        this.canvas.fitToView();
        break;
      case '1':
        e.preventDefault();
        this.canvas.setZoom(1);
        break;
    }
  }

  _copy() {
    const objs = this.state.getSelectedObjects();
    if (!objs.length) return;
    this.state.clipboard = objs.map(o => JSON.parse(JSON.stringify(o)));
    window.showToast?.(`已複製 ${objs.length} 個物件`, 'info', 1500);
  }

  _paste() {
    if (!this.state.clipboard.length) return;
    const { generateId } = window._utils || {};
    const offset = 20;

    for (const obj of this.state.clipboard) {
      const newObj = JSON.parse(JSON.stringify(obj));
      newObj.id = `${obj.id.split('-')[0]}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      if ('x' in newObj) { newObj.x += offset; newObj.y += offset; }
      if (newObj.pathNodes) newObj.pathNodes = newObj.pathNodes.map(p => ({ x: p.x + offset, y: p.y + offset }));

      const type = newObj.id.split('-')[0];
      if (type === 'station') this.state.data.stations.push(newObj);
      else if (type === 'line') this.state.data.lines.push(newObj);
      else if (type === 'text') this.state.data.texts.push(newObj);
    }

    this.state.markDirty();
    this.state.emit('objectsChange');
    this.history.push();
    window.showToast?.(`已貼上 ${this.state.clipboard.length} 個物件`, 'info', 1500);
  }
}

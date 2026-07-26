/**
 * history.js — Undo / Redo with snapshot-based history
 * Transportation Designer by NetFormosa
 */

export class HistoryManager {
  constructor(state) {
    this.state    = state;
    this._stack   = [];   // Array of JSON snapshots
    this._pointer = -1;
    this._maxSize = 80;

    this._snapshot();
  }

  _snapshot() {
    const snap = JSON.stringify({
      stations: this.state.data.stations,
      lines:    this.state.data.lines,
      texts:    this.state.data.texts,
    });

    // Truncate forward history on new action
    this._stack = this._stack.slice(0, this._pointer + 1);
    this._stack.push(snap);

    if (this._stack.length > this._maxSize) {
      this._stack.shift();
    } else {
      this._pointer++;
    }
    this._updateButtons();
  }

  push() {
    this._snapshot();
    this.state.markDirty();
  }

  undo() {
    if (this._pointer <= 0) { window.showToast?.('已無可復原的步驟', 'info'); return; }
    this._pointer--;
    this._restore();
    window.showToast?.('復原', 'info', 1500);
  }

  redo() {
    if (this._pointer >= this._stack.length - 1) { window.showToast?.('已無可重做的步驟', 'info'); return; }
    this._pointer++;
    this._restore();
    window.showToast?.('重做', 'info', 1500);
  }

  _restore() {
    const snap = JSON.parse(this._stack[this._pointer]);
    this.state.data.stations = snap.stations;
    this.state.data.lines    = snap.lines;
    this.state.data.texts    = snap.texts;
    this.state.selection.clear();
    this.state.emit('objectsChange');
    this.state.emit('selectionChange');
    this._updateButtons();
  }

  _updateButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = this._pointer <= 0;
    if (redoBtn) redoBtn.disabled = this._pointer >= this._stack.length - 1;
  }
}

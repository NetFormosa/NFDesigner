/**
 * contextMenu.js — Right-click Context Menu
 * Transportation Designer by NetFormosa
 */

export class ContextMenuUI {
  constructor(state, renderer, history, selection) {
    this.state     = state;
    this.renderer  = renderer;
    this.history   = history;
    this.selection = selection;
    this._menu     = document.getElementById('context-menu');
  }

  init() {
    const svgEl = document.getElementById('main-canvas');

    svgEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._show(e.clientX, e.clientY, e);
    });

    document.addEventListener('click', () => this._hide());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this._hide(); });

    // Actions
    document.getElementById('ctx-copy').addEventListener('click', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    });
    document.getElementById('ctx-paste').addEventListener('click', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }));
    });
    document.getElementById('ctx-delete').addEventListener('click', () => {
      this.selection.deleteSelected();
    });
    document.getElementById('ctx-to-front').addEventListener('click', () => {
      window.showToast?.('置頂功能即將推出', 'info');
    });
    document.getElementById('ctx-to-back').addEventListener('click', () => {
      window.showToast?.('置底功能即將推出', 'info');
    });
    document.getElementById('ctx-group').addEventListener('click', () => {
      window.showToast?.('群組功能即將推出', 'info');
    });
    document.getElementById('ctx-lock').addEventListener('click', () => {
      window.showToast?.('鎖定功能即將推出', 'info');
    });
  }

  _show(x, y, e) {
    const hasSelection = this.state.selection.size > 0;
    // Grey out selection-only items
    ['ctx-copy', 'ctx-delete', 'ctx-to-front', 'ctx-to-back', 'ctx-group', 'ctx-lock'].forEach(id => {
      const el = document.getElementById(id);
      el.style.opacity = hasSelection ? '1' : '0.4';
      el.style.pointerEvents = hasSelection ? '' : 'none';
    });

    this._menu.style.display = 'block';
    this._menu.style.left = `${x}px`;
    this._menu.style.top  = `${y}px`;

    // Keep in viewport
    const rect = this._menu.getBoundingClientRect();
    if (rect.right  > window.innerWidth)  this._menu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) this._menu.style.top  = `${y - rect.height}px`;
  }

  _hide() {
    this._menu.style.display = 'none';
  }
}

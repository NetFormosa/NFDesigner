/**
 * main.js — Application Entry Point
 * Transportation Designer by NetFormosa
 */
import { Canvas }         from './editor/canvas.js';
import { Renderer }       from './editor/renderer.js';
import { SelectionManager } from './editor/selection.js';
import { HistoryManager } from './editor/history.js';
import { ShortcutManager } from './editor/shortcuts.js';
import { Toolbar }        from './ui/toolbar.js';
import { PropertyPanel }  from './ui/propertyPanel.js';
import { LayerPanel }     from './ui/layerPanel.js';
import { MenuBar }        from './ui/menuBar.js';
import { ContextMenuUI }  from './ui/contextMenu.js';
import { ManagerPanel }   from './ui/managerPanel.js';
import { AppState }       from './state.js';

// ── Initialise global application state ──────────────────────────────────────
const state = new AppState();

// ── Core editor modules ───────────────────────────────────────────────────────
const history   = new HistoryManager(state);
const canvas    = new Canvas(state, history);
const renderer  = new Renderer(state, canvas);
const selection = new SelectionManager(state, canvas, renderer);

// ── UI modules ────────────────────────────────────────────────────────────────
const toolbar       = new Toolbar(state, canvas);
const propPanel     = new PropertyPanel(state, renderer, history);
const layerPanel    = new LayerPanel(state, renderer);
const menuBar       = new MenuBar(state, canvas, renderer, history);
const ctxMenu       = new ContextMenuUI(state, renderer, history, selection);
const shortcuts     = new ShortcutManager(state, canvas, renderer, history, selection);
const managerPanel  = new ManagerPanel(state, renderer, history);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function init() {
  canvas.init();
  renderer.init();
  toolbar.init();
  propPanel.init();
  layerPanel.init();
  menuBar.init();
  ctxMenu.init();
  shortcuts.init();
  managerPanel.init();

  // Expose globals for cross-module access
  window._appRenderer    = renderer;
  window._appCanvas      = canvas;
  window._appHistory     = history;
  window._appSelection   = selection;
  window._appPreset      = window._appPreset || {};
  window._managerPanel   = managerPanel;

  // Listen for state changes → trigger re-renders / UI updates
  state.on('selectionChange', () => {
    propPanel.update();
    renderer.renderSelection();
  });
  state.on('objectsChange', () => {
    renderer.renderAll();
    updateStatusBar();
  });
  state.on('toolChange', (tool) => {
    toolbar.setActiveTool(tool);
    canvas.setTool(tool);
    document.getElementById('status-tool').textContent = `工具：${toolNameMap[tool] || tool}`;
  });
  state.on('zoomChange', () => {
    document.getElementById('status-zoom').textContent =
      `${Math.round(state.transform.scale * 100)}%`;
  });

  // Initial render
  renderer.renderAll();
  updateStatusBar();

  // Add toast container to DOM
  const toastEl = document.createElement('div');
  toastEl.id = 'toast-container';
  document.body.appendChild(toastEl);

  console.log('[NetFormosa] Transportation Designer initialised.');
}

const toolNameMap = {
  select: '選取', station: '車站', line: '路線',
  text: '文字', pan: '平移', map: '地圖'
};

function updateStatusBar() {
  const allObjects = [
    ...state.data.stations,
    ...state.data.lines,
    ...state.data.texts
  ];
  document.getElementById('status-objects').textContent  = `物件：${allObjects.length}`;
  document.getElementById('status-selected').textContent = `已選：${state.selection.size}`;
}

// Mouse coordinates in canvas space
document.getElementById('main-canvas').addEventListener('mousemove', (e) => {
  const pt = canvas.screenToCanvas(e.clientX, e.clientY);
  document.getElementById('status-coords').textContent =
    `X: ${Math.round(pt.x)} \u2002 Y: ${Math.round(pt.y)}`;
});

// Expose toast helper globally
window.showToast = function(message, type = 'info', duration = 2800) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, duration);
};

init();

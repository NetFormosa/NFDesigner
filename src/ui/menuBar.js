/**
 * menuBar.js — Top Menu Bar & Dropdown Controller
 * Handles File / Edit / View / Export menus, modals, OSM loading, export.
 * Transportation Designer by NetFormosa
 */

import { STYLE_PRESETS } from '../utils.js';

export class MenuBar {
  constructor(state, canvas, renderer, history) {
    this.state    = state;
    this.canvas   = canvas;
    this.renderer = renderer;
    this.history  = history;
  }

  init() {
    this._initDropdowns();
    this._initFileActions();
    this._initEditActions();
    this._initViewActions();
    this._initThemeActions();
    this._initLayerActions();
    this._initHelpActions();
    this._initExportModal();
    this._initSaveButton();
    this._initManageActions();

    // Expose STYLE_PRESETS globally for layerPanel
    window._stylePresets = { STYLE_PRESETS };
    window._appPreset = STYLE_PRESETS['trtc'];
  }

  // ── Dropdowns ─────────────────────────────────────────────────────────────
  _initDropdowns() {
    const menus = {
      'menu-file':   'dropdown-file',
      'menu-edit':   'dropdown-edit',
      'menu-view':   'dropdown-view',
      'menu-layer':  'dropdown-layer',
      'menu-export': 'dropdown-export',
      'menu-manage': 'dropdown-manage',
      'menu-help':   'dropdown-help',
    };

    const overlay = document.getElementById('dropdown-overlay');
    let activeMenu = null;

    const closeAll = () => {
      document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.remove('open'));
      document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
      overlay.classList.remove('active');
      activeMenu = null;
    };

    Object.entries(menus).forEach(([btnId, ddId]) => {
      const btn = document.getElementById(btnId);
      const dd  = document.getElementById(ddId);
      if (!btn || !dd) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeMenu === ddId) { closeAll(); return; }
        closeAll();
        const rect = btn.getBoundingClientRect();
        dd.style.top  = `${rect.bottom + 2}px`;
        dd.style.left = `${rect.left}px`;
        dd.classList.add('open');
        btn.classList.add('active');
        overlay.classList.add('active');
        activeMenu = ddId;
      });
    });

    overlay.addEventListener('click', closeAll);
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', closeAll);
    });
  }

  // ── File Actions ──────────────────────────────────────────────────────────
  _initFileActions() {
    document.getElementById('dd-new').addEventListener('click', () => {
      if (this.state.isDirty && !confirm('有未儲存的變更，確定要建立新專案嗎？')) return;
      this.state.loadJSON({ project: '未命名專案', stations: [], lines: [], texts: [] });
      this.canvas.fitToView();
      window.showToast?.('已建立新專案', 'success');
    });

    document.getElementById('dd-open').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = '.metro,.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const obj = JSON.parse(ev.target.result);
            this.state.loadJSON(obj);
            document.getElementById('project-name-display').textContent = this.state.data.project;
            this.history.push();
            window.showToast?.(`已開啟「${obj.project}」`, 'success');
          } catch(err) {
            window.showToast?.('檔案格式錯誤', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    document.getElementById('dd-save-as').addEventListener('click', () => {
      this._saveProject();
    });
  }

  // ── Edit Actions ──────────────────────────────────────────────────────────
  _initEditActions() {
    document.getElementById('dd-undo').addEventListener('click', () => this.history.undo());
    document.getElementById('dd-redo').addEventListener('click', () => this.history.redo());
    document.getElementById('btn-undo').addEventListener('click', () => this.history.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.history.redo());

    document.getElementById('dd-delete').addEventListener('click', () => {
      window._appSelection?.deleteSelected();
    });

    document.getElementById('dd-select-all').addEventListener('click', () => {
      window._appSelection?.selectAll();
    });

    document.getElementById('dd-copy').addEventListener('click', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    });
    document.getElementById('dd-paste').addEventListener('click', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }));
    });

    const snapGridCheck = document.getElementById('snap-grid-check');
    document.getElementById('dd-toggle-snap-grid').addEventListener('click', () => {
      this.state.canvas.snapToGrid = !this.state.canvas.snapToGrid;
      snapGridCheck.classList.toggle('hidden', !this.state.canvas.snapToGrid);
      window.showToast?.(this.state.canvas.snapToGrid ? '已開啟對齊格線' : '已關閉對齊格線', 'info', 1500);
    });
  }

  // ── View Actions ──────────────────────────────────────────────────────────
  _initViewActions() {
    document.getElementById('dd-zoom-in').addEventListener('click', () => this.canvas.zoomIn());
    document.getElementById('dd-zoom-out').addEventListener('click', () => this.canvas.zoomOut());
    document.getElementById('dd-zoom-fit').addEventListener('click', () => this.canvas.fitToView());
    document.getElementById('dd-zoom-100').addEventListener('click', () => this.canvas.setZoom(1));

    const gridCheck = document.getElementById('grid-check');
    document.getElementById('dd-toggle-grid').addEventListener('click', () => {
      this.state.canvas.showGrid = !this.state.canvas.showGrid;
      document.getElementById('layer-grid').style.display = this.state.canvas.showGrid ? '' : 'none';
      gridCheck.classList.toggle('hidden', !this.state.canvas.showGrid);
    });

  }

  // ── Theme Actions ─────────────────────────────────────────────────────────
  _initThemeActions() {
    const themeIds = ['dark', 'light', 'dracula', 'nord', 'solarized-dark', 'monokai'];
    
    const applyTheme = (themeId) => {
      document.documentElement.setAttribute('data-theme', themeId);
      localStorage.setItem('nfd-theme', themeId);
      
      // Update checkmarks
      themeIds.forEach(id => {
        const check = document.getElementById(`theme-${id}-check`);
        if (check) {
          check.classList.toggle('hidden', id !== themeId);
        }
      });
    };

    // Load saved theme
    const savedTheme = localStorage.getItem('nfd-theme') || 'dark';
    applyTheme(savedTheme);

    themeIds.forEach(id => {
      const btn = document.getElementById(`dd-theme-${id}`);
      if (btn) {
        btn.addEventListener('click', () => {
          applyTheme(id);
        });
      }
    });
  }

  // ── Layer Actions ─────────────────────────────────────────────────────────
  _initLayerActions() {
    document.getElementById('dd-layer-panel').addEventListener('click', () => {
      const panel = document.getElementById('property-panel');
      if (panel) {
        panel.style.display = 'flex'; // Ensure panel is visible
        window.showToast?.('已顯示圖層面板', 'info', 1500);
      }
    });
  }

  // ── Help Actions ──────────────────────────────────────────────────────────
  _initHelpActions() {
    document.getElementById('dd-about').addEventListener('click', () => {
      this._openModal('modal-about');
    });
  }

  // ── Export Modal ──────────────────────────────────────────────────────────
  _initExportModal() {
    document.getElementById('btn-export-quick').addEventListener('click', () => {
      this._openModal('modal-export');
    });
    document.getElementById('dd-export-svg').addEventListener('click', () => {
      this._exportSVG();
    });
    document.getElementById('dd-export-png').addEventListener('click', () => {
      this._openModal('modal-export');
      document.getElementById('export-format').value = 'png';
    });
    document.getElementById('dd-export-webp').addEventListener('click', () => {
      this._openModal('modal-export');
      document.getElementById('export-format').value = 'webp';
    });
    document.getElementById('dd-export-pdf').addEventListener('click', () => {
      this._openModal('modal-export');
      document.getElementById('export-format').value = 'pdf';
    });
    document.getElementById('dd-export-json').addEventListener('click', () => {
      this._saveProject();
    });

    document.getElementById('modal-export-close').addEventListener('click',  () => this._closeModal('modal-export'));
    document.getElementById('modal-export-cancel').addEventListener('click', () => this._closeModal('modal-export'));

    const qualSlider = document.getElementById('export-quality');
    const qualVal    = document.getElementById('export-quality-val');
    qualSlider.addEventListener('input', () => { qualVal.textContent = qualSlider.value; });

    const fmtSel = document.getElementById('export-format');
    const resSel = document.getElementById('export-resolution-group');
    const qGroup = document.getElementById('export-quality-group');
    fmtSel.addEventListener('change', () => {
      const fmt = fmtSel.value;
      resSel.style.display = (fmt === 'svg' || fmt === 'json') ? 'none' : '';
      qGroup.style.display = (fmt === 'webp' || fmt === 'png') ? '' : 'none';
    });

    document.getElementById('modal-export-confirm').addEventListener('click', () => {
      const fmt = document.getElementById('export-format').value;
      this._closeModal('modal-export');
      switch (fmt) {
        case 'svg':  this._exportSVG(); break;
        case 'png':  this._exportRaster('png'); break;
        case 'webp': this._exportRaster('webp'); break;
        case 'pdf':  this._exportPDF(); break;
        case 'json': this._saveProject(); break;
      }
    });
  }


  // ── Save ──────────────────────────────────────────────────────────────────
  _initSaveButton() {
    document.getElementById('btn-save').addEventListener('click', () => this._saveProject());
  }

  _saveProject() {
    const json = JSON.stringify(this.state.toJSON(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${this.state.data.project || 'metro-project'}.metro`;
    a.click();
    URL.revokeObjectURL(url);
    this.state.markClean();
    window.showToast?.('專案已儲存', 'success');
  }

  // ── Export ────────────────────────────────────────────────────────────────
  _getExportBBox(area) {
    const defaultBBox = { x: 0, y: 0, width: this.state.canvas.width, height: this.state.canvas.height };
    if (area === 'canvas') return defaultBBox;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasPoints = false;

    const addPoint = (x, y, r = 0) => {
      if (x - r < minX) minX = x - r;
      if (y - r < minY) minY = y - r;
      if (x + r > maxX) maxX = x + r;
      if (y + r > maxY) maxY = y + r;
      hasPoints = true;
    };

    const processStation = (st) => addPoint(st.x, st.y, (st.style?.size || 10) + 40);
    const processLine = (ln) => ln.pathNodes && ln.pathNodes.forEach(pt => addPoint(pt.x, pt.y, (ln.width || 10) + 10));
    const processText = (tx) => addPoint(tx.x, tx.y, (tx.size || 14) * 3);

    if (area === 'selection') {
      const selected = this.state.getSelectedObjects();
      selected.forEach(obj => {
        if (obj.id.startsWith('station')) processStation(obj);
        if (obj.id.startsWith('line')) processLine(obj);
        if (obj.id.startsWith('text')) processText(obj);
      });
    } else if (area === 'content') {
      this.state.data.stations.forEach(processStation);
      this.state.data.lines.forEach(processLine);
      this.state.data.texts.forEach(processText);
    }

    if (!hasPoints) return defaultBBox;

    const padding = 60;
    return {
      x: minX - padding,
      y: minY - padding,
      width: (maxX - minX) + padding * 2,
      height: (maxY - minY) + padding * 2
    };
  }

  _exportSVG() {
    const area = document.getElementById('export-area')?.value || 'canvas';
    const svgEl = document.getElementById('main-canvas');
    const clone = svgEl.cloneNode(true);
    // Remove grid and selection layers
    clone.querySelector('#layer-grid')?.remove();
    clone.querySelector('#layer-selection')?.remove();
    clone.querySelector('#cursor-indicator')?.remove();
    clone.querySelector('#rubber-band')?.remove();

    const bbox = this._getExportBBox(area);
    clone.setAttribute('width', bbox.width);
    clone.setAttribute('height', bbox.height);
    clone.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);
    
    const ct = clone.querySelector('#canvas-transform');
    if (ct) {
      ct.setAttribute('transform', `translate(${-bbox.x}, ${-bbox.y})`);
    }

    const xml  = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${this.state.data.project || 'metro'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast?.('SVG 匯出完成', 'success');
  }

  async _exportRaster(format) {
    const scale    = +document.getElementById('export-resolution').value || 2;
    const quality  = (+document.getElementById('export-quality').value || 92) / 100;
    const transp   = document.getElementById('export-transparent').checked;
    const area     = document.getElementById('export-area')?.value || 'canvas';

    const svgEl = document.getElementById('main-canvas');
    const clone = svgEl.cloneNode(true);
    clone.querySelector('#layer-grid')?.remove();
    clone.querySelector('#layer-selection')?.remove();
    clone.querySelector('#cursor-indicator')?.remove();

    const bbox = this._getExportBBox(area);
    clone.setAttribute('width', bbox.width);
    clone.setAttribute('height', bbox.height);
    clone.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);

    // Adjust canvas-transform
    const ct = clone.querySelector('#canvas-transform');
    if (ct) {
      ct.setAttribute('transform', `translate(${-bbox.x}, ${-bbox.y})`);
    }

    const xml   = new XMLSerializer().serializeToString(clone);
    const blob  = new Blob([xml], { type: 'image/svg+xml' });
    const url   = URL.createObjectURL(blob);

    const img   = new Image();
    img.onload  = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = bbox.width * scale;
      canvas.height = bbox.height * scale;
      const ctx = canvas.getContext('2d');
      if (!transp) {
        const themeBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim();
        ctx.fillStyle = themeBg || this.state.canvas.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
      canvas.toBlob((b) => {
        const link = document.createElement('a');
        link.href  = URL.createObjectURL(b);
        link.download = `${this.state.data.project || 'metro'}.${format}`;
        link.click();
        window.showToast?.(`${format.toUpperCase()} 匯出完成`, 'success');
      }, mimeType, quality);
    };
    img.src = url;
  }

  _exportPDF() {
    window.showToast?.('PDF 匯出需要 jsPDF 函式庫，請使用 SVG 或 PNG 替代。', 'info', 4000);
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  _openModal(id) {
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById(id).style.display = 'block';
  }

  _closeModal(id) {
    document.getElementById(id).style.display = 'none';
    // Hide overlay if no modal open
    const anyOpen = document.querySelectorAll('.modal[style*="block"]').length > 0;
    if (!anyOpen) document.getElementById('modal-overlay').style.display = 'none';
  }

  // ── Manage Actions ────────────────────────────────────────────────────────
  _initManageActions() {
    const openManager = (tab) => {
      const panel = window._managerPanel;
      if (!panel) return;
      // 先切換分頁再開啟
      if (tab) panel._activeTab = tab;
      panel.open();
    };

    // 「管理」選單項目
    const ddStations = document.getElementById('dd-manage-stations');
    const ddLines    = document.getElementById('dd-manage-lines');
    const ddAll      = document.getElementById('dd-manage-all');
    if (ddStations) ddStations.addEventListener('click', () => openManager('stations'));
    if (ddLines)    ddLines.addEventListener('click',    () => openManager('lines'));
    if (ddAll)      ddAll.addEventListener('click',      () => openManager(null));

    // 頂部快捷按鈕
    const btnManager = document.getElementById('btn-open-manager');
    if (btnManager) btnManager.addEventListener('click', () => openManager(null));

    // Keyboard shortcut: Ctrl+M
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        openManager(null);
      }
    });
  }
}

/**
 * managerPanel.js — 站點 & 路線 管理視窗
 * Transportation Designer by NetFormosa
 */

export class ManagerPanel {
  constructor(state, renderer, history) {
    this.state    = state;
    this.renderer = renderer;
    this.history  = history;

    this._activeTab     = 'stations'; // 'stations' | 'lines'
    this._stationSearch = '';
    this._lineSearch    = '';

    // 編輯中的物件暫存
    this._editStation = null;
    this._editLine    = null;
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  init() {
    // 注入 HTML
    this._injectHTML();
    // 綁定事件
    this._bindEvents();
  }

  // ── 開啟 / 關閉 ───────────────────────────────────────────────────────────
  open() {
    this._refresh();
    const overlay = document.getElementById('modal-manager-overlay');
    const modal   = document.getElementById('modal-manager');
    overlay.style.display = 'flex';
    modal.style.display   = 'flex';
    // 動畫
    requestAnimationFrame(() => {
      modal.classList.add('manager-open');
    });
    // 讓搜尋框得到焦點
    const searchInput = document.getElementById('mgr-search');
    if (searchInput) searchInput.focus();
  }

  close() {
    const overlay = document.getElementById('modal-manager-overlay');
    const modal   = document.getElementById('modal-manager');
    modal.classList.remove('manager-open');
    // 等動畫結束再隱藏
    setTimeout(() => {
      overlay.style.display = 'none';
      modal.style.display   = 'none';
    }, 220);
    // 結束編輯
    this._cancelEdit();
  }

  // ── 注入 HTML ─────────────────────────────────────────────────────────────
  _injectHTML() {
    const overlay = document.createElement('div');
    overlay.id        = 'modal-manager-overlay';
    overlay.className = 'mgr-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div id="modal-manager" class="mgr-modal" role="dialog" aria-modal="true" aria-labelledby="mgr-modal-title" style="display:none;">

        <!-- ── 標題列 ── -->
        <div class="mgr-header">
          <div class="mgr-header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="mgr-header-icon">
              <path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h2 id="mgr-modal-title" class="mgr-title">站點 &amp; 路線管理</h2>
          </div>
          <button class="mgr-close-btn" id="mgr-close" aria-label="關閉管理視窗">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- ── 主體 ── -->
        <div class="mgr-body">

          <!-- ── 左側清單區 ── -->
          <div class="mgr-list-col">

            <!-- 分頁切換 -->
            <div class="mgr-tabs" role="tablist">
              <button class="mgr-tab active" id="mgr-tab-stations" role="tab" data-tab="stations">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
                <span>車站</span>
                <span class="mgr-tab-badge" id="mgr-badge-stations">0</span>
              </button>
              <button class="mgr-tab" id="mgr-tab-lines" role="tab" data-tab="lines">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="4" cy="12" r="2.5" fill="currentColor"/>
                  <line x1="6.5" y1="12" x2="17.5" y2="12"/>
                  <circle cx="20" cy="12" r="2.5" fill="currentColor"/>
                </svg>
                <span>路線</span>
                <span class="mgr-tab-badge" id="mgr-badge-lines">0</span>
              </button>
            </div>

            <!-- 搜尋列 + 新增按鈕 -->
            <div class="mgr-toolbar">
              <div class="mgr-search-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mgr-search-icon">
                  <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" id="mgr-search" class="mgr-search-input" placeholder="搜尋…" autocomplete="off" />
                <button class="mgr-search-clear" id="mgr-search-clear" title="清除搜尋" style="display:none;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <button class="mgr-add-btn" id="mgr-add-btn" title="新增">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span id="mgr-add-label">新增車站</span>
              </button>
            </div>

            <!-- 統計欄 -->
            <div class="mgr-stats" id="mgr-stats">正在載入…</div>

            <!-- 清單 -->
            <div class="mgr-list" id="mgr-list" role="list">
              <!-- 動態注入 -->
            </div>

          </div>

          <!-- ── 右側編輯區 ── -->
          <div class="mgr-edit-col" id="mgr-edit-col">

            <!-- 空白提示 -->
            <div class="mgr-edit-empty" id="mgr-edit-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              <p>選取項目以編輯</p>
            </div>

            <!-- 車站編輯表單 -->
            <div class="mgr-edit-form" id="mgr-station-form" style="display:none;">
              <div class="mgr-form-header">
                <div class="mgr-form-badge" id="mgr-st-badge"></div>
                <h3 class="mgr-form-title" id="mgr-st-form-title">車站屬性</h3>
              </div>
              <div class="mgr-form-scroll">
                <div class="mgr-field-group">
                  <label class="mgr-field-label">車站名稱（中文）</label>
                  <input type="text" id="mgr-st-name" class="mgr-field-input" placeholder="台北車站" />
                </div>
                <div class="mgr-field-group">
                  <label class="mgr-field-label">車站名稱（英文）</label>
                  <input type="text" id="mgr-st-en" class="mgr-field-input" placeholder="Taipei Main Station" />
                </div>
                <div class="mgr-field-group">
                  <label class="mgr-field-label">站碼</label>
                  <input type="text" id="mgr-st-code" class="mgr-field-input" placeholder="BL12" />
                </div>
                <div class="mgr-field-row">
                  <div class="mgr-field-group" style="flex:1;">
                    <label class="mgr-field-label">樣式</label>
                    <select id="mgr-st-shape" class="mgr-field-select">
                      <option value="circle">圓形</option>
                      <option value="rect">方形</option>
                      <option value="diamond">菱形</option>
                      <option value="transfer">轉乘站</option>
                    </select>
                  </div>
                  <div class="mgr-field-group" style="flex:1;">
                    <label class="mgr-field-label">大小</label>
                    <input type="number" id="mgr-st-size" class="mgr-field-input" value="10" min="4" max="30" />
                  </div>
                </div>
                <div class="mgr-field-row">
                  <div class="mgr-field-group" style="flex:1;">
                    <label class="mgr-field-label">填色</label>
                    <div class="mgr-color-row">
                      <input type="color" id="mgr-st-fill-picker" class="mgr-color-picker" value="#FFFFFF" />
                      <input type="text" id="mgr-st-fill" class="mgr-field-input mgr-hex-input" value="#FFFFFF" placeholder="#FFFFFF" />
                    </div>
                  </div>
                  <div class="mgr-field-group" style="flex:1;">
                    <label class="mgr-field-label">框線顏色</label>
                    <div class="mgr-color-row">
                      <input type="color" id="mgr-st-stroke-picker" class="mgr-color-picker" value="#0070BD" />
                      <input type="text" id="mgr-st-stroke" class="mgr-field-input mgr-hex-input" value="#0070BD" placeholder="#0070BD" />
                    </div>
                  </div>
                </div>
                <div class="mgr-field-group">
                  <label class="mgr-field-label">框線寬度</label>
                  <div class="mgr-slider-row">
                    <input type="range" id="mgr-st-sw-slider" class="mgr-slider" min="1" max="10" value="3" />
                    <input type="number" id="mgr-st-sw" class="mgr-field-input mgr-num-input" value="3" min="1" max="10" />
                  </div>
                </div>
                <div class="mgr-sep"></div>
                <div class="mgr-field-row">
                  <div class="mgr-field-group" style="flex:1;">
                    <label class="mgr-field-label">位置 X</label>
                    <input type="number" id="mgr-st-x" class="mgr-field-input" />
                  </div>
                  <div class="mgr-field-group" style="flex:1;">
                    <label class="mgr-field-label">位置 Y</label>
                    <input type="number" id="mgr-st-y" class="mgr-field-input" />
                  </div>
                </div>
              </div>
              <div class="mgr-form-footer">
                <button class="mgr-btn-danger" id="mgr-st-delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  刪除車站
                </button>
                <div class="mgr-form-footer-right">
                  <button class="mgr-btn-secondary" id="mgr-st-cancel">取消</button>
                  <button class="mgr-btn-primary" id="mgr-st-save">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    套用變更
                  </button>
                </div>
              </div>
            </div>

            <!-- 路線編輯表單 -->
            <div class="mgr-edit-form" id="mgr-line-form" style="display:none;">
              <div class="mgr-form-header">
                <div class="mgr-form-badge mgr-line-badge" id="mgr-ln-badge"></div>
                <h3 class="mgr-form-title" id="mgr-ln-form-title">路線屬性</h3>
              </div>
              <div class="mgr-form-scroll">
                <div class="mgr-field-group">
                  <label class="mgr-field-label">路線名稱</label>
                  <input type="text" id="mgr-ln-name" class="mgr-field-input" placeholder="板南線" />
                </div>
                <div class="mgr-field-group">
                  <label class="mgr-field-label">路線代碼</label>
                  <input type="text" id="mgr-ln-code" class="mgr-field-input" placeholder="BL" />
                </div>
                <div class="mgr-field-group">
                  <label class="mgr-field-label">路線顏色</label>
                  <div class="mgr-color-row">
                    <input type="color" id="mgr-ln-color-picker" class="mgr-color-picker" value="#0070BD" />
                    <input type="text" id="mgr-ln-color" class="mgr-field-input mgr-hex-input" value="#0070BD" placeholder="#0070BD" />
                  </div>
                </div>
                <div class="mgr-field-group">
                  <label class="mgr-field-label">線條寬度</label>
                  <div class="mgr-slider-row">
                    <input type="range" id="mgr-ln-width-slider" class="mgr-slider" min="2" max="20" value="8" />
                    <input type="number" id="mgr-ln-width" class="mgr-field-input mgr-num-input" value="8" min="2" max="20" />
                  </div>
                </div>
                <div class="mgr-field-row">
                  <div class="mgr-field-group" style="flex:1;">
                    <label class="mgr-field-label">路由模式</label>
                    <select id="mgr-ln-routing" class="mgr-field-select">
                      <option value="straight">直線</option>
                      <option value="45deg">45° 折線</option>
                      <option value="90deg">90° 折線</option>
                      <option value="bezier">轉折曲線</option>
                    </select>
                  </div>
                  <div class="mgr-field-group" style="flex:1;">
                    <label class="mgr-field-label">線條樣式</label>
                    <select id="mgr-ln-style" class="mgr-field-select">
                      <option value="solid">實線</option>
                      <option value="dashed">虛線</option>
                      <option value="dotted">點線</option>
                      <option value="dash-dot">虛點線</option>
                      <option value="double">雙線</option>
                    </select>
                  </div>
                </div>
                <div class="mgr-field-group">
                  <label class="mgr-field-label">不透明度</label>
                  <div class="mgr-slider-row">
                    <input type="range" id="mgr-ln-opacity-slider" class="mgr-slider" min="0" max="100" value="100" />
                    <input type="number" id="mgr-ln-opacity" class="mgr-field-input mgr-num-input" value="100" min="0" max="100" />
                  </div>
                </div>
                <div class="mgr-sep"></div>
                <!-- 路線包含車站清單 -->
                <div class="mgr-field-group">
                  <label class="mgr-field-label">路線節點數</label>
                  <div class="mgr-info-chip" id="mgr-ln-points-info">— 個節點</div>
                </div>
              </div>
              <div class="mgr-form-footer">
                <button class="mgr-btn-danger" id="mgr-ln-delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  刪除路線
                </button>
                <div class="mgr-form-footer-right">
                  <button class="mgr-btn-secondary" id="mgr-ln-cancel">取消</button>
                  <button class="mgr-btn-primary" id="mgr-ln-save">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    套用變更
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  // ── 事件綁定 ─────────────────────────────────────────────────────────────
  _bindEvents() {
    // 關閉按鈕
    document.getElementById('mgr-close').addEventListener('click', () => this.close());

    // 點擊遮罩關閉
    document.getElementById('modal-manager-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-manager-overlay') this.close();
    });

    // 分頁切換
    document.querySelectorAll('.mgr-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.tab;
        this._stationSearch = '';
        this._lineSearch    = '';
        document.getElementById('mgr-search').value = '';
        document.getElementById('mgr-search-clear').style.display = 'none';
        this._cancelEdit();
        this._refresh();
      });
    });

    // 搜尋
    document.getElementById('mgr-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (this._activeTab === 'stations') this._stationSearch = q;
      else this._lineSearch = q;
      document.getElementById('mgr-search-clear').style.display = q ? 'flex' : 'none';
      this._renderList();
    });

    // 清除搜尋
    document.getElementById('mgr-search-clear').addEventListener('click', () => {
      document.getElementById('mgr-search').value = '';
      document.getElementById('mgr-search-clear').style.display = 'none';
      if (this._activeTab === 'stations') this._stationSearch = '';
      else this._lineSearch = '';
      this._renderList();
    });

    // 新增按鈕 (僅適用於車站)
    document.getElementById('mgr-add-btn').addEventListener('click', () => {
      if (this._activeTab === 'stations') this._createNewStation();
    });

    // ── 車站表單事件 ──
    // 顏色同步（picker → text）
    document.getElementById('mgr-st-fill-picker').addEventListener('input', (e) => {
      document.getElementById('mgr-st-fill').value = e.target.value.toUpperCase();
    });
    document.getElementById('mgr-st-stroke-picker').addEventListener('input', (e) => {
      document.getElementById('mgr-st-stroke').value = e.target.value.toUpperCase();
    });
    // 顏色同步（text → picker）
    document.getElementById('mgr-st-fill').addEventListener('input', (e) => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
        document.getElementById('mgr-st-fill-picker').value = e.target.value;
    });
    document.getElementById('mgr-st-stroke').addEventListener('input', (e) => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
        document.getElementById('mgr-st-stroke-picker').value = e.target.value;
    });
    // 滑桿同步
    document.getElementById('mgr-st-sw-slider').addEventListener('input', (e) => {
      document.getElementById('mgr-st-sw').value = e.target.value;
    });
    document.getElementById('mgr-st-sw').addEventListener('input', (e) => {
      document.getElementById('mgr-st-sw-slider').value = e.target.value;
    });
    // 儲存 / 取消 / 刪除
    document.getElementById('mgr-st-save').addEventListener('click',   () => this._saveStation());
    document.getElementById('mgr-st-cancel').addEventListener('click', () => this._cancelEdit());
    document.getElementById('mgr-st-delete').addEventListener('click', () => this._deleteStation());

    // ── 路線表單事件 ──
    document.getElementById('mgr-ln-color-picker').addEventListener('input', (e) => {
      document.getElementById('mgr-ln-color').value = e.target.value.toUpperCase();
      document.getElementById('mgr-ln-badge').style.background = e.target.value;
    });
    document.getElementById('mgr-ln-color').addEventListener('input', (e) => {
      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
        document.getElementById('mgr-ln-color-picker').value = e.target.value;
        document.getElementById('mgr-ln-badge').style.background = e.target.value;
      }
    });
    document.getElementById('mgr-ln-width-slider').addEventListener('input', (e) => {
      document.getElementById('mgr-ln-width').value = e.target.value;
    });
    document.getElementById('mgr-ln-width').addEventListener('input', (e) => {
      document.getElementById('mgr-ln-width-slider').value = e.target.value;
    });
    document.getElementById('mgr-ln-opacity-slider').addEventListener('input', (e) => {
      document.getElementById('mgr-ln-opacity').value = e.target.value;
    });
    document.getElementById('mgr-ln-opacity').addEventListener('input', (e) => {
      document.getElementById('mgr-ln-opacity-slider').value = e.target.value;
    });
    document.getElementById('mgr-ln-save').addEventListener('click',   () => this._saveLine());
    document.getElementById('mgr-ln-cancel').addEventListener('click', () => this._cancelEdit());
    document.getElementById('mgr-ln-delete').addEventListener('click', () => this._deleteLine());

    // ESC 關閉
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const overlay = document.getElementById('modal-manager-overlay');
        if (overlay.style.display !== 'none') this.close();
      }
    });
  }

  // ── 整體重新整理 ──────────────────────────────────────────────────────────
  _refresh() {
    this._renderTabs();
    this._renderList();
  }

  // ── 分頁 UI ───────────────────────────────────────────────────────────────
  _renderTabs() {
    document.querySelectorAll('.mgr-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === this._activeTab);
    });
    document.getElementById('mgr-badge-stations').textContent =
      this.state.data.stations.length;
    document.getElementById('mgr-badge-lines').textContent =
      this.state.data.lines.length;
    const addBtn = document.getElementById('mgr-add-btn');
    if (this._activeTab === 'stations') {
      addBtn.style.display = 'flex';
      document.getElementById('mgr-add-label').textContent = '新增車站';
    } else {
      addBtn.style.display = 'none';
    }

    // 同步搜尋框
    document.getElementById('mgr-search').placeholder =
      this._activeTab === 'stations' ? '搜尋車站名稱、站碼…' : '搜尋路線名稱、代碼…';
    const q = this._activeTab === 'stations' ? this._stationSearch : this._lineSearch;
    document.getElementById('mgr-search').value = q;
    document.getElementById('mgr-search-clear').style.display = q ? 'flex' : 'none';
  }

  // ── 清單渲染 ─────────────────────────────────────────────────────────────
  _renderList() {
    const list = document.getElementById('mgr-list');
    list.innerHTML = '';

    if (this._activeTab === 'stations') {
      this._renderStationList(list);
    } else {
      this._renderLineList(list);
    }
  }

  _renderStationList(container) {
    const q = this._stationSearch;
    const all = this.state.data.stations;
    const filtered = q
      ? all.filter(s =>
          (s.name  || '').toLowerCase().includes(q) ||
          (s.nameEn|| '').toLowerCase().includes(q) ||
          (s.code  || '').toLowerCase().includes(q))
      : all;

    this._updateStats(filtered.length, all.length, '車站');

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="mgr-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="currentColor"/>
          </svg>
          <p>${q ? '沒有符合的車站' : '尚未建立任何車站'}</p>
          ${!q ? '<span>使用左側工具列車站工具，或按下方「新增」來建立</span>' : ''}
        </div>`;
      return;
    }

    filtered.forEach(station => {
      const item = document.createElement('div');
      item.className = 'mgr-list-item';
      item.dataset.id = station.id;
      const isSelected = this._editStation && this._editStation.id === station.id;
      if (isSelected) item.classList.add('selected');

      const fillColor  = station.fill   || '#FFFFFF';
      const strokeColor= station.stroke || '#0070BD';

      item.innerHTML = `
        <div class="mgr-item-icon" style="background:${fillColor};border:2.5px solid ${strokeColor};border-radius:${station.shape === 'rect' ? '3px' : station.shape === 'diamond' ? '3px' : '50%'};">
        </div>
        <div class="mgr-item-info">
          <div class="mgr-item-name">${this._hl(station.name || '未命名車站', q)}</div>
          <div class="mgr-item-sub">
            ${station.code ? `<span class="mgr-code-chip">${this._hl(station.code, q)}</span>` : ''}
            ${station.nameEn ? `<span class="mgr-item-en">${this._hl(station.nameEn, q)}</span>` : ''}
          </div>
        </div>
        <div class="mgr-item-actions">
          <button class="mgr-item-btn mgr-item-select-btn" data-id="${station.id}" title="在畫布上選取">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button class="mgr-item-btn mgr-item-edit-btn" data-id="${station.id}" title="編輯">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      `;

      // 點擊整列 → 編輯
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.mgr-item-btn')) {
          this._openStationEdit(station);
        }
      });
      // 在畫布上選取
      item.querySelector('.mgr-item-select-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._selectOnCanvas(station.id);
      });
      // 編輯按鈕
      item.querySelector('.mgr-item-edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._openStationEdit(station);
      });

      container.appendChild(item);
    });
  }

  _renderLineList(container) {
    const q = this._lineSearch;
    const all = this.state.data.lines;
    const filtered = q
      ? all.filter(l =>
          (l.name || '').toLowerCase().includes(q) ||
          (l.code || '').toLowerCase().includes(q))
      : all;

    this._updateStats(filtered.length, all.length, '路線');

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="mgr-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <circle cx="4" cy="12" r="3"/><line x1="7" y1="12" x2="17" y2="12"/><circle cx="20" cy="12" r="3"/>
          </svg>
          <p>${q ? '沒有符合的路線' : '尚未建立任何路線'}</p>
          ${!q ? '<span>請切換至畫布並使用左側工具列的「路線工具 (L)」進行繪製</span>' : ''}
        </div>`;
      return;
    }

    filtered.forEach(line => {
      const item = document.createElement('div');
      item.className = 'mgr-list-item';
      item.dataset.id = line.id;
      const isSelected = this._editLine && this._editLine.id === line.id;
      if (isSelected) item.classList.add('selected');

      const color = line.color || '#4A9EFF';
      const pts   = line.points ? line.points.length : 0;

      item.innerHTML = `
        <div class="mgr-item-line-swatch" style="background:${color};"></div>
        <div class="mgr-item-info">
          <div class="mgr-item-name">${this._hl(line.name || '未命名路線', q)}</div>
          <div class="mgr-item-sub">
            ${line.code ? `<span class="mgr-code-chip" style="background:${color}22;color:${color};border-color:${color}44;">${this._hl(line.code, q)}</span>` : ''}
            <span class="mgr-item-en">${pts} 個節點</span>
          </div>
        </div>
        <div class="mgr-item-actions">
          <button class="mgr-item-btn mgr-item-select-btn" data-id="${line.id}" title="在畫布上選取">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button class="mgr-item-btn mgr-item-edit-btn" data-id="${line.id}" title="編輯">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.mgr-item-btn')) this._openLineEdit(line);
      });
      item.querySelector('.mgr-item-select-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._selectOnCanvas(line.id);
      });
      item.querySelector('.mgr-item-edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._openLineEdit(line);
      });

      container.appendChild(item);
    });
  }

  // ── 統計欄 ────────────────────────────────────────────────────────────────
  _updateStats(shown, total, label) {
    const el = document.getElementById('mgr-stats');
    if (shown === total) {
      el.textContent = `共 ${total} 個${label}`;
    } else {
      el.textContent = `顯示 ${shown} / ${total} 個${label}`;
    }
  }

  // ── 搜尋高亮 ──────────────────────────────────────────────────────────────
  _hl(text, query) {
    if (!query || !text) return text || '';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="mgr-hl">$1</mark>');
  }

  // ── 在畫布上選取 ─────────────────────────────────────────────────────────
  _selectOnCanvas(id) {
    this.state.selection.clear();
    this.state.selection.add(id);
    this.state.emit('selectionChange');
    if (window.showToast) window.showToast('已在畫布上選取', 'info', 1500);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STATION CRUD
  // ────────────────────────────────────────────────────────────────────────────
  _openStationEdit(station) {
    this._editStation = station;
    this._editLine    = null;

    // 高亮清單項目
    document.querySelectorAll('.mgr-list-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === station.id);
    });

    // 填入表單值
    document.getElementById('mgr-st-form-title').textContent = station.name || '車站屬性';
    const badge = document.getElementById('mgr-st-badge');
    badge.style.background = station.stroke || '#0070BD';

    document.getElementById('mgr-st-name').value    = station.name    || '';
    document.getElementById('mgr-st-en').value      = station.nameEn  || '';
    document.getElementById('mgr-st-code').value    = station.code    || '';
    document.getElementById('mgr-st-shape').value   = station.shape   || 'circle';
    document.getElementById('mgr-st-size').value    = station.size    || 10;

    const fill   = station.fill   || '#FFFFFF';
    const stroke = station.stroke || '#0070BD';
    document.getElementById('mgr-st-fill').value          = fill;
    document.getElementById('mgr-st-fill-picker').value   = fill;
    document.getElementById('mgr-st-stroke').value        = stroke;
    document.getElementById('mgr-st-stroke-picker').value = stroke;

    const sw = station.strokeWidth || 3;
    document.getElementById('mgr-st-sw').value        = sw;
    document.getElementById('mgr-st-sw-slider').value  = sw;
    document.getElementById('mgr-st-x').value = Math.round(station.x || 0);
    document.getElementById('mgr-st-y').value = Math.round(station.y || 0);

    // 顯示表單
    document.getElementById('mgr-edit-empty').style.display    = 'none';
    document.getElementById('mgr-station-form').style.display  = 'flex';
    document.getElementById('mgr-line-form').style.display     = 'none';
  }

  _saveStation() {
    if (!this._editStation) return;

    const station = this._editStation;
    this.history && this.history.push({ type: 'batch', ops: [] });

    station.name        = document.getElementById('mgr-st-name').value.trim()   || station.name;
    station.nameEn      = document.getElementById('mgr-st-en').value.trim();
    station.code        = document.getElementById('mgr-st-code').value.trim();
    station.shape       = document.getElementById('mgr-st-shape').value;
    station.size        = parseFloat(document.getElementById('mgr-st-size').value)    || station.size;
    station.fill        = document.getElementById('mgr-st-fill').value;
    station.stroke      = document.getElementById('mgr-st-stroke').value;
    station.strokeWidth = parseFloat(document.getElementById('mgr-st-sw').value)       || station.strokeWidth;
    station.x           = parseFloat(document.getElementById('mgr-st-x').value)         || station.x;
    station.y           = parseFloat(document.getElementById('mgr-st-y').value)         || station.y;

    this.state.markDirty();
    this.state.emit('objectsChange');

    this._refresh();
    // 重新高亮
    const el = document.querySelector(`.mgr-list-item[data-id="${station.id}"]`);
    if (el) el.classList.add('selected');

    if (window.showToast) window.showToast('車站已更新', 'success', 2000);
  }

  _deleteStation() {
    if (!this._editStation) return;
    const id  = this._editStation.id;
    const idx = this.state.data.stations.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.state.data.stations.splice(idx, 1);
      this.state.selection.delete(id);
      this.state.markDirty();
      this.state.emit('objectsChange');
      this.state.emit('selectionChange');
    }
    this._cancelEdit();
    this._refresh();
    if (window.showToast) window.showToast('車站已刪除', 'info', 2000);
  }

  _createNewStation() {
    const id = 'st_' + Date.now();
    const newStation = {
      id,
      name: '新車站',
      nameEn: '',
      code: '',
      shape: 'circle',
      size: 10,
      fill: '#FFFFFF',
      stroke: '#0070BD',
      strokeWidth: 3,
      x: 200,
      y: 200,
    };
    this.state.data.stations.push(newStation);
    this.state.markDirty();
    this.state.emit('objectsChange');
    this._refresh();
    // 自動開啟編輯
    this._openStationEdit(newStation);
    if (window.showToast) window.showToast('已建立新車站', 'success', 2000);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // LINE CRUD
  // ────────────────────────────────────────────────────────────────────────────
  _openLineEdit(line) {
    this._editLine    = line;
    this._editStation = null;

    document.querySelectorAll('.mgr-list-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === line.id);
    });

    const color = line.color || '#4A9EFF';
    document.getElementById('mgr-ln-form-title').textContent = line.name || '路線屬性';
    document.getElementById('mgr-ln-badge').style.background = color;
    document.getElementById('mgr-ln-name').value    = line.name   || '';
    document.getElementById('mgr-ln-code').value    = line.code   || '';
    document.getElementById('mgr-ln-color').value         = color;
    document.getElementById('mgr-ln-color-picker').value  = color;
    const width = line.width || 8;
    document.getElementById('mgr-ln-width').value         = width;
    document.getElementById('mgr-ln-width-slider').value  = width;
    document.getElementById('mgr-ln-routing').value = line.routing || '45deg';
    document.getElementById('mgr-ln-style').value   = line.lineStyle || 'solid';
    const opacity = line.opacity !== undefined ? Math.round(line.opacity * 100) : 100;
    document.getElementById('mgr-ln-opacity').value        = opacity;
    document.getElementById('mgr-ln-opacity-slider').value = opacity;
    document.getElementById('mgr-ln-points-info').textContent =
      `${(line.points || []).length} 個節點`;

    document.getElementById('mgr-edit-empty').style.display   = 'none';
    document.getElementById('mgr-station-form').style.display = 'none';
    document.getElementById('mgr-line-form').style.display    = 'flex';
  }

  _saveLine() {
    if (!this._editLine) return;

    const line = this._editLine;
    line.name      = document.getElementById('mgr-ln-name').value.trim()  || line.name;
    line.code      = document.getElementById('mgr-ln-code').value.trim();
    line.color     = document.getElementById('mgr-ln-color').value;
    line.width     = parseFloat(document.getElementById('mgr-ln-width').value)   || line.width;
    line.routing   = document.getElementById('mgr-ln-routing').value;
    line.lineStyle = document.getElementById('mgr-ln-style').value;
    line.opacity   = parseFloat(document.getElementById('mgr-ln-opacity').value) / 100;

    this.state.markDirty();
    this.state.emit('objectsChange');
    this._refresh();
    const el = document.querySelector(`.mgr-list-item[data-id="${line.id}"]`);
    if (el) el.classList.add('selected');
    if (window.showToast) window.showToast('路線已更新', 'success', 2000);
  }

  _deleteLine() {
    if (!this._editLine) return;
    const id  = this._editLine.id;
    const idx = this.state.data.lines.findIndex(l => l.id === id);
    if (idx !== -1) {
      this.state.data.lines.splice(idx, 1);
      this.state.selection.delete(id);
      this.state.markDirty();
      this.state.emit('objectsChange');
      this.state.emit('selectionChange');
    }
    this._cancelEdit();
    this._refresh();
    if (window._appHistory) window._appHistory.push();
    if (window.showToast) window.showToast('路線已刪除', 'info', 2000);
  }

  // ── 取消編輯 ─────────────────────────────────────────────────────────────
  _cancelEdit() {
    this._editStation = null;
    this._editLine    = null;
    document.querySelectorAll('.mgr-list-item').forEach(el => el.classList.remove('selected'));
    document.getElementById('mgr-edit-empty').style.display   = 'flex';
    document.getElementById('mgr-station-form').style.display = 'none';
    document.getElementById('mgr-line-form').style.display    = 'none';
  }
}

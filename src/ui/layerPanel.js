/**
 * layerPanel.js — Layer Panel Controller
 * Transportation Designer by NetFormosa
 */

export class LayerPanel {
  constructor(state, renderer) {
    this.state    = state;
    this.renderer = renderer;
  }

  init() {
    // Layer visibility toggle
    document.querySelectorAll('.layer-vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const layer = btn.dataset.layer;
        if (!this.state.layers[layer]) return;
        this.state.layers[layer].visible = !this.state.layers[layer].visible;
        const isVisible = this.state.layers[layer].visible;
        btn.classList.toggle('hidden', !isVisible);
        // Also dim the entire layer row
        btn.closest('.layer-item')?.classList.toggle('layer-hidden', !isVisible);
        this.renderer.renderAll();
      });
    });
  }
}

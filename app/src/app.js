// Vice City Cover Studio — the editor. Wires the controls to the render engine:
// pick photos (upload or samples), choose a layout, grade, title style and frame,
// edit the words and furniture, pan and zoom each panel's photo on the preview,
// and export the cover as a PNG in the chosen post size.

import { SIZES, SAMPLES, LAYOUTS, GRADES, TITLE_STYLES, FRAMES, defaultState, defaultCrop } from './presets.js';
import { drawCover, panelAt } from './cover.js';
import { runShot } from './shots.js';

const state = defaultState();
const preview = document.getElementById('preview');
const status = document.getElementById('status');
/** The offscreen canvas the cover is drawn on at export size; the preview shows it scaled. */
const renderCanvas = document.createElement('canvas');

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** The panel count the current layout uses. */
function panelCount() {
  return LAYOUTS[state.layout].panels(1, 1).length;
}

/** Redraws the cover at the export size, then paints it onto the preview canvas. */
function redraw() {
  const size = SIZES[state.size];
  renderCanvas.width = size.w;
  renderCanvas.height = size.h;
  drawCover(renderCanvas, state);
  // Size the preview from the stage's space, not the canvas's own size: sizing
  // from the canvas feeds back into itself and the preview never grows.
  const stage = preview.parentElement;
  const coverMode = document.body.classList.contains('shot-cover');
  const availW = stage.clientWidth - (coverMode ? 0 : 56);
  const availH = stage.clientHeight - (coverMode ? 0 : 130);
  const scale = Math.min(availW / size.w, availH / size.h, 1);
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  const ctx = preview.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(renderCanvas, 0, 0, preview.width, preview.height);
  updatePanelList();
}

/** The per-panel slot list under the preview: which photo each panel holds. */
function updatePanelList() {
  const list = document.getElementById('panels');
  list.innerHTML = '';
  const n = panelCount();
  for (let i = 0; i < n; i++) {
    const slot = state.photos[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `panel-slot${i === state.selected ? ' selected' : ''}`;
    btn.textContent = slot ? `${i + 1} · ${slot.name}` : `${i + 1} · empty`;
    btn.addEventListener('click', () => {
      state.selected = i;
      redraw();
    });
    list.appendChild(btn);
  }
  document.getElementById('zoom').value = String(state.photos[state.selected]?.crop.zoom ?? 1);
}

/** Puts a loaded image into a panel slot, with its face-aware default crop. */
function setPhoto(index, img, name) {
  const layout = LAYOUTS[state.layout].panels(1, 1);
  const p = layout[index] ?? layout[0];
  const photoRatio = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  state.photos[index] = {
    img,
    name,
    crop: defaultCrop(photoRatio, p.w / p.h),
  };
  state.selected = index;
}

/** Fills every panel of the current layout with one photo, crops varied. */
async function fillAllWith(url, name) {
  const img = await loadImage(url);
  const n = panelCount();
  const layout = LAYOUTS[state.layout].panels(1, 1);
  for (let i = 0; i < n; i++) {
    const p = layout[i];
    const photoRatio = img.naturalWidth / img.naturalHeight;
    const crop = defaultCrop(photoRatio, p.w / p.h);
    // Vary the crop centre per panel so one photo reads differently in each.
    crop.cx = 0.3 + 0.4 * ((i * 0.37) % 1);
    crop.cy = 0.3 + 0.4 * ((i * 0.53) % 1);
    state.photos[i] = { img, name, crop };
  }
  state.selected = 0;
  redraw();
}

/** Builds a row of option buttons from a preset map, wiring the active one. */
function buildOptions(containerId, options, current, onPick) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (const [key, opt] of Object.entries(options)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `option${key === current ? ' active' : ''}`;
    btn.textContent = opt.label;
    btn.title = opt.blurb ?? opt.label;
    btn.addEventListener('click', () => {
      onPick(key);
      container.querySelectorAll('.option').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    container.appendChild(btn);
  }
}

/** The sample-photo strip: click to put the sample in the selected panel. */
function buildSamples() {
  const strip = document.getElementById('samples');
  strip.innerHTML = '';
  for (const sample of SAMPLES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sample';
    btn.title = `Put ${sample.label} in panel ${state.selected + 1} (double-click to fill all panels)`;
    const thumb = document.createElement('img');
    thumb.src = `samples/${sample.id}.jpg`;
    thumb.alt = sample.label;
    thumb.loading = 'lazy';
    btn.appendChild(thumb);
    const label = document.createElement('span');
    label.textContent = sample.label;
    btn.appendChild(label);
    btn.addEventListener('click', async () => {
      try {
        const img = await loadImage(`samples/${sample.id}.jpg`);
        setPhoto(state.selected, img, sample.label);
        status.textContent = `${sample.label} in panel ${state.selected + 1}.`;
        redraw();
      } catch {
        status.textContent = `Could not load ${sample.label}.`;
      }
    });
    btn.addEventListener('dblclick', async (e) => {
      e.preventDefault();
      try {
        await fillAllWith(`samples/${sample.id}.jpg`, sample.label);
        status.textContent = `${sample.label} fills every panel, each cropped differently.`;
      } catch {
        status.textContent = `Could not load ${sample.label}.`;
      }
    });
    strip.appendChild(btn);
  }
}

/** The furniture toggles. */
function buildFurniture() {
  const box = document.getElementById('furniture');
  box.innerHTML = '';
  const labels = {
    quote: 'Press quote',
    ticket: 'Ticket stub',
    subtitle: 'Script subtitle',
    ribbon: 'Tagline ribbon',
    tags: 'Role tags',
    seal: 'Gold seal',
    barcode: 'Barcode',
    billing: 'Billing block',
  };
  for (const [key, label] of Object.entries(labels)) {
    const wrap = document.createElement('label');
    wrap.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.furniture[key];
    input.addEventListener('change', () => {
      state.furniture[key] = input.checked;
      redraw();
    });
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(label));
    box.appendChild(wrap);
  }
}

/** The role-tag editors, one per panel slot. */
function buildTagEditors() {
  const box = document.getElementById('tags');
  box.innerHTML = '';
  for (let i = 0; i < panelCount(); i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 18;
    input.placeholder = `Panel ${i + 1} tag`;
    input.value = state.tags[i] ?? '';
    input.addEventListener('input', () => {
      state.tags[i] = input.value;
      redraw();
    });
    box.appendChild(input);
  }
}

/** Binds a text input to a words field. */
function bindWord(inputId, field) {
  const input = document.getElementById(inputId);
  input.value = state.words[field];
  input.addEventListener('input', () => {
    state.words[field] = input.value;
    redraw();
  });
}

/** Drag to pan and scroll to zoom the selected panel's photo, on the preview. */
function bindPreviewGestures() {
  let dragging = null;
  const toCanvas = (e) => {
    const rect = preview.getBoundingClientRect();
    const size = SIZES[state.size];
    return {
      x: ((e.clientX - rect.left) / rect.width) * size.w,
      y: ((e.clientY - rect.top) / rect.height) * size.h,
    };
  };
  preview.addEventListener('pointerdown', (e) => {
    const { x, y } = toCanvas(e);
    const size = SIZES[state.size];
    const hit = panelAt(state, x, y, size.w, size.h);
    if (hit >= 0) {
      state.selected = hit;
      dragging = { x, y, index: hit };
      preview.setPointerCapture(e.pointerId);
      redraw();
    }
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const slot = state.photos[dragging.index];
    if (!slot) return;
    const { x, y } = toCanvas(e);
    const size = SIZES[state.size];
    const layout = LAYOUTS[state.layout].panels(size.w, size.h);
    const r = layout[dragging.index];
    const img = slot.img;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cover = Math.max((r.w * size.w) / iw, (r.h * size.h) / ih) * slot.crop.zoom;
    slot.crop.cx -= (x - dragging.x) / (iw * cover);
    slot.crop.cy -= (y - dragging.y) / (ih * cover);
    slot.crop.cx = Math.min(1, Math.max(0, slot.crop.cx));
    slot.crop.cy = Math.min(1, Math.max(0, slot.crop.cy));
    dragging = { x, y, index: dragging.index };
    redraw();
  });
  preview.addEventListener('pointerup', () => { dragging = null; });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = state.photos[state.selected];
    if (!slot) return;
    const next = slot.crop.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1);
    slot.crop.zoom = Math.min(4, Math.max(1, next));
    document.getElementById('zoom').value = String(slot.crop.zoom);
    redraw();
  }, { passive: false });
}

/** Export: draws the cover at full size and downloads the PNG. */
function bindExport() {
  document.getElementById('export').addEventListener('click', () => {
    const size = SIZES[state.size];
    renderCanvas.width = size.w;
    renderCanvas.height = size.h;
    drawCover(renderCanvas, state);
    renderCanvas.toBlob((blob) => {
      if (!blob) {
        status.textContent = 'Export failed — please try again.';
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-city-cover-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      status.textContent = `Saved vice-city-cover-${size.w}x${size.h}.png`;
    }, 'image/png');
  });
}

/** Uploads from the file input into the selected panel. */
function bindUpload() {
  document.getElementById('upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      setPhoto(state.selected, img, file.name.replace(/\.[^.]+$/, ''));
      status.textContent = `${file.name} in panel ${state.selected + 1}. Drag to position it, scroll to zoom.`;
      redraw();
    } catch {
      status.textContent = 'That file could not be read as an image.';
    }
    e.target.value = '';
  });
}

/** The zoom slider for the selected panel. */
function bindZoom() {
  document.getElementById('zoom').addEventListener('input', (e) => {
    const slot = state.photos[state.selected];
    if (!slot) return;
    slot.crop.zoom = Number(e.target.value);
    redraw();
  });
}

/** Puts the default sample photos in, so the first paint already looks like a cover. */
async function loadDefaults() {
  const picks = ['woman-sunglasses', 'neon-drive', 'man-hawaiian', 'sunset-beach', 'woman-car', 'speedboat', 'man-leather'];
  const n = panelCount();
  for (let i = 0; i < n; i++) {
    try {
      const img = await loadImage(`samples/${picks[i % picks.length]}.jpg`);
      const layout = LAYOUTS[state.layout].panels(1, 1);
      const p = layout[i];
      state.photos[i] = {
        img,
        name: picks[i % picks.length],
        crop: defaultCrop(img.naturalWidth / img.naturalHeight, p.w / p.h),
      };
    } catch {
      // A missing sample leaves its panel empty; the editor still works.
    }
  }
}

function buildControls() {
  buildOptions('layouts', LAYOUTS, state.layout, (key) => {
    state.layout = key;
    state.selected = 0;
    buildTagEditors();
    redraw();
  });
  buildOptions('grades', GRADES, state.grade, (key) => {
    state.grade = key;
    redraw();
  });
  buildOptions('titles', TITLE_STYLES, state.titleStyle, (key) => {
    state.titleStyle = key;
    redraw();
  });
  buildOptions('frames', FRAMES, state.frame, (key) => {
    state.frame = key;
    redraw();
  });
  buildOptions('sizes', SIZES, state.size, (key) => {
    state.size = key;
    document.getElementById('export').textContent = `Export PNG ${SIZES[key].w} × ${SIZES[key].h}`;
    redraw();
  });
  buildSamples();
  buildFurniture();
  buildTagEditors();
  bindWord('title', 'title');
  bindWord('subtitle', 'subtitle');
  bindWord('tagline', 'tagline');
  bindWord('quote', 'quote');
  bindWord('quote-source', 'quoteSource');
  bindWord('billing1', 'billing1');
  bindWord('billing2', 'billing2');
  bindUpload();
  bindZoom();
  bindExport();
  bindPreviewGestures();
}

const shot = new URLSearchParams(location.search).get('shot');
buildControls();
if (shot) {
  runShot(shot, new URLSearchParams(location.search), state, loadImage, redraw);
} else {
  loadDefaults().then(() => {
    // Paint once the bundled fonts arrive, so the title uses them.
    if (document.fonts?.ready) document.fonts.ready.then(redraw);
    redraw();
  });
}

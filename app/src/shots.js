// Fixed scenes for screenshots: ?shot=cover shows the cover alone, ?shot=editor
// shows the whole editor with photos loaded. Query parameters pick the scene:
// layout, grade, title (or caption), subtitle, tagline, quote, size, and photos
// (a comma-separated list of sample ids, one per panel). window.__shotReady is
// set once the fonts have arrived and the cover is painted.

import { LAYOUTS, GRADES, TITLE_STYLES, FRAMES, SIZES, defaultCrop } from './presets.js';

export async function runShot(shot, query, state, loadImage, redraw) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');

  const pick = (name, map, field) => {
    const value = query.get(name);
    if (value && map[value]) state[field] = value;
  };
  pick('layout', LAYOUTS, 'layout');
  pick('grade', GRADES, 'grade');
  pick('titleStyle', TITLE_STYLES, 'titleStyle');
  pick('frame', FRAMES, 'frame');
  pick('size', SIZES, 'size');

  const words = {
    title: query.get('title') ?? query.get('caption'),
    subtitle: query.get('subtitle'),
    tagline: query.get('tagline'),
    quote: query.get('quote'),
    quoteSource: query.get('quoteSource'),
  };
  for (const [field, value] of Object.entries(words)) {
    if (value !== null && value !== undefined) state.words[field] = value;
  }

  const furniture = query.get('furniture');
  if (furniture !== null) {
    const on = new Set(furniture.split(',').filter(Boolean));
    for (const key of Object.keys(state.furniture)) state.furniture[key] = on.has(key);
  }

  const tags = query.get('tags');
  if (tags !== null) {
    tags.split(',').forEach((tag, i) => { state.tags[i] = tag; });
  }

  const photos = (query.get('photos') ?? '').split(',').filter(Boolean);
  const layout = LAYOUTS[state.layout].panels(1, 1);
  for (let i = 0; i < photos.length && i < layout.length; i++) {
    try {
      const img = await loadImage(`samples/${photos[i]}.jpg`);
      const p = layout[i];
      state.photos[i] = {
        img,
        name: photos[i],
        crop: defaultCrop(img.naturalWidth / img.naturalHeight, p.w / p.h),
      };
    } catch {
      // A missing sample leaves its panel empty.
    }
  }

  // Sync the visible controls with the scene, so the editor shot shows them set.
  const OPTION_MAPS = { layouts: LAYOUTS, grades: GRADES, titles: TITLE_STYLES, frames: FRAMES, sizes: SIZES };
  const syncOptions = (containerId, active) => {
    const keys = Object.keys(OPTION_MAPS[containerId]);
    document.querySelectorAll(`#${containerId} .option`).forEach((btn, i) => {
      btn.classList.toggle('active', keys[i] === active);
    });
  };
  syncOptions('layouts', state.layout);
  syncOptions('grades', state.grade);
  syncOptions('titles', state.titleStyle);
  syncOptions('frames', state.frame);
  syncOptions('sizes', state.size);
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };
  setValue('title', state.words.title);
  setValue('subtitle', state.words.subtitle);
  setValue('tagline', state.words.tagline);
  setValue('quote', state.words.quote);
  setValue('quote-source', state.words.quoteSource);
  document.querySelectorAll('#furniture input').forEach((input, i) => {
    input.checked = state.furniture[Object.keys(state.furniture)[i]];
  });
  document.getElementById('export').textContent =
    `Export PNG ${SIZES[state.size].w} × ${SIZES[state.size].h}`;

  redraw();
  try {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  } catch {
    // Fonts failing still leaves a painted cover.
  }
  redraw();
  window.__shotReady = true;
}

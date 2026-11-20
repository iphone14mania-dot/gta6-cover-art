// Vice City Cover Studio — the render engine. drawCover paints the whole poster
// onto a canvas at the canvas's own size: panels and photos, the colour grade,
// the title in its style, and every piece of poster furniture. All sizes derive
// from the canvas width and height, so the preview and the exported PNG are the
// same drawing at different scales.

import { LAYOUTS, GRADES, TITLE_STYLES, MAX_PANELS } from './presets.js';

/** The three bundled fonts, as the CSS @font-face rules name them. */
const FONT_DISPLAY = '"Anton", "Arial Black", sans-serif';
const FONT_CONDENSED = '"Bebas Neue", "Arial Narrow", sans-serif';
const FONT_SCRIPT = '"Yellowtail", cursive';

/** Small deterministic hash of a string, for the barcode. */
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A panel's unit rectangle as pixels. */
function panelPixels(p, w, h) {
  return { x: p.x * w, y: p.y * h, w: p.w * w, h: p.h * h, slant: p.slant * w };
}

/** The clip path of a panel: a rectangle, or a parallelogram when slanted. */
function clipPanel(ctx, r, slant) {
  ctx.beginPath();
  if (slant) {
    ctx.moveTo(r.x + slant, r.y);
    ctx.lineTo(r.x + r.w + slant, r.y);
    ctx.lineTo(r.x + r.w - slant, r.y + r.h);
    ctx.lineTo(r.x - slant, r.y + r.h);
  } else {
    ctx.rect(r.x, r.y, r.w, r.h);
  }
  ctx.closePath();
  ctx.clip();
}

/**
 * Draws one photo inside its panel rect, cover-fitting it with the crop:
 * `crop.cx/cy` is the photo point (in fractions of the photo) centred in the
 * panel, `crop.zoom` a scale multiplier of 1 or more. A pop-out hero is drawn
 * a little larger than its frame, with a soft shadow behind it.
 */
function drawPhoto(ctx, img, crop, r, slant, popout, w, h) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const cover = Math.max(r.w / iw, r.h / ih) * (crop?.zoom ?? 1);
  const dw = iw * cover;
  const dh = ih * cover;
  const cx = crop?.cx ?? 0.5;
  const cy = crop?.cy ?? 0.5;
  let dx = r.x + r.w / 2 - cx * dw;
  let dy = r.y + r.h / 2 - cy * dh;
  ctx.save();
  if (popout) {
    // The hero breaks its frame: draw it oversized, offset up-left, shadowed.
    const over = 0.05 * Math.min(r.w, r.h);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = over * 0.9;
    ctx.shadowOffsetY = over * 0.4;
    dx -= over * 0.6;
    dy -= over * 0.6;
    const grow = 1 + over / Math.min(r.w, r.h);
    ctx.drawImage(img, dx, dy, dw * grow, dh * grow);
  } else {
    clipPanel(ctx, r, slant);
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
}

/** An empty panel: a dark gradient with a dashed outline and a plus mark. */
function drawEmptyPanel(ctx, r, slant, u) {
  ctx.save();
  clipPanel(ctx, r, slant);
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, '#2a1b3d');
  g.addColorStop(1, '#12081f');
  ctx.fillStyle = g;
  ctx.fillRect(r.x - Math.abs(slant), r.y, r.w + 2 * Math.abs(slant), r.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, u * 1.5);
  ctx.setLineDash([u * 10, u * 8]);
  ctx.strokeRect(r.x + u * 10, r.y + u * 10, r.w - u * 20, r.h - u * 20);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${u * 44}px ${FONT_CONDENSED}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', r.x + r.w / 2, r.y + r.h / 2 - u * 4);
  ctx.font = `${u * 15}px ${FONT_CONDENSED}`;
  ctx.fillText('ADD PHOTO', r.x + r.w / 2, r.y + r.h / 2 + u * 26);
  ctx.restore();
}

/** The thin white keylines between panels. */
function drawPanelBorders(ctx, panels, w, h, u) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, u * 2);
  for (const p of panels) {
    if (p.inset === false) continue;
    const r = panelPixels(p, w, h);
    ctx.beginPath();
    if (p.slant) {
      ctx.moveTo(r.x + r.slant, r.y);
      ctx.lineTo(r.x + r.w + r.slant, r.y);
      ctx.lineTo(r.x + r.w - r.slant, r.y + r.h);
      ctx.lineTo(r.x - r.slant, r.y + r.h);
    } else {
      ctx.rect(r.x, r.y, r.w, r.h);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

/** The colour grade: overlay passes, then the vignette. */
function applyGrade(ctx, grade, w, h) {
  const g = GRADES[grade] ?? GRADES['vice-sunset'];
  for (const pass of g.passes) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (const [offset, colour] of pass.stops) grad.addColorStop(offset, colour);
    ctx.save();
    ctx.globalCompositeOperation = pass.op;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${g.vignette})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Wraps `text` into at most two lines that fit `maxWidth` at `size`, shrinking
 * the size until they do. Returns { lines, size }.
 */
function fitTitleLines(ctx, text, maxWidth, size, font) {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], size };
  let current = size;
  while (current > 10) {
    ctx.font = `${current}px ${font}`;
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { lines, size: current };
    }
    current -= Math.max(1, Math.round(current * 0.06));
  }
  ctx.font = `${current}px ${font}`;
  return { lines: [words.join(' ')], size: current };
}

/** The striped retro-chrome fill for a title of the given height. */
function chromeFill(ctx, y, size) {
  const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.2);
  const bands = ['#fff7d6', '#ffd166', '#ff9f43', '#ff6b9d', '#c86bff', '#7ec8ff', '#ffffff'];
  bands.forEach((c, i) => g.addColorStop(i / (bands.length - 1), c));
  return g;
}

/**
 * Draws the title (and the script subtitle for the script style). Returns the
 * title's bounding box { x, y, w, h } in pixels, for role-tag collision.
 */
function drawTitle(ctx, state, w, h, u) {
  const style = state.titleStyle;
  const text = state.words.title.trim();
  const maxWidth = w * 0.88;
  const baseline = h - u * 118;
  const startSize = h * 0.115;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const { lines, size } = fitTitleLines(ctx, text, maxWidth, startSize, FONT_DISPLAY);
  const lineHeight = size * 1.02;
  const top = baseline - lineHeight * (lines.length - 1) - size * 0.86;
  const boxW = Math.max(...lines.map((l) => {
    ctx.font = `${size}px ${FONT_DISPLAY}`;
    return ctx.measureText(l).width;
  }), 0);
  const box = { x: w / 2 - boxW / 2, y: top, w: boxW, h: baseline - top + size * 0.2 };

  // A soft scrim behind the title keeps it readable over busy photos.
  const scrim = ctx.createLinearGradient(0, top - u * 30, 0, baseline + u * 34);
  scrim.addColorStop(0, 'rgba(10,5,20,0)');
  scrim.addColorStop(0.5, 'rgba(10,5,20,0.42)');
  scrim.addColorStop(1, 'rgba(10,5,20,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, top - u * 30, w, baseline - top + u * 64);

  lines.forEach((line, i) => {
    const y = baseline - lineHeight * (lines.length - 1 - i);
    ctx.font = `${size}px ${FONT_DISPLAY}`;
    if (style === 'chrome') {
      const depth = Math.max(2, size * 0.055);
      ctx.fillStyle = '#2b0a1e';
      for (let d = 7; d >= 1; d--) ctx.fillText(line, w / 2 + d * depth * 0.28, y + d * depth * 0.28);
      ctx.fillStyle = chromeFill(ctx, y, size);
      ctx.fillText(line, w / 2, y);
      ctx.lineWidth = Math.max(1, size * 0.02);
      ctx.strokeStyle = 'rgba(43,10,30,0.9)';
      ctx.strokeText(line, w / 2, y);
      ctx.lineWidth = Math.max(1, size * 0.006);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.strokeText(line, w / 2, y);
    } else if (style === 'neon') {
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = size * 0.35;
      ctx.strokeStyle = '#ff2d95';
      ctx.lineWidth = Math.max(1.5, size * 0.045);
      ctx.strokeText(line, w / 2, y);
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = size * 0.18;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, size * 0.016);
      ctx.strokeText(line, w / 2, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(20,0,30,0.55)';
      ctx.fillText(line, w / 2, y);
    } else if (style === 'block') {
      ctx.fillStyle = '#111';
      ctx.fillText(line, w / 2 + size * 0.07, y + size * 0.07);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, w / 2, y);
    } else {
      // script: bold title, the script subtitle drawn under it below.
      ctx.fillStyle = '#1a0b1e';
      ctx.fillText(line, w / 2 + size * 0.04, y + size * 0.05);
      ctx.fillStyle = '#fff3d6';
      ctx.fillText(line, w / 2, y);
    }
  });

  if ((style === 'script' || state.furniture.subtitle) && state.words.subtitle.trim()) {
    ctx.font = `${Math.max(14, size * 0.42)}px ${FONT_SCRIPT}`;
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = u * 8;
    ctx.fillText(state.words.subtitle.trim(), w / 2, baseline + size * 0.42);
    ctx.shadowBlur = 0;
    box.h += size * 0.42;
  }
  ctx.restore();
  return box;
}

/** Role tags: a pill per panel, skipped where the title would cover it. */
function drawRoleTags(ctx, state, panels, w, h, u, titleBox) {
  if (!state.furniture.tags) return;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  panels.forEach((p, i) => {
    const tag = (state.tags[i] ?? '').trim();
    if (!tag) return;
    const r = panelPixels(p, w, h);
    if (r.w < w * 0.09 || r.h < h * 0.07) return;
    const fontSize = Math.max(11, u * 17);
    ctx.font = `${fontSize}px ${FONT_CONDENSED}`;
    const padX = u * 10;
    const tw = ctx.measureText(tag.toUpperCase()).width + padX * 2;
    const th = fontSize * 1.7;
    const x = r.x + u * 10;
    const y = r.y + r.h - th - u * 10;
    const tagBox = { x, y, w: tw, h: th };
    // Auto-hide: skip the tag when it would sit under the title, the ticket
    // stub (bottom-left) or the seal/barcode cluster (bottom-right).
    const m = u * 6;
    const overlapsTitle =
      tagBox.x < titleBox.x + titleBox.w + m && tagBox.x + tagBox.w > titleBox.x - m &&
      tagBox.y < titleBox.y + titleBox.h + m && tagBox.y + tagBox.h > titleBox.y - m;
    const inTicketZone = tagBox.x < u * 250 && tagBox.y + tagBox.h > h - u * 120;
    const inSealZone = tagBox.x + tagBox.w > w - u * 370 && tagBox.y + tagBox.h > h - u * 120;
    if (overlapsTitle || inTicketZone || inSealZone) return;
    ctx.fillStyle = 'rgba(10,5,20,0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, tw, th, th / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.9)';
    ctx.lineWidth = Math.max(1, u * 1.2);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(tag.toUpperCase(), x + padX, y + th / 2 + u * 1);
  });
  ctx.restore();
}

/** The press quote with stars, top centre. */
function drawQuote(ctx, state, w, h, u) {
  if (!state.furniture.quote) return;
  const quote = state.words.quote.trim();
  if (!quote) return;
  ctx.save();
  ctx.textAlign = 'center';
  const y = u * 34;
  ctx.font = `${u * 22}px ${FONT_CONDENSED}`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText('★ ★ ★ ★ ★', w / 2, y);
  ctx.font = `${u * 24}px ${FONT_CONDENSED}`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = u * 6;
  ctx.fillText(`“${quote}”`, w / 2, y + u * 30);
  ctx.font = `${u * 15}px ${FONT_CONDENSED}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  try { ctx.letterSpacing = `${u * 3}px`; } catch { /* older canvas: no letter spacing */ }
  ctx.fillText(`— ${state.words.quoteSource.trim().toUpperCase()}`, w / 2, y + u * 56);
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  ctx.restore();
}

/** The diagonal tagline ribbon, top-right corner. */
function drawRibbon(ctx, state, w, h, u) {
  if (!state.furniture.ribbon) return;
  const text = state.words.tagline.trim().toUpperCase();
  if (!text) return;
  ctx.save();
  // The band crosses the top-right corner diagonally: its centre sits on the
  // corner diagonal, a short way in from the corner, so the middle of the band
  // (and its text) stays on the canvas while the ends run off the edges.
  ctx.translate(w - w * 0.085, w * 0.085);
  ctx.rotate(Math.PI / 4);
  const bandH = u * 34;
  const bandW = w * 0.42;
  ctx.fillStyle = '#e63946';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = u * 8;
  ctx.fillRect(-bandW / 2, -bandH / 2, bandW, bandH);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `${u * 17}px ${FONT_CONDENSED}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let shown = text;
  while (ctx.measureText(shown).width > bandW - u * 20 && shown.length > 4) {
    shown = shown.slice(0, -1);
  }
  ctx.fillText(shown, 0, u * 1);
  ctx.restore();
}

/** The ticket stub, bottom-left, tilted. */
function drawTicketStub(ctx, state, w, h, u) {
  if (!state.furniture.ticket) return;
  ctx.save();
  const tw = u * 190;
  const th = u * 52;
  ctx.translate(u * 24, h - u * 84);
  ctx.rotate(-0.14);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = u * 8;
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath();
  ctx.roundRect(0, 0, tw, th, u * 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.setLineDash([u * 5, u * 5]);
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = Math.max(1, u * 1.5);
  ctx.beginPath();
  ctx.moveTo(tw * 0.72, u * 6);
  ctx.lineTo(tw * 0.72, th - u * 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#7a1f2b';
  ctx.font = `${u * 20}px ${FONT_CONDENSED}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADMIT ONE', u * 12, th / 2 - u * 8);
  ctx.font = `${u * 13}px ${FONT_CONDENSED}`;
  ctx.fillStyle = '#8a6d3b';
  ctx.fillText('VICE CITY · LEONIDA', u * 12, th / 2 + u * 12);
  ctx.fillStyle = '#7a1f2b';
  ctx.font = `${u * 18}px ${FONT_CONDENSED}`;
  ctx.textAlign = 'center';
  ctx.fillText('★', tw * 0.86, th / 2);
  ctx.restore();
}

/** The gold seal, bottom-right, with text on a circular path. */
function drawSeal(ctx, state, w, h, u) {
  if (!state.furniture.seal) return;
  ctx.save();
  const cx = w - u * 62;
  const cy = h - u * 62;
  const r = u * 40;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = u * 8;
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.7, '#d4a017');
  g.addColorStop(1, '#8a6d00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#7a5c00';
  ctx.lineWidth = Math.max(1, u * 2);
  ctx.beginPath();
  ctx.arc(cx, cy, r - u * 5, 0, Math.PI * 2);
  ctx.stroke();
  const ring = (text, radius, startAngle, flip) => {
    ctx.fillStyle = '#5c4400';
    ctx.font = `bold ${u * 11}px ${FONT_CONDENSED}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = (Math.PI * 0.9) / Math.max(1, text.length - 1);
    [...text].forEach((ch, i) => {
      const a = startAngle + (flip ? -i * step : i * step);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2));
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  };
  ring('VICE CITY', r - u * 12, -Math.PI * 0.95, false);
  ring('EST · 2026', r - u * 12, Math.PI * 0.95, true);
  ctx.fillStyle = '#5c4400';
  ctx.font = `${u * 24}px ${FONT_CONDENSED}`;
  ctx.fillText('★', cx, cy + u * 1);
  ctx.restore();
}

/** The deterministic barcode, from the title's hash. */
function drawBarcode(ctx, state, w, h, u) {
  if (!state.furniture.barcode) return;
  const seed = hashString(state.words.title.trim() || 'vice city');
  ctx.save();
  const bw = u * 110;
  const bh = u * 42;
  const x = w - u * 128 - bw;
  const y = h - u * 84;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, bw, bh);
  let s = seed;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let bx = x + u * 6;
  ctx.fillStyle = '#111111';
  while (bx < x + bw - u * 6) {
    const barW = (1 + Math.floor(next() * 3)) * Math.max(1, u * 1.4);
    if (next() > 0.35) ctx.fillRect(bx, y + u * 5, barW, bh - u * 16);
    bx += barW + Math.max(1, u * 1.4);
  }
  ctx.font = `${u * 9}px ${FONT_CONDENSED}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(seed % 100000000).padStart(8, '0'), x + bw / 2, y + bh - u * 4);
  ctx.restore();
}

/** The two-line billing block, bottom centre. */
function drawBilling(ctx, state, w, h, u) {
  if (!state.furniture.billing) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `${Math.max(9, u * 11)}px ${FONT_CONDENSED}`;
  try { ctx.letterSpacing = `${u * 1.5}px`; } catch { /* ignore */ }
  const line1 = state.words.billing1.trim().toUpperCase();
  const line2 = state.words.billing2.trim().toUpperCase();
  if (line1) ctx.fillText(line1, w / 2, h - u * 30);
  if (line2) ctx.fillText(line2, w / 2, h - u * 16);
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  ctx.restore();
}

/** The outer frame. */
function drawFrame(ctx, state, w, h, u) {
  const frame = state.frame;
  if (frame === 'none') return;
  ctx.save();
  if (frame === 'thin') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1, u * 3);
    ctx.strokeRect(u * 6, u * 6, w - u * 12, h - u * 12);
  } else if (frame === 'double') {
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(2, u * 8);
    ctx.strokeRect(u * 4, u * 4, w - u * 8, h - u * 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(1, u * 2);
    ctx.strokeRect(u * 12, u * 12, w - u * 24, h - u * 24);
  } else if (frame === 'neon') {
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = u * 18;
    ctx.strokeStyle = '#ff2d95';
    ctx.lineWidth = Math.max(1.5, u * 3);
    ctx.strokeRect(u * 8, u * 8, w - u * 16, h - u * 16);
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = u * 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1, u * 1.2);
    ctx.strokeRect(u * 8, u * 8, w - u * 16, h - u * 16);
  }
  ctx.restore();
}

/**
 * Draws the whole cover onto `canvas` at the canvas's own size, from `state`.
 * The same function paints the preview and the export, so the two match.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const u = h / 1080;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.mosaic;
  const panels = layout.panels(w, h);

  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, w, h);

  panels.forEach((p, i) => {
    const r = panelPixels(p, w, h);
    const slot = state.photos[i];
    if (slot?.img) drawPhoto(ctx, slot.img, slot.crop, r, p.slant, p.popout, w, h);
    else drawEmptyPanel(ctx, r, p.slant, u);
    if (p.inset) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, u * 5);
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = u * 16;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  });
  drawPanelBorders(ctx, panels, w, h, u);
  applyGrade(ctx, state.grade, w, h);

  const titleBox = drawTitle(ctx, state, w, h, u);
  drawRoleTags(ctx, state, panels, w, h, u, titleBox);
  drawQuote(ctx, state, w, h, u);
  drawRibbon(ctx, state, w, h, u);
  drawTicketStub(ctx, state, w, h, u);
  drawSeal(ctx, state, w, h, u);
  drawBarcode(ctx, state, w, h, u);
  drawBilling(ctx, state, w, h, u);
  drawFrame(ctx, state, w, h, u);
  return { panels, titleBox };
}

/** Which panel (if any) a canvas point falls in, for click-to-select. */
export function panelAt(state, x, y, w, h) {
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.mosaic;
  const panels = layout.panels(w, h);
  for (let i = panels.length - 1; i >= 0; i--) {
    const r = panelPixels(panels[i], w, h);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

export { MAX_PANELS, TITLE_STYLES };

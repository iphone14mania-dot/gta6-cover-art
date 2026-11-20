// Vice City Cover Studio — presets: the layouts, colour grades, title styles, frame
// styles, sample photos and furniture defaults the editor offers. Pure data plus the
// geometry each layout needs; the render engine in cover.js consumes it.

/** The three export sizes, in pixels. */
export const SIZES = {
  landscape: { w: 1920, h: 1080, label: '1920 × 1080 · Landscape' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350 · Portrait' },
  square: { w: 1080, h: 1080, label: '1080 × 1080 · Square' },
};

/** Sample photos shipped with the app (the kit's two, plus nine made for this entry). */
export const SAMPLES = [
  { id: 'woman-sunglasses', label: 'Sunglasses', kind: 'portrait' },
  { id: 'man-hawaiian', label: 'Hawaiian', kind: 'portrait' },
  { id: 'woman-car', label: 'Convertible', kind: 'portrait' },
  { id: 'man-leather', label: 'Leather Jacket', kind: 'portrait' },
  { id: 'sunset-beach', label: 'Sunset Beach', kind: 'scene' },
  { id: 'neon-drive', label: 'Neon Drive', kind: 'scene' },
  { id: 'palms-dusk', label: 'Palms at Dusk', kind: 'scene' },
  { id: 'speedboat', label: 'Speedboat', kind: 'scene' },
  { id: 'rooftop-pool', label: 'Rooftop Pool', kind: 'scene' },
  { id: 'boulevard', label: 'Boulevard', kind: 'scene' },
  { id: 'pier', label: 'Pier', kind: 'scene' },
];

/**
 * A panel is a rectangle in unit space (fractions of the canvas width and height).
 * `slant` (a fraction of the width) turns the rectangle into a parallelogram: the
 * top edge shifts right by it and the bottom edge left, for the diagonal-cut look.
 * `popout` marks the hero panel of the Hero Pop-Out layout: its photo is drawn a
 * little larger than the frame, with a drop shadow, so it breaks out of the grid.
 */
function panel(x, y, w, h, extra = {}) {
  return { x, y, w, h, slant: 0, popout: false, ...extra };
}

/** The six layouts. Each returns the panels for a canvas of the given size. */
export const LAYOUTS = {
  grid: {
    label: 'Showcase Grid',
    blurb: 'Four equal panels',
    panels: () => [
      panel(0.012, 0.012, 0.476, 0.476),
      panel(0.512, 0.012, 0.476, 0.476),
      panel(0.012, 0.512, 0.476, 0.476),
      panel(0.512, 0.512, 0.476, 0.476),
    ],
  },
  hero: {
    label: 'Hero Pop-Out',
    blurb: 'One big hero, two small',
    panels: () => [
      panel(0.012, 0.012, 0.62, 0.976, { popout: true }),
      panel(0.656, 0.012, 0.332, 0.476),
      panel(0.656, 0.512, 0.332, 0.476),
    ],
  },
  strips: {
    label: 'Sunset Strips',
    blurb: 'Three wide bands',
    panels: () => [
      panel(0.012, 0.012, 0.976, 0.31),
      panel(0.012, 0.345, 0.976, 0.31),
      panel(0.012, 0.678, 0.976, 0.31),
    ],
  },
  spotlight: {
    label: 'Spotlight',
    blurb: 'Full bleed + inset',
    panels: () => [
      panel(0, 0, 1, 1, { inset: false }),
      panel(0.6, 0.6, 0.36, 0.32, { inset: true }),
    ],
  },
  mosaic: {
    label: 'Mosaic',
    blurb: 'Seven panels, one large',
    panels: () => [
      panel(0.012, 0.012, 0.532, 0.64),
      panel(0.556, 0.012, 0.432, 0.31),
      panel(0.556, 0.334, 0.21, 0.318),
      panel(0.778, 0.334, 0.21, 0.318),
      panel(0.012, 0.664, 0.318, 0.324),
      panel(0.342, 0.664, 0.318, 0.324),
      panel(0.672, 0.664, 0.316, 0.324),
    ],
  },
  slanted: {
    label: 'Slanted',
    blurb: 'Four diagonal cuts',
    panels: () => [
      panel(-0.01, 0.012, 0.27, 0.976, { slant: 0.045 }),
      panel(0.24, 0.012, 0.27, 0.976, { slant: 0.045 }),
      panel(0.49, 0.012, 0.27, 0.976, { slant: 0.045 }),
      panel(0.74, 0.012, 0.27, 0.976, { slant: 0.045 }),
    ],
  },
};

/** How many photo slots each layout uses (the most of any layout is seven). */
export const MAX_PANELS = 7;

/**
 * A colour grade is a list of overlay passes, each a gradient or flat fill drawn
 * over the finished panels with a composite operation, plus a vignette strength.
 * Gradients are vertical unless `radial` is set; stops are [offset, colour].
 */
export const GRADES = {
  'vice-sunset': {
    label: 'Vice Sunset',
    swatch: ['#ff9a5c', '#e84393'],
    vignette: 0.32,
    passes: [
      { op: 'overlay', stops: [[0, 'rgba(255,154,92,0)'], [0.55, 'rgba(255,120,110,0.18)'], [1, 'rgba(232,67,147,0.42)']] },
      { op: 'soft-light', stops: [[0, 'rgba(255,200,120,0.25)'], [1, 'rgba(120,20,90,0.25)']] },
    ],
  },
  'neon-nights': {
    label: 'Neon Nights',
    swatch: ['#00e5ff', '#7c4dff'],
    vignette: 0.38,
    passes: [
      { op: 'overlay', stops: [[0, 'rgba(124,77,255,0.30)'], [0.5, 'rgba(0,229,255,0.10)'], [1, 'rgba(255,45,149,0.32)']] },
      { op: 'multiply', stops: [[0, 'rgba(20,10,60,0.28)'], [1, 'rgba(10,5,40,0.28)']] },
    ],
  },
  'golden-hour': {
    label: 'Golden Hour',
    swatch: ['#ffd76a', '#ff8c42'],
    vignette: 0.28,
    passes: [
      { op: 'soft-light', stops: [[0, 'rgba(255,215,106,0.45)'], [1, 'rgba(255,140,66,0.35)']] },
      { op: 'overlay', stops: [[0, 'rgba(255,220,150,0)'], [1, 'rgba(200,90,20,0.30)']] },
    ],
  },
  'miami-pastel': {
    label: 'Miami Pastel',
    swatch: ['#ffb3c8', '#7fe7dc'],
    vignette: 0.2,
    passes: [
      { op: 'soft-light', stops: [[0, 'rgba(255,179,200,0.30)'], [1, 'rgba(127,231,220,0.28)']] },
      { op: 'screen', stops: [[0, 'rgba(255,240,245,0.10)'], [1, 'rgba(255,240,245,0.10)']] },
    ],
  },
  ember: {
    label: 'Ember',
    swatch: ['#ff5e3a', '#8e1e1e'],
    vignette: 0.42,
    passes: [
      { op: 'overlay', stops: [[0, 'rgba(255,94,58,0.22)'], [1, 'rgba(142,30,30,0.40)']] },
      { op: 'multiply', stops: [[0, 'rgba(60,10,10,0.22)'], [1, 'rgba(60,10,10,0.22)']] },
    ],
  },
  'midnight-noir': {
    label: 'Midnight Noir',
    swatch: ['#2b3a67', '#0d0d1a'],
    vignette: 0.5,
    passes: [
      { op: 'multiply', stops: [[0, 'rgba(30,40,80,0.38)'], [1, 'rgba(8,8,26,0.45)']] },
      { op: 'screen', stops: [[0, 'rgba(120,160,255,0.10)'], [1, 'rgba(120,160,255,0.04)']] },
    ],
  },
};

/** The four title styles. */
export const TITLE_STYLES = {
  chrome: { label: 'Retro Chrome', blurb: 'Striped 3D lettering' },
  neon: { label: 'Neon Outline', blurb: 'Glowing neon stroke' },
  block: { label: 'Block Shadow', blurb: 'Solid white, hard shadow' },
  script: { label: 'Script Mix', blurb: 'Script subtitle + bold title' },
};

/** The four frame styles. */
export const FRAMES = {
  none: { label: 'No frame' },
  thin: { label: 'Thin white' },
  double: { label: 'Double border' },
  neon: { label: 'Neon glow' },
};

/** Default role tags, one per panel slot. The user can edit each. */
export const DEFAULT_TAGS = ['LUCIA', 'JASON', 'THE HEIST', 'VICE CITY', 'THE CREW', 'THE JOB', 'THE GETAWAY'];

/** The poster's default words. */
export const DEFAULT_WORDS = {
  title: 'VICE CITY',
  subtitle: 'a sun-soaked story',
  tagline: 'EVERY SUNSET HAS A PRICE',
  quote: 'A sun-soaked masterpiece',
  quoteSource: 'VICE CITY GAZETTE',
  billing1: 'VICE CITY COVER STUDIO PRESENTS A LEONIDA PRODUCTION',
  billing2: 'SHOT ON LOCATION IN VICE CITY · NO CARS WERE HARMED · © 2026',
};

/** Which furniture is on by default. */
export const DEFAULT_FURNITURE = {
  quote: true,
  ticket: true,
  subtitle: true,
  ribbon: true,
  tags: true,
  seal: true,
  barcode: true,
  billing: true,
};

/** A fresh editor state. */
export function defaultState() {
  return {
    layout: 'mosaic',
    grade: 'vice-sunset',
    titleStyle: 'chrome',
    frame: 'double',
    size: 'landscape',
    words: { ...DEFAULT_WORDS },
    furniture: { ...DEFAULT_FURNITURE },
    tags: [...DEFAULT_TAGS],
    // One photo slot per panel: { image, name, crop: { cx, cy, zoom } } or null.
    photos: Array.from({ length: MAX_PANELS }, () => null),
    selected: 0,
  };
}

/**
 * The face-aware default crop for a photo in a panel: a portrait photo in a
 * wide panel biases toward the upper third, where a face usually is, instead
 * of dead centre. `photoRatio` is width/height of the photo, `panelRatio` of
 * the panel. Returns { cx, cy, zoom }.
 */
export function defaultCrop(photoRatio, panelRatio) {
  const portraitPhoto = photoRatio < 0.9;
  const widePanel = panelRatio > 1.1;
  return { cx: 0.5, cy: portraitPhoto && widePanel ? 0.34 : 0.5, zoom: 1 };
}

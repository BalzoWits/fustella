// Disegno della piastra della fustella: elementi (testo, motivo, immagine, cornice) disegnati su
// canvas in millimetri. La maschera (canale alfa) è quello che il worker trasforma in rilievo.
// Coordinate: la piastra inferiore vista dall'alto con la cerniera a sinistra.
// u verso destra (0 = bordo lato cerniera … L = bordo libero), v verso il basso (0 … W).
// Il disegno resta sulla piastra (e sulla parte coperta dal foglio, se ci sono allineatori): fuori viene tagliato.
import { STOP } from './fustella.js';
import { t } from './i18n.js';
export const PXMM = 10; // risoluzione della maschera

// misure correnti della piastra (le cambia la pagina con setPlate)
// guide: allineatori del foglio, distanza del bordo del foglio dal bordo della piastra (null = assente)
//   back = lato cerniera (u), top / bottom = lato in alto / in basso nell'editor (v)
// Si può imprimere su tutta la piastra: l'area del disegno è la piastra intera.
export const PLATE = { L: 60, W: 45, M: 0, stops: false, guides: { back: null, top: null, bottom: null } };
export function setPlate(L, W, guides) { Object.assign(PLATE, { L, W }); if (guides) PLATE.guides = guides; }
export function area() {
  return { x: 0, y: 0, w: PLATE.L, h: PLATE.W };
}
// riporta sulla piastra gli elementi finiti fuori (disegni vecchi, ridimensionamenti estremi)
export function keepOnPlate(els) {
  const { L, W } = PLATE;
  const cl = (v, a, b) => r2(Math.min(b, Math.max(a, v)));
  for (const el of els) {
    if (el.type === 'frame' || el.type === 'pattern') {
      el.w = cl(el.w, 4, L); el.h = cl(el.h, 4, W);
      el.x = cl(el.x, 0, L - el.w); el.y = cl(el.y, 0, W - el.h);
    } else if (el.x !== undefined) { el.x = cl(el.x, 0, L); el.y = cl(el.y, 0, W); }
  }
}
// distanza minima tra il bordo del foglio (faccia dell'allineatore) e il disegno
export const GUIDE_INSET = 0.8;
// dove si può imprimere: la piastra, ristretta alla parte coperta dal foglio se ci sono allineatori
export function printRegion() {
  const A = area(), g = PLATE.guides;
  let x0 = A.x, y0 = A.y, x1 = A.x + A.w, y1 = A.y + A.h;
  if (g.back != null) x0 = Math.max(x0, g.back + GUIDE_INSET);
  if (g.top != null) y0 = Math.max(y0, g.top + GUIDE_INSET);
  if (g.bottom != null) y1 = Math.min(y1, PLATE.W - g.bottom - GUIDE_INSET);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

// Piastra ridimensionata con il disegno: posizioni scalate rispetto all'area utile (fx, fy per asse),
// misure (lettere, spessori, passi) con il fattore minore per non deformare.
// M0 / M1: margine prima e dopo (l'angolo dell'area utile è il punto fisso)
export function scaleDesign(els, fx, fy, M0, M1 = M0) {
  const s = Math.min(fx, fy);
  const px = (u) => r2(M1 + (u - M0) * fx), py = (v) => r2(M1 + (v - M0) * fy);
  for (const el of els) {
    const isRect = el.type === 'frame' || el.type === 'pattern';
    if (isRect) {
      el.x = px(el.x); el.y = py(el.y); el.w = r2(el.w * fx); el.h = r2(el.h * fy);
    } else if (el.x !== undefined) { el.x = px(el.x); el.y = py(el.y); }
    // senza proporzioni bloccate segue i due assi, se no il fattore minore
    const free = el.keep === false;
    switch (el.type) {
      case 'text':
        el.size = r2(Math.min(60, Math.max(1, el.size * (free ? fy : s)))); el.spacing = r2(el.spacing * (free ? fy : s)); el.stroke = r2(el.stroke * s);
        if (free) el.sx = r2((el.sx || 1) * fx / fy);
        break;
      case 'image': el.w = r2(Math.max(2, el.w * (free ? fx : s))); if (el.h) el.h = r2(Math.max(2, el.h * (free ? fy : s))); break;
      case 'frame': el.thick = r2(Math.max(0.4, el.thick * s)); el.radius = r2(el.radius * s); break;
      case 'pattern': el.period = r2(Math.max(1.5, el.period * s)); el.thick = r2(Math.max(0.4, el.thick * s)); break;
    }
  }
}

export const FONTS = [
  { id: 'playfair', name: 'Playfair Display (serif elegante)', file: 'fonts/playfair-display-700.woff' },
  { id: 'montserrat-700', name: 'Montserrat Bold', file: 'fonts/montserrat-700.woff' },
  { id: 'montserrat-400', name: 'Montserrat Regular (sottile)', file: 'fonts/montserrat-400.woff' },
  { id: 'cinzel', name: 'Cinzel (capitali romane)', file: 'fonts/cinzel-700.woff' },
  { id: 'roboto-slab', name: 'Roboto Slab Bold', file: 'fonts/roboto-slab-700.woff' },
  { id: 'oswald', name: 'Oswald Bold (stretto)', file: 'fonts/oswald-700.woff' },
  { id: 'bebas', name: 'Bebas Neue (alto)', file: 'fonts/bebas-neue.woff' },
  { id: 'great-vibes', name: 'Great Vibes (corsivo)', file: 'fonts/great-vibes.woff' },
  { id: 'pacifico', name: 'Pacifico (corsivo tondo)', file: 'fonts/pacifico.woff' },
  { id: 'lobster', name: 'Lobster', file: 'fonts/lobster.woff' },
];
const family = (id) => `emb-${id}`;
const fontReady = new Map();

export function loadFont(id) {
  if (fontReady.has(id)) return fontReady.get(id);
  const f = FONTS.find((x) => x.id === id);
  if (!f) return Promise.resolve(false);
  const p = new FontFace(family(id), `url(${f.file})`).load().then((ff) => { document.fonts.add(ff); return true; });
  fontReady.set(id, p);
  return p;
}

// font caricato dall'utente: resta per la sessione
export async function addCustomFont(file) {
  const id = 'custom-' + Date.now().toString(36);
  const ff = await new FontFace(family(id), await file.arrayBuffer()).load();
  document.fonts.add(ff);
  FONTS.push({ id, name: `Caricato: ${file.name}`, custom: true });
  fontReady.set(id, Promise.resolve(true));
  return id;
}

const capCache = new Map();
function capRatio(ctx, fam) {
  if (capCache.has(fam)) return capCache.get(fam);
  ctx.save();
  ctx.font = `100px "${fam}"`;
  const m = ctx.measureText('H');
  ctx.restore();
  const r = m.actualBoundingBoxAscent > 1 ? m.actualBoundingBoxAscent / 100 : 0.7;
  if (document.fonts.check(`100px "${fam}"`)) capCache.set(fam, r);
  return r;
}

// ------------------------------------------------------------------ elementi
const r2 = (n) => Math.round(n * 100) / 100;
let uid = 0;
export const newId = () => `e${Date.now().toString(36)}${(uid++).toString(36)}`;

export const PATTERNS = [
  ['pois', 'Pois'],
  ['righe', 'Righe'],
  ['griglia', 'Griglia'],
  ['quadri', 'Scacchiera'],
  ['esagoni', 'Nido d\'ape'],
  ['onde', 'Onde'],
  ['zigzag', 'Zigzag'],
  ['scaglie', 'Scaglie'],
  ['coriandoli', 'Coriandoli'],
];

export function newElement(type) {
  const A = area();
  const cx = r2(A.x + A.w / 2), cy = r2(A.y + A.h / 2);
  const base = { id: newId(), type, op: 'add', visible: true };
  switch (type) {
    // keep = proporzioni bloccate; sx = allargamento orizzontale del testo (solo con keep spento)
    case 'text': return { ...base, text: t('Il tuo nome'), font: 'playfair', size: 4.5, spacing: 0.3, lineH: 1.5, align: 'center', style: 'fill', stroke: 0.8, x: cx, y: cy, rot: 0, keep: true, sx: 1 };
    case 'pattern': return { ...base, kind: 'pois', period: 4, thick: 1.4, angle: 45, area: 'all', x: r2(A.x + 4), y: r2(A.y + 4), w: 20, h: 14, seed: 1 };
    // h vale solo con keep spento; con keep acceso l'altezza viene dalle proporzioni del file
    case 'image': return { ...base, src: null, name: '', threshold: 128, invert: false, w: Math.min(20, A.w - 4), h: 0, x: cx, y: cy, rot: 0, keep: true };
    case 'frame': return { ...base, style: 'line', x: r2(A.x + 1), y: r2(A.y + 1), w: r2(A.w - 2), h: r2(A.h - 2), radius: 3, thick: 0.9 };
    default: throw new Error('tipo sconosciuto ' + type);
  }
}

export function defaultDesign() {
  // cornice a 4 mm dal bordo, testi nella parte interna
  const A = { x: 4, y: 4, w: PLATE.L - 8, h: PLATE.W - 8 };
  const frame = { ...newElement('frame'), style: 'double', thick: 0.9, x: 4, y: 4, w: A.w, h: A.h };
  const top = { ...newElement('text'), text: 'EX LIBRIS', font: 'montserrat-700', size: 3.4, spacing: 1, y: r2(A.y + A.h * 0.3) };
  const name = { ...newElement('text'), font: 'roboto-slab', size: 5, spacing: 0.4, y: r2(A.y + A.h * 0.62) };
  return [frame, top, name];
}

export function label(el) {
  switch (el.type) {
    case 'text': return (el.text || '').split('\n')[0].slice(0, 24) || 'Testo vuoto';
    case 'pattern': return (PATTERNS.find((p) => p[0] === el.kind) || [, 'Motivo'])[1];
    case 'image': return el.name || 'Immagine';
    case 'frame': return 'Cornice';
  }
  return el.type;
}

// ------------------------------------------------------------------ immagini (soglia -> maschera)
const imgCache = new Map(); // id -> { src, img, key, canvas }

export function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('immagine non leggibile')); im.src = src; });
}

async function imageMask(el) {
  let c = imgCache.get(el.id);
  if (!c || c.src !== el.src) {
    c = { src: el.src, img: await loadImage(el.src), key: '', canvas: null };
    imgCache.set(el.id, c);
  }
  const key = `${el.threshold}|${el.invert}`;
  if (c.key !== key) {
    const im = c.img;
    const k = Math.min(1, 1200 / Math.max(im.naturalWidth || 1, im.naturalHeight || 1));
    const w = Math.max(1, Math.round((im.naturalWidth || 300) * k)), h = Math.max(1, Math.round((im.naturalHeight || 300) * k));
    const cv = c.canvas || document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, w, h);
    x.drawImage(im, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const lum = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
      const opaque = a[i + 3] >= 128;
      let on = opaque && lum < el.threshold;   // scuro e pieno = rilievo
      if (el.invert) on = !on;
      a[i] = a[i + 1] = a[i + 2] = 0; a[i + 3] = on ? 255 : 0;
    }
    x.putImageData(d, 0, 0);
    c.canvas = cv; c.key = key;
  }
  return c.canvas;
}

export async function prepareImages(els) {
  for (const el of els) if (el.type === 'image' && el.src) {
    try { await imageMask(el); } catch { /* immagine rotta: la salto */ }
  }
}
export function dropImageCache(id) { imgCache.delete(id); }

// ------------------------------------------------------------------ motivi
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function patternRect(el) {
  if (el.area !== 'rect') return { ...area(), all: true };
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}

// Come si modifica un elemento sulla piastra:
//  scale  -> trascina per spostare (x, y), angoli = ingrandisci (o deforma se keep è spento), pallino = ruota
//  rect   -> trascina per spostare, angoli = cambia larghezza/altezza (chiavi indicate)
//  null   -> occupa tutta la piastra: si modifica dal pannello
export function editMode(el) {
  if (el.type === 'frame') return { rect: ['x', 'y', 'w', 'h'] };
  if (el.type === 'pattern') return el.area === 'rect' ? { rect: ['x', 'y', 'w', 'h'] } : null;
  return { scale: true };
}

function drawLines(ctx, R, p, t, deg) {
  const a = (deg * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a);
  const n = [-s, c];
  const corners = [[R.x, R.y], [R.x + R.w, R.y], [R.x, R.y + R.h], [R.x + R.w, R.y + R.h]];
  const proj = corners.map(([x, y]) => x * n[0] + y * n[1]);
  const diag = Math.hypot(R.w, R.h) + 10;
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
  ctx.lineWidth = t; ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let k = Math.floor(Math.min(...proj) / p) - 1; k <= Math.ceil(Math.max(...proj) / p) + 1; k++) {
    // punto della retta k più vicino al centro del riquadro
    const off = k * p - (cx * n[0] + cy * n[1]);
    const px = cx + n[0] * off, py = cy + n[1] * off;
    ctx.moveTo(px - c * diag, py - s * diag);
    ctx.lineTo(px + c * diag, py + s * diag);
  }
  ctx.stroke();
}

function drawPattern(ctx, el) {
  const R = patternRect(el);
  const p = Math.max(1, el.period), t = Math.max(0.2, el.thick);
  ctx.save();
  ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  const px = p;
  const x0 = R.x;
  const nx = Math.ceil(R.w / px) + 2;
  switch (el.kind) {
    case 'righe': drawLines(ctx, R, p, t, el.angle); break;
    case 'griglia': drawLines(ctx, R, p, t, el.angle); drawLines(ctx, R, p, t, el.angle + 90); break;
    case 'pois': {
      const py = (px * Math.sqrt(3)) / 2;
      ctx.beginPath();
      for (let j = 0, y = R.y + py / 2; y < R.y + R.h + py; j++, y += py) {
        for (let i = -1; i < nx; i++) {
          const x = x0 + i * px + (j % 2 ? px / 2 : 0);
          ctx.moveTo(x + t / 2, y); ctx.arc(x, y, t / 2, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      break;
    }
    case 'quadri': {
      const q = px / 2;
      for (let j = 0, y = R.y; y < R.y + R.h; j++, y += q) {
        for (let i = -2; i < 2 * nx; i++) if ((i + j) % 2 === 0) ctx.fillRect(x0 + i * q, y, q, q);
      }
      break;
    }
    case 'esagoni': {
      const r = px / Math.sqrt(3), dy = 1.5 * r;
      ctx.lineWidth = t; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let j = 0, y = R.y; y < R.y + R.h + r; j++, y += dy) {
        for (let i = -1; i < nx; i++) {
          const cx = x0 + i * px + (j % 2 ? px / 2 : 0);
          for (let k = 0; k <= 6; k++) {
            const a = (Math.PI / 3) * k + Math.PI / 6;
            const X = cx + r * Math.cos(a), Y = y + r * Math.sin(a);
            if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
          }
        }
      }
      ctx.stroke();
      break;
    }
    case 'onde':
    case 'zigzag': {
      const amp = p * (el.kind === 'onde' ? 0.22 : 0.28), dy = p * 0.75;
      ctx.lineWidth = t; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let y = R.y + dy / 2; y < R.y + R.h + dy; y += dy) {
        const xa = x0 - px, xb = x0 + nx * px;
        if (el.kind === 'onde') {
          const st = px / 24;
          for (let x = xa; x <= xb; x += st) {
            const Y = y + amp * Math.sin(((x - x0) / px) * Math.PI * 2);
            if (x === xa) ctx.moveTo(x, Y); else ctx.lineTo(x, Y);
          }
        } else {
          for (let i = -1, x = xa; x <= xb; i++, x += px / 2) {
            const Y = y + (i % 2 ? amp : -amp);
            if (x === xa) ctx.moveTo(x, Y); else ctx.lineTo(x, Y);
          }
        }
      }
      ctx.stroke();
      break;
    }
    case 'scaglie': {
      const r = px / 2;
      ctx.lineWidth = t;
      ctx.beginPath();
      for (let j = 0, y = R.y; y < R.y + R.h + r; j++, y += r) {
        for (let i = -1; i < nx; i++) {
          const cx = x0 + i * px + (j % 2 ? r : 0);
          ctx.moveTo(cx + r, y); ctx.arc(cx, y, r, 0, Math.PI);
        }
      }
      ctx.stroke();
      break;
    }
    case 'coriandoli': {
      const rand = rng(el.seed || 1);
      const n = Math.round((R.w * R.h) / (p * p));
      for (let i = 0; i < n; i++) {
        const x = R.x + rand() * R.w, y = R.y + rand() * R.h, kind = Math.floor(rand() * 4), ang = rand() * Math.PI;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.beginPath();
        if (kind === 0) ctx.arc(0, 0, t / 2, 0, Math.PI * 2);
        else if (kind === 1) ctx.rect(-t / 2, -t / 2, t, t);
        else if (kind === 2) { ctx.moveTo(0, -t * 0.6); ctx.lineTo(t * 0.55, t * 0.4); ctx.lineTo(-t * 0.55, t * 0.4); ctx.closePath(); }
        else ctx.rect(-t, -t / 4, 2 * t, t / 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ testo, immagine, cornice
// Il testo si disegna a scala TK (font da decine di px invece che da pochi "mm"): alcuni browser
// rasterizzano i glifi alla dimensione nominale e poi li ingrandiscono, sgranandoli.
const TK = 10;

// imposta font e spaziatura su ctx (in unità ×TK) e misura; le misure tornano in mm
function textMetrics(ctx, el) {
  const fam = family(el.font);
  const cap = capRatio(ctx, fam);
  const fpx = el.size / cap;
  ctx.font = `${fpx * TK}px "${fam}"`;
  try { ctx.letterSpacing = `${el.spacing * TK}px`; } catch { /* browser senza letterSpacing */ }
  const lines = String(el.text || '').split('\n');
  const lh = fpx * el.lineH * 0.8;
  const widths = lines.map((l) => ctx.measureText(l).width / TK);
  return { fpx, lines, lh, widths, w: Math.max(0, ...widths), h: el.size + (lines.length - 1) * lh };
}

// allargamento orizzontale del testo (solo con le proporzioni sbloccate)
const stretch = (el) => (el.keep === false ? el.sx || 1 : 1);

function drawText(ctx, el) {
  const m = textMetrics(ctx, el);
  ctx.scale(stretch(el) / TK, 1 / TK);
  ctx.textAlign = el.align === 'left' ? 'left' : el.align === 'right' ? 'right' : 'center';
  ctx.textBaseline = 'alphabetic';
  const ax = el.align === 'left' ? -m.w / 2 : el.align === 'right' ? m.w / 2 : 0;
  ctx.lineJoin = 'round';
  ctx.lineWidth = el.stroke * TK;
  m.lines.forEach((line, i) => {
    const y = -m.h / 2 + el.size + i * m.lh;
    if (el.style === 'outline') ctx.strokeText(line, ax * TK, y * TK);
    else ctx.fillText(line, ax * TK, y * TK);
  });
}

function imgSize(el) {
  const c = imgCache.get(el.id);
  if (!c || !c.canvas) return null;
  const h = el.keep === false && el.h > 0 ? el.h : (el.w * c.canvas.height) / c.canvas.width;
  return { w: el.w, h, canvas: c.canvas };
}
// altezza naturale dell'immagine alla larghezza attuale (serve quando si sbloccano le proporzioni)
export function imageNaturalH(el) {
  const c = imgCache.get(el.id);
  return c && c.canvas ? r2((el.w * c.canvas.height) / c.canvas.width) : el.w;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrame(ctx, el) {
  const t = el.thick;
  ctx.lineWidth = t; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const { x, y, w, h, radius } = el;
  if (el.style === 'corners') {
    const L = Math.min(w, h) * 0.22, r = Math.min(radius, L * 0.8);
    ctx.beginPath();
    const corner = (cx, cy, sx, sy) => {
      ctx.moveTo(cx + sx * L, cy);
      ctx.arcTo(cx, cy, cx, cy + sy * L, r);
      ctx.lineTo(cx, cy + sy * L);
    };
    corner(x, y, 1, 1); corner(x + w, y, -1, 1); corner(x, y + h, 1, -1); corner(x + w, y + h, -1, -1);
    ctx.stroke();
    return;
  }
  if (el.style === 'ellipse') {
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  if (el.style === 'dashed') ctx.setLineDash([3 * t, 2.2 * t]);
  ctx.beginPath(); roundRect(ctx, x, y, w, h, radius); ctx.stroke();
  if (el.style === 'double') {
    const g = 1.6 * t + 0.6;
    ctx.beginPath(); roundRect(ctx, x + g, y + g, w - 2 * g, h - 2 * g, Math.max(0, radius - g)); ctx.stroke();
  }
  ctx.setLineDash([]);
}

// Riquadro (in mm, ruotato) per selezione e trascinamento
export function bounds(ctx, el) {
  switch (el.type) {
    case 'text': { ctx.save(); const m = textMetrics(ctx, el); ctx.restore(); return { cx: el.x, cy: el.y, w: m.w * stretch(el) + 1, h: m.h + 1, rot: el.rot }; }
    case 'image': { const s = imgSize(el); return s ? { cx: el.x, cy: el.y, w: s.w, h: s.h, rot: el.rot } : { cx: el.x, cy: el.y, w: el.w, h: el.w, rot: el.rot }; }
    case 'frame': return { cx: el.x + el.w / 2, cy: el.y + el.h / 2, w: el.w + el.thick, h: el.h + el.thick, rot: 0 };
    case 'pattern': { const R = patternRect(el); return { cx: R.x + R.w / 2, cy: R.y + R.h / 2, w: R.w, h: R.h, rot: 0, fixed: el.area !== 'rect' }; }
  }
  return null;
}

// spostamento di un elemento trascinato (dx, dy in mm)
// start: copia dei valori all'inizio del trascinamento
export function moveBy(el, start, dx, dy) {
  el.x = r2(start.x + dx);
  el.y = r2(start.y + dy);
}

// sposta tutto il disegno (quando cambia la misura della piastra resta centrato)
export function shiftAll(els, dx, dy) {
  for (const el of els) if (el.x !== undefined) { el.x = r2(el.x + dx); el.y = r2(el.y + dy); }
}

// Ingrandimento attorno al centro (testo e immagine): fx, fy = fattori rispetto a start lungo gli assi
// dell'elemento. Con le proporzioni bloccate conta solo la media dei due (fx = fy).
export function scaleBy(el, start, fx, fy = fx) {
  if (el.type === 'text') {
    el.size = r2(Math.min(60, Math.max(1, start.size * fy)));
    el.spacing = r2(start.spacing * (el.size / start.size));
    if (el.keep === false) el.sx = r2(Math.min(5, Math.max(0.2, (start.sx || 1) * fx / (el.size / start.size))));
  } else if (el.type === 'image') {
    el.w = r2(Math.min(120, Math.max(2, start.w * fx)));
    if (el.keep === false) el.h = r2(Math.min(100, Math.max(2, (start.h > 0 ? start.h : imageNaturalH(start)) * fy)));
  }
}

// Porta l'elemento (testo o immagine) a riempire il riquadro R e lo centra:
// fill = false tiene le proporzioni (la misura massima che entra), true lo deforma per occuparlo tutto.
export function fitTo(ctx, el, R, fill) {
  const f0 = 0.98; // un filo di aria: i contorni misurati sono approssimati
  if (fill) {
    el.rot = 0; el.keep = false;
    if (el.type === 'image') { el.w = r2(R.w * f0); el.h = r2(R.h * f0); }
    else {
      el.sx = 1;
      const b = bounds(ctx, el);
      el.size = r2(el.size * (R.h * f0 - 1) / Math.max(0.5, b.h - 1));
      el.spacing = r2(el.spacing * (R.h * f0 - 1) / Math.max(0.5, b.h - 1));
      const b2 = bounds(ctx, el);
      const sx = (R.w * f0 - 1) / Math.max(0.5, b2.w - 1);
      // oltre 0,5×–2× le lettere diventano illeggibili: allargo al massimo consentito e
      // se il testo è troppo lungo lo rimpicciolisco finché sta in larghezza
      el.sx = r2(Math.min(2, Math.max(0.5, sx)));
      if (sx < 0.5) { const k = sx / 0.5; el.size = r2(el.size * k); el.spacing = r2(el.spacing * k); }
    }
  } else {
    if (el.type === 'image' && el.keep === false && !(el.h > 0)) el.h = imageNaturalH(el);
    const b = bounds(ctx, el);
    const a = ((b.rot || 0) * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const bw = c * b.w + s * b.h, bh = s * b.w + c * b.h;
    const k = Math.min((R.w * f0) / bw, (R.h * f0) / bh);
    scaleBy(el, { ...el }, k);
  }
  el.x = r2(R.x + R.w / 2); el.y = r2(R.y + R.h / 2);
}

// Ridimensionamento di un riquadro trascinando un angolo (sx, sy = -1/+1 quale angolo)
export function resizeRect(el, start, keys, sx, sy, dx, dy) {
  const [kx, ky, kw, kh] = keys;
  const minS = 4;
  let x = start[kx], y = start[ky], w = start[kw], h = start[kh];
  if (sx > 0) w = Math.max(minS, w + dx); else { const nw = Math.max(minS, w - dx); x += w - nw; w = nw; }
  if (sy > 0) h = Math.max(minS, h + dy); else { const nh = Math.max(minS, h - dy); y += h - nh; h = nh; }
  Object.assign(el, { [kx]: r2(x), [ky]: r2(y), [kw]: r2(w), [kh]: r2(h) });
}

function drawOne(ctx, el) {
  switch (el.type) {
    case 'text': drawText(ctx, el); break;
    case 'image': { const s = imgSize(el); if (s) ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h); break; }
    case 'frame': drawFrame(ctx, el); break;
  }
}

// Disegna tutta la piastra: ctx già scalato in mm (1 unità = 1 mm), sfondo trasparente.
// clip = true taglia alla zona stampabile (maschera vera); false lascia vedere anche quello che esce.
export function renderDesign(ctx, els, clip = true) {
  ctx.save();
  if (clip) {
    const A = printRegion();
    ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
    // distanziali: un buco attorno a ciascuno (come nella geometria). Secondo ritaglio a parte:
    // con rettangolo e cerchi nello stesso percorso le parti dei cerchi fuori dal rettangolo entrerebbero
    if (PLATE.stops) {
      ctx.beginPath(); ctx.rect(-10, -10, PLATE.L + 20, PLATE.W + 20);
      for (const u of [STOP.d + 0.5, PLATE.L - STOP.d - 0.5]) for (const v of [STOP.d, PLATE.W - STOP.d]) {
        ctx.moveTo(u + STOP.r + STOP.keep, v); ctx.arc(u, v, STOP.r + STOP.keep, 0, Math.PI * 2);
      }
      ctx.clip('evenodd');
    }
  }
  for (const el of els) {
    if (!el.visible) continue;
    ctx.save();
    ctx.globalCompositeOperation = el.op === 'cut' ? 'destination-out' : 'source-over';
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    if (el.type === 'pattern') drawPattern(ctx, el);
    else {
      if (el.type !== 'frame') { ctx.translate(el.x, el.y); ctx.rotate(((el.rot || 0) * Math.PI) / 180); }
      drawOne(ctx, el);
    }
    ctx.restore();
  }
  ctx.restore();
}

// Maschera ad alta risoluzione: tutta la piastra, PXMM pixel per mm.
export function maskSize() {
  const W = Math.round(PLATE.L * PXMM), H = Math.round(PLATE.W * PXMM);
  return { W, H, sx: W / PLATE.L, sy: H / PLATE.W };
}

export function renderMask(canvas, els, clip = true) {
  const { W, H, sx, sy } = maskSize();
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  renderDesign(ctx, els, clip);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { W, H, sx, sy };
}

import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';
import {
  PLATE, setPlate, area, FONTS, PATTERNS, loadFont, addCustomFont, newElement, newId, defaultDesign, label,
  prepareImages, dropImageCache, bounds, moveBy, scaleBy, resizeRect, editMode, renderMask, maskSize, shiftAll,
  scaleDesign, printRegion, fitTo, imageNaturalH,
} from './design.js';
import { DEFAULTS, hingeDims } from './fustella.js';
import { toSTL, to3MF } from './export.js';
import { PRINT, bambuObjectSettings } from './print-settings.js';
import { embossImage } from './emboss.js';

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 1) => n.toFixed(d).replace('.', ',');
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ------------------------------------------------------------------ stato
const store = {
  get(k, d) { try { const v = localStorage.getItem('fustella.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fustella.' + k, JSON.stringify(v)); return true; } catch { return false; } },
};

let els = [];
let selId = null;
const sel = () => els.find((e) => e.id === selId) || null;

// parametri della fustella: campo -> [min, max]
const NUM = {
  L: [35, 120], W: [25, 100], T: [3.5, 8], margin: [0, 15], corner: [0.5, 15],
  relief: [0.3, 1.5], clearance: [0.1, 0.6], gap: [0.05, 0.5], tip: [0.05, 0.6], soften: [0, 0.25],
  hingeClr: [0.2, 0.5], axialGap: [0.25, 0.8], alignBackPos: [2, 114], alignSidePos: [2, 94],
};
const CHK = ['tab', 'stops', 'alignBack'];
function clampNum(v, a, b, d) { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; }
function readParams() {
  const p = {};
  for (const [k, [a, b]] of Object.entries(NUM)) p[k] = clampNum($(k).value, a, b, DEFAULTS[k]);
  for (const k of CHK) p[k] = $(k).checked;
  p.knuckles = +$('knuckles').value;
  p.alignSide = $('alignSide').value;
  p.mode = document.querySelector('input[name=mode]:checked').value;
  // il margine non può mangiarsi tutta la piastra
  p.margin = Math.min(p.margin, (Math.min(p.L, p.W) - 8) / 2);
  // l'allineatore deve stare sulla piastra
  p.alignBackPos = Math.min(p.alignBackPos, p.L - 6);
  p.alignSidePos = Math.min(p.alignSidePos, p.W - 6);
  return p;
}
// allineatori nel formato del modulo del disegno: distanza del bordo del foglio dal bordo piastra
function guidesOf(p) {
  return {
    back: p.alignBack ? p.alignBackPos : null,
    top: p.alignSide === 'top' ? p.alignSidePos : null,
    bottom: p.alignSide === 'bottom' ? p.alignSidePos : null,
  };
}
function applyParams(p) {
  const q = { ...DEFAULTS, ...(p || {}) };
  for (const k of Object.keys(NUM)) $(k).value = q[k];
  for (const k of CHK) $(k).checked = !!q[k];
  $('knuckles').value = String(q.knuckles);
  $('alignSide').value = q.alignSide;
  const r = document.querySelector(`input[name=mode][value="${q.mode}"]`);
  if (r) r.checked = true;
  syncPlate();
}
// misure della piastra -> modulo del disegno
function syncPlate() {
  const p = readParams();
  setPlate(p.L, p.W, p.margin, guidesOf(p));
  $('alignBackPosWrap').style.visibility = p.alignBack ? '' : 'hidden';
  $('alignSidePosWrap').style.visibility = p.alignSide !== 'none' ? '' : 'hidden';
  $('plateSize').textContent = `${fmt(p.L, 0)} × ${fmt(p.W, 0)} mm, cerniera a sinistra · clic per selezionare, trascina per spostare`;
  $('modeHint').textContent = p.mode === 'deboss'
    ? 'Il disegno resta inciso sul lato del foglio che guardi dall\'alto (lo stampo in rilievo è sulla metà di sopra).'
    : 'Il disegno esce in rilievo sul lato del foglio che guardi dall\'alto (lo stampo in rilievo è sulla metà di sotto).';
}
// gradi in (-180, 180]
const normDeg = (a) => { const r = ((Math.round(a) % 360) + 360) % 360; return r > 180 ? r - 360 : r; };

function save() {
  if (!store.set('design', els)) store.set('design', els.map((e) => (e.type === 'image' ? { ...e, src: null } : e)));
  store.set('params', readParams());
}

// ------------------------------------------------------------------ schema delle proprietà
// Voci dello schema: un campo, una riga di campi (array) o un gruppo chiudibile { group, items, show }.
// Posizione e misure si cambiano soprattutto trascinando sulla piastra: nel pannello stanno in gruppi chiusi.
const OP = { key: 'op', label: 'Effetto', type: 'seg', options: [['add', 'In rilievo'], ['cut', 'Sottrai']] };
const isMulti = (e) => String(e.text).includes('\n');
const AREA = [['all', 'Tutta l\'area utile'], ['rect', 'Riquadro']];
const free = (e) => e.keep === false;
// misure: bottoni per adattare all'area e check delle proporzioni (testo e immagine)
const FIT = { key: 'fit', type: 'fit' };
const KEEP = { key: 'keep', label: 'Mantieni proporzioni (spento: gli angoli deformano)', type: 'checkbox' };
const POS = {
  group: 'Posizione', items: [
    [{ key: 'x', label: 'Orizzontale', type: 'number', unit: 'mm', step: 0.5 }, { key: 'y', label: 'Verticale', type: 'number', unit: 'mm', step: 0.5 }],
    { key: 'center', type: 'center' },
  ],
};// rotazione sempre in vista: campo in gradi + scatti rapidi (per il motivo vale per ogni copia)
const ROT = { key: 'rot', label: 'Rotazione', type: 'rotation' };
const SCHEMA = {
  text: [
    { key: 'text', label: 'Testo (Invio per andare a capo)', type: 'textarea' },
    { key: 'font', label: 'Font', type: 'font' },
    [{ key: 'size', label: 'Altezza maiuscole', type: 'number', unit: 'mm', min: 1, max: 60, step: 0.25 },
      { key: 'spacing', label: 'Spaziatura lettere', type: 'number', unit: 'mm', min: -2, max: 8, step: 0.1 }],
    FIT, KEEP,
    { key: 'sx', label: 'Allargamento orizzontale', type: 'number', unit: '×', min: 0.2, max: 5, step: 0.05, show: free },
    ROT, OP,
    { group: 'Stile e righe', items: [
      [{ key: 'style', label: 'Stile', type: 'select', options: [['fill', 'Pieno'], ['outline', 'Solo contorno']] },
        { key: 'stroke', label: 'Spessore contorno', type: 'number', unit: 'mm', min: 0.3, max: 3, step: 0.1, show: (e) => e.style === 'outline' }],
      [{ key: 'align', label: 'Allineamento righe', type: 'select', options: [['left', 'Sinistra'], ['center', 'Centro'], ['right', 'Destra']], show: isMulti },
        { key: 'lineH', label: 'Interlinea', type: 'number', min: 0.8, max: 3, step: 0.05, show: isMulti }],
    ] },
    POS,
  ],
  pattern: [
    { key: 'kind', label: 'Motivo', type: 'select', options: PATTERNS },
    [{ key: 'period', label: 'Passo', type: 'number', unit: 'mm', min: 1.5, max: 40, step: 0.5 },
      { key: 'thick', label: 'Spessore / dimensione', type: 'number', unit: 'mm', min: 0.4, max: 15, step: 0.1 }],
    [{ key: 'angle', label: 'Angolo', type: 'number', unit: '°', step: 5, show: (e) => e.kind === 'righe' || e.kind === 'griglia' },
      { key: 'seed', label: 'Variante casuale', type: 'number', min: 1, max: 9999, step: 1, show: (e) => e.kind === 'coriandoli' }],
    { key: 'area', label: 'Dove', type: 'select', options: AREA },
    OP,
  ],
  image: [
    { key: 'src', label: 'File', type: 'image' },
    { key: 'threshold', label: 'Soglia (più alta = più scuri inclusi)', type: 'range', min: 1, max: 254, step: 1 },
    { key: 'invert', label: 'Inverti chiari/scuri', type: 'checkbox' },
    FIT, KEEP,
    [{ key: 'w', label: 'Larghezza', type: 'number', unit: 'mm', min: 2, max: 120, step: 0.5 },
      { key: 'h', label: 'Altezza', type: 'number', unit: 'mm', min: 2, max: 100, step: 0.5, show: free }],
    ROT, OP,
    POS,
  ],
  frame: [
    { key: 'style', label: 'Stile', type: 'select', options: [['line', 'Linea'], ['double', 'Doppia'], ['dashed', 'Tratteggio'], ['corners', 'Solo angoli'], ['ellipse', 'Ovale']] },
    [{ key: 'radius', label: 'Raggio angoli', type: 'number', unit: 'mm', min: 0, max: 20, step: 0.5, show: (e) => e.style !== 'ellipse' }, { key: 'thick', label: 'Spessore', type: 'number', unit: 'mm', min: 0.4, max: 5, step: 0.1 }],
    OP,
    { group: 'Posizione e misure', items: [
      [{ key: 'x', label: 'Sinistra', type: 'number', unit: 'mm', step: 0.5 }, { key: 'y', label: 'Alto', type: 'number', unit: 'mm', step: 0.5 }],
      [{ key: 'w', label: 'Larghezza', type: 'number', unit: 'mm', min: 4, max: 100, step: 0.5 }, { key: 'h', label: 'Altezza', type: 'number', unit: 'mm', min: 4, max: 80, step: 0.5 }],
    ] },
  ],
};
const TYPE_NAME = { text: 'Testo', pattern: 'Motivo', image: 'Immagine', frame: 'Cornice' };

let formFields = []; // { f, wrap, input }

let fieldSeq = 0;
function fieldHtml(f, el) {
  const id = `p_${f.key}_${fieldSeq++}`;
  const unit = f.unit ? ` <span class="unit">${f.unit}</span>` : '';
  const v = el[f.key];
  switch (f.type) {
    case 'textarea': return `<label>${f.label}<textarea id="${id}" data-key="${f.key}" rows="2">${escapeHtml(v)}</textarea></label>`;
    case 'number': return `<label>${f.label}${unit}<input id="${id}" data-key="${f.key}" type="number" step="${f.step ?? 'any'}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} value="${v}"></label>`;
    case 'select': return `<label>${f.label}<select id="${id}" data-key="${f.key}">${f.options.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>`;
    case 'font': return `<label>${f.label}<select id="${id}" data-key="${f.key}">${FONTS.map((x) => `<option value="${x.id}"${x.id === v ? ' selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}<option value="__upload">Carica un font (TTF, OTF, WOFF)…</option></select></label>`;
    case 'range': return `<label>${f.label} <span class="unit" data-out="${f.key}">${v}</span><input id="${id}" data-key="${f.key}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}"></label>`;
    case 'rotation': return `<label>${f.label} <span class="unit">° (pallino sopra la selezione)</span></label><div class="rotrow"><input id="${id}" data-key="rot" type="number" step="1" min="-180" max="180" value="${v || 0}" aria-label="Rotazione in gradi"><button type="button" data-rot="-15">−15°</button><button type="button" data-rot="0">0°</button><button type="button" data-rot="15">+15°</button><button type="button" data-rot="90">+90°</button></div>`;
    case 'fit': return '<div class="row"><button type="button" data-fit="contain" title="La misura più grande che entra, senza deformare">Adatta all\'area</button><button type="button" data-fit="fill" title="Lo stira fino a coprire tutta l\'area">Riempi tutta l\'area</button></div>';
    case 'center': return '<div class="row"><button type="button" data-center="h">Centra in orizzontale</button><button type="button" data-center="v">Centra in verticale</button></div>';
    case 'checkbox': return `<label class="chk opt"><input id="${id}" data-key="${f.key}" type="checkbox"${v ? ' checked' : ''}> ${f.label}</label>`;
    case 'seg': return `<div class="seg" data-wrap="${f.key}">${f.options.map(([k, t]) => `<label><input type="radio" name="${id}" data-key="${f.key}" value="${k}"${k === v ? ' checked' : ''}> ${t}</label>`).join('')}</div>`;
    case 'image': return `<div class="row"><button type="button" id="pickImage">${el.src ? 'Cambia immagine…' : 'Scegli immagine…'}</button><span class="hint" style="align-self:center">${escapeHtml(el.name || 'nessun file')}</span></div><p class="hint">PNG, JPG o SVG. Va bene un logo nero su bianco: si può anche trascinare il file sulla piastra.</p>`;
  }
  return '';
}

function renderProps() {
  const el = sel();
  const box = $('props');
  formFields = [];
  if (!el) { box.innerHTML = ''; return; }
  const hint = editMode(el)?.scale
    ? 'Sulla piastra: trascina per spostare, angoli per ingrandire, pallino per ruotare. Si aggancia alle guide: tieni Alt per muoverlo libero.'
    : editMode(el)?.rect ? 'Sulla piastra: trascina per spostare, angoli per cambiare le misure. Tieni Alt per non agganciarti alle guide.' : '';
  const parts = [`<p class="ptitle">${TYPE_NAME[el.type]}${hint ? ` <span class="muted">${hint}</span>` : ''}</p>`];
  let n = 0;
  const uid = () => `w${n++}`;
  const flat = [];
  const one = (f) => { const w = uid(); flat.push({ f, w }); return `<div data-w="${w}">${fieldHtml(f, el)}</div>`; };
  const emit = (item) => {
    if (Array.isArray(item)) return `<div class="row">${item.map(one).join('')}</div>`;
    if (item.group) {
      const w = uid();
      flat.push({ f: { show: item.show }, w });
      return `<details data-w="${w}"><summary>${item.group}</summary>${item.items.map(emit).join('')}</details>`;
    }
    return one(item);
  };
  for (const item of SCHEMA[el.type]) parts.push(emit(item));
  box.innerHTML = parts.join('');
  for (const { f, w } of flat) formFields.push({ f, wrap: box.querySelector(`[data-w="${w}"]`) });
  updateVisibility();

  for (const input of box.querySelectorAll('[data-key]')) {
    const ev = input.tagName === 'SELECT' || input.type === 'checkbox' || input.type === 'radio' ? 'change' : 'input';
    input.addEventListener(ev, () => onField(el, input));
  }
  $('pickImage')?.addEventListener('click', () => $('imageFile').click());
  for (const bt of box.querySelectorAll('[data-rot]')) {
    bt.addEventListener('click', () => {
      const d = +bt.dataset.rot;
      el.rot = d === 0 ? 0 : normDeg((el.rot || 0) + d);
      syncForm(); changed();
    });
  }
  // adatta / riempi la zona dove si imprime (area utile, ristretta al foglio se ci sono allineatori)
  for (const bt of box.querySelectorAll('[data-fit]')) {
    bt.addEventListener('click', () => {
      fitTo(maskCanvas.getContext('2d'), el, printRegion(), bt.dataset.fit === 'fill');
      renderProps(); changed();
    });
  }
  // centro dell'area utile
  box.querySelector('[data-center=h]')?.addEventListener('click', () => { const A = area(); el.x = +(A.x + A.w / 2).toFixed(2); syncForm(); changed(); });
  box.querySelector('[data-center=v]')?.addEventListener('click', () => { const A = area(); el.y = +(A.y + A.h / 2).toFixed(2); syncForm(); changed(); });
}

function updateVisibility() {
  const el = sel();
  for (const { f, wrap } of formFields) if (wrap) wrap.hidden = !!(f.show && !f.show(el));
}

async function onField(el, input) {
  const key = input.dataset.key;
  const f = formFields.find((x) => x.f.key === key)?.f;
  let v;
  if (input.type === 'checkbox') v = input.checked;
  else if (input.type === 'radio') { if (!input.checked) return; v = input.value; }
  else if (f && (f.type === 'number' || f.type === 'range' || f.type === 'rotation')) {
    v = parseFloat(String(input.value).replace(',', '.'));
    if (!Number.isFinite(v)) return;
    if (f.min != null) v = Math.max(f.min, v);
    if (f.max != null) v = Math.min(f.max, v);
    if (f.type === 'range') { const o = $('props').querySelector(`[data-out="${key}"]`); if (o) o.textContent = v; }
  } else v = input.value;
  if (key === 'font' && v === '__upload') { input.value = el.font; $('fontFile').click(); return; }
  // proporzioni sbloccate: si parte dalla misura attuale (altezza vera dell'immagine, testo non allargato)
  if (key === 'keep' && !v) {
    if (el.type === 'image') el.h = imageNaturalH(el);
    if (el.type === 'text') el.sx = el.sx || 1;
  }
  el[key] = v;
  if (key === 'area' || key === 'keep') { renderProps(); renderLayers(); changed(); return; }
  updateVisibility();
  renderLayers();
  changed();
}

// aggiorna i campi del modulo dopo un trascinamento (senza ricostruirlo)
function syncForm() {
  const el = sel();
  if (!el) return;
  for (const input of $('props').querySelectorAll('[data-key]')) {
    if (input === document.activeElement || input.type === 'radio' || input.type === 'checkbox') continue;
    const v = el[input.dataset.key];
    if (v !== undefined && String(input.value) !== String(v)) input.value = v;
  }
}

// ------------------------------------------------------------------ lista elementi
function renderLayers() {
  const ul = $('layers');
  if (!els.length) { ul.innerHTML = '<li class="empty">Nessun elemento: aggiungine uno.</li>'; return; }
  ul.innerHTML = [...els].reverse().map((e) => `
    <li data-id="${e.id}" class="${e.id === selId ? 'sel' : ''} ${e.visible ? '' : 'off'}">
      <span class="ty">${TYPE_NAME[e.type]}</span>
      <span class="nm">${escapeHtml(label(e))}</span>
      ${e.op === 'cut' ? '<span class="cut">sottrai</span>' : ''}
      <button type="button" data-act="vis" title="${e.visible ? 'Nascondi' : 'Mostra'}">${e.visible ? '◉' : '○'}</button>
      <button type="button" data-act="up" title="Porta sopra">↑</button>
      <button type="button" data-act="down" title="Porta sotto">↓</button>
      <button type="button" data-act="dup" title="Duplica">⧉</button>
      <button type="button" data-act="del" title="Elimina">✕</button>
    </li>`).join('');
}

$('layers').addEventListener('click', (ev) => {
  const li = ev.target.closest('li[data-id]');
  if (!li) return;
  const i = els.findIndex((e) => e.id === li.dataset.id);
  const el = els[i];
  const act = ev.target.closest('button')?.dataset.act;
  if (!act) { select(el.id); return; }
  if (act === 'vis') el.visible = !el.visible;
  if (act === 'up' && i < els.length - 1) [els[i], els[i + 1]] = [els[i + 1], els[i]];
  if (act === 'down' && i > 0) [els[i], els[i - 1]] = [els[i - 1], els[i]];
  if (act === 'dup') {
    const copy = { ...structuredClone(el), id: newId() };
    if (copy.x !== undefined) { copy.x += 3; copy.y += 3; }
    els.splice(i + 1, 0, copy);
    selId = copy.id;
    renderProps();
  }
  if (act === 'del') { els.splice(i, 1); dropImageCache(el.id); if (selId === el.id) { selId = null; renderProps(); } }
  renderLayers();
  changed();
});

function select(id) {
  selId = id;
  renderLayers();
  renderProps();
  drawEditor();
}

for (const b of document.querySelectorAll('[data-add]')) {
  b.addEventListener('click', () => {
    const el = newElement(b.dataset.add);
    els.push(el);
    select(el.id);
    if (el.type === 'image') $('imageFile').click();
    changed();
  });
}
// se si annulla la scelta del file, l'immagine appena aggiunta (vuota) sparisce
$('imageFile').addEventListener('cancel', () => {
  const el = sel();
  if (el && el.type === 'image' && !el.src) { els = els.filter((e) => e !== el); select(null); changed(); }
});

// ------------------------------------------------------------------ file (immagine, font, disegno)
function readAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}

async function setImage(el, file) {
  el.src = await readAsDataURL(file);
  el.name = file.name;
  dropImageCache(el.id);
  renderProps();
  renderLayers();
  changed();
}

$('imageFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  const el = sel();
  if (file && el && el.type === 'image') await setImage(el, file);
});

$('fontFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  const el = sel();
  if (!file || !el || el.type !== 'text') return;
  try {
    el.font = await addCustomFont(file);
    renderProps();
    changed();
  } catch (err) { setStatus('Font non leggibile: ' + err.message, true); }
});

$('dlJson').addEventListener('click', () => {
  const data = JSON.stringify({ app: 'fustella-a-libro', version: 1, params: readParams(), elements: els }, null, 1);
  download(new TextEncoder().encode(data), `fustella-${slug()}.json`, 'application/json');
});
$('openJson').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.elements)) throw new Error('file non riconosciuto');
    loadDesign(data.elements, data.params);
    refit = true;
    changed();
  } catch (err) { setStatus('Disegno non leggibile: ' + err.message, true); }
});

function loadDesign(list, params) {
  if (params) applyParams(params);
  els = list.map((e) => ({ ...newElement(e.type), ...e }));
  for (const e of els) if (e.type === 'text' && !FONTS.some((f) => f.id === e.font)) e.font = 'playfair';
  selId = null;
  renderLayers();
  renderProps();
}

// ------------------------------------------------------------------ editor della piastra
const PAD = 3, HINGE = 7; // mm mostrati attorno alla piastra; a sinistra c'è la cerniera
const maskCanvas = document.createElement('canvas');
const fullCanvas = document.createElement('canvas'); // disegno non tagliato: si vede cosa esce dall'area
const tint = document.createElement('canvas');
const editor = $('editor');
let view = { k: 1 };

async function ensureAssets() {
  await Promise.all(els.filter((e) => e.type === 'text').map((e) => loadFont(e.font).catch(() => false)));
  await prepareImages(els);
}

function renderAll() {
  renderMask(maskCanvas, els);
  renderMask(fullCanvas, els, false);
  maskVersion++;
  designBox = maskBox();
  drawEditor();
}
// ingombro del disegno vero (maschera tagliata) in mm, per le distanze dal bordo del foglio
let designBox = null;
function maskBox() {
  const g = PLATE.guides;
  if (g.back == null && g.top == null && g.bottom == null) return null;
  const { W, H, sx, sy } = maskSize();
  const a = maskCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0, o = y * W * 4 + 3; x < W; x++, o += 4) {
      if (a[o] < 128) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { u0: x0 / sx, u1: (x1 + 1) / sx, v0: y0 / sy, v1: (y1 + 1) / sy };
}

// bordo del foglio (linea trascinabile) per ogni allineatore attivo, in mm dell'editor
function guideLines() {
  const g = PLATE.guides, out = [];
  if (g.back != null) out.push({ which: 'back', u: g.back });
  if (g.top != null) out.push({ which: 'top', v: g.top });
  if (g.bottom != null) out.push({ which: 'bottom', v: PLATE.W - g.bottom });
  return out;
}
const RIB_W = 1.2;

// sagoma della piastra (angoli tondi solo sul lato libero) in px dell'editor
function platePath(ctx, X, Y, k) {
  const { L, W } = PLATE;
  const r = Math.min(+$('corner').value || 0, W / 3, L / 3) * k;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(X(L) - r, Y(0));
  ctx.arcTo(X(L), Y(0), X(L), Y(0) + r, r);
  ctx.lineTo(X(L), Y(W) - r);
  ctx.arcTo(X(L), Y(W), X(L) - r, Y(W), r);
  ctx.lineTo(X(0), Y(W));
  ctx.closePath();
}

function tinted(src, color) {
  tint.width = src.width; tint.height = src.height;
  const t = tint.getContext('2d');
  t.clearRect(0, 0, tint.width, tint.height);
  t.drawImage(src, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = color;
  t.fillRect(0, 0, tint.width, tint.height);
  t.globalCompositeOperation = 'source-over';
  return tint;
}

function drawEditor() {
  const { L, W } = PLATE;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const spanU = L + HINGE + PAD, spanV = W + 2 * PAD;
  // larghezza del contenitore, ma non più alta del 46% della finestra (l'anteprima 3D deve restare visibile)
  const avail = (editor.parentElement.clientWidth || 800) - 16;
  // mentre si ridimensiona la piastra la scala resta ferma, se no la maniglia scappa dal puntatore
  const k = drag && drag.kind === 'plate' ? drag.k : Math.max(280, Math.min(avail, (innerHeight * 0.46 * spanU) / spanV)) / spanU;
  const cssW = spanU * k;
  // il contenitore centra il canvas: mentre cresce lo sposto per tenere fermo il bordo sinistro
  editor.style.transform = drag && drag.kind === 'plate' ? `translateX(${(cssW - drag.w0) / 2}px)` : '';
  const cssH = spanV * k;
  view = { k };
  editor.style.width = cssW + 'px';
  editor.style.height = cssH + 'px';
  editor.width = Math.round(cssW * dpr);
  editor.height = Math.round(cssH * dpr);
  const ctx = editor.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const X = (u) => (u + HINGE) * k, Y = (v) => (v + PAD) * k;
  ctx.clearRect(0, 0, cssW, cssH);

  // cerniera: nocche della metà di sotto piene, quelle della metà di sopra vuote
  const N = +$('knuckles').value, seg = W / N;
  for (let i = 0; i < N; i++) {
    const y0 = Y(i * seg) + 1, h = seg * k - 2, x0 = X(-HINGE + 1.5), w = X(0) - x0;
    ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 3);
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(192,80,77,.55)'; ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(192,80,77,.8)'; ctx.lineWidth = 1.2; ctx.stroke(); }
  }

  const mode = look();
  ctx.save();
  platePath(ctx, X, Y, k);
  ctx.clip();
  if (mode === 'flat') {
    ctx.fillStyle = css('--strip');
    ctx.fillRect(X(0), Y(0), L * k, W * k);
    // griglia 5 mm
    ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let u = 0; u <= L; u += 5) { ctx.moveTo(X(u), Y(0)); ctx.lineTo(X(u), Y(W)); }
    for (let v = 0; v <= W; v += 5) { ctx.moveTo(X(0), Y(v)); ctx.lineTo(X(L), Y(v)); }
    ctx.stroke();
    // quello che esce dall'area utile, in rosso tenue (verrà tagliato)
    ctx.globalAlpha = 0.35;
    ctx.drawImage(tinted(fullCanvas, '#c0504d'), X(0), Y(0), L * k, W * k);
    ctx.globalAlpha = 1;
    ctx.drawImage(tinted(maskCanvas, css('--ink')), X(0), Y(0), L * k, W * k);
  } else {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(reliefImage(mode === 'back'), X(0), Y(0), L * k, W * k);
  }
  // margine liscio leggermente velato
  const A = area();
  ctx.fillStyle = 'rgba(13,13,16,.10)';
  ctx.beginPath();
  ctx.rect(X(0), Y(0), L * k, W * k);
  ctx.rect(X(A.x), Y(A.y), A.w * k, A.h * k);
  ctx.fill('evenodd');
  // allineatori: dove il foglio non arriva la piastra è più scura; la nervatura è grigia
  const G = PLATE.guides, lines = mode === 'back' ? [] : guideLines();
  if (lines.length) {
    const u0 = G.back ?? -1, v0 = G.top ?? -1, v1 = G.bottom != null ? W - G.bottom : W + 1;
    ctx.fillStyle = 'rgba(13,13,16,.38)';
    ctx.beginPath();
    ctx.rect(X(-1), Y(-1), (L + 2) * k, (W + 2) * k);
    ctx.rect(X(u0), Y(v0), (L + 2 - u0) * k, (v1 - v0) * k);
    ctx.fill('evenodd');
    ctx.fillStyle = '#4a4a54';
    for (const g of lines) {
      if (g.which === 'back') ctx.fillRect(X(g.u - RIB_W), Y(0), RIB_W * k, W * k);
      else if (g.which === 'top') ctx.fillRect(X(0), Y(g.v - RIB_W), L * k, RIB_W * k);
      else ctx.fillRect(X(0), Y(g.v), L * k, RIB_W * k);
    }
  }
  ctx.restore();
  // contorno della piastra e area utile
  platePath(ctx, X, Y, k);
  ctx.strokeStyle = 'rgba(236,236,241,.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#7d6a45'; ctx.lineWidth = 1.5;
  ctx.strokeRect(X(A.x), Y(A.y), A.w * k, A.h * k);
  ctx.setLineDash([]);
  // bordo del foglio e distanza del disegno dal bordo
  for (const g of lines) {
    ctx.strokeStyle = '#3aa0ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (g.u !== undefined) { ctx.moveTo(X(g.u), Y(0)); ctx.lineTo(X(g.u), Y(W)); }
    else { ctx.moveTo(X(0), Y(g.v)); ctx.lineTo(X(L), Y(g.v)); }
    ctx.stroke();
    const B = designBox;
    const d = !B ? null : g.which === 'back' ? B.u0 - g.u : g.which === 'top' ? B.v0 - g.v : g.v - B.v1;
    const txt = d == null ? 'bordo del foglio' : `disegno a ${fmt(d)} mm dal bordo del foglio`;
    const dragging = drag && drag.kind === 'guide' && drag.which === g.which;
    if (g.u !== undefined) badge(ctx, txt, X(g.u) + 6, Y(W) - 24, dragging);
    else badge(ctx, txt, X(L) - 230, g.which === 'top' ? Y(g.v) + 4 : Y(g.v) - 24, dragging);
  }
  // maniglie della piastra: lato libero (lunghezza), lato in basso (larghezza), angolo (tutte e due)
  plateHandles = mode === 'back' ? [] : [
    { kind: 'plate', ax: 1, ay: 0, px: X(L), py: Y(W / 2) },
    { kind: 'plate', ax: 0, ay: 1, px: X(L / 2), py: Y(W) },
    { kind: 'plate', ax: 1, ay: 1, px: X(L), py: Y(W) },
  ];
  for (const h of plateHandles) {
    ctx.beginPath(); ctx.roundRect(h.px - 6, h.py - 6, 12, 12, 3);
    ctx.fillStyle = css('--accent'); ctx.fill();
    ctx.strokeStyle = '#1d1608'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  if (drag && drag.kind === 'plate') badge(ctx, `piastra ${fmt(L, 0)} × ${fmt(W, 0)} mm`, drag.at ? drag.at.px + 14 : 10, drag.at ? drag.at.py + 18 : 10, true);

  // selezione con maniglie
  handles = [];
  const el = sel();
  if (el && el.visible && mode !== 'back') {
    const b = bounds(maskCanvas.getContext('2d'), el);
    const emode = editMode(el);
    if (b) {
      const a = ((b.rot || 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      const cx = X(b.cx), cy = Y(b.cy), hw = (b.w / 2) * k + 3, hh = (b.h / 2) * k + 3;
      const P = (lx, ly) => [cx + lx * ca - ly * sa, cy + lx * sa + ly * ca];
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(a);
      ctx.strokeStyle = '#3aa0ff'; ctx.lineWidth = 1.5; ctx.setLineDash(emode ? [] : [4, 3]);
      ctx.strokeRect(-hw, -hh, 2 * hw, 2 * hh);
      if (emode?.scale) { ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(0, -hh - 16); ctx.stroke(); }
      ctx.restore();
      if (emode) {
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const [px, py] = P(sx * hw, sy * hh);
          handles.push({ kind: 'corner', sx, sy, px, py, cx, cy });
        }
        if (emode.scale) { const [px, py] = P(0, -hh - 22); handles.push({ kind: 'rot', px, py, cx, cy }); }
        for (const h of handles) {
          ctx.beginPath();
          if (h.kind === 'rot') ctx.arc(h.px, h.py, 8, 0, Math.PI * 2);
          else ctx.rect(h.px - 5, h.py - 5, 10, 10);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = '#3aa0ff'; ctx.lineWidth = 1.5; ctx.stroke();
          if (h.kind === 'rot') rotIcon(ctx, h.px, h.py);
        }
        // gradi accanto al pallino (sempre, se ruotato)
        const rh = handles.find((x) => x.kind === 'rot');
        const rotating = drag && drag.kind === 'rot';
        if (rh && (el.rot || 0) !== 0 && !rotating) badge(ctx, `${normDeg(el.rot)}°`, rh.px + 13, rh.py - 9);
        if (rotating) {
          // riferimento orizzontale e arco dall'orizzontale all'angolo attuale
          const R = Math.min(70, Math.max(46, hh * 0.9));
          ctx.save();
          ctx.strokeStyle = 'rgba(58,160,255,.8)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(cx - R - 10, cy); ctx.lineTo(cx + R + 10, cy); ctx.stroke();
          ctx.setLineDash([]); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, a, a < 0); ctx.closePath();
          ctx.fillStyle = 'rgba(58,160,255,.18)'; ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // guide magnetiche e valore durante il trascinamento
  if (drag && drag.guides) {
    ctx.save();
    ctx.strokeStyle = '#ff3fb4'; ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
    for (const g of drag.guides) {
      ctx.beginPath();
      if (g.x !== undefined) { ctx.moveTo(X(g.x), 0); ctx.lineTo(X(g.x), cssH); }
      else { ctx.moveTo(0, Y(g.y)); ctx.lineTo(cssW, Y(g.y)); }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (drag && drag.readout && drag.at) badge(ctx, drag.readout, drag.at.px + 14, drag.at.py + 18, drag.kind === 'rot');
}

// etichetta scura con testo chiaro (gradi, misure), tenuta dentro l'editor
function badge(ctx, text, x, y, big = false) {
  ctx.save();
  ctx.font = `${big ? 600 : 500} ${big ? 14 : 12}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 12, h = big ? 22 : 19;
  const cw = editor.clientWidth, ch = editor.clientHeight;
  x = Math.min(Math.max(2, x), cw - w - 2); y = Math.min(Math.max(2, y), ch - h - 2);
  ctx.fillStyle = 'rgba(20,20,26,.88)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 6, y + h / 2 + 0.5);
  ctx.restore();
}
// freccia circolare dentro il pallino di rotazione
function rotIcon(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#3aa0ff'; ctx.fillStyle = '#3aa0ff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(x, y, 4.2, -Math.PI * 0.15, Math.PI * 1.35); ctx.stroke();
  const ax = x + 4.2 * Math.cos(-Math.PI * 0.15), ay = y + 4.2 * Math.sin(-Math.PI * 0.15);
  ctx.beginPath(); ctx.moveTo(ax + 2.6, ay - 0.4); ctx.lineTo(ax - 0.6, ay - 2.8); ctx.lineTo(ax - 0.2, ay + 1.6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
let handles = []; // maniglie dell'elemento selezionato, in px css dell'editor

function toMM(ev) {
  const r = editor.getBoundingClientRect();
  const px = ev.clientX - r.left, py = ev.clientY - r.top;
  return { u: px / view.k - HINGE, v: py / view.k - PAD, px, py };
}
const handleAt = (px, py) => handles.find((h) => Math.hypot(h.px - px, h.py - py) <= (h.kind === 'rot' ? 11 : 9)) || null;
const HANDLE_CURSOR = (h) => (h.kind === 'rot' ? 'grab' : h.sx * h.sy > 0 ? 'nwse-resize' : 'nesw-resize');

let plateHandles = [];
const plateHandleAt = (px, py) => plateHandles.find((h) => Math.abs(h.px - px) <= 8 && Math.abs(h.py - py) <= 8) || null;
// linea del bordo del foglio vicina al puntatore (entro 6 px), dentro la piastra
function guideAt(px, py) {
  const k = view.k, X = (u) => (u + HINGE) * k, Y = (v) => (v + PAD) * k;
  const inU = px >= X(0) - 4 && px <= X(PLATE.L) + 4, inV = py >= Y(0) - 4 && py <= Y(PLATE.W) + 4;
  if (look() === 'back' || !inU || !inV) return null;
  return guideLines().find((g) => (g.u !== undefined ? Math.abs(X(g.u) - px) : Math.abs(Y(g.v) - py)) <= 6) || null;
}

// misure della piastra cambiate (input o maniglie): il disegno si scala con l'area utile
// oppure resta della sua misura, centrato
function resizePlate(oL, oW, oM) {
  const { L, W, M } = PLATE;
  if ($('scaleDesign').checked) {
    const fx = (L - 2 * M) / Math.max(1, oL - 2 * oM), fy = (W - 2 * M) / Math.max(1, oW - 2 * oM);
    scaleDesign(els, fx, fy, oM, M);
  } else shiftAll(els, (L - oL) / 2, (W - oW) / 2);
}

function hit(u, v) {
  const mctx = maskCanvas.getContext('2d');
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (!el.visible) continue;
    const b = bounds(mctx, el);
    if (!b || !editMode(el)) continue;
    const a = (-(b.rot || 0) * Math.PI) / 180;
    const dx = u - b.cx, dy = v - b.cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= b.w / 2 + 1 && Math.abs(ly) <= b.h / 2 + 1) return el;
  }
  return null;
}

// trascinamento: sposta, ingrandisci (angolo), cambia misure (angolo di un riquadro), ruota (pallino)
let drag = null;
editor.addEventListener('pointerdown', (ev) => {
  if (look() === 'back') return; // il retro è solo da guardare
  const p = toMM(ev);
  const h = handleAt(p.px, p.py);
  let el = sel();
  const ph = h ? null : plateHandleAt(p.px, p.py);
  const gl = h || ph ? null : guideAt(p.px, p.py);
  if (h && el) {
    const mode = editMode(el);
    const kind = h.kind === 'rot' ? 'rot' : mode.scale ? 'scale' : 'rect';
    drag = { el, kind, h, p, start: { ...el }, keys: mode.rect, moved: false };
  } else if (ph) {
    drag = { kind: 'plate', h: ph, p, k: view.k, w0: editor.clientWidth, L0: PLATE.L, W0: PLATE.W, M0: PLATE.M, els0: structuredClone(els), moved: false };
  } else if (gl) {
    drag = { kind: 'guide', which: gl.which, p, moved: false };
  } else {
    el = hit(p.u, p.v);
    if (!el) { if (selId) select(null); return; }
    if (el.id !== selId) select(el.id);
    drag = { el, kind: 'move', p, start: { ...el }, moved: false };
  }
  editor.setPointerCapture(ev.pointerId);
  editor.focus();
});
editor.addEventListener('pointermove', (ev) => {
  const p = toMM(ev);
  if (!drag) {
    if (look() === 'back') { editor.style.cursor = 'default'; return; }
    const h = handleAt(p.px, p.py);
    const ph = h ? null : plateHandleAt(p.px, p.py);
    const gl = h || ph ? null : guideAt(p.px, p.py);
    editor.style.cursor = h ? HANDLE_CURSOR(h)
      : ph ? (ph.ax && ph.ay ? 'nwse-resize' : ph.ax ? 'ew-resize' : 'ns-resize')
      : gl ? (gl.which === 'back' ? 'ew-resize' : 'ns-resize')
      : hit(p.u, p.v) ? 'move' : 'default';
    return;
  }
  const { el, start, h } = drag;
  const du = p.u - drag.p.u, dv = p.v - drag.p.v;
  const snapOn = !ev.altKey;
  drag.guides = [];
  drag.at = p;
  if (drag.kind === 'plate') {
    const L = Math.round(clampNum(drag.L0 + du * h.ax, ...NUM.L, drag.L0));
    const W = Math.round(clampNum(drag.W0 + dv * h.ay, ...NUM.W, drag.W0));
    $('L').value = L; $('W').value = W;
    els = structuredClone(drag.els0);
    syncPlate();
    resizePlate(drag.L0, drag.W0, drag.M0);
    drag.moved = true;
    requestFrame();
    return;
  }
  if (drag.kind === 'guide') {
    const r = (x) => Math.round(x * 2) / 2;
    if (drag.which === 'back') $('alignBackPos').value = clampNum(r(p.u), 2, PLATE.L - 6, 3);
    else $('alignSidePos').value = clampNum(r(drag.which === 'top' ? p.v : PLATE.W - p.v), 2, PLATE.W - 6, 3);
    syncPlate();
    drag.moved = true;
    requestFrame();
    return;
  }
  if (drag.kind === 'move') {
    moveBy(el, start, du, dv);
    if (snapOn) {
      const A = aabb(bounds(maskCanvas.getContext('2d'), el));
      const T = snapTargets(el);
      const sx = snapAxis([A.l, A.cx, A.r], T.xs), sy = snapAxis([A.t, A.cy, A.b], T.ys);
      if (sx || sy) moveBy(el, start, du + (sx ? sx.d : 0), dv + (sy ? sy.d : 0));
      if (sx) drag.guides.push({ x: sx.t });
      if (sy) drag.guides.push({ y: sy.t });
    }
    drag.readout = `x ${fmt(el.x)} · y ${fmt(el.y)} mm`;
  } else if (drag.kind === 'rect') {
    resizeRect(el, start, drag.keys, h.sx, h.sy, du, dv);
    const [kx, ky, kw, kh] = drag.keys;
    if (snapOn) {
      // aggancio solo dei due bordi che si stanno muovendo
      const T = snapTargets(el);
      const ex = h.sx > 0 ? el[kx] + el[kw] : el[kx], ey = h.sy > 0 ? el[ky] + el[kh] : el[ky];
      const sx = snapAxis([ex], T.xs), sy = snapAxis([ey], T.ys);
      if (sx || sy) resizeRect(el, start, drag.keys, h.sx, h.sy, du + (sx ? sx.d : 0), dv + (sy ? sy.d : 0));
      if (sx) drag.guides.push({ x: sx.t });
      if (sy) drag.guides.push({ y: sy.t });
    }
    drag.readout = `${fmt(el[kw])} × ${fmt(el[kh])} mm`;
  } else if (drag.kind === 'scale') {
    if (el.keep === false) {
      // proporzioni libere: i due assi dell'elemento (ruotato) si allungano ciascuno per conto suo
      const a = ((el.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      const loc = (q) => { const dx = q.px - h.cx, dy = q.py - h.cy; return [dx * c + dy * s, -dx * s + dy * c]; };
      const [x0, y0] = loc(drag.p), [x1, y1] = loc(p);
      if (Math.abs(x0) > 2 && Math.abs(y0) > 2) scaleBy(el, start, Math.max(0.05, Math.abs(x1 / x0)), Math.max(0.05, Math.abs(y1 / y0)));
      const b = bounds(maskCanvas.getContext('2d'), el);
      drag.readout = `${fmt(b.w)} × ${fmt(b.h)} mm`;
    } else {
      const d0 = Math.hypot(drag.p.px - h.cx, drag.p.py - h.cy), d = Math.hypot(p.px - h.cx, p.py - h.cy);
      if (d0 > 2) scaleBy(el, start, d / d0);
      drag.readout = el.type === 'text' ? `altezza lettere ${fmt(el.size, 2)} mm` : `larghezza ${fmt(el.w)} mm`;
    }
  } else if (drag.kind === 'rot') {
    const a0 = Math.atan2(drag.p.py - h.cy, drag.p.px - h.cx), a = Math.atan2(p.py - h.cy, p.px - h.cx);
    let r = normDeg((start.rot || 0) + ((a - a0) * 180) / Math.PI);
    const snap = Math.round(r / 15) * 15;
    if (ev.shiftKey || Math.abs(r - snap) < 4) r = normDeg(snap); // si aggancia a 0°, 15°, 30°…
    el.rot = r;
    drag.readout = `${r}°${r % 15 === 0 ? ' ✓' : ''}`;
  }
  drag.moved = true;
  requestFrame();
});

// ---- guide magnetiche
const SNAP_PX = 7; // distanza di aggancio in pixel dello schermo
// riquadro allineato agli assi di un riquadro ruotato
function aabb(b) {
  const a = ((b.rot || 0) * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const ex = c * b.w / 2 + s * b.h / 2, ey = s * b.w / 2 + c * b.h / 2;
  return { l: b.cx - ex, r: b.cx + ex, t: b.cy - ey, b: b.cy + ey, cx: b.cx, cy: b.cy };
}
// linee a cui agganciarsi: bordi e centro dell'area utile, poi bordi e centri degli altri elementi
function snapTargets(except) {
  const A = area();
  const xs = [A.x, A.x + A.w / 2, A.x + A.w];
  const ys = [A.y, A.y + A.h / 2, A.y + A.h];
  const mctx = maskCanvas.getContext('2d');
  for (const e of els) {
    if (e === except || !e.visible || !editMode(e)) continue;
    const b = bounds(mctx, e);
    if (!b) continue;
    const B = aabb(b);
    xs.push(B.l, B.cx, B.r); ys.push(B.t, B.cy, B.b);
  }
  return { xs, ys };
}
function snapAxis(cands, targets) {
  const thr = SNAP_PX / view.k;
  let best = null;
  for (const c of cands) for (const t of targets) {
    const d = t - c;
    if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t };
  }
  return best;
}
const endDrag = () => {
  if (!drag) return;
  const moved = drag.moved, kind = drag.kind;
  drag = null;
  drawEditor(); // toglie guide ed etichetta (e sblocca la scala dopo il ridimensionamento)
  if (kind === 'plate' && moved) { refit = true; renderProps(); } // gli elementi sono oggetti nuovi
  if (moved) { syncForm(); renderLayers(); changed(); }
};
editor.addEventListener('pointerup', endDrag);
editor.addEventListener('pointercancel', endDrag);
// doppio clic: va al primo campo (per un testo, il testo da scrivere)
editor.addEventListener('dblclick', () => { const f = $('props').querySelector('textarea, input, select'); if (f) { f.focus(); f.select?.(); } });
editor.addEventListener('keydown', (ev) => {
  const el = sel();
  if (!el) return;
  const step = ev.shiftKey ? 2 : 0.5;
  const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
  if (mv && editMode(el)) {
    ev.preventDefault();
    moveBy(el, { ...el }, mv[0], mv[1]);
    syncForm(); changed();
  } else if (ev.key === 'Delete') {
    els = els.filter((e) => e !== el); dropImageCache(el.id); select(null); changed();
  }
});
// immagine trascinata sulla piastra
editor.addEventListener('dragover', (ev) => ev.preventDefault());
editor.addEventListener('drop', async (ev) => {
  ev.preventDefault();
  const file = [...(ev.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  const { u, v } = toMM(ev);
  const el = { ...newElement('image'), x: +u.toFixed(1), y: +v.toFixed(1) };
  els.push(el);
  selId = el.id;
  await setImage(el, file);
});

let frameReq = 0;
function requestFrame() {
  if (frameReq) return;
  frameReq = requestAnimationFrame(() => { frameReq = 0; renderAll(); });
}

// ------------------------------------------------------------------ resa in rilievo della carta
// Ricalcolata solo quando cambia la maschera, il verso dell'impressione o la vista (fronte/retro).
const reliefCanvas = document.createElement('canvas');
let maskVersion = 0, reliefKey = '';
const look = () => document.querySelector('input[name=look]:checked').value;

function reliefImage(back) {
  const deboss = readParams().mode === 'deboss';
  const key = `${maskVersion}|${back}|${deboss}`;
  if (key !== reliefKey) {
    const { W, H, sx } = maskSize();
    const a = maskCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    reliefCanvas.width = W; reliefCanvas.height = H;
    reliefCanvas.getContext('2d').putImageData(embossImage(a, W, H, { back, deboss, stride: 4, pxmm: sx }), 0, 0);
    reliefKey = key;
  }
  return reliefCanvas;
}
const LOOK_HINT = {
  relief: 'luce radente: così appare il foglio visto dall\'alto',
  flat: 'in rosso tenue le parti fuori dall\'area utile (vengono tagliate)',
  back: 'retro del foglio (specchiato, solo da guardare)',
};
for (const r of document.querySelectorAll('input[name=look]')) {
  r.addEventListener('change', () => { $('lookHint').textContent = LOOK_HINT[look()]; store.set('look', look()); drawEditor(); });
}

// ------------------------------------------------------------------ scena 3D
const viewerEl = $('viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
viewerEl.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#16161a');
const camera = new THREE.PerspectiveCamera(35, 1, 1, 3000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight('#ffffff', '#40404a', 1.5));
const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(120, -200, 220); scene.add(key);
const rim = new THREE.DirectionalLight('#ffe0a8', 0.8); rim.position.set(-200, 150, 80); scene.add(rim);
const MAT = {
  lower: new THREE.MeshStandardMaterial({ color: '#e8c27a', roughness: 0.5, flatShading: true }),
  upper: new THREE.MeshStandardMaterial({ color: '#cfd2d6', roughness: 0.55, flatShading: true }),
};
const group = new THREE.Group();
scene.add(group);
const bed = new THREE.GridHelper(200, 20, '#55555f', '#2e2e36');
bed.rotation.x = Math.PI / 2;
bed.position.z = -0.05;
scene.add(bed);
// la metà superiore gira attorno all'asse della cerniera (Y, quota H)
const pivot = new THREE.Group();
let lowerMesh = null, upperMesh = null, lastResult = null, refit = true;

function toGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.vertProperties, 3));
  g.setIndex(new THREE.BufferAttribute(m.triVerts, 1));
  return g;
}

function showResult(r) {
  lastResult = r;
  for (const m of [lowerMesh, upperMesh]) if (m) { m.parent.remove(m); m.geometry.dispose(); }
  group.clear();
  pivot.clear();
  const { H } = hingeDims(readParams());
  lowerMesh = new THREE.Mesh(toGeometry(r.lower), MAT.lower);
  upperMesh = new THREE.Mesh(toGeometry(r.upper), MAT.upper);
  upperMesh.position.set(0, 0, -H);
  pivot.position.set(0, 0, H);
  pivot.add(upperMesh);
  group.add(lowerMesh, pivot);
  setFold();
  if (refit) { fit(); refit = false; }
  invalidate();
}
function setFold() {
  pivot.rotation.y = (+$('fold').value * Math.PI) / 180;
  invalidate();
}
$('fold').addEventListener('input', () => { $('anim').checked = false; setFold(); });

function fit() {
  // inquadra la fustella aperta, che è il caso più largo
  const saved = pivot.rotation.y;
  pivot.rotation.y = 0;
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  pivot.rotation.y = saved;
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const fov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const fitFov = camera.aspect < 1 ? Math.atan(Math.tan(fov) * camera.aspect) : fov;
  camera.position.copy(c).add(new THREE.Vector3(0.25, -1, 0.75).normalize().multiplyScalar((radius / Math.sin(fitFov)) * 0.72));
  controls.target.copy(c);
  controls.update();
}
function resize3d() {
  const w = viewerEl.clientWidth, h = viewerEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
  invalidate();
}
new ResizeObserver(resize3d).observe(viewerEl);
new ResizeObserver(() => drawEditor()).observe(editor.parentElement);

let dirty = true;
const invalidate = () => { dirty = true; };
controls.addEventListener('change', invalidate);
let animT = 0, prevT = performance.now();
renderer.setAnimationLoop((t) => {
  const dt = Math.min((t - prevT) / 1000, 0.1); prevT = t;
  if (lastResult && $('anim').checked) {
    animT += dt;
    // si chiude, resta chiusa un attimo, si riapre
    const s = (1 - Math.cos(animT * 0.9)) / 2;
    $('fold').value = String(Math.round(180 * Math.min(1, s * 1.08)));
    setFold();
  }
  controls.update();
  if (dirty) { renderer.render(scene, camera); dirty = false; }
});
$('anim').addEventListener('change', () => { animT = Math.acos(1 - 2 * Math.min(1, +$('fold').value / 180)) / 0.9; store.set('anim', $('anim').checked); });

// ------------------------------------------------------------------ build nel worker
let worker = null, spare = null, reqId = 0, buildTimer = 0;
function makeWorker() {
  const w = new Worker('./worker.js', { type: 'module' });
  w.onmessage = (ev) => { w.terminate(); if (w === worker) worker = null; onResult(ev.data); };
  w.onerror = (e) => { if (w !== worker) return; setStatus('Errore nel generatore: ' + (e.message || 'sconosciuto'), true); busy(false); };
  return w;
}
function takeWorker() { if (worker) worker.terminate(); worker = spare || makeWorker(); spare = makeWorker(); return worker; }

function scheduleBuild() { clearTimeout(buildTimer); buildTimer = setTimeout(doBuild, 600); }

function doBuild() {
  const { W, H, sx, sy } = maskSize();
  const data = maskCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const alpha = new Uint8Array(W * H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  const id = ++reqId;
  const w = takeWorker();
  busy(true);
  setStatus('Genero la fustella…');
  w.postMessage({ id, alpha, W, H, sx, sy, params: readParams() }, [alpha.buffer]);
}

function onResult(data) {
  if (data.id !== reqId) return;
  busy(false);
  if (!data.ok) { setStatus('Errore: ' + data.error, true); return; }
  showResult(data);
  renderInfo(data);
  $('warnings').innerHTML = data.warnings.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
  for (const b of ['dl3mf', 'dl3mfTop', 'dlStl', 'dlTest']) $(b).disabled = false;
  setStatus(`Pronto · ${fmt(data.ms / 1000)} s`);
}

function busy(on) { $('busy').classList.toggle('on', on); }
function setStatus(msg, err = false) { const s = $('status'); s.textContent = msg; s.classList.toggle('err', err); }

function renderInfo(r) {
  const i = r.info, p = readParams();
  const rows = [
    ['Ingombro sul piatto', `${fmt(i.footprint[0], 0)} × ${fmt(i.footprint[1], 0)} × ${fmt(2 * i.H)} mm`],
    ['Chiusa', `${fmt(p.L + i.start, 0)} × ${fmt(p.W, 0)} × ${fmt(2 * i.H)} mm`],
    ['Stampo', `rilievo ${fmt(p.relief, 2)}, cavità ${fmt(i.depth, 2)}, gioco ${fmt(p.clearance, 2)} mm`],
    ['Superficie da imprimere', `${Math.round(i.coverage * 100)}% dell'area utile`],
    ['Triangoli', `${Math.round(i.triangles / 1000)} mila`],
  ];
  $('info').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

$('settings').innerHTML = `<tr><th>Pezzo</th><th>Pareti</th><th>Layer</th><th>Riempimento</th><th>Il resto</th></tr><tr><td>Fustella (un pezzo)</td><td>${PRINT.walls}</td><td>${fmt(PRINT.layer, 2)}</td><td>${PRINT.infill}%</td><td>profilo standard</td></tr>`;

// ------------------------------------------------------------------ download
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function slug() {
  const t = els.filter((e) => e.type === 'text' && e.visible).map((e) => e.text).sort((a, b) => b.length - a.length)[0] || 'fustella';
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'fustella';
}
// pezzo centrato sul piatto: centro del suo ingombro in (0,0), to3MF lo porta al centro del piatto
function centered(m) {
  const V = m.vertProperties; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < V.length; i += 3) { if (V[i] < x0) x0 = V[i]; if (V[i] > x1) x1 = V[i]; if (V[i + 1] < y0) y0 = V[i + 1]; if (V[i + 1] > y1) y1 = V[i + 1]; }
  return [-(x0 + x1) / 2, -(y0 + y1) / 2];
}
$('dl3mfTop').addEventListener('click', () => $('dl3mf').click());
// schede del pannello
for (const t of document.querySelectorAll('[data-tab]')) {
  t.addEventListener('click', () => {
    for (const x of document.querySelectorAll('[data-tab]')) x.setAttribute('aria-selected', String(x === t));
    for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== t.dataset.tab;
  });
}
$('dl3mf').addEventListener('click', () => {
  const m = lastResult.whole;
  download(to3MF([{ name: 'Fustella', mesh: m, offset: centered(m), settings: bambuObjectSettings(PRINT) }],
    { title: `Fustella ${slug()}` }), `fustella-${slug()}.3mf`, 'model/3mf');
});
$('dlStl').addEventListener('click', () => download(toSTL(lastResult.whole), `fustella-${slug()}.stl`, 'model/stl'));
$('dlTest').addEventListener('click', () => {
  const m = lastResult.coupon;
  download(to3MF([{ name: 'Prova cerniera', mesh: m, offset: centered(m), settings: bambuObjectSettings(PRINT) }],
    { title: 'Prova cerniera' }), 'fustella-prova-cerniera.3mf', 'model/3mf');
});

// ------------------------------------------------------------------ ciclo modifiche
let busyAssets = 0;
async function changed() {
  save();
  const n = ++busyAssets;
  await ensureAssets();
  if (n !== busyAssets) return; // arrivata nel frattempo un'altra modifica
  renderAll();
  scheduleBuild();
}
// misure della piastra: il disegno resta centrato
for (const id of ['L', 'W', 'margin']) {
  $(id).addEventListener('change', () => {
    const oL = PLATE.L, oW = PLATE.W, oM = PLATE.M;
    syncPlate();
    resizePlate(oL, oW, oM);
    renderProps();
    refit = true;
    changed();
  });
}
$('scaleDesign').addEventListener('change', () => store.set('scaleDesign', $('scaleDesign').checked));
// allineatori: cambia la zona del foglio, quindi la maschera
for (const id of ['alignBack', 'alignSide']) $(id).addEventListener('change', () => { syncPlate(); changed(); });
for (const id of ['alignBackPos', 'alignSidePos']) $(id).addEventListener('input', () => { syncPlate(); changed(); });
for (const id of ['T', 'corner', 'relief', 'clearance', 'gap', 'tip', 'soften', 'hingeClr', 'axialGap']) {
  $(id).addEventListener('input', () => { save(); drawEditor(); scheduleBuild(); });
}
for (const id of ['knuckles', 'tab', 'stops']) $(id).addEventListener('change', () => { save(); drawEditor(); scheduleBuild(); });
for (const r of document.querySelectorAll('input[name=mode]')) r.addEventListener('change', () => { syncPlate(); save(); drawEditor(); scheduleBuild(); });

// ------------------------------------------------------------------ avvio
window.__fus = { get els() { return els; }, camera, controls, fit, maskCanvas, changed, scene, THREE, get result() { return lastResult; } }; // per test e debug
applyParams(store.get('params', null));
const saved = store.get('design', null);
loadDesign(Array.isArray(saved) && saved.length ? saved : defaultDesign(), null);
$('anim').checked = store.get('anim', false);
$('scaleDesign').checked = store.get('scaleDesign', true);
{
  const l = store.get('look', 'relief');
  const r = document.querySelector(`input[name=look][value="${l}"]`);
  if (r) r.checked = true;
  $('lookHint').textContent = LOOK_HINT[look()];
}
setStatus('Carico i font…');
changed();
// i font possono finire di caricarsi dopo il primo disegno: ridisegno quando sono pronti
document.fonts.addEventListener('loadingdone', () => renderAll());

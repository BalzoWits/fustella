// Test in node: maschera sintetica -> fustella; poi verifica che le due metà non si compenetrino
// in tutta la rotazione della cerniera (0° = aperta come stampata, 180° = chiusa).
// Uso: node test/node-test.mjs [deboss]   (con allineatori del foglio e distanziali)
import Module from '../lib/manifold.js';
import { traceContours, padMask, simplifyClosed } from '../trace.js';
import { buildFustella, hingeDims, DEFAULTS } from '../fustella.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { toSTL } from '../export.js';

const wasm = await Module();
wasm.setup();

const mode = process.argv[2] === 'deboss' ? 'deboss' : 'emboss';
// allineatori: battuta di fondo + laterale (in alto con emboss, in basso con deboss)
const params = { ...DEFAULTS, mode, stops: true, alignBack: true, alignBackPos: 2, alignSide: mode === 'deboss' ? 'bottom' : 'top', alignSidePos: 2 };
const { L, W, margin: M } = params;
const PX = 10, Wpx = L * PX, Hpx = W * PX;
const alpha = new Uint8Array(Wpx * Hpx);
const paint = (fn) => {
  for (let j = 0; j < Hpx; j++) for (let i = 0; i < Wpx; i++) {
    const u = (i + 0.5) / PX, v = (j + 0.5) / PX;
    // come nella pagina: niente disegno dove il foglio non arriva (0,8 mm di distacco dalle nervature)
    const g = 0.8, top = params.alignSide === 'top', bot = params.alignSide === 'bottom';
    if (u < M || u > L - M || v < M || v > W - M) continue;
    if (params.alignBack && u < params.alignBackPos + g) continue;
    if (top && v < params.alignSidePos + g) continue;
    if (bot && v > W - params.alignSidePos - g) continue;
    const a = fn(u, v);
    if (a > 0) alpha[j * Wpx + i] = Math.max(alpha[j * Wpx + i], Math.round(255 * Math.min(1, a)));
  }
};
// "L" asimmetrica: con lo specchio sbagliato non combacia
paint((u, v) => ((u > 12 && u < 15 && v > 10 && v < 30) || (u > 12 && u < 28 && v > 27 && v < 30) ? 1 : 0));
// pois
paint((u, v) => { const d = Math.hypot(u - 4 * Math.round(u / 4), v - 4 * Math.round(v / 4)); return u > 35 && v > 10 && v < 30 ? 1.2 - d : 0; });
// cornice
paint((u, v) => { const e = Math.min(u - M - 1, L - M - 1 - u, v - M - 1, W - M - 1 - v); return e >= 0 && e < 0.8 ? 1 : 0; });
// tratto sottile per il controllo dei tratti
paint((u, v) => (u > 18 && u < 50 && v > 36 && v < 36.4 ? 1 : 0));

const t0 = performance.now();
const pad = padMask(alpha, Wpx, Hpx);
const contours = traceContours(pad.field, pad.w, pad.h).map((c) => simplifyClosed(c, 0.12));
const t1 = performance.now();
const r = buildFustella(wasm, { contours, sx: PX, sy: PX, x0: pad.x0, y0: pad.y0 }, params);
const t2 = performance.now();
console.log(`modo ${mode}: contorni ${contours.length} in ${(t1 - t0).toFixed(0)} ms, fustella in ${(t2 - t1).toFixed(0)} ms`);
console.log('info', r.info);
console.log('avvisi', r.warnings);
for (const [k, m] of [['inferiore', r.lower], ['superiore', r.upper], ['prova cerniera', r.coupon]]) {
  const b = m.boundingBox();
  console.log(k.padEnd(15), 'genus', m.genus(), 'vol', m.volume().toFixed(0), 'bbox', b.min.map((x) => x.toFixed(2)), b.max.map((x) => x.toFixed(2)));
}

const { H } = hingeDims(params);
const fold = (m, deg) => m.translate([0, 0, -H]).rotate([0, deg, 0]).translate([0, 0, H]);
let worst = 0;
for (let deg = 0; deg <= 180; deg += 7.5) {
  const v = fold(r.upper, deg).intersect(r.lower).volume();
  worst = Math.max(worst, v);
  if (v > 0.01) console.log(`  apertura ${deg}°: compenetrazione ${v.toFixed(3)} mm³`);
}
console.log('compenetrazione massima in rotazione:', worst.toFixed(4), 'mm³ (deve essere ~0)');
// chiusa: distanza minima tra le facce = luce G (al netto della carta)
{
  const closed = fold(r.upper, 180);
  const lift = closed.translate([0, 0, -params.gap + 0.02]).intersect(r.lower).volume();
  console.log('chiusa abbassata di G-0,02: compenetrazione', lift.toFixed(2), 'mm³ (deve essere > 0: le facce o i distanziali si toccano)');
  // controprova: stessa superiore NON specchiata (disegno girato) -> lo stampo non entra nella cavità
  const wrong = closed.mirror([0, 1, 0]).intersect(r.lower).volume();
  console.log('controprova (disegno specchiato male):', wrong.toFixed(2), 'mm³ (deve essere molto più grande)');
}
// tutto sul piatto
const zmin = Math.min(r.lower.boundingBox().min[2], r.upper.boundingBox().min[2]);
console.log('quota minima', zmin.toFixed(3), '(deve essere 0)');

mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
const pack = (m) => { const g = m.getMesh(); return { vertProperties: g.vertProperties, triVerts: g.triVerts, numProp: g.numProp }; };
writeFileSync(new URL(`../out/fustella-${mode}.stl`, import.meta.url), toSTL(pack(wasm.Manifold.union([r.lower, r.upper]))));
writeFileSync(new URL(`../out/fustella-${mode}-chiusa.stl`, import.meta.url), toSTL(pack(wasm.Manifold.union([r.lower, fold(r.upper, 180)]))));
console.log('STL in out/');

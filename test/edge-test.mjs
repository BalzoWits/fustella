import Module from '../lib/manifold.js';
import { traceContours, padMask, simplifyClosed } from '../trace.js';
import { buildFustella, hingeDims, DEFAULTS } from '../fustella.js';
const wasm = await Module(); wasm.setup();
const L = 60, W = 45, PX = 10, Wp = L * PX, Hp = W * PX;
// disegno pieno fino al bordo: cornice a 0,3 mm dal bordo, larga 1 mm, tutto attorno
const alpha = new Uint8Array(Wp * Hp);
for (let j = 0; j < Hp; j++) for (let i = 0; i < Wp; i++) { const u = (i + .5) / PX, v = (j + .5) / PX; const e = Math.min(u, L - u, v, W - v); if (e > 0.3 && e < 1.3) alpha[j * Wp + i] = 255; }
const pad = padMask(alpha, Wp, Hp);
const contours = traceContours(pad.field, pad.w, pad.h).map((c) => simplifyClosed(c, 0.12));
for (const mode of ['emboss', 'deboss']) {
  const p = { ...DEFAULTS, mode };
  const r = buildFustella(wasm, { contours, sx: PX, sy: PX, x0: pad.x0, y0: pad.y0 }, p);
  const { H } = hingeDims(p);
  let worst = 0, at = 0;
  for (let d = 0; d <= 180; d += 5) { const v = r.upper.translate([0, 0, -H]).rotate([0, d, 0]).translate([0, 0, H]).intersect(r.lower).volume(); if (v > worst) { worst = v; at = d; } }
  console.log(mode, 'max', worst.toFixed(3), 'a', at, '°');
}

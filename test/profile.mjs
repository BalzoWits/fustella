import Module from '../lib/manifold.js';
import { traceContours, padMask, simplifyClosed } from '../trace.js';
import { buildFustella, DEFAULTS } from '../fustella.js';
const wasm = await Module(); wasm.setup();
const L = 60, W = 45, PX = 10, Wp = L * PX, Hp = W * PX;
const alpha = new Uint8Array(Wp * Hp);
// pois di passo 4, diametro 1,4, su tutta la piastra (il motivo di default)
for (let j = 0; j < Hp; j++) for (let i = 0; i < Wp; i++) { const u = (i + .5) / PX, v = (j + .5) / PX; const py = 4 * Math.sqrt(3) / 2; const r = Math.round(v / py); const off = r % 2 ? 2 : 0; const d = Math.hypot(u - off - 4 * Math.round((u - off) / 4), v - r * py); if (d < 0.7) alpha[j * Wp + i] = 255; }
const t0 = performance.now();
const pad = padMask(alpha, Wp, Hp);
const contours = traceContours(pad.field, pad.w, pad.h).map((c) => simplifyClosed(c, 0.12));
console.log('contorni', contours.length, 'punti', contours.reduce((s, c) => s + c.length, 0), Math.round(performance.now() - t0), 'ms');
for (const stops of [false, true]) for (const mode of ['emboss', 'deboss']) {
  let last = performance.now(); const laps = [];
  const timing = (n) => { const now = performance.now(); laps.push(`${n} ${Math.round(now - last)}`); last = now; };
  const t1 = performance.now();
  buildFustella(wasm, { contours, sx: PX, sy: PX, x0: pad.x0, y0: pad.y0 }, { ...DEFAULTS, mode, stops, timing });
  console.log(mode, 'stops', stops, Math.round(performance.now() - t1), 'ms |', laps.join(' | '));
}

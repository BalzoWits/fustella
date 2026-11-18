// Worker: maschera -> contorni -> fustella, senza bloccare la pagina.
import Module from './lib/manifold.js';
import { traceContours, padMask, simplifyClosed } from './trace.js';
import { buildFustella } from './fustella.js';

const ready = Module().then((w) => { w.setup(); return w; });

function pack(m, transfer) {
  const mesh = m.getMesh();
  const np = mesh.numProp;
  let vert = mesh.vertProperties;
  if (np !== 3) {
    const out = new Float32Array((vert.length / np) * 3);
    for (let i = 0, j = 0; i < vert.length; i += np, j += 3) { out[j] = vert[i]; out[j + 1] = vert[i + 1]; out[j + 2] = vert[i + 2]; }
    vert = out;
  } else vert = vert.slice();
  const tri = mesh.triVerts.slice();
  transfer.push(vert.buffer, tri.buffer);
  return { vertProperties: vert, triVerts: tri, numProp: 3 };
}

// le due metà sono separate (si toccano solo a fustella chiusa): per l'export basta accodarle,
// senza un'unione booleana
function concat(a, b) {
  const nv = a.vertProperties.length / 3;
  const vert = new Float32Array(a.vertProperties.length + b.vertProperties.length);
  vert.set(a.vertProperties); vert.set(b.vertProperties, a.vertProperties.length);
  const tri = new Uint32Array(a.triVerts.length + b.triVerts.length);
  tri.set(a.triVerts);
  for (let i = 0; i < b.triVerts.length; i++) tri[a.triVerts.length + i] = b.triVerts[i] + nv;
  return { vertProperties: vert, triVerts: tri, numProp: 3 };
}

self.onmessage = async ({ data }) => {
  const { id } = data;
  try {
    const wasm = await ready;
    const t0 = performance.now();
    const { alpha, W, H, sx, sy, params } = data;
    const pad = padMask(alpha, W, H);
    const contours = traceContours(pad.field, pad.w, pad.h).map((c) => simplifyClosed(c, 0.12));
    const r = buildFustella(wasm, { contours, sx, sy, x0: pad.x0, y0: pad.y0 }, params);
    const transfer = [];
    const lower = pack(r.lower, transfer), upper = pack(r.upper, transfer), coupon = pack(r.coupon, transfer);
    // un pezzo solo per l'export: le due metà sono incastrate e non vanno spostate una dall'altra
    const whole = concat(lower, upper);
    transfer.push(whole.vertProperties.buffer, whole.triVerts.buffer);
    const ms = Math.round(performance.now() - t0);
    self.postMessage({ id, ok: true, lower, upper, coupon, whole, info: r.info, warnings: r.warnings, ms }, transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e && e.message ? e.message : e) });
  }
};
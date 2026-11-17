// Resa "carta goffrata" di una maschera (alfa 0..255, w*h): altezza smussata, luce radente da in alto
// a sinistra calcolata dalle normali, ombra portata morbida verso il basso a destra.
// back = true: il retro del foglio (immagine specchiata); deboss = true: la carta è incisa invece che in rilievo.

function boxBlur(src, w, h, r) {
  if (r < 1) return src;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// alpha: Uint8 (un byte per pixel) oppure RGBA (stride 4); pxmm: pixel per mm
export function embossImage(alpha, w, h, { back = false, deboss = false, stride = 1, pxmm = 10, paper = [244, 240, 231] } = {}) {
  const sign = back !== deboss ? -1 : 1;
  const n = w * h;
  let hf = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = back ? w - 1 - x : x;
    hf[y * w + x] = sign * (alpha[(y * w + X) * stride + (stride === 4 ? 3 : 0)] / 255);
  }
  // smusso del bordo ~0,25 mm: la carta goffrata non ha spigoli vivi
  const bev = Math.max(1, Math.round(pxmm * 0.12));
  const hb = boxBlur(boxBlur(hf, w, h, bev), w, h, bev);
  // ombra portata: quanto il rilievo poco più in alto a sinistra sovrasta questo punto
  const ox = Math.round(pxmm * 0.35), oy = Math.round(pxmm * 0.45);
  const occ = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - ox, sy = y - oy;
    const src = sx >= 0 && sy >= 0 ? hb[sy * w + sx] : hb[y * w + x];
    occ[y * w + x] = Math.max(0, src - hb[y * w + x]);
  }
  const shadow = boxBlur(occ, w, h, Math.max(1, Math.round(pxmm * 0.3)));

  // luce: da in alto a sinistra, radente
  let lx = -0.55, ly = -0.62, lz = 0.56;
  const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
  const steep = 2.2 * bev; // pendenza del fianco in unità della normale
  const out = new ImageData(w, h);
  const d = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const xl = x > 0 ? i - 1 : i, xr = x < w - 1 ? i + 1 : i, yu = y > 0 ? i - w : i, yd = y < h - 1 ? i + w : i;
      const dx = (hb[xr] - hb[xl]) * 0.5 * steep, dy = (hb[yd] - hb[yu]) * 0.5 * steep;
      const nl = Math.hypot(dx, dy, 1);
      const lam = (-dx * lx - dy * ly + lz) / nl;
      let s = 0.3 + 0.7 * (lam / lz);           // = 1 sulla carta piana
      s -= 0.32 * Math.min(1, shadow[i]);       // ombra portata
      s += 0.04 * Math.max(0, hb[i]);           // le parti in rilievo prendono un filo più di luce
      s = Math.max(0.45, Math.min(1.18, s));
      const g = 1 - (((x * 7919 + y * 104729) % 17) / 17) * 0.018; // grana della carta
      const o = i * 4;
      d[o] = Math.min(255, paper[0] * s * g);
      d[o + 1] = Math.min(255, paper[1] * s * g);
      d[o + 2] = Math.min(255, paper[2] * s * g);
      d[o + 3] = 255;
    }
  }
  return out;
}

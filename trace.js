// Contorni di una maschera in scala di grigi (marching squares con interpolazione a 0,5).
// Ingresso: field Uint8Array (0..255) di w*h; il bordo deve essere già vuoto perché i contorni si chiudano.
// Uscita: array di contorni, ciascuno array di [x, y] in pixel (centro del pixel = intero).
// Ogni cella produce segmenti orientati (stesso verso per tutti), quindi ogni punto sul lato di una
// cella ha esattamente un segmento entrante e uno uscente: si concatenano con una mappa inizio -> fine.

export function traceContours(field, w, h, iso = 128) {
  const inside = (x, y) => field[y * w + x] >= iso;
  const val = (x, y) => field[y * w + x];
  // chiave di un lato: orizzontale (x,y)-(x+1,y) = 2*(y*w+x); verticale (x,y)-(x,y+1) = 2*(y*w+x)+1
  const pt = new Map(); // chiave -> [x, y]
  const next = new Map(); // chiave inizio -> chiave fine
  const edgePoint = (k) => {
    let p = pt.get(k);
    if (p) return p;
    const base = k >> 1, x = base % w, y = (base - x) / w;
    const a = val(x, y);
    if (k & 1) { const b = val(x, y + 1); p = [x, y + (iso - a) / (b - a)]; }
    else { const b = val(x + 1, y); p = [x + (iso - a) / (b - a), y]; }
    pt.set(k, p);
    return p;
  };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      // angoli in senso orario (y verso il basso): tl, tr, br, bl
      const c = [inside(x, y), inside(x + 1, y), inside(x + 1, y + 1), inside(x, y + 1)];
      if (c[0] === c[1] && c[1] === c[2] && c[2] === c[3]) continue;
      // lati tra angoli consecutivi: T, R, B, L
      const e = [2 * (y * w + x), 2 * (y * w + x + 1) + 1, 2 * ((y + 1) * w + x), 2 * (y * w + x) + 1];
      // per ogni tratto "dentro" (da un attraversamento fuori->dentro al successivo dentro->fuori,
      // in senso orario) il segmento va dall'uscita all'entrata
      for (let i = 0; i < 4; i++) {
        if (!c[i] && c[(i + 1) % 4]) {          // lato i: fuori -> dentro (entrata)
          let j = (i + 1) % 4;
          while (c[(j + 1) % 4]) j = (j + 1) % 4; // lato j: dentro -> fuori (uscita)
          next.set(e[j], e[i]);
        }
      }
    }
  }
  const contours = [];
  const used = new Set();
  for (const start of next.keys()) {
    if (used.has(start)) continue;
    const poly = [];
    let k = start;
    while (!used.has(k)) {
      used.add(k);
      poly.push(edgePoint(k));
      k = next.get(k);
      if (k === undefined) break;
    }
    if (poly.length >= 3) contours.push(poly);
  }
  return contours;
}

// Maschera della piastra con un bordo vuoto di 1 pixel tutto attorno, perché i contorni si chiudano.
// Il pixel i ha centro in (i + 0,5) / sx mm e nel campo bordato sta in X = i + 1: u = (X - x0) / sx.
export function padMask(alpha, W, H) {
  const w = W + 2, h = H + 2;
  const field = new Uint8Array(w * h);
  for (let j = 0; j < H; j++) field.set(alpha.subarray(j * W, (j + 1) * W), (j + 1) * w + 1);
  return { field, w, h, x0: 0.5, y0: 0.5 };
}

// Semplificazione Douglas-Peucker di un contorno chiuso (tolleranza in pixel).
export function simplifyClosed(poly, tol) {
  if (poly.length < 8) return poly;
  // spezzo il chiuso in due aperti tra il punto 0 e il più lontano
  let far = 0, best = -1;
  for (let i = 1; i < poly.length; i++) {
    const d = (poly[i][0] - poly[0][0]) ** 2 + (poly[i][1] - poly[0][1]) ** 2;
    if (d > best) { best = d; far = i; }
  }
  const a = dp(poly.slice(0, far + 1), tol);
  const b = dp(poly.slice(far).concat([poly[0]]), tol);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

function dp(pts, tol) {
  const n = pts.length;
  if (n < 3) return pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [s, e] = stack.pop();
    const [x1, y1] = pts[s], [x2, y2] = pts[e];
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1e-12;
    let idx = -1, md = t2;
    for (let i = s + 1; i < e; i++) {
      const [x, y] = pts[i];
      const t = ((x - x1) * dx + (y - y1) * dy) / L2;
      const px = x1 + t * dx - x, py = y1 + t * dy - y;
      const d = px * px + py * py;
      if (d > md) { md = d; idx = i; }
    }
    if (idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Geometria della fustella a libro: due piastre unite da una cerniera stampata già montata.
// Modulo puro: gira identico nel worker del browser e in node (test).
//
// Riferimento di stampa: tutte e due le piastre appoggiate sul piatto con il dorso, facce di lavoro in alto.
//  - asse della cerniera lungo Y, a x = 0 e quota H = T + G/2 (T spessore piastra, G luce tra le facce)
//  - piastra inferiore a x > 0, piastra superiore a x < 0
//  - chiudere = ruotare la superiore di 180° attorno all'asse: (x, y, z) -> (-x, y, 2H - z).
//    Quindi la faccia superiore (z = T) finisce a T + G: tra le due facce resta la luce G per la carta.
// La superiore si costruisce prima "chiusa sopra la inferiore" (x > 0) e poi si specchia in x: così il
// disegno è uno solo e lo stampo maschio e quello femmina combaciano per costruzione.
//
// Cerniera: nocche alterne lungo Y (le pari, comprese le due estreme, sono della inferiore e portano
// un perno passante unico; le dispari sono della superiore e hanno il foro con gioco). Il foro ha
// tetto e fondo a punta (45°) così si stampa senza supporti e ruota di 180° senza toccare.

export const DEFAULTS = {
  L: 60,            // lunghezza della piastra, dalla cerniera al bordo libero
  W: 45,            // larghezza (lungo la cerniera)
  T: 4.5,           // spessore di ciascuna piastra
  corner: 4,        // raggio degli angoli sul lato libero
  margin: 0,        // bordo liscio attorno al disegno (0: si imprime su tutta la piastra)
  mode: 'emboss',   // emboss: la carta esce in rilievo verso l'alto · deboss: incisa
  relief: 0.7,      // altezza dello stampo maschio
  clearance: 0.25,  // gioco laterale per lato tra maschio e cavità (posto per la carta)
  gap: 0.15,        // luce tra le facce a fustella chiusa
  tip: 0.2,         // spazio tra la punta del maschio e il fondo della cavità
  soften: 0.12,     // smusso degli spigoli del maschio e dell'imbocco della cavità
  hingeClr: 0.3,    // gioco radiale perno-foro
  axialGap: 0.4,    // spazio tra una nocca e l'altra
  knuckles: 7,      // numero di nocche (dispari)
  stops: false,     // distanziali agli angoli: fermano la chiusura alla luce G
  tab: true,        // linguetta per aprire sul bordo libero della superiore
  // allineatori del foglio: nervature sulla inferiore contro cui si appoggia il bordo del foglio,
  // con la sede corrispondente nella superiore. Posizione = distanza del bordo del foglio dal bordo piastra.
  alignBack: false, alignBackPos: 3,     // battuta di fondo, parallela alla cerniera
  alignSide: 'none', alignSidePos: 3,    // battuta laterale: 'none' | 'top' | 'bottom' (come nell'editor)
};

export const RIB = { w: 1.2, h: 1.0, clr: 0.3, min: 2 };
// distanziali: raggio, distanza dal bordo, anello libero dal disegno attorno a ciascuno
export const STOP = { r: 1.4, d: 2.5, keep: 0.8 };

const K = {
  sink: 0.3,        // il maschio affonda nella piastra per un'unione pulita
  steps: 1,         // gradini dello smusso: uno basta, più sottili di un layer (0,12) in stampa non esistono
  minStroke: 0.6,   // tratto minimo che si imprime bene sulla carta
  minWall: 0.6,     // parete minima tra due cavità della femmina
  minBack: 1.2,     // materiale minimo sotto la cavità
  seg: 64,          // segmenti dei cerchi della cerniera
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// misure derivate della cerniera, condivise con la pagina (anteprima che si apre)
export function hingeDims(params) {
  const p = { ...DEFAULTS, ...params };
  const H = p.T + p.gap / 2;
  const rk = 1.12 * H;                      // raggio delle nocche (tagliate in piano sopra e sotto)
  const pinR = clamp(0.36 * p.T, 1.3, 2.0);
  return { H, rk, pinR, start: rk + 0.6, bore: pinR + p.hingeClr };
}

// traced: contorni (pixel) della maschera bordata, scala sx/sy (px per mm), origine x0/y0
export function buildFustella(wasm, traced, params) {
  const { Manifold, CrossSection } = wasm;
  const p = { ...DEFAULTS, ...params };
  const warnings = [];
  const { L, W, T, gap: G } = p;
  const { H, rk, pinR, start, bore } = hingeDims(p);
  const N = Math.max(3, Math.round(p.knuckles) | 1);
  const lap = typeof p.timing === 'function' ? p.timing : () => {};

  // ---- disegno: contorni (px) -> mm nel riferimento della piastra inferiore
  // pixel: u = (x - x0)/sx dal bordo lato cerniera, v = (y - y0)/sy dall'alto; vista dall'alto con
  // la cerniera a sinistra, quindi l'alto dello schermo è +Y
  const { contours, sx, sy, x0, y0 } = traced;
  let design = contours.length
    ? new CrossSection(contours.map((c) => c.map(([x, y]) => [start + (x - x0) / sx, W / 2 - (y - y0) / sy])), 'EvenOdd').simplify(0.01)
    : null;
  lap('sezione 2D');

  // ---- profondità della cavità
  const depth = p.relief + p.tip - G;
  if (T - depth < K.minBack) throw new Error(`La cavità (${depth.toFixed(2)} mm) lascia meno di ${K.minBack} mm di piastra: aumenta lo spessore o riduci il rilievo.`);
  const soft = Math.max(0, Math.min(p.soften, p.relief / 3, p.clearance * 0.8));

  // ---- piastra: rettangolo con gli angoli arrotondati solo sul lato libero
  const rc = clamp(p.corner, 0.5, Math.min(W / 3, L / 3));
  const plateCs = CrossSection.union([
    CrossSection.square([1, W]).translate([start, -W / 2]),
    CrossSection.circle(rc, 48).translate([start + L - rc, W / 2 - rc]),
    CrossSection.circle(rc, 48).translate([start + L - rc, -W / 2 + rc]),
  ]).hull();
  const plate = () => plateCs.extrude(T);
  // il disegno può arrivare al bordo: lo taglio sulla sagoma vera della piastra (angoli tondi compresi)
  if (design && !design.isEmpty()) design = design.intersect(plateCs.offset(-0.2, 'Round', 2, 24));
  // distanziali: posizioni fisse negli angoli; lì il disegno si ferma, se no lo stampo li urta
  const stopXY = [];
  for (const x of [start + STOP.d + 0.5, start + L - STOP.d - 0.5]) for (const y of [-W / 2 + STOP.d, W / 2 - STOP.d]) stopXY.push([x, y]);
  if (p.stops && design && !design.isEmpty()) design = design.subtract(CrossSection.union(stopXY.map(([x, y]) => CrossSection.circle(STOP.r + STOP.keep, 32).translate([x, y]))));
  const empty = !design || design.isEmpty();
  if (empty) warnings.push('Il disegno è vuoto: la fustella esce liscia.');

  // ---- stampo maschio e cavità femmina sulla faccia z = T
  const male = (cs) => {
    const parts = [cs.extrude(p.relief - soft + K.sink).translate([0, 0, T - K.sink])];
    for (let k = 1; k <= K.steps && soft > 0; k++) {
      const c = cs.offset((-k * soft) / K.steps, 'Round', 2, 12);
      if (c.isEmpty()) break;
      parts.push(c.extrude(soft / K.steps + 0.002).translate([0, 0, T + p.relief - soft + ((k - 1) * soft) / K.steps]));
    }
    return Manifold.union(parts);
  };
  const cavity = (cs) => {
    const parts = [cs.offset(p.clearance, 'Round', 2, 16).extrude(depth + 0.02).translate([0, 0, T - depth])];
    for (let k = 1; k <= K.steps && soft > 0; k++) {
      parts.push(cs.offset(p.clearance + (k * soft) / K.steps, 'Round', 2, 16)
        .extrude(soft / K.steps + (k === K.steps ? 0.05 : 0.002)).translate([0, 0, T - soft + ((k - 1) * soft) / K.steps]));
    }
    return Manifold.union(parts);
  };

  // ---- cerniera
  const alongY = (cs, y0, len) => cs.extrude(len).rotate([90, 0, 0]).translate([0, y0 + len, 0]);
  const knuckleCs = CrossSection.circle(rk, K.seg).intersect(CrossSection.square([2 * rk + 1, 2 * H], true)).translate([0, H]);
  const blockCs = CrossSection.square([start + 1, T]);       // collega la nocca alla piastra (x da 0 a start+1)
  const s2 = Math.SQRT2, b = bore;
  const boreCs = CrossSection.union([
    CrossSection.circle(b, K.seg),
    new CrossSection([[[-b / s2, -b / s2], [0, -b * s2], [b / s2, -b / s2], [b / s2, b / s2], [0, b * s2], [-b / s2, b / s2]]]),
  ]).translate([0, H]);
  const seg = W / N, ag = p.axialGap;
  if (ag >= seg / 3) throw new Error('Troppe nocche per questa larghezza: riduci il numero di nocche o lo spazio tra le nocche.');
  const knuckles = (upper) => {
    const parts = [];
    for (let i = 0; i < N; i++) {
      if ((i % 2 === 1) !== upper) continue;
      const y = -W / 2 + i * seg + ag / 2, len = seg - ag;
      let k = alongY(CrossSection.union([knuckleCs, blockCs]), y, len);
      if (upper) k = k.subtract(alongY(boreCs, y - 0.05, len + 0.1));
      parts.push(k);
    }
    if (!upper) parts.push(alongY(CrossSection.circle(pinR, K.seg).translate([0, H]), -W / 2 + ag / 2, W - ag));
    return Manifold.union(parts);
  };

  // ---- piastra inferiore
  let lower = Manifold.union([plate(), knuckles(false)]);
  // ---- piastra superiore, costruita chiusa sopra la inferiore (x > 0), specchiata alla fine
  let upper = Manifold.union([plate(), knuckles(true)]);
  if (p.tab) {
    // linguetta sul bordo libero: sporge oltre la inferiore quando è chiusa (sta sul lato del dorso)
    const tab = CrossSection.circle(7, 48).intersect(CrossSection.square([8, 16]).translate([0, -8])).translate([start + L - 1, 0]);
    upper = upper.add(tab.extrude(Math.min(2.4, T * 0.55)));
  }
  lap('piastre e cerniera');

  const info = { coverage: 0, depth, H, start, soft };
  if (!empty) {
    const emboss = p.mode !== 'deboss';
    // l'inferiore ha il maschio se la carta deve uscire in rilievo verso l'alto
    const maleSolid = male(design), cavSolid = cavity(design);
    if (emboss) { lower = lower.add(maleSolid); upper = upper.subtract(cavSolid); }
    else { lower = lower.subtract(cavSolid); upper = upper.add(maleSolid); }
    lower.numTri(); upper.numTri();
    lap('stampi');

    // ---- controlli di stampabilità e impressione
    const A = { w: L - 2 * p.margin, h: W - 2 * p.margin };
    const ar = design.area();
    info.coverage = ar / Math.max(1, A.w * A.h);
    const h = K.minStroke / 2;
    const robust = design.offset(-h, 'Round').offset(h, 'Round');
    const lost = 1 - robust.area() / Math.max(ar, 1e-9);
    if (lost > 0.05) warnings.push(`Circa il ${Math.round(lost * 100)}% del disegno ha tratti più sottili di ${String(K.minStroke).replace('.', ',')} mm: sulla carta si vedranno poco. Ingrandisci o ispessisci quelle parti.`);
    const rec = design.offset(p.clearance, 'Round', 2, 16);
    const w = K.minWall / 2;
    const thin = rec.offset(w, 'Round').offset(-w, 'Round').area() - rec.area();
    if (thin > Math.max(3, 0.03 * rec.area())) warnings.push(`Nella piastra con la cavità restano pareti più sottili di ${String(K.minWall).replace('.', ',')} mm tra un incavo e l'altro (${thin.toFixed(0)} mm²): elementi troppo vicini, distanziali un po' o riduci il gioco.`);
    if (info.coverage > 0.45) warnings.push(`Il disegno copre il ${Math.round(info.coverage * 100)}% della piastra: con tanta superficie da imprimere serve molta forza (o una morsa).`);
    lap('controlli');
  }

  // distanziali: quattro pastiglie alte G sulla faccia della inferiore, negli angoli del margine
  if (p.stops) {
    warnings.push('I distanziali stanno negli angoli della piastra: se il foglio li copre, lì resta un segno.');
    const pads = stopXY.map(([x, y]) => Manifold.cylinder(G + 0.02, STOP.r, STOP.r, 32).translate([x, y, T - 0.02]));
    lower = lower.add(Manifold.union(pads));
  }

  // allineatori del foglio: la faccia verso il foglio sta a "pos" dal bordo della piastra
  const ribs = [];
  if (p.alignBack) {
    const pos = clamp(p.alignBackPos, RIB.min, L - 6);
    ribs.push(CrossSection.square([RIB.w, W]).translate([start + pos - RIB.w, -W / 2]));
  }
  if (p.alignSide === 'top' || p.alignSide === 'bottom') {
    const pos = clamp(p.alignSidePos, RIB.min, W - 6);
    const y = p.alignSide === 'top' ? W / 2 - pos : -W / 2 + pos - RIB.w; // in alto nell'editor = +Y
    ribs.push(CrossSection.square([L, RIB.w]).translate([start, y]));
  }
  if (ribs.length) {
    const inside = plateCs.offset(-0.6, 'Round', 2, 24);
    const ribCs = CrossSection.union(ribs).intersect(inside);
    const slotDepth = RIB.h - G + RIB.clr;
    if (T - slotDepth < K.minBack) throw new Error('Piastra troppo sottile per gli allineatori: aumenta lo spessore.');
    lower = lower.add(ribCs.extrude(RIB.h + 0.02).translate([0, 0, T - 0.02]));
    upper = upper.subtract(ribCs.offset(RIB.clr, 'Square').extrude(slotDepth + 0.05).translate([0, 0, T - slotDepth]));
    info.ribs = ribs.length;
  }

  upper = upper.mirror([1, 0, 0]);
  lower = lower.simplify(1e-3);
  upper = upper.simplify(1e-3);

  for (const [name, m] of [['inferiore', lower], ['superiore', upper]]) {
    if (m.status() !== 'NoError' || m.isEmpty()) throw new Error(`Geometria non valida: piastra ${name} (${m.status()})`);
  }
  // pezzo di prova della cerniera: le nocche con un pezzetto di piastra
  const cut = Manifold.cube([2 * (start + 6), W + 2, 2 * H + 2]).translate([-(start + 6), -W / 2 - 1, -0.5]);
  const coupon = Manifold.union([lower, upper]).intersect(cut);
  lap('pulizia');

  info.triangles = lower.numTri() + upper.numTri();
  info.footprint = [2 * (start + L) + (p.tab ? 6 : 0), W];
  return { lower, upper, coupon, info, warnings };
}

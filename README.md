# Fustella a Libro

Pagina statica che genera nel browser una fustella da goffratura per carta: due piastre unite da una
cerniera stampata già montata. Si stampa aperta, in un pezzo solo, senza supporti; si chiude sul foglio
e si stringe.

Si disegna sulla piastra vista dall'alto, con la cerniera a sinistra (testo, motivi, immagini, cornici,
anche in sottrazione). Testi e immagini hanno "Adatta all'area" (misura massima senza deformare) e
"Riempi tutta l'area" (deforma per coprirla; il testo si allarga al massimo tra 0,5× e 2×); con
"Mantieni proporzioni" spento le maniglie d'angolo deformano. Sulla piastra: trascina per spostare,
angoli per ingrandire o cambiare le misure, pallino per ruotare (aggancio ogni 15°, Maiusc forza),
frecce per spostare di 0,5 mm (Maiusc 2 mm), Canc per eliminare, doppio clic per modificare il testo.
Guide magnetiche su bordi, centro e linee a 4 mm dal bordo della piastra e sugli altri elementi (Alt le disattiva).
L'editor mostra di default la resa sulla carta a luce radente (`emboss.js`), poi la vista piatta (con
in rosso quello che esce dalla piastra o dal foglio e viene tagliato) e il retro del foglio.

Le misure della piastra (scheda Disegno) si cambiano anche trascinando le maniglie gialle sul bordo libero,
sul lato in basso e sull'angolo; con "Scala anche il disegno" il disegno segue la piastra, se no resta
della sua misura e centrato. Si imprime su tutta la superficie della piastra, fino al bordo (gli angoli
tondi tagliano il disegno). Con i distanziali attivi resta un anello libero attorno a ciascuno.

Allineatori del foglio (opzionali): battuta di fondo (lato cerniera) e/o laterale (in alto o in basso).
Sono nervature 1,2 × 1 mm sulla metà di sotto con la sede nella metà di sopra; la linea blu nell'editor
è il bordo del foglio, si trascina e mostra a quanti mm dal bordo parte il disegno. Dove il foglio non
arriva il disegno viene tagliato (con 0,8 mm di distacco dalla nervatura).

Il .3mf scaricato contiene un solo oggetto (le due metà sono incastrate) con layer 0,12, 3 pareti,
riempimento 25% e supporti spenti, letti da Bambu Studio e OrcaSlicer. C'è anche un pezzo di prova
con la sola cerniera.

## Geometria (`fustella.js`)

- Riferimento di stampa: tutte e due le piastre con il dorso sul piatto. Asse della cerniera lungo Y a
  x = 0, quota H = T + G/2 (T spessore, G luce tra le facce). Chiudere = ruotare la superiore di 180°
  attorno all'asse: (x, y, z) → (−x, y, 2H − z), quindi a fustella chiusa tra le facce resta G.
- La superiore si costruisce "chiusa sopra la inferiore" e poi si specchia in x: il disegno è uno solo
  e stampo maschio e cavità combaciano per costruzione.
- Maschio: disegno estruso del rilievo, con smusso a gradini in punta. Cavità: disegno allargato del
  gioco per lato, profonda rilievo + spazio in punta − G, con imbocco smussato.
- In rilievo: maschio sulla inferiore (la carta esce in rilievo verso chi guarda dall'alto).
  Inciso: maschio sulla superiore.
- Cerniera: nocche alterne; le pari (comprese le estreme) sono della inferiore e portano un perno
  passante unico, le dispari della superiore hanno il foro con gioco radiale, a punta sopra e sotto
  (45°) per stamparlo senza supporti e ruotare di 180°. Le nocche sono tagliate in piano sopra e sotto
  per appoggiare sul piatto.
- Opzioni: linguetta per aprire, distanziali negli angoli (fermano la chiusura a G).

## Avvio in locale

Serve un server HTTP (i moduli JS e il worker non funzionano da `file://`):

```
python -m http.server 8767
```

poi apri http://127.0.0.1:8767/

## File

- `design.js` — elementi del disegno e loro resa su canvas (in mm); la maschera alfa è il rilievo
- `trace.js` — marching squares sulla maschera
- `fustella.js` — piastre, cerniera e stampi con manifold-3d (modulo puro, gira anche in node)
- `worker.js` — maschera → contorni → fustella, fuori dal thread della pagina
- `app.js` — interfaccia, editor, 3D, download
- `export.js` — STL binario e 3MF con impostazioni per oggetto

## Test

```
node test/node-test.mjs          # in rilievo
node test/node-test.mjs deboss   # inciso
```

Controlla che in tutta la rotazione (0–180°) le due metà non si compenetrino, che chiusa le facce
restino alla luce G e che con il disegno specchiato male lo stampo non entri nella cavità.

## Licenze

Progetto originale. Font: SIL Open Font License (`fonts/licenses`). manifold-3d: Apache 2.0,
three.js: MIT (`lib/licenses`).
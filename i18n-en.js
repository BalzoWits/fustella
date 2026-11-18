// Traduzioni inglesi della Fustella a Libro (la pagina è scritta in italiano). Vedi i18n.js.
const N = '([\\d.,]+)'; // un numero, con la virgola (italiano) o il punto (inglese)

export const TEXT = {
  // intestazione e schede
  'Fustella a Libro': 'Book Embosser',
  'goffratura per carta, cerniera stampata già montata': 'paper embossing, print-in-place hinge',
  'Caricamento…': 'Loading…',
  'Carico i font…': 'Loading fonts…',
  'Genero la fustella…': 'Building the embosser…',
  'Scarica la fustella (.3mf)': 'Download the embosser (.3mf)',
  'Disegno': 'Design',
  'Fustella e stampa': 'Embosser & print',
  'Passa all\'italiano': 'Passa all\'italiano',
  'Disegna una fustella da goffratura per carta con cerniera stampata già montata e scaricala pronta da stampare in 3D.':
    'Design a paper embosser with a print-in-place hinge and download it ready to 3D print.',

  // piastra
  'Piastra': 'Plate',
  'Lunghezza': 'Length',
  'Larghezza': 'Width',
  'mm': 'mm',
  'Scala anche il disegno quando cambio la piastra': 'Scale the design with the plate',
  'Puoi anche trascinare le maniglie gialle sul bordo della piastra nell\'editor. Si imprime su tutta la superficie, fino al bordo.':
    'You can also drag the yellow handles on the plate edge in the editor. The whole surface can be embossed, right up to the edge.',

  // elementi
  '+ Testo': '+ Text',
  '+ Motivo': '+ Pattern',
  '+ Immagine': '+ Image',
  '+ Cornice': '+ Frame',
  'Elementi del disegno': 'Design elements',
  'Nessun elemento: aggiungine uno.': 'No elements yet: add one.',
  'Più in alto nella lista = sta sopra. "Sottrai" buca gli elementi sotto (es. un nome scavato in un motivo). Quello che esce dalla piastra viene tagliato.':
    'Higher in the list = on top. "Subtract" cuts through the elements below (e.g. a name carved out of a pattern). Anything outside the plate is cut off.',
  'Testo': 'Text',
  'Motivo': 'Pattern',
  'Immagine': 'Image',
  'Cornice': 'Frame',
  'Testo vuoto': 'Empty text',
  'sottrai': 'subtract',
  'Nascondi': 'Hide',
  'Mostra': 'Show',
  'Porta sopra': 'Bring forward',
  'Porta sotto': 'Send backward',
  'Duplica': 'Duplicate',
  'Elimina': 'Delete',
  'Sulla piastra: trascina per spostare, angoli per ingrandire, pallino per ruotare. Si aggancia alle guide: tieni Alt per muoverlo libero.':
    'On the plate: drag to move, corners to resize, dot to rotate. It snaps to guides: hold Alt to move freely.',
  'Sulla piastra: trascina per spostare, angoli per cambiare le misure. Tieni Alt per non agganciarti alle guide.':
    'On the plate: drag to move, corners to change the size. Hold Alt to avoid snapping to guides.',

  // campi
  'Testo (Invio per andare a capo)': 'Text (Enter for a new line)',
  'Font': 'Font',
  'Carica un font (TTF, OTF, WOFF)…': 'Upload a font (TTF, OTF, WOFF)…',
  'Altezza maiuscole': 'Cap height',
  'Spaziatura lettere': 'Letter spacing',
  'Adatta all\'area': 'Fit to area',
  'Riempi tutta l\'area': 'Fill the whole area',
  'La misura più grande che entra, senza deformare': 'The largest size that fits, without distortion',
  'Lo stira fino a coprire tutta l\'area': 'Stretches it to cover the whole area',
  'Mantieni proporzioni (spento: gli angoli deformano)': 'Keep proportions (off: corners stretch)',
  'Allargamento orizzontale': 'Horizontal stretch',
  'Rotazione': 'Rotation',
  '° (pallino sopra la selezione)': '° (dot above the selection)',
  'Rotazione in gradi': 'Rotation in degrees',
  'Effetto': 'Effect',
  'In rilievo': 'Raised',
  'Sottrai': 'Subtract',
  'Stile e righe': 'Style and lines',
  'Stile': 'Style',
  'Pieno': 'Filled',
  'Solo contorno': 'Outline only',
  'Spessore contorno': 'Outline width',
  'Allineamento righe': 'Line alignment',
  'Sinistra': 'Left',
  'Centro': 'Center',
  'Destra': 'Right',
  'Interlinea': 'Line spacing',
  'Posizione': 'Position',
  'Orizzontale': 'Horizontal',
  'Verticale': 'Vertical',
  'Centra in orizzontale': 'Center horizontally',
  'Centra in verticale': 'Center vertically',
  'Passo': 'Spacing',
  'Spessore / dimensione': 'Thickness / size',
  'Angolo': 'Angle',
  'Variante casuale': 'Random variant',
  'Dove': 'Where',
  'Tutta la piastra': 'Whole plate',
  'Riquadro': 'Box',
  'Scegli immagine…': 'Choose image…',
  'Cambia immagine…': 'Change image…',
  'nessun file': 'no file',
  'PNG, JPG o SVG. Va bene un logo nero su bianco: si può anche trascinare il file sulla piastra.':
    'PNG, JPG or SVG. A black logo on white works best: you can also drop the file onto the plate.',
  'Soglia (più alta = più scuri inclusi)': 'Threshold (higher = more dark tones included)',
  'Inverti chiari/scuri': 'Invert light/dark',
  'Altezza': 'Height',
  'Linea': 'Line',
  'Doppia': 'Double',
  'Tratteggio': 'Dashed',
  'Solo angoli': 'Corners only',
  'Ovale': 'Oval',
  'Raggio angoli': 'Corner radius',
  'Spessore': 'Thickness',
  'Posizione e misure': 'Position and size',
  'Alto': 'Top',

  // motivi
  'Pois': 'Dots',
  'Righe': 'Stripes',
  'Griglia': 'Grid',
  'Scacchiera': 'Checkerboard',
  'Nido d\'ape': 'Honeycomb',
  'Onde': 'Waves',
  'Zigzag': 'Zigzag',
  'Scaglie': 'Scales',
  'Coriandoli': 'Confetti',

  // font
  'Playfair Display (serif elegante)': 'Playfair Display (elegant serif)',
  'Montserrat Bold': 'Montserrat Bold',
  'Montserrat Regular (sottile)': 'Montserrat Regular (thin)',
  'Cinzel (capitali romane)': 'Cinzel (Roman capitals)',
  'Roboto Slab Bold': 'Roboto Slab Bold',
  'Oswald Bold (stretto)': 'Oswald Bold (condensed)',
  'Bebas Neue (alto)': 'Bebas Neue (tall)',
  'Great Vibes (corsivo)': 'Great Vibes (script)',
  'Pacifico (corsivo tondo)': 'Pacifico (round script)',
  'Lobster': 'Lobster',

  // allineatori
  'Allineatori del foglio': 'Paper guides',
  'Battuta di fondo (lato cerniera)': 'Back stop (hinge side)',
  'Battuta laterale': 'Side stop',
  'Nessuna': 'None',
  'In alto': 'Top',
  'In basso': 'Bottom',
  'Fondo dal bordo': 'Back stop from edge',
  'Lato dal bordo': 'Side stop from edge',
  'Una nervatura sulla metà di sotto, con la sua sede nella metà di sopra: appoggi il bordo del foglio e il disegno cade sempre nello stesso punto. Con tutte e due fai battere l\'angolo del foglio. La linea blu nell\'editor è il bordo del foglio: si trascina.':
    'A rib on the bottom half with a matching slot in the top half: butt the paper edge against it and the design always lands in the same place. With both, you register the paper corner. The blue line in the editor is the paper edge: drag it.',

  // seconda scheda
  'Piastre': 'Plates',
  'Lunghezza e larghezza sono nella scheda Disegno. Il raggio vale per gli angoli del lato libero.':
    'Length and width are in the Design tab. The radius applies to the corners on the open side.',
  'Impressione': 'Impression',
  'Verso dell\'impressione': 'Impression direction',
  'Inciso': 'Debossed',
  'Il disegno esce in rilievo sul lato del foglio che guardi dall\'alto (lo stampo in rilievo è sulla metà di sotto).':
    'The design comes out raised on the side of the paper you see from above (the raised die is on the bottom half).',
  'Il disegno resta inciso sul lato del foglio che guardi dall\'alto (lo stampo in rilievo è sulla metà di sopra).':
    'The design is pressed in on the side of the paper you see from above (the raised die is on the top half).',
  'Rilievo': 'Relief',
  'Gioco per lato': 'Clearance per side',
  'Regolazioni fini': 'Fine tuning',
  'Luce tra le facce': 'Gap between faces',
  'Spazio in punta': 'Tip clearance',
  'Smusso degli spigoli': 'Edge softening',
  'Luce: distanza tra le facce a fustella chiusa. Spazio in punta: aria tra la punta dello stampo e il fondo della cavità. Lo smusso evita che gli spigoli taglino la carta.':
    'Gap: distance between the faces when closed. Tip clearance: air between the die tip and the cavity floor. Softening keeps sharp edges from cutting the paper.',
  'Carta normale (80–120 g): valori di partenza. Cartoncino (200–300 g): gioco 0,3–0,35 e rilievo 0,8–1.':
    'Regular paper (80–120 gsm): default values. Card stock (200–300 gsm): clearance 0.3–0.35 and relief 0.8–1.',
  'Cerniera e accessori': 'Hinge and extras',
  'Gioco del perno': 'Pin clearance',
  'Spazio tra le nocche': 'Knuckle gap',
  'Nocche': 'Knuckles',
  'Linguetta per aprire sul bordo libero': 'Opening tab on the free edge',
  'Distanziali negli angoli (fermano la chiusura alla luce)': 'Corner stops (hold the faces at the set gap)',
  'Se la cerniera esce incollata, alza il gioco del perno a 0,35–0,4. Prima di stampare tutto puoi provare solo la cerniera (sotto).':
    'If the hinge comes out fused, raise the pin clearance to 0.35–0.4. Before printing everything you can test just the hinge (below).',
  'Scarica': 'Download',
  'Fustella (.3mf)': 'Embosser (.3mf)',
  'Fustella': 'Embosser',
  'STL': 'STL',
  'Prova cerniera': 'Hinge test',
  '3MF': '3MF',
  'Salva disegno': 'Save design',
  'Apri un disegno salvato (.json)': 'Open a saved design (.json)',
  'Stampa e uso': 'Printing and use',
  'Pezzo': 'Part',
  'Pareti': 'Walls',
  'Layer': 'Layer',
  'Riempimento': 'Infill',
  'Il resto': 'Everything else',
  'Fustella (un pezzo)': 'Embosser (one piece)',
  'profilo standard': 'standard profile',
  'Niente supporti. Il .3mf imposta layer 0,12, 3 pareti e riempimento 25%; il resto resta quello del profilo della tua stampante.':
    'No supports. The .3mf sets 0.12 layers, 3 walls and 25% infill; everything else comes from your printer profile.',
  'Appena staccata dal piatto, piega la cerniera avanti e indietro un paio di volte per sbloccarla.':
    'Right after removing it from the bed, flex the hinge back and forth a couple of times to free it.',
  'Se il segno è debole: rilievo un po\' più alto o carta più sottile. Se la carta si taglia: gioco più largo o smusso maggiore.':
    'Faint impression: a bit more relief or thinner paper. Paper tearing: more clearance or more softening.',

  // info
  'Ingombro sul piatto': 'Footprint on the bed',
  'Chiusa': 'Closed',
  'Stampo': 'Die',
  'Superficie da imprimere': 'Area to emboss',
  'Triangoli': 'Triangles',

  // editor
  'Piastra vista dall\'alto': 'Plate seen from above',
  'Vista dell\'editor': 'Editor view',
  'Retro del foglio': 'Back of the paper',
  'cerniera': 'hinge',
  'Editor della piastra': 'Plate editor',
  'luce radente: così appare il foglio visto dall\'alto': 'raking light: how the paper looks from above',
  'in rosso tenue le parti che escono dalla piastra o dal foglio (vengono tagliate)': 'faint red: parts outside the plate or the paper (they get cut off)',
  'retro del foglio (specchiato, solo da guardare)': 'back of the paper (mirrored, view only)',
  'bordo del foglio': 'paper edge',

  // 3D
  'Fustella 3D': '3D embosser',
  'Aperta': 'Open',
  'Chiusura della fustella': 'Closing the embosser',
  'Apri e chiudi': 'Open and close',

  // contenuto di partenza
  'Il tuo nome': 'Your name',
  'EX LIBRIS': 'EX LIBRIS',

  // avvisi ed errori del generatore
  'Il disegno è vuoto: la fustella esce liscia.': 'The design is empty: the embosser will come out plain.',
  'I distanziali stanno negli angoli della piastra: se il foglio li copre, lì resta un segno.':
    'The stops sit in the plate corners: if the paper covers them, they leave a mark there.',
  'Troppe nocche per questa larghezza: riduci il numero di nocche o lo spazio tra le nocche.':
    'Too many knuckles for this width: use fewer knuckles or a smaller knuckle gap.',
  'Piastra troppo sottile per gli allineatori: aumenta lo spessore.': 'Plate too thin for the paper guides: increase the thickness.',
};

export const HTML = {
  'Stampa la fustella <b>aperta, come esce dal file</b>: le due metà sono già montate sulla cerniera. Non separarle e non ruotarle sul piatto.':
    'Print the embosser <b>open, exactly as it comes out of the file</b>: the two halves are already joined by the hinge. Do not separate them or rotate them on the bed.',
  'Infila il foglio fino in fondo (verso la cerniera), chiudi e <b>stringi forte</b> con le dita, o meglio in una morsa o sotto una pressa. Il lato che guardi dall\'alto è quello disegnato qui.':
    'Slide the paper all the way in (towards the hinge), close and <b>squeeze hard</b> with your fingers, or better in a vise or under a press. The side you see from above is the one designed here.',
  'Progetto originale. Font: SIL Open Font License (cartella <code>fonts/licenses</code>). Librerie: manifold-3d, three.js.':
    'Original project. Fonts: SIL Open Font License (<code>fonts/licenses</code> folder). Libraries: manifold-3d, three.js.',
};

export const PATTERNS = [
  [new RegExp(`^Pronto · ${N} s$`), 'Ready · $1 s'],
  [new RegExp(`^${N} × ${N} mm, cerniera a sinistra · clic per selezionare, trascina per spostare$`), '$1 × $2 mm, hinge on the left · click to select, drag to move'],
  [new RegExp(`^${N}% della piastra$`), '$1% of the plate'],
  [new RegExp(`^${N} mila$`), '$1 thousand'],
  [new RegExp(`^rilievo ${N}, cavità ${N}, gioco ${N} mm$`), 'relief $1, cavity $2, clearance $3 mm'],
  [new RegExp(`^disegno a (-?${N}) mm dal bordo del foglio$`), 'design $1 mm from the paper edge'],
  [new RegExp(`^piastra ${N} × ${N} mm$`), 'plate $1 × $2 mm'],
  [new RegExp(`^altezza lettere ${N} mm$`), 'cap height $1 mm'],
  [new RegExp(`^larghezza ${N} mm$`), 'width $1 mm'],
  [/^Errore: (.*)$/, 'Error: $1'],
  [/^Errore nel generatore: (.*)$/, 'Generator error: $1'],
  [/^Font non leggibile: (.*)$/, 'Unreadable font: $1'],
  [/^Disegno non leggibile: (.*)$/, 'Unreadable design: $1'],
  [new RegExp(`^Circa il ${N}% del disegno ha tratti più sottili di ${N} mm: sulla carta si vedranno poco\\. Ingrandisci o ispessisci quelle parti\\.$`),
    'About $1% of the design has strokes thinner than $2 mm: they will barely show on paper. Enlarge or thicken those parts.'],
  [new RegExp(`^Nella piastra con la cavità restano pareti più sottili di ${N} mm tra un incavo e l'altro \\(${N} mm²\\): elementi troppo vicini, distanziali un po' o riduci il gioco\\.$`),
    'The cavity plate has walls thinner than $1 mm between recesses ($2 mm²): elements are too close, space them out a bit or reduce the clearance.'],
  [new RegExp(`^Il disegno copre il ${N}% della piastra: con tanta superficie da imprimere serve molta forza \\(o una morsa\\)\\.$`),
    'The design covers $1% of the plate: with this much area to emboss you need a lot of force (or a vise).'],
  [new RegExp(`^La cavità \\(${N} mm\\) lascia meno di ${N} mm di piastra: aumenta lo spessore o riduci il rilievo\\.$`),
    'The cavity ($1 mm) leaves less than $2 mm of plate: increase the thickness or reduce the relief.'],
  [/^Geometria non valida: piastra inferiore \((.*)\)$/, 'Invalid geometry: bottom plate ($1)'],
  [/^Geometria non valida: piastra superiore \((.*)\)$/, 'Invalid geometry: top plate ($1)'],
];

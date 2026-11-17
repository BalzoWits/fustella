// Impostazioni di stampa della fustella: unica fonte per la tabella nella pagina e per il 3MF
// (Metadata/model_settings.config, letto da Bambu Studio e OrcaSlicer anche nei 3MF non loro).
// Si scrivono solo i valori diversi dal profilo standard: il resto lo decide il profilo della stampante.
// Layer fine: il rilievo è di pochi decimi e la cerniera ha giochi di 0,3 mm.

export const PRINT = { walls: 3, layer: 0.12, infill: 25, placement: 'aperta, dorsi sul piatto' };

export function bambuObjectSettings(s) {
  return {
    layer_height: String(s.layer),
    wall_loops: String(s.walls),
    sparse_infill_density: `${s.infill}%`,
    enable_support: '0',
  };
}
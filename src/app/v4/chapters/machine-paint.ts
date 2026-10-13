import { MiniConfig, MiniTrace } from '../engine/mini-gpt';
import { WORDS } from '../engine/mini-world';
import { pct } from '../shared';

// Le dessin de la machine complète, partagé par la fresque et par le grand zoom.
export const W = 1600;
export const H = 900;
export const INK = '#eef1fb', MUTE = '#9aa5c4', LINE = '#2a3558', AMBER = '#ffb454', CYAN = '#5ad1e6', PINK = '#ff7eb6', NIGHT = '#0d1326', RAISE = '#1b2442';
export const HEAD_COLORS = [CYAN, PINK];
export const HEAD_NAMES = ['bleu', 'rose'];

const CHIP = { x: 20, width: 116 };
const TABLE = { x: 182, y: 250, width: 132, row: 6 };
const FLOW = { first: 356, last: 1196, width: 144 };
const READ = { x: 1380, bar: 100, slots: 7, step: 64 };
const MIDDLE = 452;

export interface Guess {
  readonly id: number;
  readonly value: number;
}

export interface MachineScene {
  readonly config: MiniConfig;
  readonly ids: readonly number[];
  readonly trace: MiniTrace;
  /** Candidats pour le mot suivant, du plus probable au moins probable. */
  readonly ranked: readonly Guess[];
  /** Le favori si on lisait la réponse à l'entrée, puis après chaque couche. */
  readonly glimpses: readonly Guess[];
  readonly table: readonly (readonly number[])[];
  /** Nombre de mots, à la fin du texte, que la machine a écrits elle-même. */
  readonly written: number;
  readonly offLayers: readonly number[];
  readonly offHeads: readonly (readonly [number, number])[];
}

export interface MachineView {
  /** Étape du pas à pas : −1 pour tout montrer. */
  readonly stage: number;
  /** Le dernier mot écrit vole de la sortie vers le texte : instant de départ et rang parmi les candidats. */
  readonly flight?: { readonly since: number; readonly slot: number };
}

export function tone(value: number, scale = 2): string {
  const strength = Math.min(1, Math.abs(value) / scale);
  return value >= 0 ? `rgba(255,180,84,${strength})` : `rgba(90,209,230,${strength})`;
}

export const font = (size: number, weight = '') => `${weight} ${size}px Inter, system-ui, sans-serif`;

/** Où se trouve chaque chose dans la fresque, pour un texte de cette longueur. */
export function layout(config: MiniConfig, count: number) {
  const gap = Math.min(64, 690 / count), top = MIDDLE - (gap * (count - 1)) / 2;
  return {
    gap,
    row: (i: number) => top + i * gap,
    thick: Math.min(26, gap - 6),
    band: FLOW.width,
    station: (s: number) => FLOW.first + ((FLOW.last - FLOW.first) / Math.max(1, config.layers)) * s,
  };
}

/** Point d'une courbe de Bézier dont les tangentes sont horizontales aux deux bouts. */
function along(x0: number, y0: number, x1: number, y1: number, t: number): [number, number] {
  const bend = (x1 - x0) * 0.5, u = 1 - t;
  return [u * u * u * x0 + 3 * u * u * t * (x0 + bend) + 3 * u * t * t * (x1 - bend) + t * t * t * x1, u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1];
}

/** Un conduit entre deux points, avec des grains qui y circulent. phase < 0 : pas de grain. */
export function wire(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, color: string, alpha: number, phase: number, grains = 1): void {
  if (alpha <= 0.01) return;
  const bend = (x1 - x0) * 0.5, base = c.globalAlpha;
  c.globalAlpha = base * Math.min(1, alpha) * 0.55;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x0, y0);
  c.bezierCurveTo(x0 + bend, y0, x1 - bend, y1, x1, y1);
  c.stroke();
  if (phase >= 0) {
    c.globalAlpha = base * Math.min(1, alpha * 1.6 + 0.15);
    c.fillStyle = '#fff';
    for (let g = 0; g < grains; g++) {
      const [x, y] = along(x0, y0, x1, y1, (phase + g / grains) % 1);
      c.beginPath();
      c.arc(x, y, 1.5 + width * 0.22, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.globalAlpha = base;
}

/** Une bande : les nombres d'un mot, une case par nombre. */
export function strip(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, values: readonly number[], scale = 2.5): void {
  const cell = width / values.length;
  c.fillStyle = '#131a30';
  c.fillRect(x - 3, y - height / 2 - 3, width + 6, height + 6);
  values.forEach((v, k) => {
    c.fillStyle = tone(v, scale);
    c.fillRect(x + k * cell, y - height / 2, Math.max(0.6, cell - 0.5), height);
  });
}

export function paintMachine(c: CanvasRenderingContext2D, scene: MachineScene, time: number, view: MachineView = { stage: -1 }): void {
  const { ids, trace, ranked, table, glimpses } = scene, { width, layers, hidden } = scene.config;
  const count = ids.length, last = count - 1, stage = view.stage, { gap, row, thick, station } = layout(scene.config, count);
  // Le dessin peut être fondu dans un autre (grand zoom) : tout se règle par rapport à l'opacité reçue.
  const base = c.globalAlpha, shown = (column: number) => base * (stage < 0 || stage >= column ? 1 : 0.1);
  const flow = (phase: number) => (time * 0.32 + phase) % 1;
  c.fillStyle = NIGHT;
  c.fillRect(0, 0, W, H);
  c.textBaseline = 'middle';

  const header = (text: string, x: number, column: number, color = MUTE) => {
    c.globalAlpha = shown(column);
    c.fillStyle = color;
    c.font = font(18, '600');
    c.textAlign = 'left';
    c.fillText(text, x, 44);
  };
  header('1 · LES MOTS', CHIP.x, 0);
  header('2 · LA TABLE', TABLE.x, 1);
  header('3 · LE FLUX', station(0), 2);
  for (let l = 0; l < layers; l++) header(`COUCHE ${l + 1}`, station(l) + FLOW.width + 18, 3 + l, INK);
  header('4 · LA SUITE', READ.x, 3 + layers);

  // 1 · Les mots. Ceux que la machine a écrits elle-même sont en orange.
  const mine = count - scene.written, chipHeight = Math.min(42, gap - 4);
  c.globalAlpha = shown(0);
  ids.forEach((id, i) => {
    const y = row(i);
    c.fillStyle = RAISE;
    c.strokeStyle = i === last ? AMBER : LINE;
    c.lineWidth = i === last ? 2.5 : 1.5;
    c.beginPath();
    c.roundRect(CHIP.x, y - chipHeight / 2, CHIP.width, chipHeight, 9);
    c.fill();
    c.stroke();
    c.fillStyle = i >= mine ? AMBER : INK;
    c.font = font(Math.min(21, chipHeight * 0.56), '500');
    c.textAlign = 'center';
    c.fillText(WORDS[id], CHIP.x + CHIP.width / 2, y + 1);
    if (gap > 30) {
      c.fillStyle = MUTE;
      c.font = font(13);
      c.textAlign = 'left';
      c.fillText('n° ' + id, CHIP.x + CHIP.width + 6, y - chipHeight / 2 + 7);
    }
  });

  // 2 · La table : une ligne de boutons par mot du vocabulaire.
  const tableCell = TABLE.width / width, tableRight = TABLE.x + TABLE.width;
  c.globalAlpha = shown(1);
  table.forEach((line, r) => {
    const used = ids.includes(r);
    line.forEach((v, k) => {
      c.fillStyle = tone(v, used ? 0.5 : 1.6);
      c.fillRect(TABLE.x + k * tableCell, TABLE.y + r * TABLE.row, tableCell - 0.4, TABLE.row - 1.5);
    });
  });
  ids.forEach((id, i) => {
    const lineY = TABLE.y + id * TABLE.row + TABLE.row / 2 - 1;
    c.globalAlpha = shown(1);
    wire(c, CHIP.x + CHIP.width + 36, row(i), TABLE.x - 4, lineY, 1, MUTE, 0.45, flow(i * 0.13));
    c.globalAlpha = shown(2);
    wire(c, tableRight + 3, lineY, station(0) - 6, row(i), 1, MUTE, 0.45, flow(i * 0.13 + 0.4));
  });

  // 3 · Le flux : l'état de chaque mot à l'entrée, puis après chaque couche.
  const choice = ranked[0]?.id;
  trace.stream.forEach((state, s) => {
    c.globalAlpha = shown(2 + s);
    state.forEach((values, i) => strip(c, station(s), row(i), FLOW.width, thick, values));
    if (s === layers) {
      c.strokeStyle = AMBER;
      c.lineWidth = 2;
      c.strokeRect(station(s) - 3, row(last) - thick / 2 - 3, FLOW.width + 6, thick + 6);
    }
    // Ce que la machine dirait si on lisait sa réponse ici, sur la bande du dernier mot.
    const glimpse = glimpses[s];
    if (!glimpse) return;
    c.textAlign = 'center';
    c.fillStyle = MUTE;
    c.font = font(14);
    c.fillText(s === 0 ? 'lue dès l’entrée' : `après la couche ${s}`, station(s) + FLOW.width / 2, 848);
    c.fillStyle = glimpse.id === choice ? AMBER : INK;
    c.font = font(18, '600');
    c.fillText(`« ${WORDS[glimpse.id]} » ${pct(glimpse.value)}`, station(s) + FLOW.width / 2, 872);
  });

  // Les couches : regards de chaque tête, puis neurones du dernier mot.
  trace.layers.forEach((layer, l) => {
    const from = station(l) + FLOW.width + 6, to = station(l + 1) - 6, active = !scene.offLayers.includes(l);
    c.globalAlpha = shown(3 + l);
    for (let i = 0; i < count; i++) wire(c, from, row(i), to, row(i), 1, LINE, 1, -1);
    if (!active) {
      c.fillStyle = '#ff8a8a';
      c.font = font(17, '600');
      c.textAlign = 'left';
      c.fillText('débranchée', from + 12, 74);
      return;
    }
    layer.heads.forEach((head, h) => {
      if (scene.offHeads.some(([ml, mh]) => ml === l && mh === h)) return;
      const color = HEAD_COLORS[h % HEAD_COLORS.length];
      for (let i = 1; i < count; i++)
        for (let j = 0; j < i; j++) {
          const weight = head.attention[i][j], final = i === last;
          if (weight < (final ? 0.05 : 0.14)) continue;
          wire(c, from, row(j), to, row(i), 1 + weight * (final ? 6 : 3), color, weight * (final ? 1 : 0.32), final || weight > 0.6 ? flow(i * 0.21 + j * 0.37 + h * 0.5) : -1, final ? Math.ceil(weight * 3) : 1);
        }
    });
    const neurons = layer.neurons[last];
    if (!neurons) return;
    const lit = neurons.filter((v) => v > 0).length, peak = Math.max(...neurons, 1e-6), step = (to - from) / hidden;
    c.fillStyle = MUTE;
    c.font = font(13);
    c.textAlign = 'center';
    c.fillText(`${lit} / ${hidden} neurones`, (from + to) / 2, 848);
    neurons.forEach((v, k) => {
      c.fillStyle = v > 0 ? `rgba(255,255,255,${0.25 + 0.75 * (v / peak)})` : RAISE;
      c.fillRect(from + k * step, 862, Math.max(1, step - 0.3), 16);
    });
  });

  // 4 · La suite : les candidats les mieux notés pour le mot suivant.
  const outX = station(layers) + FLOW.width + 6, slotY = (k: number) => MIDDLE + (k - (READ.slots - 1) / 2) * READ.step;
  c.globalAlpha = shown(3 + layers);
  ranked.slice(0, READ.slots).forEach(({ id, value }, k) => {
    const y = slotY(k);
    if (value > 0.02) wire(c, outX, row(last), READ.x - 10, y, 1 + value * 7, AMBER, value, flow(k * 0.17), Math.ceil(value * 4));
    c.fillStyle = k === 0 ? INK : MUTE;
    c.font = font(22, k === 0 ? '600' : '');
    c.textAlign = 'left';
    c.fillText(WORDS[id], READ.x, y - 10);
    c.fillStyle = RAISE;
    c.fillRect(READ.x, y + 6, READ.bar, 12);
    c.fillStyle = k === 0 ? AMBER : CYAN;
    c.fillRect(READ.x, y + 6, READ.bar * value, 12);
    c.fillStyle = INK;
    c.font = font(17);
    c.fillText(pct(value), READ.x + READ.bar + 8, y + 12);
  });

  // La boucle : le mot choisi repart de la sortie et vient s'ajouter au texte.
  const since = view.flight ? time - view.flight.since : -1;
  if (view.flight && since >= 0 && since < 0.7 && scene.written) {
    const t = since / 0.7, eased = t * t * (3 - 2 * t), u = 1 - eased;
    const x0 = READ.x + 40, y0 = slotY(view.flight.slot), x1 = CHIP.x + CHIP.width / 2, y1 = row(last);
    const x = u * u * u * x0 + 3 * u * u * eased * 1100 + 3 * u * eased * eased * 400 + eased * eased * eased * x1;
    const y = u * u * u * y0 + 3 * u * u * eased * -30 + 3 * u * eased * eased * -30 + eased * eased * eased * y1;
    c.globalAlpha = base;
    c.fillStyle = AMBER;
    c.beginPath();
    c.roundRect(x - 52, y - 17, 104, 34, 9);
    c.fill();
    c.fillStyle = '#1a1205';
    c.font = font(18, '600');
    c.textAlign = 'center';
    c.fillText(WORDS[ids[last]], x, y + 1);
  }
  c.globalAlpha = base;
}

/** Transforme des notes en candidats classés, du plus probable au moins probable. */
export function rank(logits: readonly number[], heat = 1): Guess[] {
  const peak = Math.max(...logits), exps = logits.map((v) => Math.exp((v - peak) / heat)), sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v, id) => ({ id, value: v / sum })).sort((a, b) => b.value - a.value);
}

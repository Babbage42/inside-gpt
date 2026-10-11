import { MiniLanguageModel, MiniSnapshot } from '../v2/mini-model';

export const PILOT_STORAGE_KEY = 'gradient-lab-v3-pilot-v1';
export interface AnswerRecord {
  readonly value: string;
  readonly explanation: string;
  readonly attempts: number;
  readonly hint: boolean;
  readonly result?: 'correct' | 'incorrect';
  readonly assisted: boolean;
}
export interface HistoryPoint { readonly epoch: number; readonly loss: number; readonly testProbability: number; }
export interface PilotState {
  readonly version: 1;
  readonly scene: number;
  readonly seen: readonly number[];
  readonly answers: Readonly<Record<string, AnswerRecord>>;
  readonly notes: string;
  readonly lab: MiniSnapshot | null;
  readonly history: readonly HistoryPoint[];
}
export const SCENE_COUNT = 16;
export function emptyPilotState(): PilotState {
  return { version: 1, scene: 0, seen: [0], answers: {}, notes: '', lab: null, history: [] };
}
export function readPilotState(storage: Pick<Storage, 'getItem'> | null): PilotState {
  try {
    const raw = storage?.getItem(PILOT_STORAGE_KEY);
    if (!raw) return emptyPilotState();
    const value = JSON.parse(raw) as Partial<PilotState>;
    if (value.version !== 1) return emptyPilotState();
    let lab: MiniSnapshot | null = null;
    if (value.lab) {
      try { new MiniLanguageModel().restore(value.lab); lab = value.lab; } catch { /* only discard the damaged lab */ }
    }
    const answers: Record<string, AnswerRecord> = {};
    if (value.answers && typeof value.answers === 'object') {
      for (const [key, answer] of Object.entries(value.answers)) {
        if (answer && typeof answer.value === 'string' && typeof answer.explanation === 'string' &&
            Number.isInteger(answer.attempts) && answer.attempts >= 0 && typeof answer.hint === 'boolean' &&
            typeof answer.assisted === 'boolean' &&
            (answer.result === undefined || answer.result === 'correct' || answer.result === 'incorrect')) {
          answers[key] = answer;
        }
      }
    }
    return {
      version: 1,
      scene: Number.isInteger(value.scene) && value.scene! >= 0 && value.scene! < SCENE_COUNT ? value.scene! : 0,
      seen: Array.isArray(value.seen) ? value.seen.filter((s) => Number.isInteger(s) && s >= 0 && s < SCENE_COUNT) : [0],
      answers, notes: typeof value.notes === 'string' ? value.notes : '', lab,
      history: lab && Array.isArray(value.history) ? value.history.filter((p) => p && Number.isInteger(p.epoch) &&
        p.epoch >= 0 && p.epoch <= lab!.epoch && Number.isFinite(p.loss) && p.loss >= 0 &&
        Number.isFinite(p.testProbability) && p.testProbability >= 0 && p.testProbability <= 1) : [],
    };
  } catch { return emptyPilotState(); }
}
export function writePilotState(storage: Pick<Storage, 'setItem'> | null, state: PilotState): boolean {
  try { if (!storage) return false; storage.setItem(PILOT_STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
export function parseAnswer(value: string): number {
  const cleaned = value.trim().replace(/\s/g, '').replace(/−/g, '-').replace(',', '.');
  return cleaned ? Number(cleaned) : NaN;
}

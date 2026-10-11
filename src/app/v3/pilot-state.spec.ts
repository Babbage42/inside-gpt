import { PilotModel } from './pilot-model';
import { emptyPilotState, parseAnswer, PILOT_STORAGE_KEY, readPilotState, writePilotState } from './pilot-state';

describe('V3: reprise et isolation des sessions', () => {
  it('writes only to the dedicated V3 key and restores progress and lab exactly', () => {
    const model = new PilotModel().clone(); model.train(10);
    const state = { ...emptyPilotState(), scene: 14, seen: [0, 4, 14], notes: 'Je reconstruis le calcul.', lab: model.snapshot(),
      answers: { mean: { value: '0,0292', explanation: 'Je divise par cinq.', attempts: 1, hint: false, assisted: false, result: 'correct' as const } } };
    const memory = new Map<string, string>([['gradient-lab-v2-mini-model-v2', 'existing V2']]);
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) };
    expect(writePilotState(storage, state)).toBeTrue();
    expect(memory.get('gradient-lab-v2-mini-model-v2')).toBe('existing V2');
    expect(memory.has(PILOT_STORAGE_KEY)).toBeTrue();
    expect(readPilotState(storage)).toEqual(state);
  });
  it('falls back for corrupt JSON and unsupported versions', () => {
    expect(readPilotState({ getItem: () => '{broken' })).toEqual(emptyPilotState());
    expect(readPilotState({ getItem: () => JSON.stringify({ version: 22 }) })).toEqual(emptyPilotState());
  });
  it('preserves learning answers when only the lab is damaged', () => {
    const restored = readPilotState({ getItem: () => JSON.stringify({ ...emptyPilotState(), scene: 12,
      notes: 'Notes conservées', lab: { epoch: 2, embeddings: [] }, history: [{ epoch: 2, loss: 1, testProbability: 0.5 }] }) });
    expect(restored.scene).toBe(12); expect(restored.notes).toBe('Notes conservées');
    expect(restored.lab).toBeNull(); expect(restored.history).toEqual([]);
  });
  it('rejects invalid scene numbers, malformed answers and non-finite histories', () => {
    const restored = readPilotState({ getItem: () => JSON.stringify({ ...emptyPilotState(), scene: 99, seen: [0, -1, 99],
      answers: { broken: { value: 23 } } }) });
    expect(restored.scene).toBe(0); expect(restored.seen).toEqual([0]); expect(restored.answers).toEqual({});
  });
  it('continues safely when storage is unavailable', () => {
    expect(readPilotState({ getItem: () => { throw new Error('denied'); } })).toEqual(emptyPilotState());
    expect(writePilotState({ setItem: () => { throw new Error('full'); } }, emptyPilotState())).toBeFalse();
    expect(writePilotState(null, emptyPilotState())).toBeFalse();
  });
  it('parses French decimal answers without treating empty input as zero', () => {
    expect(parseAnswer(' −0,0283439 ')).toBeCloseTo(-0.0283439, 12);
    expect(parseAnswer('2e-4')).toBe(0.0002);
    expect(Number.isNaN(parseAnswer(' '))).toBeTrue();
    expect(Number.isNaN(parseAnswer('abc'))).toBeTrue();
  });
});

import { MiniLanguageModel, promptTokens } from './mini-model';
import { probeOrder } from './order-probe';

describe('controlled order probes', () => {
  const model = new MiniLanguageModel();
  const normal = promptTokens('chat', 'mange');
  const swapped = [...normal];
  [swapped[2], swapped[3]] = [swapped[3], swapped[2]];

  it('uses precisely the original mean model for its baseline', () => {
    const original = model.trace(normal);
    const probe = probeOrder(model.snapshot(), normal, 'mean');
    expect(probe.context).toEqual(original.context);
    expect(probe.probabilities).toEqual(original.probabilities);
  });

  it('cannot recover order by adding a fixed position vector before a mean', () => {
    for (const strength of [0, 0.25, 1.5]) {
      const a = probeOrder(model.snapshot(), normal, 'add-position', 2, strength);
      const b = probeOrder(model.snapshot(), swapped, 'add-position', 2, strength);
      expect(a.context).toEqual(b.context);
      expect(a.probabilities).toEqual(b.probabilities);
    }
  });

  it('becomes order-sensitive when token values interact with their positions', () => {
    const a = probeOrder(model.snapshot(), normal, 'weighted', 2, 1);
    const b = probeOrder(model.snapshot(), swapped, 'weighted', 2, 1);
    expect(a.context[0]).not.toBeCloseTo(b.context[0]);
    expect(a.probabilities).not.toEqual(b.probabilities);
  });
});

import { MiniLanguageModel, MiniSnapshot, MiniTrace, promptTokens } from '../v2/mini-model';
import { vocabulary } from '../v2/world';

/** A read-only teaching reference. Every intervention runs on a separate real model. */
export class PilotModel {
  private readonly reference = new MiniLanguageModel();
  readonly snapshot = this.reference.snapshot();
  readonly input = promptTokens('chat', 'mange', 'un');
  readonly trace = this.reference.trace(this.input, 'souris');
  readonly targetIndex = vocabulary.indexOf('souris');

  embedding(token: string): readonly number[] { return this.reference.embedding(token); }
  weight(coordinate: number): number { return this.reference.outputWeight(coordinate, 'souris'); }
  gradient(coordinate = 0) {
    return this.reference.gradientCheck({ input: this.input, target: 'souris' }, coordinate);
  }
  embeddingGradient(token = 'chat', coordinate = 0) {
    return this.reference.gradientCheckEmbedding({ input: this.input, target: 'souris' }, token, coordinate);
  }
  contributions(): number[] {
    return this.trace.context.map((value, d) => value * this.weight(d));
  }
  interveneWeight(delta: number, coordinate = 0): MiniTrace {
    const model = this.clone();
    const snapshot = model.snapshot();
    const output = snapshot.output.map((row) => [...row]);
    output[coordinate][this.targetIndex] += delta;
    model.restore({ ...snapshot, output });
    return model.trace(this.input, 'souris');
  }
  interveneEmbedding(token: string, delta: number, coordinate = 0): MiniTrace {
    const model = this.clone();
    const snapshot = model.snapshot();
    const embeddings = snapshot.embeddings.map((row) => [...row]);
    const index = vocabulary.indexOf(token as typeof vocabulary[number]);
    if (index < 0) throw new Error('Token inconnu.');
    embeddings[index][coordinate] += delta;
    model.restore({ ...snapshot, embeddings });
    return model.trace(this.input, 'souris');
  }
  /** Counterfactual at the output, not a claimed learned parameter update. */
  interveneScore(token: string, delta: number) {
    const index = vocabulary.indexOf(token as typeof vocabulary[number]);
    if (index < 0) throw new Error('Token inconnu.');
    const logits = this.trace.logits.map((s, j) => s + (j === index ? delta : 0));
    const max = Math.max(...logits);
    const exp = logits.map((s) => Math.exp(s - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return { logits, probabilities: exp.map((value) => value / sum) };
  }
  singleUpdate(rate: number) {
    const gradient = this.gradient().analytic;
    return {
      gradient, beforeWeight: this.weight(0), afterWeight: this.weight(0) - rate * gradient,
      trace: this.interveneWeight(-rate * gradient),
    };
  }
  outputGradientFor(input: readonly string[], target: string, coordinate = 0) {
    const trace = this.reference.trace(input, target);
    return trace.context[coordinate] * (trace.probabilities[this.targetIndex] - (target === 'souris' ? 1 : 0));
  }
  clone(snapshot: MiniSnapshot = this.snapshot): MiniLanguageModel {
    const model = new MiniLanguageModel();
    model.restore(snapshot);
    return model;
  }
}

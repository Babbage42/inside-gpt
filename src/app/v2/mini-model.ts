import { corpus, initialEmbedding, trainingPairs, vocabulary } from './world';

export interface MiniExample { readonly input: readonly string[]; readonly target: string; }
export const examples: readonly MiniExample[] = corpus.flatMap(trainingPairs);

export interface MiniTrace {
  readonly input: readonly string[];
  readonly rows: readonly (readonly number[])[];
  readonly context: readonly number[];
  readonly logits: readonly number[];
  readonly probabilities: readonly number[];
  readonly predicted: string;
  readonly target?: string;
  readonly loss?: number;
}

export interface MiniSnapshot {
  readonly epoch: number;
  readonly embeddings: readonly (readonly number[])[];
  readonly output: readonly (readonly number[])[];
  readonly bias: readonly number[];
}

function initialOutput(): number[][] {
  let state = 23;
  const next = (): number => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (state / 0x100000000 * 2 - 1) * 0.2;
  };
  // Continue the same deterministic sequence after the 12 × 4 embedding cells.
  for (let i = 0; i < vocabulary.length * 4; i++) next();
  return Array.from({ length: 4 }, () => vocabulary.map(() => +next().toFixed(3)));
}

/** The first executable layer of the V2 miniature model: E → mean → W,b → softmax.
 *  It is deliberately order-blind; a later context mechanism must address that limit.
 */
export class MiniLanguageModel {
  readonly vocabulary = vocabulary;
  readonly width = 4;
  private embeddings = initialEmbedding();
  private output = initialOutput();
  private bias = vocabulary.map(() => 0);
  private epochValue = 0;

  get epoch(): number { return this.epochValue; }
  embedding(token: string): readonly number[] { return [...this.embeddings[this.id(token)]]; }
  outputWeight(coordinate: number, token: string): number { return this.output[coordinate][this.id(token)]; }
  outputBias(token: string): number { return this.bias[this.id(token)]; }

  trace(input: readonly string[], target?: string): MiniTrace {
    if (!input.length) throw new Error('Un préfixe doit contenir au moins un token.');
    const rows = input.map((token) => this.embedding(token));
    const context = Array.from({ length: this.width }, (_, d) =>
      rows.reduce((total, row) => total + row[d], 0) / rows.length,
    );
    const logits = vocabulary.map((_, j) =>
      this.bias[j] + context.reduce((total, value, d) => total + value * this.output[d][j], 0),
    );
    const maximum = Math.max(...logits);
    const exponentials = logits.map((score) => Math.exp(score - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    const probabilities = exponentials.map((value) => value / total);
    const predicted = vocabulary[probabilities.indexOf(Math.max(...probabilities))];
    const targetId = target === undefined ? -1 : this.id(target);
    return {
      input: [...input], rows, context, logits, probabilities, predicted, target,
      loss: targetId < 0 ? undefined : -Math.log(probabilities[targetId]),
    };
  }

  meanLoss(items: readonly MiniExample[] = examples): number {
    return items.reduce((total, item) => total + this.trace(item.input, item.target).loss!, 0) / items.length;
  }

  gradientCheck(item: MiniExample, coordinate = 0, epsilon = 0.0001): {
    readonly analytic: number; readonly numeric: number;
    readonly lossMinus: number; readonly lossPlus: number;
  } {
    const targetId = this.id(item.target);
    const trace = this.trace(item.input, item.target);
    const analytic = trace.context[coordinate] * (trace.probabilities[targetId] - 1);
    const original = this.output[coordinate][targetId];
    this.output[coordinate][targetId] = original - epsilon;
    const lossMinus = this.trace(item.input, item.target).loss!;
    this.output[coordinate][targetId] = original + epsilon;
    const lossPlus = this.trace(item.input, item.target).loss!;
    this.output[coordinate][targetId] = original;
    return { analytic, numeric: (lossPlus - lossMinus) / (2 * epsilon), lossMinus, lossPlus };
  }

  gradientCheckEmbedding(item: MiniExample, token: string, coordinate = 0, epsilon = 0.0001): {
    readonly analytic: number; readonly numeric: number;
    readonly contextGradient: number; readonly occurrences: number;
    readonly lossMinus: number; readonly lossPlus: number;
  } {
    const id = this.id(token);
    const trace = this.trace(item.input, item.target);
    const targetId = this.id(item.target);
    const occurrences = item.input.filter((part) => part === token).length;
    const contextGradient = vocabulary.reduce((total, _, j) =>
      total + this.output[coordinate][j] * (trace.probabilities[j] - (j === targetId ? 1 : 0)), 0);
    const analytic = contextGradient * occurrences / item.input.length;
    const original = this.embeddings[id][coordinate];
    this.embeddings[id][coordinate] = original - epsilon;
    const lossMinus = this.trace(item.input, item.target).loss!;
    this.embeddings[id][coordinate] = original + epsilon;
    const lossPlus = this.trace(item.input, item.target).loss!;
    this.embeddings[id][coordinate] = original;
    return { analytic, numeric: (lossPlus - lossMinus) / (2 * epsilon), contextGradient,
      occurrences, lossMinus, lossPlus };
  }

  batchGradientOutputWeight(coordinate: number, token: string, items: readonly MiniExample[] = examples): number {
    const id = this.id(token);
    return items.reduce((total, item) => {
      const trace = this.trace(item.input, item.target);
      return total + trace.context[coordinate] * (trace.probabilities[id] - (item.target === token ? 1 : 0));
    }, 0) / items.length;
  }

  train(epochs: number, learningRate = 0.7, items: readonly MiniExample[] = examples): number[] {
    if (!Number.isInteger(epochs) || epochs < 0 || epochs > 1000) throw new Error('Nombre d’époques invalide.');
    const losses: number[] = [];
    for (let epoch = 0; epoch < epochs; epoch++) {
      const eGrad = this.embeddings.map((row) => row.map(() => 0));
      const wGrad = this.output.map((row) => row.map(() => 0));
      const bGrad = this.bias.map(() => 0);
      for (const item of items) {
        const trace = this.trace(item.input, item.target);
        const target = this.id(item.target);
        const contextGrad = Array(this.width).fill(0) as number[];
        vocabulary.forEach((_, j) => {
          const g = trace.probabilities[j] - (j === target ? 1 : 0);
          bGrad[j] += g;
          for (let d = 0; d < this.width; d++) {
            wGrad[d][j] += trace.context[d] * g;
            contextGrad[d] += this.output[d][j] * g;
          }
        });
        for (const token of item.input) {
          const id = this.id(token);
          for (let d = 0; d < this.width; d++) eGrad[id][d] += contextGrad[d] / item.input.length;
        }
      }
      const scale = learningRate / items.length;
      this.embeddings = this.embeddings.map((row, i) => row.map((value, d) => value - scale * eGrad[i][d]));
      this.output = this.output.map((row, d) => row.map((value, j) => value - scale * wGrad[d][j]));
      this.bias = this.bias.map((value, j) => value - scale * bGrad[j]);
      this.epochValue++;
      losses.push(this.meanLoss(items));
    }
    return losses;
  }

  snapshot(): MiniSnapshot {
    return {
      epoch: this.epochValue,
      embeddings: this.embeddings.map((row) => [...row]),
      output: this.output.map((row) => [...row]),
      bias: [...this.bias],
    };
  }

  restore(value: MiniSnapshot): void {
    const finite = (rows: readonly (readonly number[])[]): boolean => rows.every((row) => row.every(Number.isFinite));
    if (!Number.isInteger(value.epoch) || value.epoch < 0 ||
      value.embeddings.length !== vocabulary.length || value.embeddings.some((row) => row.length !== 4) ||
      value.output.length !== 4 || value.output.some((row) => row.length !== vocabulary.length) ||
      value.bias.length !== vocabulary.length || !value.bias.every(Number.isFinite) ||
      !finite(value.embeddings) || !finite(value.output)) throw new Error('Checkpoint V2 invalide.');
    this.embeddings = value.embeddings.map((row) => [...row]);
    this.output = value.output.map((row) => [...row]);
    this.bias = [...value.bias];
    this.epochValue = value.epoch;
  }

  private id(token: string): number {
    const id = vocabulary.indexOf(token as typeof vocabulary[number]);
    if (id < 0) throw new Error(`Token hors du vocabulaire : ${token}`);
    return id;
  }
}

export function promptTokens(animal: 'chat' | 'chien', verb: 'mange' | 'regarde', article: 'le' | 'un' = 'le'): string[] {
  return ['<début>', article, animal, verb, 'la'];
}

export function sentencePairs(index: number): readonly MiniExample[] {
  return trainingPairs(corpus[index]);
}

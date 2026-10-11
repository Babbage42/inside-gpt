export type Token = string;

export interface LanguageExample {
  readonly tokens: readonly Token[];
  readonly target: Token;
}

export interface BaselineTrace {
  readonly tokenIds: readonly number[];
  readonly embeddings: readonly (readonly number[])[];
  readonly context: readonly number[];
  readonly logits: readonly number[];
  readonly probabilities: readonly number[];
  readonly predicted: string;
  readonly loss?: number;
}

export interface AttentionTrace extends BaselineTrace {
  readonly query: readonly number[];
  readonly keys: readonly (readonly number[])[];
  readonly values: readonly (readonly number[])[];
  readonly scores: readonly number[];
  readonly attention: readonly number[];
  readonly contributions: readonly (readonly number[])[];
  readonly residual: readonly number[];
  readonly normalized: readonly number[];
  readonly hidden: readonly number[];
  readonly mlp: readonly number[];
  readonly blockOutput: readonly number[];
}

export interface TrainingReport {
  readonly epoch: number;
  readonly loss: number;
}

export interface BaselineGradientTrace {
  readonly trace: BaselineTrace;
  readonly targetVector: readonly number[];
  readonly logitGradients: readonly number[];
  readonly contextGradients: readonly number[];
  readonly embeddingGradients: readonly (readonly number[])[];
  readonly outputWeightGradients: readonly (readonly number[])[];
  readonly biasGradients: readonly number[];
}

function softmax(values: readonly number[]): number[] {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function seededValues(count: number, scale: number, seed: number): number[] {
  let state = seed >>> 0;
  return Array.from({ length: count }, () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (((state / 0xffffffff) * 2 - 1) * scale);
  });
}

/**
 * Temporary baseline used in lesson 5: look up one embedding per token, average
 * them, then classify. Every displayed value comes from this exact model.
 */
export class EmbeddingBaseline {
  readonly dimension = 2;
  readonly vocabulary: readonly string[];
  readonly candidates: readonly string[];
  private embeddings: number[][];
  private output: number[][];
  private bias: number[];
  private epochValue = 0;

  constructor(vocabulary: readonly string[], candidates: readonly string[], seed = 17) {
    this.vocabulary = [...vocabulary];
    this.candidates = [...candidates];
    const values = seededValues(
      vocabulary.length * this.dimension + candidates.length * this.dimension,
      0.18,
      seed,
    );
    let cursor = 0;
    this.embeddings = vocabulary.map(() =>
      Array.from({ length: this.dimension }, () => values[cursor++]),
    );
    this.output = candidates.map(() =>
      Array.from({ length: this.dimension }, () => values[cursor++]),
    );
    this.bias = candidates.map(() => 0);
  }

  get epoch(): number {
    return this.epochValue;
  }

  /** Independent copy for controlled interventions, without changing the trained model. */
  clone(): EmbeddingBaseline {
    const copy = new EmbeddingBaseline(this.vocabulary, this.candidates);
    copy.embeddings = this.embeddings.map((row) => [...row]);
    copy.output = this.output.map((row) => [...row]);
    copy.bias = [...this.bias];
    copy.epochValue = this.epochValue;
    return copy;
  }

  setEmbeddingCoordinate(token: string, dimension: number, value: number): void {
    if (!Number.isInteger(dimension) || dimension < 0 || dimension >= this.dimension || !Number.isFinite(value)) {
      throw new Error('Coordonnée invalide');
    }
    this.embeddings[this.tokenId(token)][dimension] = value;
  }

  /** Rotate both sides of each dot product: predictions must stay identical. */
  rotated(): EmbeddingBaseline {
    const copy = this.clone();
    copy.embeddings = this.embeddings.map(([x, y]) => [-y, x]);
    copy.output = this.output.map(([x, y]) => [-y, x]);
    return copy;
  }

  embedding(token: string): readonly number[] {
    return [...this.embeddings[this.tokenId(token)]];
  }

  outputWeights(candidate: string): readonly number[] {
    const index = this.candidates.indexOf(candidate);
    if (index < 0) throw new Error(`Candidat absent: ${candidate}`);
    return [...this.output[index]];
  }

  outputBias(candidate: string): number {
    const index = this.candidates.indexOf(candidate);
    if (index < 0) throw new Error(`Candidat absent: ${candidate}`);
    return this.bias[index];
  }

  trace(tokens: readonly string[], target?: string): BaselineTrace {
    const tokenIds = tokens.map((token) => this.tokenId(token));
    const embeddings = tokenIds.map((id) => [...this.embeddings[id]]);
    const context = Array.from({ length: this.dimension }, (_, dimension) =>
      embeddings.reduce((sum, row) => sum + row[dimension], 0) / embeddings.length,
    );
    const logits = this.output.map(
      (row, candidate) =>
        row.reduce((sum, weight, dimension) => sum + weight * context[dimension], 0) +
        this.bias[candidate],
    );
    const probabilities = softmax(logits);
    const predicted = this.candidates[probabilities.indexOf(Math.max(...probabilities))];
    const targetIndex = target === undefined ? -1 : this.candidates.indexOf(target);
    return {
      tokenIds,
      embeddings,
      context,
      logits,
      probabilities,
      predicted,
      loss: targetIndex < 0 ? undefined : -Math.log(probabilities[targetIndex]),
    };
  }

  gradientTrace(example: LanguageExample): BaselineGradientTrace {
    const trace = this.trace(example.tokens, example.target);
    const targetIndex = this.candidates.indexOf(example.target);
    const targetVector = this.candidates.map((_, index) => (index === targetIndex ? 1 : 0));
    const logitGradients = trace.probabilities.map(
      (probability, index) => probability - targetVector[index],
    );
    const contextGradients = Array.from({ length: this.dimension }, (_, dimension) =>
      this.candidates.reduce(
        (total, _, candidate) =>
          total + logitGradients[candidate] * this.output[candidate][dimension],
        0,
      ),
    );
    const embeddingGradients = example.tokens.map(() =>
      contextGradients.map((gradient) => gradient / example.tokens.length),
    );
    const outputWeightGradients = this.candidates.map((_, candidate) =>
      trace.context.map((value) => logitGradients[candidate] * value),
    );
    return {
      trace,
      targetVector,
      logitGradients,
      contextGradients,
      embeddingGradients,
      outputWeightGradients,
      biasGradients: logitGradients,
    };
  }

  train(examples: readonly LanguageExample[], epochs: number, learningRate = 0.16): TrainingReport {
    for (let epoch = 0; epoch < epochs; epoch++) {
      const embeddingGradients = this.embeddings.map((row) => row.map(() => 0));
      const outputGradients = this.output.map((row) => row.map(() => 0));
      const biasGradients = this.bias.map(() => 0);

      for (const example of examples) {
        const trace = this.trace(example.tokens, example.target);
        const targetIndex = this.candidates.indexOf(example.target);
        const contextGradient = Array(this.dimension).fill(0) as number[];

        this.candidates.forEach((_, candidate) => {
          const logitGradient = trace.probabilities[candidate] - (candidate === targetIndex ? 1 : 0);
          biasGradients[candidate] += logitGradient;
          for (let dimension = 0; dimension < this.dimension; dimension++) {
            outputGradients[candidate][dimension] += logitGradient * trace.context[dimension];
            contextGradient[dimension] += logitGradient * this.output[candidate][dimension];
          }
        });

        for (const token of example.tokens) {
          const id = this.tokenId(token);
          for (let dimension = 0; dimension < this.dimension; dimension++) {
            embeddingGradients[id][dimension] += contextGradient[dimension] / example.tokens.length;
          }
        }
      }

      const scale = learningRate / examples.length;
      this.embeddings = this.embeddings.map((row, token) =>
        row.map((value, dimension) => value - scale * embeddingGradients[token][dimension]),
      );
      this.output = this.output.map((row, candidate) =>
        row.map((value, dimension) => value - scale * outputGradients[candidate][dimension]),
      );
      this.bias = this.bias.map((value, candidate) => value - scale * biasGradients[candidate]);
      this.epochValue++;
    }

    return { epoch: this.epoch, loss: this.meanLoss(examples) };
  }

  meanLoss(examples: readonly LanguageExample[]): number {
    return examples.reduce((sum, example) => sum + this.trace(example.tokens, example.target).loss!, 0) /
      examples.length;
  }

  private tokenId(token: string): number {
    const id = this.vocabulary.indexOf(token);
    if (id < 0) throw new Error(`Token absent du vocabulaire: ${token}`);
    return id;
  }
}

type Backward = (gradient: number) => void;

class Scalar {
  grad = 0;

  constructor(
    readonly data: number,
    readonly parents: readonly Scalar[] = [],
    private readonly backwardLocal: Backward = () => undefined,
  ) {}

  add(other: Scalar): Scalar {
    return new Scalar(this.data + other.data, [this, other], (gradient) => {
      this.grad += gradient;
      other.grad += gradient;
    });
  }

  multiply(other: Scalar): Scalar {
    return new Scalar(this.data * other.data, [this, other], (gradient) => {
      this.grad += other.data * gradient;
      other.grad += this.data * gradient;
    });
  }

  exp(): Scalar {
    const output = Math.exp(this.data);
    return new Scalar(output, [this], (gradient) => (this.grad += output * gradient));
  }

  log(): Scalar {
    return new Scalar(Math.log(this.data), [this], (gradient) => (this.grad += gradient / this.data));
  }

  tanh(): Scalar {
    const output = Math.tanh(this.data);
    return new Scalar(output, [this], (gradient) => (this.grad += (1 - output ** 2) * gradient));
  }

  power(exponent: number): Scalar {
    const output = this.data ** exponent;
    return new Scalar(output, [this], (gradient) => {
      this.grad += exponent * this.data ** (exponent - 1) * gradient;
    });
  }

  backward(): void {
    const ordered: Scalar[] = [];
    const visited = new Set<Scalar>();
    const visit = (node: Scalar): void => {
      if (visited.has(node)) return;
      visited.add(node);
      node.parents.forEach(visit);
      ordered.push(node);
    };
    visit(this);
    ordered.forEach((node) => (node.grad = 0));
    this.grad = 1;
    ordered.reverse().forEach((node) => node.backwardLocal(node.grad));
  }
}

const constant = (value: number): Scalar => new Scalar(value);
const sum = (values: readonly Scalar[]): Scalar =>
  values.reduce((total, value) => total.add(value), constant(0));

/** A real, tiny, one-head causal attention model trained by reverse-mode autodiff. */
export class TinyAttentionModel {
  readonly embeddingDimension = 3;
  readonly attentionDimension = 2;
  readonly valueDimension = 3;
  readonly vocabulary: readonly string[];
  readonly candidates: readonly string[];
  private parameters = new Map<string, number>();
  private epochValue = 0;

  constructor(vocabulary: readonly string[], candidates: readonly string[], seed = 29) {
    this.vocabulary = [...vocabulary];
    this.candidates = [...candidates];
    const names = this.parameterNames();
    const values = seededValues(names.length, 0.22, seed);
    names.forEach((name, index) => this.parameters.set(name, name.startsWith('b:') ? 0 : values[index]));
  }

  get epoch(): number {
    return this.epochValue;
  }

  trace(tokens: readonly string[], target?: string): AttentionTrace {
    return this.forward(tokens, target).trace;
  }

  train(examples: readonly LanguageExample[], epochs: number, learningRate = 0.08): TrainingReport {
    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradients = new Map<string, number>();
      for (const example of examples) {
        const result = this.forward(example.tokens, example.target);
        result.loss!.backward();
        result.leaves.forEach((leaf, name) =>
          gradients.set(name, (gradients.get(name) ?? 0) + leaf.grad),
        );
      }
      const scale = learningRate / examples.length;
      for (const [name, gradient] of gradients) {
        const clipped = Math.max(-4, Math.min(4, gradient));
        this.parameters.set(name, this.parameters.get(name)! - scale * clipped);
      }
      this.epochValue++;
    }
    return { epoch: this.epoch, loss: this.meanLoss(examples) };
  }

  meanLoss(examples: readonly LanguageExample[]): number {
    return examples.reduce((total, example) => total + this.trace(example.tokens, example.target).loss!, 0) /
      examples.length;
  }

  embedding(token: string): readonly number[] {
    this.requireToken(token);
    return Array.from({ length: this.embeddingDimension }, (_, dimension) =>
      this.parameters.get(`E:${token}:${dimension}`)!,
    );
  }

  parameterValue(name: string): number {
    const value = this.parameters.get(name);
    if (value === undefined) throw new Error(`Paramètre inconnu : ${name}`);
    return value;
  }

  private forward(
    tokens: readonly string[],
    target?: string,
  ): { trace: AttentionTrace; loss?: Scalar; leaves: Map<string, Scalar> } {
    tokens.forEach((token) => this.requireToken(token));
    const leaves = new Map<string, Scalar>();
    const parameter = (name: string): Scalar => {
      if (!leaves.has(name)) leaves.set(name, new Scalar(this.parameters.get(name)!));
      return leaves.get(name)!;
    };
    const embedding = (token: string): Scalar[] =>
      Array.from({ length: this.embeddingDimension }, (_, dimension) =>
        parameter(`E:${token}:${dimension}`),
      );
    const project = (vector: readonly Scalar[], matrix: string, width: number): Scalar[] =>
      Array.from({ length: width }, (_, output) =>
        sum(vector.map((value, input) => value.multiply(parameter(`${matrix}:${input}:${output}`)))),
      );

    const embedded = tokens.map(embedding);
    const query = project(embedded.at(-1)!, 'Wq', this.attentionDimension);
    const keys = embedded.map((row) => project(row, 'Wk', this.attentionDimension));
    const values = embedded.map((row) => project(row, 'Wv', this.valueDimension));
    const scoreScale = constant(1 / Math.sqrt(this.attentionDimension));
    const scores = keys.map((key) =>
      sum(query.map((value, dimension) => value.multiply(key[dimension]))).multiply(scoreScale),
    );
    const detachedMaximum = Math.max(...scores.map((score) => score.data));
    const exponentials = scores.map((score) => score.add(constant(-detachedMaximum)).exp());
    const exponentialTotal = sum(exponentials);
    // d(1 / total) is required for a true softmax derivative.
    const differentiableInverse = new Scalar(
      1 / exponentialTotal.data,
      [exponentialTotal],
      (gradient) => (exponentialTotal.grad += -gradient / exponentialTotal.data ** 2),
    );
    const attention = exponentials.map((value) => value.multiply(differentiableInverse));
    const context = Array.from({ length: this.valueDimension }, (_, dimension) =>
      sum(values.map((value, position) => value[dimension].multiply(attention[position]))),
    );
    const normalize = (vector: readonly Scalar[]): Scalar[] => {
      const mean = sum(vector).multiply(constant(1 / vector.length));
      const centered = vector.map((value) => value.add(mean.multiply(constant(-1))));
      const variance = sum(centered.map((value) => value.multiply(value))).multiply(
        constant(1 / vector.length),
      );
      const inverseDeviation = variance.add(constant(1e-5)).power(-0.5);
      return centered.map((value) => value.multiply(inverseDeviation));
    };
    const residual = context.map((value, dimension) => value.add(embedded.at(-1)![dimension]));
    const normalized = normalize(residual);
    const hidden = Array.from({ length: 4 }, (_, output) =>
      sum([
        ...normalized.map((value, input) => value.multiply(parameter(`W1:${input}:${output}`))),
        parameter(`b1:${output}`),
      ]).tanh(),
    );
    const mlp = Array.from({ length: this.valueDimension }, (_, output) =>
      sum([
        ...hidden.map((value, input) => value.multiply(parameter(`W2:${input}:${output}`))),
        parameter(`b2:${output}`),
      ]),
    );
    const blockOutput = normalize(normalized.map((value, dimension) => value.add(mlp[dimension])));
    const logits = this.candidates.map((_, candidate) =>
      sum([
        ...blockOutput.map((value, dimension) =>
          value.multiply(parameter(`Wo:${dimension}:${candidate}`)),
        ),
        parameter(`b:${candidate}`),
      ]),
    );
    const logitMaximum = Math.max(...logits.map((logit) => logit.data));
    const outputExponentials = logits.map((logit) => logit.add(constant(-logitMaximum)).exp());
    const outputTotal = sum(outputExponentials);
    const outputInverse = new Scalar(1 / outputTotal.data, [outputTotal], (gradient) => {
      outputTotal.grad += -gradient / outputTotal.data ** 2;
    });
    const probabilities = outputExponentials.map((value) => value.multiply(outputInverse));
    const targetIndex = target === undefined ? -1 : this.candidates.indexOf(target);
    const loss = targetIndex < 0 ? undefined : probabilities[targetIndex].log().multiply(constant(-1));
    const numericProbabilities = probabilities.map((value) => value.data);
    const predicted = this.candidates[numericProbabilities.indexOf(Math.max(...numericProbabilities))];

    return {
      leaves,
      loss,
      trace: {
        tokenIds: tokens.map((token) => this.vocabulary.indexOf(token)),
        embeddings: embedded.map((row) => row.map((value) => value.data)),
        query: query.map((value) => value.data),
        keys: keys.map((row) => row.map((value) => value.data)),
        values: values.map((row) => row.map((value) => value.data)),
        scores: scores.map((value) => value.data),
        attention: attention.map((value) => value.data),
        contributions: values.map((row, position) =>
          row.map((value) => value.data * attention[position].data),
        ),
        context: context.map((value) => value.data),
        residual: residual.map((value) => value.data),
        normalized: normalized.map((value) => value.data),
        hidden: hidden.map((value) => value.data),
        mlp: mlp.map((value) => value.data),
        blockOutput: blockOutput.map((value) => value.data),
        logits: logits.map((value) => value.data),
        probabilities: numericProbabilities,
        predicted,
        loss: loss?.data,
      },
    };
  }

  private parameterNames(): string[] {
    const names: string[] = [];
    for (const token of this.vocabulary)
      for (let dimension = 0; dimension < this.embeddingDimension; dimension++)
        names.push(`E:${token}:${dimension}`);
    for (const matrix of ['Wq', 'Wk'])
      for (let input = 0; input < this.embeddingDimension; input++)
        for (let output = 0; output < this.attentionDimension; output++)
          names.push(`${matrix}:${input}:${output}`);
    for (let input = 0; input < this.embeddingDimension; input++)
      for (let output = 0; output < this.valueDimension; output++) names.push(`Wv:${input}:${output}`);
    for (let input = 0; input < this.valueDimension; input++)
      for (let output = 0; output < 4; output++) names.push(`W1:${input}:${output}`);
    for (let output = 0; output < 4; output++) names.push(`b1:${output}`);
    for (let input = 0; input < 4; input++)
      for (let output = 0; output < this.valueDimension; output++) names.push(`W2:${input}:${output}`);
    for (let output = 0; output < this.valueDimension; output++) names.push(`b2:${output}`);
    for (let input = 0; input < this.valueDimension; input++)
      for (let output = 0; output < this.candidates.length; output++) names.push(`Wo:${input}:${output}`);
    for (let candidate = 0; candidate < this.candidates.length; candidate++) names.push(`b:${candidate}`);
    return names;
  }

  private requireToken(token: string): void {
    if (!this.vocabulary.includes(token)) throw new Error(`Token absent du vocabulaire: ${token}`);
  }
}

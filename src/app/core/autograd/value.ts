export type Operation = 'input' | '+' | '-' | '*' | 'tanh' | 'sigmoid' | 'square';

export class Value {
  grad = 0;

  constructor(
    readonly id: string,
    readonly label: string,
    readonly data: number,
    readonly operation: Operation = 'input',
    readonly parents: readonly Value[] = [],
    private readonly localBackward: (gradient: number) => void = () => undefined,
  ) {}

  add(other: Value, id: string, label: string): Value {
    let result!: Value;
    result = new Value(id, label, this.data + other.data, '+', [this, other], (gradient) => {
      this.grad += gradient;
      other.grad += gradient;
    });
    return result;
  }

  subtract(other: Value, id: string, label: string): Value {
    let result!: Value;
    result = new Value(id, label, this.data - other.data, '-', [this, other], (gradient) => {
      this.grad += gradient;
      other.grad -= gradient;
    });
    return result;
  }

  multiply(other: Value, id: string, label: string): Value {
    let result!: Value;
    result = new Value(id, label, this.data * other.data, '*', [this, other], (gradient) => {
      this.grad += other.data * gradient;
      other.grad += this.data * gradient;
    });
    return result;
  }

  tanh(id: string, label: string): Value {
    const output = Math.tanh(this.data);
    let result!: Value;
    result = new Value(id, label, output, 'tanh', [this], (gradient) => {
      this.grad += (1 - output ** 2) * gradient;
    });
    return result;
  }

  sigmoid(id: string, label: string): Value {
    const output = 1 / (1 + Math.exp(-this.data));
    let result!: Value;
    result = new Value(id, label, output, 'sigmoid', [this], (gradient) => {
      this.grad += output * (1 - output) * gradient;
    });
    return result;
  }

  square(id: string, label: string): Value {
    let result!: Value;
    result = new Value(id, label, this.data ** 2, 'square', [this], (gradient) => {
      this.grad += 2 * this.data * gradient;
    });
    return result;
  }

  backward(): void {
    const ordered: Value[] = [];
    const visited = new Set<Value>();

    const visit = (node: Value): void => {
      if (visited.has(node)) return;
      visited.add(node);
      node.parents.forEach(visit);
      ordered.push(node);
    };

    visit(this);
    ordered.forEach((node) => (node.grad = 0));
    this.grad = 1;
    ordered.reverse().forEach((node) => node.localBackward(node.grad));
  }
}

export interface NeuronGraph {
  readonly nodes: readonly Value[];
  readonly loss: Value;
}

export function createLinearGraph(
  inputValue: number,
  weightValue: number,
  biasValue: number,
  targetValue: number,
): NeuronGraph {
  const x = new Value('x', 'heures étudiées', inputValue);
  const w = new Value('w', 'points par heure', weightValue);
  const b = new Value('b', 'niveau de départ', biasValue);
  const target = new Value('target', 'note réelle', targetValue);
  const product = x.multiply(w, 'product', 'points gagnés');
  const prediction = product.add(b, 'prediction', 'note prédite');
  const error = prediction.subtract(target, 'error', 'écart');
  const loss = error.square('loss', 'erreur mesurée');
  loss.backward();

  return { nodes: [x, w, b, target, product, prediction, error, loss], loss };
}

export interface ClassificationGraph {
  readonly nodes: readonly Value[];
  readonly probability: Value;
}

export function createClassificationGraph(
  containsFree: number,
  linkCount: number,
  wordWeight: number,
  linkWeight: number,
  biasValue: number,
): ClassificationGraph {
  const word = new Value('word', 'mot « gratuit »', containsFree);
  const links = new Value('links', 'nombre de liens', linkCount);
  const wordW = new Value('word-weight', 'importance du mot', wordWeight);
  const linkW = new Value('link-weight', 'importance des liens', linkWeight);
  const bias = new Value('classifier-bias', 'prudence de départ', biasValue);
  const wordEvidence = word.multiply(wordW, 'word-evidence', 'indice du mot');
  const linkEvidence = links.multiply(linkW, 'link-evidence', 'indice des liens');
  const evidence = wordEvidence.add(linkEvidence, 'evidence', 'indices réunis');
  const score = evidence.add(bias, 'score', 'score brut');
  const probability = score.sigmoid('probability', 'probabilité de spam');
  probability.backward();

  return {
    nodes: [word, links, wordW, linkW, bias, wordEvidence, linkEvidence, evidence, score, probability],
    probability,
  };
}

export function createNeuronGraph(
  inputValue: number,
  weightValue: number,
  biasValue: number,
  targetValue: number,
): NeuronGraph {
  const x = new Value('x', 'x', inputValue);
  const w = new Value('w', 'w', weightValue);
  const b = new Value('b', 'b', biasValue);
  const target = new Value('target', 'cible', targetValue);
  const product = x.multiply(w, 'product', 'x · w');
  const preActivation = product.add(b, 'pre-activation', 'z');
  const prediction = preActivation.tanh('prediction', 'ŷ');
  const error = prediction.subtract(target, 'error', 'ŷ − cible');
  const loss = error.square('loss', 'L');
  loss.backward();

  return { nodes: [x, w, b, target, product, preActivation, prediction, error, loss], loss };
}

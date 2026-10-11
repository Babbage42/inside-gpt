import { createClassificationGraph, createLinearGraph, createNeuronGraph, Value } from './value';

describe('Value', () => {
  it('propagates gradients through a product', () => {
    const x = new Value('x', 'x', 3);
    const w = new Value('w', 'w', -2);
    const output = x.multiply(w, 'output', 'output');

    output.backward();

    expect(x.grad).toBe(-2);
    expect(w.grad).toBe(3);
  });

  it('matches a numerical gradient for the neuron loss', () => {
    const epsilon = 1e-5;
    const weight = -0.8;
    const graph = createNeuronGraph(1.5, weight, 0.2, 0.5);
    const analytical = graph.nodes.find((node) => node.id === 'w')!.grad;
    const plus = createNeuronGraph(1.5, weight + epsilon, 0.2, 0.5).loss.data;
    const minus = createNeuronGraph(1.5, weight - epsilon, 0.2, 0.5).loss.data;
    const numerical = (plus - minus) / (2 * epsilon);

    expect(analytical).toBeCloseTo(numerical, 5);
  });

  it('builds an understandable linear prediction', () => {
    const graph = createLinearGraph(2, 10, 20, 60);

    expect(graph.nodes.find((node) => node.id === 'prediction')!.data).toBe(40);
    expect(graph.loss.data).toBe(400);
  });

  it('turns a classifier score into a probability', () => {
    const graph = createClassificationGraph(1, 2, 1.5, 0.8, -1.5);
    const score = graph.nodes.find((node) => node.id === 'score')!.data;

    expect(score).toBeCloseTo(1.6, 8);
    expect(graph.probability.data).toBeCloseTo(0.832018, 5);
  });
});

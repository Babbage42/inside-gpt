import { LAST, LookupModel, NAMES, fixedPuzzles, isHeldOut } from './lookup';
import { TinyNet, points } from './neural';
import { Mat, Rng, Tape, randomMat } from './tensor';
import { ABSURD, SENTENCES, UNSEEN, WordMap, wordId } from './word-map';

describe('V4 · autodifférentiation', () => {
  it('donne les mêmes pentes que des différences finies', () => {
    const rng = new Rng(3);
    const table = randomMat(5, 4, 0.5, rng), mix = randomMat(4, 4, 0.5, rng), out = randomMat(4, 6, 0.5, rng), bias = randomMat(1, 6, 0.5, rng);
    const loss = (tape: Tape) => {
      const x = tape.pick(table, [1, 3, 4]);
      const weights = tape.softmax(tape.matmul(tape.matmul(x, mix), x, true), 0.5, true);
      const mixed = tape.add(x, tape.matmul(weights, x));
      return tape.crossEntropy(tape.addRow(tape.matmul(mixed, out), bias), 2, 4).loss;
    };
    const tape = new Tape();
    loss(tape);
    tape.backward();
    for (const param of [table, mix, out, bias]) {
      for (const index of [0, 5, param.data.length - 1]) {
        const saved = param.data[index], step = 1e-2;
        param.data[index] = saved + step;
        const up = loss(new Tape());
        param.data[index] = saved - step;
        const down = loss(new Tape());
        param.data[index] = saved;
        expect(param.grad[index]).toBeCloseTo((up - down) / (2 * step), 2);
      }
    }
  });
});

describe('V4 · carte des mots', () => {
  const trained = () => {
    const model = new WordMap(9, 0.05, 0.3);
    for (let i = 0; i < 1000; i++) model.trainStep();
    return model;
  };

  it('garde « le lion chasse » hors du corpus', () => {
    expect(SENTENCES.some((s) => s.join(' ') === 'le lion chasse .')).toBeFalse();
    expect(UNSEEN.some(([noun, verb]) => noun === 'lion' && verb === 'chasse')).toBeTrue();
  });

  it('calcule la pente du relief d’un mot', () => {
    const model = trained(), lion = wordId('lion'), step = 1e-3;
    const [gx, gy] = model.slopeAt(lion, 0.7, -0.4);
    expect(gx).toBeCloseTo((model.lossAt(lion, 0.7 + step, -0.4) - model.lossAt(lion, 0.7 - step, -0.4)) / (2 * step), 2);
    expect(gy).toBeCloseTo((model.lossAt(lion, 0.7, -0.4 + step) - model.lossAt(lion, 0.7, -0.4 - step)) / (2 * step), 2);
  });

  it('distingue l’inattendu de l’absurde, contrairement au comptage', () => {
    const model = trained();
    const mean = (pairs: readonly (readonly [string, string])[]) =>
      pairs.reduce((sum, [noun, verb]) => sum + model.probs(wordId(noun))[wordId(verb)], 0) / pairs.length;
    expect(mean(UNSEEN)).toBeGreaterThan(5 * mean(ABSURD));
  });
});

describe('V4 · jeu des fiches', () => {
  it('sépare les couples d’entraînement et les couples réservés', () => {
    for (const puzzle of fixedPuzzles('train', 200, 1))
      for (const slot of [0, 2, 4]) expect(isHeldOut(puzzle.ids[slot], puzzle.ids[slot + 1] - NAMES.length)).toBeFalse();
    for (const puzzle of fixedPuzzles('test', 200, 2)) expect(isHeldOut(puzzle.ids[LAST], puzzle.target - NAMES.length)).toBeTrue();
  });

  it('apprend une méthode qui tient sur des couples jamais vus', () => {
    const model = new LookupModel(7, 24, 2, 0.004, 0.2);
    for (let i = 0; i < 1400; i++) model.trainStep(16);
    const unseen = fixedPuzzles('test', 100, 99);
    expect(model.accuracy(unseen)).toBeGreaterThan(0.85);
    // Débrancher l'une ou l'autre couche casse la méthode : les deux étapes sont nécessaires.
    expect(model.accuracy(unseen, 0)).toBeLessThan(0.3);
    expect(model.accuracy(unseen, 1)).toBeLessThan(0.3);
    const inspection = model.inspect(unseen[0]);
    const before = inspection.stream[1][LAST], added = inspection.layers[1].added[LAST], after = inspection.stream[2][LAST];
    before.forEach((value, i) => expect(after[i]).toBeCloseTo(value + added[i], 4));
  }, 60000);
});

describe('V4 · neurones', () => {
  const train = (net: TinyNet, data: ReturnType<typeof points>) => {
    for (let i = 0; i < 300; i++) net.trainStep(data);
    return net.accuracy(data);
  };

  it('un neurone seul sépare une droite, pas un anneau', () => {
    expect(train(new TinyNet(0), points('ligne'))).toBe(1);
    expect(train(new TinyNet(0), points('anneau'))).toBeLessThan(0.75);
  });

  it('trois neurones avec pli enferment l’anneau ; sans pli, non', () => {
    expect(train(new TinyNet(3, true, 1), points('anneau'))).toBe(1);
    expect(train(new TinyNet(8, false, 1), points('anneau'))).toBeLessThan(0.75);
  });
});

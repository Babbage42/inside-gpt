// Entraîne le mini-GPT du dernier chapitre et écrit ses instantanés dans public/models.
// Lancer : npm run train:mini  (deux à trois minutes sur un portable ; le calcul est réparti sur plusieurs cœurs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { MiniConfig, MiniGpt } from '../src/app/v4/engine/mini-gpt';
import { CONTEXT, Case, OPENERS, Skill, WORDS, decode, encode, exam, isTrue, trainingText } from '../src/app/v4/engine/mini-world';
import { Rng } from '../src/app/v4/engine/tensor';

interface Job {
  readonly config: MiniConfig;
  readonly weights: SharedArrayBuffer;
  readonly slopes: SharedArrayBuffer;
}

if (!isMainThread) {
  // Un ouvrier : reçoit des textes, calcule les pentes sur sa part, les dépose dans la mémoire partagée.
  const job = workerData as Job, model = new MiniGpt(job.config);
  const weights = new Float32Array(job.weights), slopes = new Float32Array(job.slopes);
  parentPort!.on('message', (texts: number[][]) => {
    model.load(weights);
    const loss = model.measure(texts);
    model.takeSlopes(slopes);
    parentPort!.postMessage({ loss, guesses: texts.reduce((sum, t) => sum + t.length - 1, 0) });
  });
} else {
  const arg = (name: string, fallback: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
  const steps = arg('steps', 6000), batch = arg('batch', 16), seed = arg('seed', 1), crew = arg('crew', 4);
  const out = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] ?? 'public/models/mini-llm';
  const config: MiniConfig = { vocab: WORDS.length, context: CONTEXT, width: arg('width', 48), layers: arg('layers', 3), heads: arg('heads', 2), hidden: arg('hidden', 96) };
  const model = new MiniGpt(config, seed, arg('lr', 0.0015), arg('decay', 0.1)), size = model.parameterCount, rng = new Rng(seed + 100);

  const weights = new SharedArrayBuffer(size * 4), shared = new Float32Array(weights);
  const workers = Array.from({ length: crew }, () => {
    const slopes = new SharedArrayBuffer(size * 4);
    return { worker: new Worker(new URL(import.meta.url), { workerData: { config, weights, slopes } satisfies Job }), slopes: new Float32Array(slopes) };
  });
  const ask = (worker: Worker, texts: number[][]) =>
    new Promise<{ loss: number; guesses: number }>((resolve) => {
      worker.once('message', resolve);
      worker.postMessage(texts);
    });

  const SKILLS: Skill[] = ['question', 'accord'];
  const exams = new Map<string, Case[]>(SKILLS.map((s) => [s, exam(s)]));
  const grade = (cases: readonly Case[]) => {
    let right = 0;
    for (const c of cases) {
      if (c.prefer) {
        const scores = model.scores(encode(c.prompt)), [good, bad] = encode(c.prefer);
        if (scores[good] > scores[bad]) right++;
        continue;
      }
      const got = model.complete(encode(c.prompt), c.answer.length), want = encode(c.answer);
      if (want.every((id, i) => got[i] === id)) right++;
    }
    return right / cases.length;
  };

  /** Laisse la machine écrire librement, en tirant chaque mot selon ses probabilités, et compte les phrases vraies. */
  const truthful = (count = 150) => {
    const dice = new Rng(4242);
    let right = 0;
    for (let n = 0; n < count; n++) {
      const text = encode([OPENERS[n % OPENERS.length]]);
      while (text.length < 14 && WORDS[text[text.length - 1]] !== '.') {
        const probs = model.probabilities(text);
        let draw = dice.next(), id = 0;
        while (id < probs.length - 1 && draw > probs[id]) draw -= probs[id++];
        text.push(id);
      }
      if (isTrue(decode(text))) right++;
    }
    return right / count;
  };

  // Instantanés resserrés au début, là où tout change vite.
  const marks = [...new Set([0, 25, 50, 100, 150, 200, 300, 400, 550, 700, 900, 1200, 1600, 2200, 3200, 4500, steps].filter((m) => m <= steps))];
  const snapshots: Float32Array[] = [], report: { step: number; loss: number; scores: Record<string, number> }[] = [];
  const began = Date.now();
  let loss = Math.log(WORDS.length);
  const record = (step: number) => {
    const scores: Record<string, number> = Object.fromEntries([...exams].map(([name, cases]) => [name, grade(cases)]));
    scores['vérité'] = truthful();
    snapshots.push(model.snapshot());
    report.push({ step, loss, scores });
    console.log(`pas ${step} · surprise ${loss.toFixed(3)} · ${Object.entries(scores).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')} · ${((Date.now() - began) / 1000).toFixed(0)} s`);
  };

  record(0);
  const mixed = new Float32Array(size);
  for (let step = 1; step <= steps; step++) {
    shared.set(model.snapshot());
    const share = Math.ceil(batch / crew);
    const results = await Promise.all(workers.map(({ worker }) => ask(worker, Array.from({ length: share }, () => encode(trainingText(rng))))));
    // Chaque ouvrier a moyenné sur sa part : on recombine selon le nombre de mots devinés par chacun.
    const guesses = results.reduce((sum, r) => sum + r.guesses, 0);
    mixed.fill(0);
    let current = 0;
    results.forEach((r, w) => {
      const part = r.guesses / guesses, slopes = workers[w].slopes;
      for (let i = 0; i < size; i++) mixed[i] += part * slopes[i];
      current += part * r.loss;
    });
    model.stepWith(mixed);
    loss = step === 1 ? current : loss * 0.98 + current * 0.02;
    if (marks.includes(step)) record(step);
  }
  await Promise.all(workers.map(({ worker }) => worker.terminate()));

  mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  const bytes = new Uint8Array(snapshots.length * size * 4);
  snapshots.forEach((s, i) => bytes.set(new Uint8Array(s.buffer), i * s.byteLength));
  writeFileSync(`${out}.bin`, bytes);
  writeFileSync(`${out}.json`, JSON.stringify({ config, seed, batch, parameters: size, seconds: Math.round((Date.now() - began) / 1000), report }, null, 1));
  console.log(`écrit ${out}.bin (${(bytes.length / 1e6).toFixed(1)} Mo) et ${out}.json`);
}

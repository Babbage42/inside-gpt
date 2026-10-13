// Entraîne les modèles du mini-monde et écrit leurs réglages dans public/models.
// Lancer : npm run train:mini  (une dizaine de minutes sur un portable ; le calcul est réparti sur plusieurs cœurs).
//  - le mini-GPT complet, avec un instantané à chaque étape marquante de son entraînement ;
//  - les modèles intermédiaires de la construction pièce par pièce, dont on ne garde que l'état final.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { LADDER, UNSCALED, measure } from '../src/app/v4/engine/mini-exam';
import { MiniConfig, MiniGpt } from '../src/app/v4/engine/mini-gpt';
import { WORDS, encode, trainingText } from '../src/app/v4/engine/mini-world';
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
  const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  const steps = arg('steps', 6000), batch = arg('batch', 16), seed = arg('seed', 1), crew = arg('crew', 4), folder = 'public/models';
  // Instantanés resserrés au début, là où tout change vite.
  const marks = [...new Set([0, 25, 50, 100, 150, 200, 300, 400, 550, 700, 900, 1200, 1600, 2200, 3200, 4500, steps].filter((m) => m <= steps))];

  async function train(name: string, config: MiniConfig, keepAll: boolean) {
    const model = new MiniGpt(config, seed), size = model.parameterCount, rng = new Rng(seed + 100);
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

    const snapshots: Float32Array[] = [], report: { step: number; loss: number; scores: Record<string, number> }[] = [];
    const began = Date.now();
    let loss = Math.log(WORDS.length);
    const record = (step: number) => {
      const scores = measure(model);
      if (keepAll || step === steps) snapshots.push(model.snapshot());
      report.push({ step, loss, scores });
      console.log(`${name} · pas ${step} · surprise ${loss.toFixed(3)} · ${Object.entries(scores).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')} · ${((Date.now() - began) / 1000).toFixed(0)} s`);
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

    mkdirSync(folder, { recursive: true });
    const bytes = new Uint8Array(snapshots.length * size * 4);
    snapshots.forEach((s, i) => bytes.set(new Uint8Array(s.buffer), i * s.byteLength));
    writeFileSync(`${folder}/${name}.bin`, bytes);
    writeFileSync(`${folder}/${name}.json`, JSON.stringify({ config, seed, batch, parameters: size, seconds: Math.round((Date.now() - began) / 1000), report }, null, 1));
    console.log(`écrit ${folder}/${name}.bin (${(bytes.length / 1e6).toFixed(2)} Mo)`);
    return { bytes: bytes.slice(-size * 4), summary: { config, seed, batch, parameters: size, seconds: Math.round((Date.now() - began) / 1000), report } };
  }

  const full = LADDER[LADDER.length - 1];
  if (!only || only === 'mini-llm') {
    // Le modèle complet est aussi le dernier barreau de l'échelle : on y range son état final.
    const { bytes, summary } = await train('mini-llm', full.config, true);
    writeFileSync(`${folder}/ladder-${full.key}.bin`, bytes);
    writeFileSync(`${folder}/ladder-${full.key}.json`, JSON.stringify(summary, null, 1));
  }
  for (const rung of [...LADDER.slice(0, -1), UNSCALED]) if (!only || only === rung.key || only === 'ladder') await train(`ladder-${rung.key}`, rung.config, false);
}

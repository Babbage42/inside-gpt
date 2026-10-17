// Entraîne les modèles du chapitre « L'assistant » et écrit leurs réglages dans public/models.
// Lancer : npm run train:assistant  (une vingtaine de minutes ; le premier entraînement est réparti sur plusieurs cœurs).
//  1. le modèle de base, qui ne lit que des textes (le manuel) ;
//  2. deux assistants affinés sur des dialogues (les exercices corrigés) : l'un sans, l'autre avec des « je ne sais pas » ;
//  3. l'assistant prudent, entraîné ensuite par essais et notes (les exercices notés) ;
//  4. la contre-épreuve : un assistant qui n'a vu aucun pluriel, puis les mêmes essais notés.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { CONFIG, EXAMS, ExamKey, Lessons, Problem, baseText, dialogue, encode, grade, refusals, reply, sampled, score, USER, BOT } from '../src/app/v4/engine/assistant-world';
import { MiniGpt } from '../src/app/v4/engine/mini-gpt';
import { Rng } from '../src/app/v4/engine/tensor';

interface Job {
  readonly weights: SharedArrayBuffer;
  readonly slopes: SharedArrayBuffer;
}

const folder = 'public/models';

if (!isMainThread) {
  // Un ouvrier : reçoit des textes, calcule les pentes sur sa part, les dépose dans la mémoire partagée.
  const job = workerData as Job, model = new MiniGpt(CONFIG);
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
  const seed = arg('seed', 1), crew = arg('crew', 4);
  mkdirSync(folder, { recursive: true });

  type Report = { step: number; loss: number; scores: Record<string, number> };
  const report = (model: MiniGpt, step: number, loss: number): Report => {
    const scores: Record<string, number> = {};
    for (const key of Object.keys(EXAMS) as ExamKey[]) scores[key] = score(model, EXAMS[key]);
    scores['refus'] = refusals(model);
    // Au tirage : dix essais par question, avec un dé fixé pour que les mesures se comparent d'un modèle à l'autre.
    const dice = new Rng(777), draw = () => dice.next();
    scores['tirage'] = sampled(model, [...EXAMS.taught, ...EXAMS.taughtPlural, ...EXAMS.strangersShown], 10, draw);
    scores['tirageInconnu'] = sampled(model, [...EXAMS.known, ...EXAMS.knownPlural, ...EXAMS.strangers], 10, draw);
    console.log(`  pas ${step} · surprise ${loss.toFixed(3)} · ${Object.entries(scores).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')}`);
    return { step, loss, scores };
  };
  const save = (name: string, snapshots: Float32Array[], extra: object) => {
    const size = snapshots[0].length, bytes = new Uint8Array(snapshots.length * size * 4);
    snapshots.forEach((s, i) => bytes.set(new Uint8Array(s.buffer, s.byteOffset, s.byteLength), i * size * 4));
    writeFileSync(`${folder}/${name}.bin`, bytes);
    writeFileSync(`${folder}/${name}.json`, JSON.stringify({ config: CONFIG, seed, parameters: size, ...extra }, null, 1));
    console.log(`écrit ${folder}/${name}.bin (${(bytes.length / 1e6).toFixed(2)} Mo)`);
  };
  const loadModel = (name: string, lr: number) => {
    const model = new MiniGpt(CONFIG, seed, lr), buffer = readFileSync(`${folder}/${name}.bin`), size = model.parameterCount;
    const all = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    model.load(all.subarray(all.length - size));
    return model;
  };

  // ── 1. Le manuel ──
  async function base() {
    const steps = arg('base-steps', 6000), batch = arg('batch', 16);
    console.log(`Modèle de base : ${steps} pas sur des textes`);
    const model = new MiniGpt(CONFIG, seed), size = model.parameterCount, rng = new Rng(seed + 100);
    const weights = new SharedArrayBuffer(size * 4), shared = new Float32Array(weights);
    const workers = Array.from({ length: crew }, () => {
      const slopes = new SharedArrayBuffer(size * 4);
      return { worker: new Worker(new URL(import.meta.url), { workerData: { weights, slopes } satisfies Job }), slopes: new Float32Array(slopes) };
    });
    const ask = (worker: Worker, texts: number[][]) =>
      new Promise<{ loss: number; guesses: number }>((resolve) => {
        worker.once('message', resolve);
        worker.postMessage(texts);
      });
    const began = Date.now(), mixed = new Float32Array(size), reports: Report[] = [];
    let loss = Math.log(CONFIG.vocab);
    for (let step = 1; step <= steps; step++) {
      shared.set(model.snapshot());
      const share = Math.ceil(batch / crew);
      const results = await Promise.all(workers.map(({ worker }) => ask(worker, Array.from({ length: share }, () => encode(baseText(rng))))));
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
      if (step % 1000 === 0 || step === steps) {
        console.log(`  pas ${step} · surprise ${loss.toFixed(3)} · ${((Date.now() - began) / 1000).toFixed(0)} s`);
      }
    }
    await Promise.all(workers.map(({ worker }) => worker.terminate()));
    reports.push(report(model, steps, loss));
    save('assistant-base', [model.snapshot()], { steps, batch, report: reports });
  }

  // ── 2. Les exercices corrigés ──
  function tune(name: string, lessons: Lessons) {
    const steps = arg('tune-steps', 500), batch = arg('batch', 16), lr = arg('tune-lr', 0.0007), mix = arg('mix', 0.5), every = arg('every', 500);
    console.log(`${name} : ${steps} pas sur des dialogues (pluriel ${lessons.plural}, « je ne sais pas » ${lessons.unknown}, douze animaux ${!!lessons.all})`);
    const model = loadModel('assistant-base', lr), rng = new Rng(seed + 200), began = Date.now(), reports: Report[] = [];
    reports.push(report(model, 0, NaN));
    let loss = 0;
    for (let step = 1; step <= steps; step++) {
      // On continue de lire un peu le manuel pendant les dialogues, pour ne pas oublier ce qu'il a appris.
      const talks = Array.from({ length: batch }, () => dialogue(rng, lessons)), pages = Array.from({ length: Math.round(batch * mix) }, () => encode(baseText(rng)));
      const learned = talks.reduce((sum, d) => sum + d.learn.reduce((a, b) => a + b, 0), 0), read = pages.reduce((sum, p) => sum + p.length - 1, 0);
      const current = model.trainStep(
        [...talks.map((d) => d.ids), ...pages],
        [...talks.map((d) => d.learn.map((l) => l / learned)), ...pages.map((p) => p.slice(1).map(() => mix / read))],
      );
      loss = step === 1 ? current : loss * 0.98 + current * 0.02;
      if (step % every === 0 || step === steps) reports.push(report(model, step, loss));
    }
    console.log(`  ${((Date.now() - began) / 1000).toFixed(0)} s`);
    save(name, [model.snapshot()], { steps, batch, lr, lessons, report: reports });
  }

  // ── 3. Les exercices notés ──
  function practise(from: string, name: string, length?: number) {
    const steps = length ?? arg('rl-steps', 300), problems = arg('rl-problems', 12), tries = arg('rl-tries', 8), lr = arg('rl-lr', 0.0003);
    const pool: Problem[] = [...EXAMS.taught, ...EXAMS.taughtPlural, ...EXAMS.strangersShown, ...EXAMS.who];
    console.log(`${name} : ${steps} pas d'essais notés (${problems} questions × ${tries} essais), depuis ${from}`);
    const model = loadModel(from, lr), rng = new Rng(seed + 300), draw = () => rng.next(), began = Date.now();
    const reports: Report[] = [report(model, 0, NaN)];
    let average = 0;
    for (let step = 1; step <= steps; step++) {
      // Plusieurs questions par pas : on additionne leurs corrections avant de tourner les boutons.
      let total = 0;
      const texts: number[][] = [], weights: number[][] = [];
      for (let q = 0; q < problems; q++) {
        const problem = pool[rng.int(pool.length)], prompt = encode([USER, ...problem.ask, BOT]);
        const attempts = Array.from({ length: tries }, () => reply(model, problem.ask, draw));
        const notes = attempts.map((a) => grade(problem, a)), mean = notes.reduce((a, b) => a + b, 0) / tries;
        total += mean;
        attempts.forEach((answer, k) => {
          const advantage = notes[k] - mean;
          if (!advantage) return;
          const ids = [...prompt, ...encode(answer)];
          // Chaque mot de l'essai est encouragé si l'essai a mieux réussi que la moyenne, découragé sinon.
          weights.push(ids.slice(1).map((_, i) => (i + 1 >= prompt.length ? advantage / (problems * tries) : 0)));
          texts.push(ids);
        });
      }
      if (texts.length) model.trainStep(texts, weights);
      average = step === 1 ? total / problems : average * 0.95 + (total / problems) * 0.05;
      if (step % 50 === 0 || step === steps) {
        reports.push(report(model, step, NaN));
        console.log(`  réussite des essais ${(average * 100).toFixed(0)}% · ${((Date.now() - began) / 1000).toFixed(0)} s`);
      }
    }
    save(name, [model.snapshot()], { steps, problems, tries, lr, report: reports });
  }

  if (!only || only === 'base') await base();
  if (!only || only === 'tune') {
    tune('assistant-dialogues', { plural: arg('plural', 0.02), unknown: false });
    // Pour distinguer ce qu'il sait de ce qu'il ignore, il doit voir les deux : ses dialogues couvrent cette fois les douze animaux.
    tune('assistant-prudent', { plural: arg('plural', 0.02), unknown: true, all: true });
  }
  if (!only || only === 'rl') practise('assistant-prudent', 'assistant-recompense');
  // La contre-épreuve : sans aucun pluriel dans les dialogues, la note n'a rien à renforcer.
  if (!only || only === 'rien') {
    tune('assistant-sans-pluriel', { plural: 0, unknown: true, all: true });
    practise('assistant-sans-pluriel', 'assistant-sans-pluriel-recompense', arg('rien-steps', 150));
  }
}

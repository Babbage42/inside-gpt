import { TestBed } from '@angular/core/testing';
import { LessonFive } from './lesson-five';
import { LearningProgress } from '../../core/progress/learning-progress';

describe('LessonFive inquiry', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [LessonFive] }).compileComponents();
  });

  it('holds out the test combination while keeping both tokens in training', () => {
    const c = TestBed.createComponent(LessonFive).componentInstance as any;
    expect(c.corpus.some((e: any) => e.tokens.join(' ') === 'chat fatigué')).toBeFalse();
    expect(c.vocabulary).toContain('chat');
    expect(c.vocabulary).toContain('fatigué');
  });

  it('selects exactly one initial table row for each token', () => {
    const f = TestBed.createComponent(LessonFive); const c = f.componentInstance as any;
    c.started.set(true); c.step.set(2);
    for (const token of c.vocabulary) {
      c.selectedToken.set(token); f.detectChanges();
      expect(f.nativeElement.querySelectorAll('tbody tr.focus').length).toBe(1);
      expect(f.nativeElement.querySelector('tbody tr.focus').textContent).toContain(token);
      const selector = c.oneHot(token);
      for (const d of [0, 1]) {
        const sum = c.vocabulary.reduce((total: number, word: string, i: number) => total + selector[i] * c.studyModel.embedding(word)[d], 0);
        expect(sum).toEqual(c.studyModel.embedding(token)[d]);
      }
    }
  });

  it('requires a correct explanation and reacts to training instead of getting stuck', () => {
    const c = TestBed.createComponent(LessonFive).componentInstance as any;
    c.step.set(8); expect(c.canContinue()).toBeFalse();
    c.answer(0); expect(c.canContinue()).toBeFalse();
    c.train(300); expect(c.canContinue()).toBeTrue();
    c.next(); expect(c.step()).toBe(9);
  });

  it('keeps introductory calculations fixed after training', () => {
    const c = TestBed.createComponent(LessonFive).componentInstance as any;
    const initial = c.studyModel.embedding('fatigué');
    const initialLoss = c.study.loss;
    c.train(300);
    expect(c.studyModel.embedding('fatigué')).toEqual(initial);
    expect(c.study.loss).toEqual(initialLoss);
    expect(c.model.embedding('fatigué')).not.toEqual(initial);
    expect(c.testTrace().predicted).toBe('dort');
  });

  it('shows a controlled intervention and agrees with the analytic gradient', () => {
    const c = TestBed.createComponent(LessonFive).componentInstance as any;
    c.intervention.set(0.001);
    expect(c.interventionTrace().context[0] - c.study.context[0]).toBeCloseTo(0.0005, 10);
    expect(c.interventionTrace().context[1]).toEqual(c.study.context[1]);
    expect(c.finiteDifference).toBeCloseTo(c.studyGradient.embeddingGradients[1][0], 7);
    expect(c.studyModel.epoch).toBe(0);
  });

  it('migrates the old lesson without discarding training or completed lessons', () => {
    const progress = TestBed.inject(LearningProgress);
    progress.complete(4);
    progress.saveLessonState(5, { contentVersion: 3, started: true, step: 18, epoch: 300, selectedToken: 'chien', didReorder: true });
    const f = TestBed.createComponent(LessonFive); const c = f.componentInstance as any;
    f.detectChanges();
    expect(c.step()).toBe(0);
    expect(c.model.epoch).toBe(300);
    expect(c.selectedToken()).toBe('chien');
    expect(progress.isCompleted(4)).toBeTrue();
  });

  it('restores answers, reading position and trained state after recreating the lesson', () => {
    const f = TestBed.createComponent(LessonFive); const c = f.componentInstance as any;
    c.started.set(true); c.step.set(8); c.answer(0); c.train(300); c.step.set(10);
    f.detectChanges(); const probabilities = c.testTrace().probabilities;
    f.destroy();
    const next = TestBed.createComponent(LessonFive).componentInstance as any;
    expect(next.step()).toBe(10);
    expect(next.answers()[8]).toBe(0);
    expect(next.model.epoch).toBe(300);
    expect(next.testTrace().probabilities).toEqual(probabilities);
  });

  it('renders all chapters, including every interactive calculation', () => {
    const f = TestBed.createComponent(LessonFive); const c = f.componentInstance as any;
    c.started.set(true);
    for (let i = 0; i < c.steps.length; i++) {
      c.step.set(i); f.detectChanges();
      expect(f.nativeElement.querySelector('.chapter h2')).not.toBeNull();
      expect(f.nativeElement.querySelector('.bridge')).not.toBeNull();
      expect(f.nativeElement.querySelector('.destination')).not.toBeNull();
      expect(f.nativeElement.querySelectorAll('.checkpoint button').length).toBe(2);
    }
  });
});

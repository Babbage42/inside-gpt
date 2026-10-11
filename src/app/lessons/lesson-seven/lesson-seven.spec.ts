import { TestBed } from '@angular/core/testing';
import { LessonSeven } from './lesson-seven';
import { LearningProgress } from '../../core/progress/learning-progress';
import { TinyAttentionModel } from '../../core/model/tiny-language-model';

describe('LessonSeven', () => {
  beforeEach(async () => { localStorage.clear(); await TestBed.configureTestingModule({ imports: [LessonSeven] }).compileComponents(); });
  it('reconstructs the exact saved lesson-six checkpoint rather than a hardcoded epoch', () => {
    TestBed.inject(LearningProgress).saveLessonState(6, { started: true, step: 6, epoch: 13 });
    const c = TestBed.createComponent(LessonSeven).componentInstance as any;
    const reference = new TinyAttentionModel(c.vocabulary, c.candidates);
    reference.train(c.corpus, 13, .12);
    expect(c.checkpointEpoch).toBe(13);
    expect(c.trace.probabilities).toEqual(reference.trace(c.tokens).probabilities);
  });
  it('renders every numerical stage and the causal visibility exercise', () => {
    const f = TestBed.createComponent(LessonSeven); const c = f.componentInstance as any;
    c.started.set(true);
    for (let i = 0; i < c.steps.length; i++) { c.step.set(i); f.detectChanges(); expect(f.nativeElement.querySelector('.lesson-stage h2')).not.toBeNull(); }
    c.step.set(6); c.causalPosition.set(1); f.detectChanges();
    expect(f.nativeElement.querySelector('tbody').textContent.match(/Masqué/g)?.length).toBe(3);
  });
  it('keeps every stage of the block in one numeric trace', () => { const component = TestBed.createComponent(LessonSeven).componentInstance as any; expect(component.trace.context.length).toBe(3); expect(component.trace.residual.length).toBe(3); expect(component.trace.normalized.length).toBe(3); expect(component.trace.mlp.length).toBe(3); expect(component.trace.blockOutput.length).toBe(3); });
  it('normalizes the block output', () => { const component = TestBed.createComponent(LessonSeven).componentInstance as any; const mean = component.trace.blockOutput.reduce((sum: number, value: number) => sum + value, 0) / 3; expect(mean).toBeCloseTo(0, 6); });
});

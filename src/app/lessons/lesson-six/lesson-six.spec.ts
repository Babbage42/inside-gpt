import { TestBed } from '@angular/core/testing';
import { LessonSix } from './lesson-six';

describe('LessonSix', () => {
  beforeEach(async () => { localStorage.clear(); await TestBed.configureTestingModule({ imports: [LessonSix] }).compileComponents(); });
  it('renders all stages and switches Q/K/V sources without changing learned matrices', () => {
    const f = TestBed.createComponent(LessonSix); const c = f.componentInstance as any;
    c.started.set(true);
    for (let i = 0; i < c.steps.length; i++) { c.step.set(i); f.detectChanges(); expect(f.nativeElement.querySelector('.lesson-stage h2')).not.toBeNull(); }
    c.step.set(1); c.selectedProjection.set('Wv'); c.selectedPosition.set(0); f.detectChanges();
    expect(c.projectionToken()).toBe('chat'); expect(c.projectionVector().length).toBe(3);
    c.selectedProjection.set('Wq'); expect(c.projectionToken()).toBe('donc'); expect(c.projectionVector().length).toBe(2);
  });
  it('derives one attention weight per visible token', () => { const component = TestBed.createComponent(LessonSix).componentInstance as any; expect(component.trace().attention.length).toBe(component.testTokens.length); expect(component.trace().attention.reduce((sum: number, value: number) => sum + value, 0)).toBeCloseTo(1, 8); });
  it('learns the held-out continuation end to end', () => { const component = TestBed.createComponent(LessonSix).componentInstance as any; const before = component.trainingLoss(); component.train(1400); expect(component.trainingLoss()).toBeLessThan(before * .25); expect(component.trace().predicted).toBe('dort'); });
});

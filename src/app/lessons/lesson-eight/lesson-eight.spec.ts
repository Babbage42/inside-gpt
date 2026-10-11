import { TestBed } from '@angular/core/testing';
import { LessonEight } from './lesson-eight';

describe('LessonEight', () => {
  beforeEach(async () => { localStorage.clear(); await TestBed.configureTestingModule({ imports: [LessonEight] }).compileComponents(); });
  it('holds the exact test context out of training', () => { const component = TestBed.createComponent(LessonEight).componentInstance as any; expect(component.corpus.some((example: any) => example.tokens.join(' ') === 'menthe sol sec donc')).toBeFalse(); });
  it('gates the token mission until four rows and the explanation are checked', () => { const component = TestBed.createComponent(LessonEight).componentInstance as any; component.step.set(1); expect(component.canNext()).toBeFalse(); component.testTokens().forEach((token: string) => component.reveal(token)); expect(component.canNext()).toBeFalse(); component.check(1); expect(component.canNext()).toBeTrue(); });
  it('does not allow the stepper to skip missions', () => { const c = TestBed.createComponent(LessonEight).componentInstance as any; c.check(0); expect(c.canVisit(1)).toBeTrue(); expect(c.canVisit(7)).toBeFalse(); c.visit(7); expect(c.step()).toBe(0); });
  it('allows revisiting an already reached mission without losing it', () => { const c = TestBed.createComponent(LessonEight).componentInstance as any; c.check(0); c.next(); c.previous(); expect(c.step()).toBe(0); expect(c.canVisit(1)).toBeTrue(); c.visit(1); expect(c.step()).toBe(1); });
  it('reacts to the first training epoch when its gate was already evaluated', () => { const c = TestBed.createComponent(LessonEight).componentInstance as any; c.step.set(3); c.check(0); expect(c.canNext()).toBeFalse(); c.train(1); expect(c.canNext()).toBeTrue(); expect(c.lastTraining().before).toEqual(c.initialLoss); });
  it('learns and flips under the dry-versus-wet intervention', () => { const component = TestBed.createComponent(LessonEight).componentInstance as any; component.train(1400); expect(component.trace().predicted).toBe('arroser'); component.chooseState('humide'); expect(component.trace().predicted).toBe('attendre'); });
});

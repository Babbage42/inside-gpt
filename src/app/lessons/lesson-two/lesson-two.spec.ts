import { TestBed } from '@angular/core/testing';
import { LessonTwo } from './lesson-two';

describe('LessonTwo', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [LessonTwo] }).compileComponents();
  });

  it('introduces the classification problem before the laboratory', () => {
    const fixture = TestBed.createComponent(LessonTwo);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Comment un modèle');
    expect(fixture.nativeElement.textContent).toContain('Détecter un message suspect');
    expect(fixture.nativeElement.querySelector('.classifier-workspace')).toBeNull();
  });

  it('computes the score and probability of the example message', () => {
    const fixture = TestBed.createComponent(LessonTwo);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.lesson-start button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.score-stage').textContent).toContain('1.60');
    expect(fixture.nativeElement.querySelector('.probability-ring').textContent).toContain('83%');
  });

  it('requires the correct conceptual answer before completion', () => {
    const fixture = TestBed.createComponent(LessonTwo);
    let completed = false;
    fixture.componentInstance.completed.subscribe(() => (completed = true));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.lesson-start button') as HTMLButtonElement).click();
    fixture.detectChanges();

    for (let index = 0; index < 7; index++) {
      (fixture.nativeElement.querySelector('[aria-label="Étape suivante de la leçon 2"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    const answers = fixture.nativeElement.querySelectorAll('.answers button') as NodeListOf<HTMLButtonElement>;
    answers[0].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.wrong')).toBeTruthy();
    expect(completed).toBeFalse();

    answers[1].click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.correct button') as HTMLButtonElement).click();
    expect(completed).toBeTrue();
  });
});

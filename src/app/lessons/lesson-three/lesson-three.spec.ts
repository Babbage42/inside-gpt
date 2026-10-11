import { TestBed } from '@angular/core/testing';
import { LessonThree } from './lesson-three';

describe('LessonThree', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [LessonThree] }).compileComponents();
  });

  it('introduces XOR as a concrete switch problem', () => {
    const fixture = TestBed.createComponent(LessonThree);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pourquoi un seul neurone');
    expect(fixture.nativeElement.querySelectorAll('.truth-intro article').length).toBe(4);
  });

  it('shows that the initial single neuron solves only three cases', () => {
    const fixture = TestBed.createComponent(LessonThree);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.start-row button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.accuracy').textContent).toContain('3/4');
    expect(fixture.nativeElement.querySelectorAll('.truth-table strong:not(.ok)').length).toBe(1);
  });

  it('solves every selected case with the hidden layer', () => {
    const fixture = TestBed.createComponent(LessonThree);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.start-row button') as HTMLButtonElement).click();
    fixture.detectChanges();

    for (let index = 0; index < 4; index++) {
      (fixture.nativeElement.querySelector('[aria-label="Étape suivante de la leçon 3"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    expect(fixture.nativeElement.querySelector('.network-solution .accuracy').textContent).toContain('4/4');
    expect(fixture.nativeElement.querySelector('.final-lamp small').textContent).toContain('correcte');
  });

  it('validates why nonlinear activations are necessary', () => {
    const fixture = TestBed.createComponent(LessonThree);
    let completed = false;
    fixture.componentInstance.completed.subscribe(() => (completed = true));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.start-row button') as HTMLButtonElement).click();
    fixture.detectChanges();

    for (let index = 0; index < 9; index++) {
      (fixture.nativeElement.querySelector('[aria-label="Étape suivante de la leçon 3"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    const answers = fixture.nativeElement.querySelectorAll('.answers button') as NodeListOf<HTMLButtonElement>;
    answers[1].click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.success button') as HTMLButtonElement).click();

    expect(completed).toBeTrue();
  });
});

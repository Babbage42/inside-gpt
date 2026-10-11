import { TestBed } from '@angular/core/testing';
import { LessonFour } from './lesson-four';

describe('LessonFour', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [LessonFour] }).compileComponents();
  });

  it('introduces next-token prediction before the model', () => {
    const fixture = TestBed.createComponent(LessonFour);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Que signifie vraiment');
    expect(fixture.nativeElement.textContent).toContain('plusieurs continuations');
  });

  it('derives a 60/40 distribution after the token le', () => {
    const fixture = TestBed.createComponent(LessonFour);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.start button') as HTMLButtonElement).click();
    fixture.detectChanges();
    for (let index = 0; index < 5; index++) {
      (fixture.nativeElement.querySelector('[aria-label="Étape suivante de la leçon 4"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    const bars = fixture.nativeElement.querySelector('.bars').textContent;
    expect(bars).toContain('chat');
    expect(bars).toContain('60%');
    expect(bars).toContain('chien');
    expect(bars).toContain('40%');
  });

  it('generates autoregressively from the current token', () => {
    const fixture = TestBed.createComponent(LessonFour);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.start button') as HTMLButtonElement).click();
    fixture.detectChanges();
    for (let index = 0; index < 7; index++) {
      (fixture.nativeElement.querySelector('[aria-label="Étape suivante de la leçon 4"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    (fixture.nativeElement.querySelector('.generation-controls button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.generated-text').textContent).toContain('lechat');
  });

  it('makes sampling visibly different from greedy choice in the guided example', () => {
    const fixture = TestBed.createComponent(LessonFour);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.start button') as HTMLButtonElement).click();
    fixture.detectChanges();
    for (let index = 0; index < 7; index++) {
      (fixture.nativeElement.querySelector('[aria-label="Étape suivante de la leçon 4"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    (fixture.nativeElement.querySelector('.generation-controls button.sample') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.generated-text').textContent).toContain('lechien');
    expect(fixture.nativeElement.querySelector('.choice-trace').textContent).toContain('62 sur 100');
  });

  it('validates the context-length limitation', () => {
    const fixture = TestBed.createComponent(LessonFour);
    let completed = false;
    fixture.componentInstance.completed.subscribe(() => (completed = true));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.start button') as HTMLButtonElement).click();
    fixture.detectChanges();
    for (let index = 0; index < 9; index++) {
      (fixture.nativeElement.querySelector('[aria-label="Étape suivante de la leçon 4"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    const answers = fixture.nativeElement.querySelectorAll('.answers button') as NodeListOf<HTMLButtonElement>;
    answers[1].click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.success button') as HTMLButtonElement).click();
    expect(completed).toBeTrue();
  });
});

import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem('gradient-lab-progress-v1');
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should introduce the learning problem before showing the graph', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Comment une machine');
    expect(compiled.textContent).toContain('Prédire une note à partir du temps d’étude');
    expect(compiled.querySelectorAll('.graph-node').length).toBe(0);
  });

  it('opens the guided experiment from the introduction', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.first-question button') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.graph-node').length).toBe(8);
  });

  it('reduces the loss after the complete guided sequence', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.first-question button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const next = fixture.nativeElement.querySelector('[aria-label="Étape suivante"]') as HTMLButtonElement;
    for (let index = 0; index < 9; index++) {
      next.click();
      fixture.detectChanges();
    }

    const train = fixture.nativeElement.querySelector('.train-button') as HTMLButtonElement;
    expect(train.disabled).toBeFalse();
    train.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loss-card strong').textContent).toContain('324.00');
  });

  it('unlocks the next lesson after convergence', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.first-question button') as HTMLButtonElement).click();
    fixture.detectChanges();

    for (let index = 0; index < 9; index++) {
      (fixture.nativeElement.querySelector('[aria-label="Étape suivante"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    for (let index = 0; index < 10 && !fixture.nativeElement.querySelector('.lesson-unlocked'); index++) {
      (fixture.nativeElement.querySelector('.convergence-actions button') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    expect(fixture.nativeElement.querySelector('.lesson-unlocked')).toBeTruthy();
    (fixture.nativeElement.querySelector('.lesson-unlocked button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.completion-actions button:last-child') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-lesson-two')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Comment un modèle');
  });

  it('restores the last unlocked lesson from local progress', () => {
    localStorage.setItem(
      'gradient-lab-progress-v1',
      JSON.stringify({ version: 1, currentLesson: 3, completedLessons: [1, 2] }),
    );
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-lesson-three')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Pourquoi un seul neurone');
  });
});

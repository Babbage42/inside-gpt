import { TestBed } from '@angular/core/testing';
import { V3Root } from './v3';
import { PILOT_STORAGE_KEY } from './pilot-state';
import { scenes } from './pilot-content';

describe('V3: parcours guidé utilisable de bout en bout', () => {
  beforeEach(async () => {
    localStorage.removeItem(PILOT_STORAGE_KEY);
    await TestBed.configureTestingModule({ imports: [V3Root] }).compileComponents();
  });
  it('opens on the corpus and keeps all 16 scenes accessible through the footer', () => {
    const fixture = TestBed.createComponent(V3Root); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.corpus-list li').length).toBe(10);
    expect(root.querySelectorAll('.rail nav button').length).toBe(scenes.length);
    for (let i = 0; i < scenes.length; i++) {
      expect(root.querySelector('h1')?.textContent).toBe(scenes[i].title);
      if (i < scenes.length - 1) { (root.querySelector('.lesson-navigation .primary') as HTMLButtonElement).click(); fixture.detectChanges(); }
    }
    expect(root.querySelectorAll('.transfer-checks app-v3-checkpoint').length).toBe(4);
    expect(root.textContent).toContain('Ce qui reste à construire');
  });
  it('follows the actual selected embedding rather than a permanently fixed hero token', () => {
    const fixture = TestBed.createComponent(V3Root); fixture.componentInstance.go(3); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const mange = Array.from(root.querySelectorAll('.token-picker button')).find((button) => button.textContent === 'mange') as HTMLButtonElement;
    mange.click(); fixture.detectChanges();
    expect(root.querySelector('.lookup-path')?.textContent).toContain('mange');
    expect(root.querySelector('.vector-cells strong')?.textContent?.replace('−', '-')).toBe('-0,032');
  });
  it('does not reveal intervention controls before a prediction or an explicit hint', () => {
    const fixture = TestBed.createComponent(V3Root); fixture.componentInstance.go(9); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Variation du poids de sortie souris"]')).toBeNull();
    const hint = Array.from(root.querySelectorAll('app-v3-checkpoint button')).find((b) => b.textContent === 'Un indice') as HTMLButtonElement;
    hint.click(); fixture.detectChanges();
    expect(root.querySelector('[aria-label="Variation du poids de sortie souris"]')).not.toBeNull();
    expect(fixture.componentInstance.answers()['loss-direction'].assisted).toBeTrue();
  });
  it('records a result only after commitment and saves the explanation without claiming to grade its meaning', () => {
    const fixture = TestBed.createComponent(V3Root); fixture.componentInstance.go(5); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.feedback')).toBeNull();
    const buttons = root.querySelectorAll('app-v3-checkpoint .options button');
    (buttons[1] as HTMLButtonElement).click();
    const textarea = root.querySelector('app-v3-checkpoint textarea') as HTMLTextAreaElement;
    textarea.value = 'L’entrée est négative donc le produit diminue.'; textarea.dispatchEvent(new Event('input')); fixture.detectChanges();
    (root.querySelector('app-v3-checkpoint .primary') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(root.querySelector('.feedback.correct')).not.toBeNull();
    expect(root.querySelector('.feedback')?.textContent).toContain('son sens n’est pas évalué automatiquement');
    expect(fixture.componentInstance.answers()['weight-direction'].assisted).toBeFalse();
    expect(fixture.componentInstance.status(5)).toBe('Réussi sans indice');
  });
  it('teaches the same forward graph in backward mode without deleting forward values', () => {
    const fixture = TestBed.createComponent(V3Root); fixture.componentInstance.go(11); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    for (let i = 0; i < 4; i++) fixture.componentInstance.backpropagateOne();
    fixture.detectChanges();
    expect(root.querySelector('.backprop-graph')?.textContent).toContain('0,047');
    expect(root.querySelector('.backprop-graph')?.textContent).toContain('0,10763414');
    expect(root.querySelector('.derivation')?.textContent).toContain('uR / (u + R)²');
  });
  it('trains and resumes the lab without changing the explanatory reference or V2 storage', () => {
    localStorage.setItem('gradient-lab-v2-lesson-v1', '4');
    const fixture = TestBed.createComponent(V3Root); fixture.detectChanges();
    const reference = fixture.componentInstance.pilot.snapshot;
    fixture.componentInstance.go(14); fixture.componentInstance.trainLab(10); fixture.detectChanges();
    expect(fixture.componentInstance.labEpoch()).toBe(10);
    expect(fixture.componentInstance.pilot.clone().snapshot()).toEqual(reference);
    expect(localStorage.getItem('gradient-lab-v2-lesson-v1')).toBe('4');
    const savedProbability = fixture.componentInstance.testTrace().probabilities;
    fixture.destroy();
    const restored = TestBed.createComponent(V3Root); restored.detectChanges();
    expect(restored.componentInstance.scene()).toBe(14);
    expect(restored.componentInstance.labEpoch()).toBe(10);
    expect(restored.componentInstance.testTrace().probabilities).toEqual(savedProbability);
    restored.componentInstance.resetLab(); restored.detectChanges();
    expect(restored.componentInstance.labEpoch()).toBe(0);
    restored.componentInstance.undoReset(); restored.detectChanges();
    expect(restored.componentInstance.labEpoch()).toBe(10);
    expect(restored.componentInstance.labHistory().length).toBe(11);
    localStorage.removeItem('gradient-lab-v2-lesson-v1');
  });
  it('keeps the skip link on V3 despite the application’s root base href', () => {
    const fixture = TestBed.createComponent(V3Root); fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.skip-link') as HTMLAnchorElement).getAttribute('href')).toBe('/v3#scene-title');
  });
  it('reflects the restored scene in the mobile selector after the options are created', () => {
    localStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify({ version: 1, scene: 14, seen: [0, 14], answers: {}, notes: '', lab: null, history: [] }));
    const fixture = TestBed.createComponent(V3Root); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('.mobile-scene-picker select') as HTMLSelectElement;
    expect(select.value).toBe('14');
    fixture.componentInstance.go(11); fixture.detectChanges();
    expect(select.value).toBe('11');
  });
  it('distinguishes the visible training witness from the permanent held-out question', () => {
    const fixture = TestBed.createComponent(V3Root); fixture.componentInstance.go(5); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.context-bar').textContent).toContain('le chat mange la');
    expect(fixture.nativeElement.querySelector('.active-pair').textContent).toContain('un chat mange la');
    expect(fixture.nativeElement.querySelector('.separate-target').textContent).toContain('CIBLE GARDÉE À PART');
  });
});

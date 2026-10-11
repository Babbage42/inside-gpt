import { TestBed } from '@angular/core/testing';
import { V2Root } from './v2';

describe('V2: une enquête continue', () => {
  beforeEach(async () => {
    for (const key of ['gradient-lab-v2-scene-v2', 'gradient-lab-v2-finished-v2', 'gradient-lab-v2-screen', 'gradient-lab-v2-lesson-v1', 'gradient-lab-v2-lesson2-stage-v2', 'gradient-lab-v2-lesson2-stage-v3', 'gradient-lab-v2-lesson3-stage-v1', 'gradient-lab-v2-lesson3-stage-v2', 'gradient-lab-v2-lesson4-stage-v1', 'gradient-lab-v2-lesson4-stage-v2', 'gradient-lab-v2-lesson5-stage-v1', 'gradient-lab-v2-attention-checkpoint-v1', 'gradient-lab-v2-attention-source-v1', 'gradient-lab-v2-attention-history-v1', 'gradient-lab-v2-mini-model-v2', 'gradient-lab-v2-mini-history-v2']) {
      localStorage.removeItem(key);
    }
    await TestBed.configureTestingModule({ imports: [V2Root] }).compileComponents();
  });

  it('treats the seven scenes as steps of the same lesson, not seven tiny lessons', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const next = () => root.querySelector('.lesson-footer .primary') as HTMLButtonElement;

    expect(root.textContent).toContain('Leçon 1 · étape 1/7');
    expect(root.querySelector('.results')).not.toBeNull();
    expect(root.querySelector('.live-trace')?.textContent).toContain('0 ligne');
    expect(root.querySelector('.partial-evidence')?.textContent).toContain('souris : 3 phrases');
    expect(next().textContent).toContain('Étape suivante');

    next().click(); fixture.detectChanges();
    expect(root.querySelector('h1')?.textContent).toContain('D’où viennent');
    expect(root.querySelectorAll('.corpus-line').length).toBe(10);
    expect(root.textContent).toContain('Leçon 1 · étape 2/7');

    next().click(); fixture.detectChanges();
    expect(root.querySelector('h1')?.textContent).toContain('contexte');
    expect(root.querySelector('.compare')).not.toBeNull();
  });

  it('recalculates the visible trace when the phrase or ablation changes', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.hero-prompt button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.live-trace')?.textContent).toContain('pomme 100');

    (fixture.componentInstance as any).go(2);
    fixture.detectChanges();
    const blind = [...root.querySelectorAll('.toggle-row button')].find((button) => button.textContent?.includes('seulement')) as HTMLButtonElement;
    blind.click(); fixture.detectChanges();
    expect(root.querySelector('.live-trace')?.textContent).toContain('Occurrences de « la »');
    expect(root.querySelector('.live-trace')?.textContent).toMatch(/50/);
  });

  it('shows a new combination of known tokens with no invented probability', () => {
    const fixture = TestBed.createComponent(V2Root);
    (fixture.componentInstance as any).go(3);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.novel-card')?.textContent).toContain('le chat mange la');
    expect(root.querySelector('.live-trace')?.textContent).toContain('0 ligne');
    expect(root.querySelector('.live-trace')?.textContent).toContain('non calculables');
    expect(root.textContent).not.toContain('NaN');
  });

  it('reaches tokens, IDs, embeddings and the honest end of lesson 1', () => {
    const fixture = TestBed.createComponent(V2Root);
    const component = fixture.componentInstance as any;
    const root = fixture.nativeElement as HTMLElement;
    component.go(4); fixture.detectChanges();
    expect(root.querySelector('.pair-list')).not.toBeNull();
    expect(root.querySelector('.live-trace')?.textContent).toContain('[chat]');

    component.advance(); fixture.detectChanges();
    expect(root.querySelector('.id-grid')).not.toBeNull();
    expect(root.querySelector('.live-trace')?.textContent).toContain('IDs des tokens');

    component.advance(); fixture.detectChanges();
    expect(root.querySelector('.onehot-lab')).not.toBeNull();
    expect(root.querySelector('.live-trace')?.textContent).toContain('Table E');
    expect((root.querySelector('.lesson-footer .primary') as HTMLButtonElement).textContent).toContain('Passer à la leçon 2');

    (root.querySelector('.lesson-footer .primary') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(root.querySelector('app-v2-lesson-two')).not.toBeNull();
    expect(root.querySelector('.l2-heading')?.textContent).toContain('Que prédit vraiment notre modèle');
  });

  it('returns to the actual held-out prefix when lesson 1 was explored with another animal', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.hero-prompt button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.hero-prompt')?.textContent).toContain('chien');
    (root.querySelectorAll('.lesson-switch button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l2-prompt')?.textContent).toContain('chat');
    expect(root.querySelector('.l2-prompt')?.textContent).not.toContain('chien');
  });

  it('restores the exact scene after recreation', () => {
    const first = TestBed.createComponent(V2Root);
    (first.componentInstance as any).go(3);
    first.detectChanges();
    first.destroy();

    const second = TestBed.createComponent(V2Root);
    second.detectChanges();
    expect((second.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('phrase était nouvelle');
  });

  it('makes lesson 2 reachable, trains real weights and restores its checkpoint', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelectorAll('.lesson-switch button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l2-heading')?.textContent).toContain('Que prédit vraiment notre modèle');
    for (let step = 0; step < 8; step++) {
      (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    expect(root.querySelector('.l2-heading')?.textContent).toContain('Que change une vraie correction');
    (root.querySelector('.train-actions button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.training-report')?.textContent).toContain('Perte moyenne');
    expect(localStorage.getItem('gradient-lab-v2-mini-model-v2')).toContain('"epoch":1');
    fixture.destroy();

    const resumed = TestBed.createComponent(V2Root);
    resumed.detectChanges();
    const html = resumed.nativeElement as HTMLElement;
    expect(html.querySelector('.l2-heading')?.textContent).toContain('Que change une vraie correction');
    expect(html.querySelector('.checkpoint')?.textContent).toContain('époque 1');
  });

  it('lets the reader inspect the mean and try a weight without training the model', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelectorAll('.lesson-switch button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.mix-board')?.textContent).toContain('Les cinq cases de cette colonne fusionnent');
    const before = root.querySelector('.v21-hero-number')?.textContent;
    (root.querySelectorAll('.coordinate-picker button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.v21-hero-number')?.textContent).not.toBe(before);

    for (let step = 0; step < 4; step++) {
      (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    const slider = root.querySelector('.v21-slider input') as HTMLInputElement;
    slider.value = '1';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelector('.v21-dual')?.textContent).toContain('ESSAI');
    expect(root.querySelector('.v21-slider')?.textContent).toMatch(/1[,.]00/);
    expect(root.querySelector('.checkpoint')?.textContent).toContain('graine 23');
  });

  it('introduces the loss before its formula and checks backpropagation to E', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelectorAll('.lesson-switch button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    for (let step = 0; step < 4; step++) {
      (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    expect(root.querySelector('.v21-one-result')?.textContent).toContain('Perte de cette paire');
    (root.querySelector('.calculation-detail') as HTMLDetailsElement).open = true;
    fixture.detectChanges();
    expect(root.querySelector('.calculation-detail')?.textContent).toContain('−ln');
    (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.v21-slider')).not.toBeNull();
    (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.v21-curve')).not.toBeNull();
    (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.v21-graph')?.textContent).toContain('score cible');
  });

  it('connects lessons 2, 3 and 4 and remembers the current lesson and step', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelectorAll('.lesson-switch button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    for (let step = 0; step < 10; step++) {
      (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    (root.querySelector('.l2-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l3-lesson h2')?.textContent).toContain('ordre');
    (root.querySelector('.l3-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l3-lesson h2')?.textContent).toContain('position');
    fixture.destroy();

    const resumed = TestBed.createComponent(V2Root);
    resumed.detectChanges();
    const html = resumed.nativeElement as HTMLElement;
    expect(html.querySelector('.l3-lesson h2')?.textContent).toContain('position');
    for (let step = 0; step < 4; step++) {
      (html.querySelector('.l3-footer .next') as HTMLButtonElement).click();
      resumed.detectChanges();
    }
    (html.querySelector('.l3-footer .next') as HTMLButtonElement).click();
    resumed.detectChanges();
    expect(html.querySelector('.l4-lesson h2')?.textContent).toContain('regarder');
  });

  it('introduces slots before numeric positions and attention before Q/K/V', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelectorAll('.lesson-switch button')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.learning-guide')?.textContent).toContain('Clique A puis B');
    expect(root.querySelector('.l3-lesson .math-reveal')).toBeNull();
    (root.querySelector('.l3-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.slot-strip button').length).toBe(5);
    expect(root.querySelector('.l3-lesson .math-reveal')).toBeNull();
    (root.querySelector('.l3-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l3-lesson .math-reveal')).not.toBeNull();

    (root.querySelectorAll('.lesson-switch button')[3] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l4-lesson')?.textContent).not.toContain('Wq');
    expect(root.querySelectorAll('.equal-weights > div').length).toBe(5);
    expect(root.querySelector('.equal-weights')?.textContent).toContain('20 %');
    (root.querySelector('.l4-prompt button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.equal-weights')?.textContent).toContain('chien');
    expect(root.querySelector('.equal-weights')?.textContent).toContain('20 %');
    (root.querySelector('.l4-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l4-lesson')?.textContent).toContain('P');
    expect(root.querySelector('.l4-lesson')?.textContent).not.toContain('Wq');
    (root.querySelector('.l4-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l4-lesson')?.textContent).toContain('Wq');
    expect(root.querySelector('.l4-lesson')?.textContent).not.toContain('Wv');
  });

  it('makes the 2D attention calculation and learned attention reachable', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelectorAll('.lesson-switch button')[3] as HTMLButtonElement).click();
    fixture.detectChanges();
    for (let i = 0; i < 3; i++) {
      (root.querySelector('.l4-footer .next') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    expect(root.querySelector('.micro-result')?.textContent).toContain('X = E');
    (root.querySelectorAll('.micro-steps button')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.micro-result')?.textContent).toContain('Une cellule de QK');
    expect(root.querySelectorAll('.micro-cells button').length).toBe(4);
    for (let i = 0; i < 3; i++) {
      (root.querySelector('.l4-footer .next') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    (root.querySelector('.l4-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('app-v2-lesson-five-attention')).not.toBeNull();
    expect(root.querySelector('.l5-map')?.textContent).toContain('Lecture initiale');
    (root.querySelectorAll('.lesson-switch button')[4] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('app-v2-lesson-five-attention')).not.toBeNull();
  });

  it('persists the genuinely trained attention checkpoint and history', () => {
    const fixture = TestBed.createComponent(V2Root);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelectorAll('.lesson-switch button')[4] as HTMLButtonElement).click();
    fixture.detectChanges();
    (root.querySelector('.l5-footer .next') as HTMLButtonElement).click();
    fixture.detectChanges();
    const before = root.querySelector('.l5-stats')?.textContent;
    (root.querySelectorAll('.l5-actions button')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.l5-stats')?.textContent).not.toBe(before);
    expect(root.querySelector('.l5-stats')?.textContent).toContain('Époque 100');
    expect(localStorage.getItem('gradient-lab-v2-attention-checkpoint-v1')).toContain('"epoch":100');
    expect(JSON.parse(localStorage.getItem('gradient-lab-v2-attention-history-v1')!).length).toBe(101);
    fixture.destroy();

    const resumed = TestBed.createComponent(V2Root);
    resumed.detectChanges();
    const html = resumed.nativeElement as HTMLElement;
    expect(html.querySelector('.l5-stats')?.textContent).toContain('Époque 100');
  });
});

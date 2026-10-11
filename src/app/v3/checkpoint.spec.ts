import { TestBed } from '@angular/core/testing';
import { V3Checkpoint } from './checkpoint';
import { checkpoints } from './pilot-content';
import { AnswerRecord } from './pilot-state';

describe('V3: prévision engagée, feedback et niveau d’aide', () => {
  beforeEach(async () => { await TestBed.configureTestingModule({ imports: [V3Checkpoint] }).compileComponents(); });
  function setup() {
    const fixture = TestBed.createComponent(V3Checkpoint);
    fixture.componentRef.setInput('question', checkpoints[5]);
    fixture.detectChanges();
    const records: AnswerRecord[] = [];
    fixture.componentInstance.answer.subscribe((record) => { records.push(record); fixture.componentRef.setInput('record', record); });
    return { fixture, records };
  }
  it('does not expose the answer before engagement', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelector('.feedback')).toBeNull();
    expect(fixture.nativeElement.querySelector('.hint')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Le signe de l’entrée est décisif.');
  });
  it('requires both a prediction and a written justification', () => {
    const { fixture, records } = setup();
    fixture.componentInstance.value.set('down'); fixture.componentInstance.submit();
    expect(records.length).toBe(0);
    fixture.componentInstance.explanation.set('Entrée négative.'); fixture.componentInstance.submit();
    expect(records[0].result).toBe('correct'); expect(records[0].assisted).toBeFalse();
  });
  it('marks an explicit hint as help and restores the learner’s draft', () => {
    const { fixture, records } = setup();
    fixture.componentInstance.value.set('down'); fixture.componentInstance.explanation.set('Mon raisonnement.');
    fixture.componentInstance.askHint(); fixture.detectChanges();
    expect(records[0].hint).toBeTrue(); expect(records[0].assisted).toBeTrue();
    expect(fixture.componentInstance.explanation()).toBe('Mon raisonnement.');
    expect(fixture.nativeElement.querySelector('.hint')).not.toBeNull();
  });
  it('distinguishes a successful retry from an independent first prediction', () => {
    const { fixture, records } = setup();
    fixture.componentInstance.value.set('up'); fixture.componentInstance.explanation.set('Je regarde le coefficient.');
    fixture.componentInstance.submit(); fixture.detectChanges();
    fixture.componentInstance.value.set('down'); fixture.componentInstance.explanation.set('Il faut prendre le signe négatif de l’entrée.');
    fixture.componentInstance.submit(); fixture.detectChanges();
    expect(records[1].result).toBe('correct'); expect(records[1].assisted).toBeTrue(); expect(records[1].attempts).toBe(2);
  });
  it('does not downgrade a repeated correct check when no hint or failure occurred', () => {
    const { fixture, records } = setup();
    fixture.componentInstance.value.set('down'); fixture.componentInstance.explanation.set('L’entrée est négative.');
    fixture.componentInstance.submit(); fixture.detectChanges();
    fixture.componentInstance.submit(); fixture.detectChanges();
    expect(records[1].result).toBe('correct'); expect(records[1].assisted).toBeFalse();
  });
  it('resets the local draft on a new question instead of reusing the previous choice', () => {
    const { fixture } = setup();
    fixture.componentInstance.value.set('down'); fixture.componentInstance.explanation.set('Un premier essai.');
    fixture.componentRef.setInput('question', checkpoints[10]); fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(''); expect(fixture.componentInstance.explanation()).toBe('');
  });
});

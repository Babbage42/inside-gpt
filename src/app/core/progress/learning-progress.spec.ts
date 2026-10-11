import { TestBed } from '@angular/core/testing';
import { LearningProgress } from './learning-progress';

describe('LearningProgress', () => {
  beforeEach(() => {
    localStorage.removeItem('gradient-lab-progress-v1');
    TestBed.configureTestingModule({});
  });

  it('unlocks the next lesson and persists the current lesson', () => {
    const progress = TestBed.inject(LearningProgress);

    progress.complete(1);
    expect(progress.canAccess(2)).toBeTrue();
    expect(progress.navigateTo(2)).toBeTrue();

    const stored = JSON.parse(localStorage.getItem('gradient-lab-progress-v1')!);
    expect(stored.currentLesson).toBe(2);
    expect(stored.completedLessons).toEqual([1]);
  });

  it('does not navigate to a locked lesson', () => {
    const progress = TestBed.inject(LearningProgress);
    expect(progress.navigateTo(3)).toBeFalse();
    expect(progress.currentLesson()).toBe(1);
  });

  it('restores the exact state saved inside a lesson', () => {
    const progress = TestBed.inject(LearningProgress);
    progress.saveLessonState(6, { started: true, step: 4, epoch: 300 });

    expect(progress.lessonState(6, { started: false, step: 0, epoch: 0 })).toEqual({
      started: true,
      step: 4,
      epoch: 300,
    });
  });

  it('isolates developer previews from existing learner progress', () => {
    const originalUrl = location.href;
    const stored = JSON.stringify({ version: 2, currentLesson: 3, completedLessons: [1, 2], lessonStates: {} });
    localStorage.setItem('gradient-lab-progress-v1', stored);
    try {
      history.replaceState(null, '', '?previewLesson=5');
      const preview = new LearningProgress();
      expect(preview.previewMode).toBeTrue();
      expect(preview.currentLesson()).toBe(5);
      preview.saveLessonState(5, { epoch: 300 });
      preview.complete(5);
      expect(localStorage.getItem('gradient-lab-progress-v1')).toBe(stored);
    } finally { history.replaceState(null, '', originalUrl); }
  });
});

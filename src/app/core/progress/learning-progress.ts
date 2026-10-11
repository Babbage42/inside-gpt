import { Injectable, isDevMode, signal, untracked } from '@angular/core';

interface StoredProgress {
  readonly version: 2;
  readonly currentLesson: number;
  readonly completedLessons: readonly number[];
  readonly lessonStates: Readonly<Record<string, unknown>>;
}

const STORAGE_KEY = 'gradient-lab-progress-v1';
const INITIAL_PROGRESS: StoredProgress = {
  version: 2,
  currentLesson: 1,
  completedLessons: [],
  lessonStates: {},
};

@Injectable({ providedIn: 'root' })
export class LearningProgress {
  // Isolated developer preview: inspect a lesson without modifying the learner's history.
  private readonly previewLesson = isDevMode() ? Number(new URLSearchParams(globalThis.location?.search ?? '').get('previewLesson')) : 0;
  readonly previewMode = Number.isInteger(this.previewLesson) && this.previewLesson >= 1 && this.previewLesson <= 8;
  private readonly state = signal<StoredProgress>(this.load());

  currentLesson(): number {
    return this.state().currentLesson;
  }

  isCompleted(lesson: number): boolean {
    return this.state().completedLessons.includes(lesson);
  }

  canAccess(lesson: number): boolean {
    return lesson <= Math.max(1, ...this.state().completedLessons.map((value) => value + 1));
  }

  complete(lesson: number): void {
    const completed = [...new Set([...this.state().completedLessons, lesson])].sort();
    this.save({ ...this.state(), completedLessons: completed, currentLesson: Math.max(this.currentLesson(), lesson) });
  }

  lessonState<T>(lesson: number, fallback: T): T {
    return (this.state().lessonStates[String(lesson)] as T | undefined) ?? fallback;
  }

  saveLessonState<T>(lesson: number, value: T): void {
    const current = untracked(() => this.state());
    this.save({
      ...current,
      lessonStates: { ...current.lessonStates, [String(lesson)]: value },
    });
  }

  clearLessonState(lesson: number): void {
    const lessonStates = { ...this.state().lessonStates };
    delete lessonStates[String(lesson)];
    this.save({ ...this.state(), lessonStates });
  }

  navigateTo(lesson: number): boolean {
    if (!this.canAccess(lesson)) return false;
    this.save({ ...this.state(), currentLesson: lesson });
    return true;
  }

  clear(): void {
    this.save(INITIAL_PROGRESS);
  }

  private load(): StoredProgress {
    if (this.previewMode) return { ...INITIAL_PROGRESS, currentLesson: this.previewLesson, completedLessons: Array.from({ length: this.previewLesson - 1 }, (_, i) => i + 1) };
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return INITIAL_PROGRESS;
      const parsed = JSON.parse(raw) as Partial<StoredProgress>;
      if (!Array.isArray(parsed.completedLessons)) return INITIAL_PROGRESS;
      return {
        version: 2,
        currentLesson: Number(parsed.currentLesson) || 1,
        completedLessons: parsed.completedLessons.filter(Number.isInteger),
        lessonStates:
          parsed.version === 2 && parsed.lessonStates && typeof parsed.lessonStates === 'object'
            ? parsed.lessonStates
            : {},
      };
    } catch {
      return INITIAL_PROGRESS;
    }
  }

  private save(progress: StoredProgress): void {
    this.state.set(progress);
    if (this.previewMode) return;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // The laboratory remains usable when storage is unavailable or blocked.
    }
  }
}

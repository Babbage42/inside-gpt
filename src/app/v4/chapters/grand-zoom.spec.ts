import { play } from './grand-zoom';

describe('V4 · grand zoom', () => {
  it('s’arrête sur chaque palier, puis va jusqu’au bout', () => {
    let state = { position: 0, held: 0 }, seconds = 0;
    const stops = new Set<number>();
    for (let frame = 0; frame < 60 * 120; frame++) {
      const next = play(state, 1 / 60, 7);
      if (next.position === state.position && Number.isInteger(next.position)) stops.add(next.position);
      expect(next.position).toBeGreaterThanOrEqual(state.position);
      state = next;
      seconds += 1 / 60;
      if (next.done) break;
    }
    expect(state.position).toBe(7);
    expect([...stops].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // Huit pauses, six reculs ordinaires et un dernier recul plus long : un peu moins d'une minute.
    expect(seconds).toBeGreaterThan(35);
    expect(seconds).toBeLessThan(60);
  });

  it('ne dépasse jamais un palier, même si une image arrive très en retard', () => {
    const late = play({ position: 2.9, held: 0 }, 5, 7);
    expect(late.position).toBe(3);
  });
});

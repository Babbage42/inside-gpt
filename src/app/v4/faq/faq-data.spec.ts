import { CHAPTERS } from '../chapters';
import { CATEGORIES, ENTRIES, search, slug } from './faq-data';

describe('V4 · questions fréquentes', () => {
  it('donne à chaque question une adresse unique', () => {
    const slugs = ENTRIES.map((entry) => slug(entry.question));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => s.length > 5)).toBeTrue();
  });

  it('range chaque question dans une famille connue, et renvoie à un chapitre qui existe', () => {
    for (const entry of ENTRIES) {
      expect(CATEGORIES as readonly string[]).withContext(entry.question).toContain(entry.category);
      if (entry.chapter !== undefined) expect(entry.chapter >= 0 && entry.chapter < CHAPTERS.length).withContext(entry.question).toBeTrue();
    }
    for (const category of CATEGORIES) expect(ENTRIES.filter((entry) => entry.category === category).length).toBeGreaterThanOrEqual(4);
  });

  it('garde des réponses courtes', () => {
    for (const entry of ENTRIES) {
      const length = entry.answer.replace(/<[^>]+>/g, '').length;
      expect(length).withContext(entry.question).toBeGreaterThan(120);
      expect(length).withContext(entry.question).toBeLessThan(720);
    }
  });

  it('cherche sans tenir compte des accents, des majuscules ni des balises', () => {
    expect(search('rétropropagation').length).toBeGreaterThan(0);
    expect(search('RETROPROPAGATION')).toEqual(search('rétropropagation'));
    expect(search('température tirage').length).toBeGreaterThan(0);
    expect(search('strong')).toEqual([]);
    expect(search('').length).toBe(ENTRIES.length);
    expect(search('zzzz')).toEqual([]);
  });
});

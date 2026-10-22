import { describe, expect, it } from 'vitest';
import { NUTRITION_SERVICES, INITIAL_PACKAGES } from './seedData';
import { consultationsValue, programLengths } from '../components/ServiceCatalog';
import { lengthSaving, planFamilies } from '../components/PlanCard';

describe('program catalogue', () => {
  it('has the 15 programs in 4 categories', () => {
    expect(NUTRITION_SERVICES).toHaveLength(15);
    const count = (g: string) => NUTRITION_SERVICES.filter((s) => s.group === g).length;
    expect([count('everyday'), count('conditions'), count('specialised'), count('medical')]).toEqual([3, 3, 6, 3]);
    expect(new Set(NUTRITION_SERVICES.map((s) => s.id)).size).toBe(15);
    expect(new Set(NUTRITION_SERVICES.map((s) => s.title)).size).toBe(15);
  });

  it('every program has a price and consultations, or is clearly "assessment first"', () => {
    for (const s of NUTRITION_SERVICES) {
      if (s.assessmentFirst) {
        expect(s.priceInr, s.title).toBeUndefined();
      } else {
        expect(s.priceInr, s.title).toBeGreaterThan(0);
        expect(s.consultations, s.title).toBeGreaterThan(0);
      }
      expect(s.whatIsIncluded.length, s.title).toBeGreaterThan(3);
    }
  });

  it('3-month options save about 20%, 6-month options about 27%', () => {
    for (const s of NUTRITION_SERVICES) {
      for (const l of programLengths(s)) {
        if (l.months === 3) expect(l.pct, s.title).toBe(20);
        if (l.months === 6) expect(l.pct, s.title).toBeGreaterThanOrEqual(26);
        if (l.months === 6) expect(l.pct, s.title).toBeLessThanOrEqual(28);
      }
    }
  });

  it('every ongoing-care program offers 1, 3 and 6 months', () => {
    const withLengths = NUTRITION_SERVICES.filter((s) => programLengths(s).length === 3).map((s) => s.title);
    expect(withLengths).toHaveLength(9);
  });

  it('the Nutrition Care plan comes in 1, 3 and 6 months, saving 20% and 27%', () => {
    const family = planFamilies(INITIAL_PACKAGES).find((f) => f[0].familyTitle === 'Nutrition Care')!;
    expect(family.map((p) => p.validityDays)).toEqual([30, 90, 180]);
    expect(family.map((p) => lengthSaving(p, family).pct)).toEqual([0, 20, 27]);
    expect(planFamilies(INITIAL_PACKAGES)).toHaveLength(3);
  });

  it('values included consultations at the standard fees (first ₹500, then ₹300)', () => {
    expect(consultationsValue(2)).toBe(800);
    expect(consultationsValue(4)).toBe(1400);
  });

  it('keeps the 4 core plans separate from the programs', () => {
    const planTitles = INITIAL_PACKAGES.map((p) => p.title);
    expect(planTitles).toEqual(['Starter Consultation', 'Personalised Diet Plan', 'Monthly Nutrition Care', 'Quarterly Nutrition Care', 'Half-Yearly Nutrition Care']);
    expect(NUTRITION_SERVICES.some((s) => planTitles.includes(s.title))).toBe(false);
  });
});

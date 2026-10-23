import { describe, expect, it } from 'vitest';
import { NUTRITION_SERVICES, INITIAL_PACKAGES, PROGRAM_PACKAGES, SEED_PACKAGES } from './seedData';
import { consultationsValue, programLengths, programPackage } from '../components/ServiceCatalog';
import { lengthSaving, planFamilies } from '../components/PlanCard';

describe('program catalogue', () => {
  it('has the 12 condition programs in 3 categories', () => {
    expect(NUTRITION_SERVICES).toHaveLength(12);
    const count = (g: string) => NUTRITION_SERVICES.filter((s) => s.group === g).length;
    expect([count('conditions'), count('specialised'), count('medical')]).toEqual([3, 6, 3]);
    expect(new Set(NUTRITION_SERVICES.map((s) => s.id)).size).toBe(12);
    expect(new Set(NUTRITION_SERVICES.map((s) => s.title)).size).toBe(12);
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
    expect(withLengths).toHaveLength(6);
  });

  it('sells every priced program online, one plan per length, at the listed prices', () => {
    for (const s of NUTRITION_SERVICES) {
      const lengths = programLengths(s);
      expect(lengths.length > 0, s.title).toBe(!s.assessmentFirst);
      for (const l of lengths) {
        const pkg = programPackage(s.id, l.months, PROGRAM_PACKAGES)!;
        expect(pkg, `${s.title} ${l.months}`).toMatchObject({ serviceId: s.id, priceInr: l.priceInr, validityDays: l.months * 30, isActive: true });
      }
    }
    expect(new Set(SEED_PACKAGES.map((p) => p.id)).size).toBe(SEED_PACKAGES.length);
    // Each program is one choice with its lengths, like Nutrition Care.
    expect(planFamilies(PROGRAM_PACKAGES)).toHaveLength(NUTRITION_SERVICES.filter((s) => !s.assessmentFirst).length);
  });

  it('Nutrition Care covers Lifestyle Reset, Weight Management and Women’s Wellness as goals', () => {
    const care = INITIAL_PACKAGES.find((p) => p.id === 'pkg-monthly-nutrition-care')!;
    expect(care.goals!.map((g) => g.id)).toEqual(['habits', 'weight', 'womens-wellness']);
    for (const g of care.goals!) expect(g.highlights.length, g.label).toBeGreaterThan(1);
    expect(NUTRITION_SERVICES.some((s) => /Lifestyle Reset|Weight Management|Women/.test(s.title))).toBe(false);
  });

  it('the Nutrition Care plan comes in 1, 3 and 6 months, saving 20% and 27%', () => {
    const family = planFamilies(INITIAL_PACKAGES).find((f) => f[0].familyTitle === 'Nutrition Care')!;
    expect(family.map((p) => p.validityDays)).toEqual([30, 90, 180]);
    expect(family.map((p) => lengthSaving(p, family).pct)).toEqual([0, 20, 27]);
    expect(planFamilies(INITIAL_PACKAGES)).toHaveLength(3);
  });

  it('values included consultations at the standard fees (first ₹499, then ₹300)', () => {
    expect(consultationsValue(2)).toBe(799);
    expect(consultationsValue(4)).toBe(1399);
  });

  it('keeps the core plans separate from the programs', () => {
    const planTitles = INITIAL_PACKAGES.map((p) => p.title);
    expect(planTitles).toEqual(['First Consultation', 'Personalised Diet Plan', 'Monthly Nutrition Care', 'Quarterly Nutrition Care', 'Half-Yearly Nutrition Care']);
    expect(NUTRITION_SERVICES.some((s) => planTitles.includes(s.title))).toBe(false);
    expect(INITIAL_PACKAGES.find((p) => p.title === 'First Consultation')).toMatchObject({ priceInr: 499, creditInFull: true });
  });
});

import { useEffect, useState } from 'react';
import { dataApi } from './dataApi';
import type { NutritionPackage } from '../types/nutrition';

// The last price list this browser saw. Shown instantly on the next visit, so the pricing section
// renders at its real size immediately instead of growing when the request returns (which made the
// page jump on refresh). The live list replaces it a moment later.
const CACHE_KEY = 'nf_price_list';

function readCache(): NutritionPackage[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const list = raw ? JSON.parse(raw) : null;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

/** The live price list (as set by the dietitian in Manage Pricing), active plans only. */
export function usePublicPackages() {
  const [packages, setPackages] = useState<NutritionPackage[] | null>(readCache);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dataApi
      .publicPackages()
      .then((list) => {
        if (cancelled) return;
        const active = list.filter((p) => p.isActive);
        setPackages(active);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(active));
        } catch {
          /* storage unavailable: fine, it's only a speed-up */
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return { packages, failed: failed && !packages };
}

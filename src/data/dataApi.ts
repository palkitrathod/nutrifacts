import { request } from '../auth/authApi';
import type {
  Appointment,
  AppNotification,
  DailyTracker,
  DietChart,
  MealAdherenceEntry,
  NutritionPackage,
  PackagePayment,
  User,
  WeightRecord,
} from '../types/nutrition';

/** Everything the signed-in person may see, as returned by GET /api/data. */
export interface AppData {
  patients: User[];
  dietCharts: DietChart[];
  weightRecords: WeightRecord[];
  appointments: Appointment[];
  notifications: AppNotification[];
  dailyTrackers: Record<string, DailyTracker>;
  packages: NutritionPackage[];
  payments: PackagePayment[];
  adherenceRecords: MealAdherenceEntry[];
}

export type Collection = keyof AppData;
export const COLLECTIONS: Collection[] = [
  'patients',
  'dietCharts',
  'weightRecords',
  'appointments',
  'notifications',
  'dailyTrackers',
  'packages',
  'payments',
  'adherenceRecords',
];

export interface WriteOp {
  collection: Collection;
  id: string;
  data: object;
}

const accountHeader = (accountId: string) => ({ 'X-Nutrifacts-Account': accountId });

export const dataApi = {
  load: (accountId: string) => request<AppData>('/data', { headers: accountHeader(accountId) }),
  save: (accountId: string, ops: WriteOp[], keepalive = false) =>
    request<{ saved: number }>('/data/batch', {
      method: 'POST',
      body: JSON.stringify({ ops }),
      keepalive,
      headers: accountHeader(accountId),
    }),
  publicPackages: () => request<{ packages: NutritionPackage[] }>('/packages').then((r) => r.packages),
};

// ── Change tracking ─────────────────────────────────────────────────────────
// The app updates records immutably, so a record whose object identity is unchanged is unchanged.
// Caching serialisations by identity keeps diffing cheap even with large PDF-bearing diet charts.

const serialised = new WeakMap<object, string>();
const serialise = (o: object) => {
  let s = serialised.get(o);
  if (s === undefined) {
    s = JSON.stringify(o);
    serialised.set(o, s);
  }
  return s;
};

export type Snapshot = Record<Collection, Map<string, string>>;

function entries(collection: Collection, data: AppData): Array<[string, object]> {
  if (collection === 'dailyTrackers') return Object.entries(data.dailyTrackers);
  return (data[collection] as Array<{ id: string }>).map((r) => [r.id, r]);
}

export function snapshotOf(data: AppData): Snapshot {
  const snap = {} as Snapshot;
  for (const c of COLLECTIONS) snap[c] = new Map(entries(c, data).map(([id, r]) => [id, serialise(r)]));
  return snap;
}

/** Records that are new or changed since the snapshot. (The app never deletes records.) */
export function diff(snapshot: Snapshot, data: AppData): WriteOp[] {
  const ops: WriteOp[] = [];
  for (const c of COLLECTIONS) {
    for (const [id, record] of entries(c, data)) {
      if (snapshot[c].get(id) !== serialise(record)) ops.push({ collection: c, id, data: record });
    }
  }
  return ops;
}

export function markSaved(snapshot: Snapshot, ops: WriteOp[]) {
  for (const op of ops) snapshot[op.collection].set(op.id, serialise(op.data));
}

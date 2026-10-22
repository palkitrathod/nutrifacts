import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import {
  User,
  DietChart,
  WeightRecord,
  Appointment,
  NutritionService,
  AppNotification,
  DailyTracker,
  UserRole,
  NutritionPackage,
  PackagePayment,
  PaymentMethodType,
  MealAdherenceEntry,
  ClinicalConditionType,
  DayOfWeek,
} from '../types/nutrition';
import { DIETITIAN_PROFILE, NUTRITION_SERVICES, CLINICAL_CONDITIONS_DATA } from '../data/mockData';
import { dataApi, diff, markSaved, snapshotOf, type AppData, type Snapshot } from '../data/dataApi';
import { ApiError } from '../auth/authApi';
import { formatPhone } from '../shared/authValidation';
import { addDays, canRenewEarly, isPlanActive, newPlanValidUntil, RENEWAL_BONUS_DAYS, todayIso, upgradeQuote } from '../shared/plans';

/** The signed-in account as returned by the auth API. */
export interface AccountInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

interface NutritionContextType {
  currentUser: User;
  isDietitian: boolean;
  patients: User[];
  dietCharts: DietChart[];
  weightRecords: WeightRecord[];
  appointments: Appointment[];
  notifications: AppNotification[];
  dailyTrackers: Record<string, DailyTracker>;
  services: NutritionService[];
  selectedPatientId: string; // for dietitian admin viewing
  
  // Actions
  /** Loads the signed-in account's data from the server (creating its patient record on first sign-in). */
  activateAccount: (account: AccountInfo) => Promise<void>;
  /** Saves any unsent changes now (e.g. before signing out). */
  flushPendingChanges: () => Promise<void>;
  /** Clears all in-memory data, so nothing from this account remains after sign-out. */
  resetData: () => void;
  /** Id of the account whose data is loaded, or null. */
  dataOwnerId: string | null;
  /** Set when a change could not be saved; the data has then been reloaded from the server. */
  syncError: string | null;
  dismissSyncError: () => void;
  setSelectedPatientId: (id: string) => void;
  
  // Diet Chart Actions
  getCurrentUserDietChart: () => DietChart | undefined;
  getPatientDietChart: (patientId: string) => DietChart | undefined;
  saveDietChart: (chart: DietChart) => void;
  uploadCustomPdfChart: (patientId: string, fileName: string, fileDataUrl: string) => void;
  
  // Weight & Progress Actions
  addWeightRecord: (record: Omit<WeightRecord, 'id'>) => void;
  getPatientWeightHistory: (patientId: string) => WeightRecord[];
  
  // Appointment Actions
  bookAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'status'>) => void;
  updateAppointmentStatus: (id: string, status: Appointment['status'], dietitianNotes?: string) => void;
  
  // Daily Tracking Actions
  updateWaterIntake: (delta: number) => void;
  toggleMealCompletion: (mealId: string) => void;
  
  // Daily Food Intake & Adherence Actions
  adherenceRecords: MealAdherenceEntry[];
  logMealAdherence: (entry: Omit<MealAdherenceEntry, 'id' | 'loggedAt'>) => void;
  getPatientAdherenceHistory: (patientId: string) => MealAdherenceEntry[];
  getAdherenceStats: (patientId: string) => { totalLogged: number; followed: number; skipped: number; adherencePercentage: number };
  assignClinicalConditionDiet: (patientId: string, conditionType: ClinicalConditionType) => void;

  // Package & Payment Actions
  packages: NutritionPackage[];
  payments: PackagePayment[];
  /** Resolves only once the server has accepted the payment; rejects with the reason otherwise. */
  /** Buys a plan. With `upgrade`, the current plan's unused days are credited against the price. */
  processPackagePurchase: (
    packageId: string,
    paymentMethod: PaymentMethodType,
    paymentDetails: string,
    options?: { upgrade?: boolean; renew?: boolean }
  ) => Promise<PackagePayment>;
  /** My Plans: switch to a cheaper (or same-price) plan when the current one ends. */
  schedulePlanChange: (pkg: NutritionPackage) => void;
  cancelScheduledPlanChange: () => void;
  updatePackage: (updated: NutritionPackage) => void;
  addPackage: (newPkg: Omit<NutritionPackage, 'id'>) => void;
  togglePackageActive: (packageId: string) => void;
  /** Marks a payment refunded; amountInr defaults to the full amount paid. */
  refundPayment: (paymentId: string, reason: string, amountInr?: number) => void;
  getPatientPayments: (patientId: string) => PackagePayment[];
  getActivePackage: (patientId: string) => PackagePayment | undefined;

  // Notifications
  markNotificationRead: (id: string) => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  
  // Profile update
  updatePatientProfile: (updatedData: Partial<User>) => void;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

// Shown only until the signed-in account's data has loaded; the app shell never renders with it.
const NO_USER: User = { id: '', name: '', email: '', phone: '', role: 'patient', joinedDate: '' };

const EMPTY_DATA: AppData = {
  patients: [],
  dietCharts: [],
  weightRecords: [],
  appointments: [],
  notifications: [],
  dailyTrackers: {},
  packages: [],
  payments: [],
  adherenceRecords: [],
};

const SAVE_DELAY_MS = 300;

/**
 * Globally unique record id, e.g. "appt-3f2b…". crypto.randomUUID only exists on https/localhost,
 * so fall back to getRandomValues (available everywhere) when the site is opened via a LAN IP.
 */
const newId = (prefix: string) => {
  if (typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
};


/** Today's tracker for a person; yesterday's counts never carry over. */
export function trackerForToday(tracker: DailyTracker | undefined): DailyTracker {
  const today = todayIso();
  if (tracker && tracker.date === today) return tracker;
  return { date: today, waterGlasses: 0, mealsChecked: {}, activityMinutes: 0 };
}

/** `syncError` value when the server no longer recognises the session (expired or signed out elsewhere). */
export const SESSION_EXPIRED = 'session_expired';

/** Signed out, expired, or another account signed in from another tab. */
const isSessionGone = (err: unknown) => err instanceof ApiError && (err.status === 401 || err.status === 409);

export const NutritionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(NO_USER);
  const [patients, setPatients] = useState<User[]>([]);
  const [dietCharts, setDietCharts] = useState<DietChart[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dailyTrackers, setDailyTrackers] = useState<Record<string, DailyTracker>>({});
  const [packages, setPackages] = useState<NutritionPackage[]>([]);
  const [payments, setPayments] = useState<PackagePayment[]>([]);
  const [adherenceRecords, setAdherenceRecords] = useState<MealAdherenceEntry[]>([]);

  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  // ── Server sync ─────────────────────────────────────────────────────────
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const accountRef = useRef<AccountInfo | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const savingRef = useRef<Promise<void> | null>(null);

  const appData: AppData = {
    patients,
    dietCharts,
    weightRecords,
    appointments,
    notifications,
    dailyTrackers,
    packages,
    payments,
    adherenceRecords,
  };
  const appDataRef = useRef(appData);
  appDataRef.current = appData;

  /** Puts server data on screen. `additions` are local-only records (not yet saved) layered on top. */
  const applyData = useCallback((data: AppData, account: AccountInfo, additions?: Partial<AppData>) => {
    snapshotRef.current = snapshotOf(data);
    const merged: AppData = { ...data, ...additions };

    // Identity fields always come from the account; the clinical profile from the app data.
    const identity = { id: account.id, name: account.name, email: account.email, phone: formatPhone(account.phone) };
    if (account.role === 'dietitian') {
      setCurrentUser({ ...DIETITIAN_PROFILE, ...identity, role: 'dietitian' });
      setSelectedPatientId((prev) => (merged.patients.some((p) => p.id === prev) ? prev : merged.patients[0]?.id ?? ''));
    } else {
      const own = merged.patients.find((p) => p.id === account.id);
      if (own) setCurrentUser({ ...own, ...identity, role: 'patient' });
      setSelectedPatientId(account.id);
    }

    setPatients(merged.patients);
    setDietCharts(merged.dietCharts);
    setWeightRecords(merged.weightRecords);
    setAppointments(merged.appointments);
    setNotifications(merged.notifications);
    setDailyTrackers(merged.dailyTrackers);
    setPackages(merged.packages);
    setPayments(merged.payments);
    setAdherenceRecords(merged.adherenceRecords);
  }, []);

  const reloadFromServer = useCallback(async () => {
    const account = accountRef.current;
    if (!account) return;
    const data = await dataApi.load(account.id);
    if (accountRef.current?.id === account.id) applyData(data, account);
  }, [applyData]);

  const saveChanges = useCallback(
    (keepalive = false): Promise<void> => {
      // One save at a time; a save requested meanwhile runs right after, with the latest state.
      if (savingRef.current) return savingRef.current.then(() => saveChanges(keepalive));
      const snapshot = snapshotRef.current;
      if (!snapshot || !accountRef.current) return Promise.resolve();
      const ops = diff(snapshot, appDataRef.current);
      if (ops.length === 0) return Promise.resolve();

      const run = (async () => {
        try {
          await dataApi.save(accountRef.current!.id, ops, keepalive);
          markSaved(snapshot, ops);
        } catch (err) {
          console.error('Saving changes failed', err);
          if (isSessionGone(err)) {
            setSyncError(SESSION_EXPIRED);
            return;
          }
          setSyncError(
            err instanceof ApiError && err.status !== 0
              ? `Your last change could not be saved: ${err.message}`
              : 'Your last change could not be saved because the connection dropped. Please try again.'
          );
          // Show what the server actually has, rather than unsaved local edits.
          await reloadFromServer().catch(() => undefined);
        } finally {
          savingRef.current = null;
        }
      })();
      savingRef.current = run;
      return run;
    },
    [reloadFromServer]
  );

  // Auto-save shortly after any change.
  useEffect(() => {
    if (!dataOwnerId) return;
    const t = setTimeout(() => void saveChanges(), SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [dataOwnerId, saveChanges, patients, dietCharts, weightRecords, appointments, notifications, dailyTrackers, packages, payments, adherenceRecords]);

  useEffect(() => {
    if (!dataOwnerId) return;
    // Save anything pending if the tab is closed; refresh when the person comes back to the tab,
    // so a patient sees chart updates the dietitian made in the meantime.
    const onHide = () => void saveChanges(true);
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || savingRef.current) return;
      if (snapshotRef.current && diff(snapshotRef.current, appDataRef.current).length === 0) {
        reloadFromServer().catch((err) => isSessionGone(err) && setSyncError(SESSION_EXPIRED));
      }
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dataOwnerId, saveChanges, reloadFromServer]);

  const flushPendingChanges = useCallback(() => saveChanges(), [saveChanges]);

  const resetData = useCallback(() => {
    accountRef.current = null;
    snapshotRef.current = null;
    setDataOwnerId(null);
    setSyncError(null);
    setCurrentUser(NO_USER);
    setSelectedPatientId('');
    applyEmpty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyEmpty = () => {
    setPatients(EMPTY_DATA.patients);
    setDietCharts(EMPTY_DATA.dietCharts);
    setWeightRecords(EMPTY_DATA.weightRecords);
    setAppointments(EMPTY_DATA.appointments);
    setNotifications(EMPTY_DATA.notifications);
    setDailyTrackers(EMPTY_DATA.dailyTrackers);
    setPackages(EMPTY_DATA.packages);
    setPayments(EMPTY_DATA.payments);
    setAdherenceRecords(EMPTY_DATA.adherenceRecords);
  };

  const isDietitian = currentUser.role === 'dietitian';

  const activateAccount = useCallback(
    async (account: AccountInfo) => {
      accountRef.current = account;
      const data = await dataApi.load(account.id);
      if (accountRef.current?.id !== account.id) return; // signed out / switched meanwhile

      let additions: Partial<AppData> | undefined;
      if (account.role === 'patient' && !data.patients.some((p) => p.id === account.id)) {
        // First sign-in after sign-up: create the clinical profile (saved by the auto-save).
        const newPatient: User = {
          id: account.id,
          name: account.name,
          email: account.email,
          phone: formatPhone(account.phone),
          role: 'patient',
          dietaryPreference: 'Vegetarian',
          healthGoals: ['Sustainable Nutrition & Health'],
          medicalConditions: [],
          allergies: [],
          waterGoalLitres: 3.0,
          joinedDate: new Date().toISOString().split('T')[0],
          assignedProgram: 'Awaiting initial consultation',
        };
        const welcomeNotif: AppNotification = {
          id: `notif-welcome-${account.id}`,
          userId: account.id,
          title: 'Welcome to Nutrifacts!',
          message: 'Welcome to your nutrition journey with Dt. Anchal. Book your initial consultation to receive your diet chart.',
          timestamp: 'Just now',
          category: 'care',
          read: false,
        };
        additions = {
          patients: [newPatient, ...data.patients],
          notifications: [welcomeNotif, ...data.notifications],
        };
      }

      applyData(data, account, additions);
      setSyncError(null);
      setDataOwnerId(account.id);
    },
    [applyData]
  );

  // Privacy rule: Patients can only view their own diet chart
  const getCurrentUserDietChart = () => {
    if (isDietitian) {
      return dietCharts.find((c) => c.patientId === selectedPatientId);
    }
    return dietCharts.find((c) => c.patientId === currentUser.id);
  };

  const getPatientDietChart = (patientId: string) => {
    if (!isDietitian && currentUser.id !== patientId) {
      // Privacy boundary protection
      return undefined;
    }
    return dietCharts.find((c) => c.patientId === patientId);
  };

  const saveDietChart = (updatedChart: DietChart) => {
    upsertDietChart(updatedChart);

    // Notify the patient
    addNotification({
      userId: updatedChart.patientId,
      title: 'Diet Chart Updated by Dt. Anchal',
      message: `Your diet chart "${updatedChart.title}" is updated with new recommendations.`,
      category: 'diet',
    });
  };

  const upsertDietChart = (updatedChart: DietChart) => {
    setDietCharts((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedChart.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedChart;
        return copy;
      }
      return [updatedChart, ...prev];
    });
  };

  const uploadCustomPdfChart = (patientId: string, fileName: string, fileDataUrl: string) => {
    setDietCharts((prev) => {
      const existing = prev.find((c) => c.patientId === patientId);
      const patient = patients.find((p) => p.id === patientId);
      const today = new Date().toISOString().split('T')[0];

      if (existing) {
        return prev.map((c) =>
          c.patientId === patientId
            ? {
                ...c,
                pdfFileName: fileName,
                pdfCustomUrl: fileDataUrl,
                pdfUploadedDate: today,
              }
            : c
        );
      } else {
        const newChart: DietChart = {
          id: newId('chart'),
          patientId,
          patientName: patient?.name || 'Patient',
          title: `Personalized Nutrition Chart (${fileName.replace('.pdf', '')})`,
          version: '1.0',
          dateIssued: today,
          validUntil: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          followUpDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          dailyCalorieTarget: 1500,
          macroDistribution: { carbs: 50, protein: 25, fats: 25 },
          focusArea: 'Custom Diet Protocol',
          generalInstructions: [
            'Follow meal timings as outlined in your attached PDF chart.',
            'Maintain optimal hydration throughout the day.',
          ],
          dos: ['Stay consistent with prescribed portions', 'Log water daily'],
          donts: ['Do not consume ultra-processed foods'],
          hydrationGuidelines: '3.0 Litres daily',
          lifestyleTips: ['7-8 hours restful sleep'],
          dietitianNotes: 'Uploaded official PDF diet chart document.',
          meals: [],
          pdfFileName: fileName,
          pdfCustomUrl: fileDataUrl,
          pdfUploadedDate: today,
        };
        return [newChart, ...prev];
      }
    });

    addNotification({
      userId: patientId,
      title: 'New Diet Chart PDF Uploaded',
      message: `Dt. Anchal uploaded your new diet chart: ${fileName}. Tap to view and download.`,
      category: 'diet',
    });
  };

  const addWeightRecord = (record: Omit<WeightRecord, 'id'>) => {
    const newRecord: WeightRecord = {
      ...record,
      id: newId('weight'),
    };
    setWeightRecords((prev) => [...prev, newRecord]);

    // Update patient current weight
    setPatients((prev) =>
      prev.map((p) => (p.id === record.patientId ? { ...p, currentWeightKg: record.weightKg } : p))
    );
    if (currentUser.id === record.patientId) {
      setCurrentUser((prev) => ({ ...prev, currentWeightKg: record.weightKg }));
    }

    addNotification({
      userId: record.patientId,
      title: 'Weight Log Recorded',
      message: `Great job logging your weight: ${record.weightKg} kg on ${record.date}.`,
      category: 'weight',
    });
  };

  const getPatientWeightHistory = (patientId: string) => {
    return weightRecords
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const bookAppointment = (appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'status'>) => {
    const newAppt: Appointment = {
      ...appointmentData,
      id: newId('appt'),
      status: 'confirmed', // instant confirmation in clinic system
      createdAt: new Date().toISOString().split('T')[0],
      meetingLink:
        appointmentData.consultationType === 'online_video'
          ? `https://meet.google.com/nutrifacts-${appointmentData.patientName.toLowerCase().replace(/\s+/g, '-')}`
          : undefined,
    };

    setAppointments((prev) => [newAppt, ...prev]);

    // Notification for patient
    addNotification({
      userId: appointmentData.patientId,
      title: 'Consultation Scheduled!',
      message: `Your ${appointmentData.consultationType === 'online_video' ? 'online video' : 'in-clinic'} consultation with Dt. Anchal is booked for ${appointmentData.date} at ${appointmentData.timeSlot}.`,
      category: 'appointment',
    });
  };

  const updateAppointmentStatus = (id: string, status: Appointment['status'], dietitianNotes?: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status, dietitianNotes: dietitianNotes ?? a.dietitianNotes } : a))
    );

    const appt = appointments.find((a) => a.id === id);
    if (appt) {
      addNotification({
        userId: appt.patientId,
        title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your appointment on ${appt.date} status is now ${status}. ${dietitianNotes ? `Notes: ${dietitianNotes}` : ''}`,
        category: 'appointment',
      });
    }
  };

  const updateWaterIntake = (delta: number) => {
    const today = new Date().toISOString().split('T')[0];
    const patientKey = currentUser.id;

    setDailyTrackers((prev) => {
      const current = trackerForToday(prev[patientKey]);

      const newGlasses = Math.max(0, Math.min(16, current.waterGlasses + delta));
      return {
        ...prev,
        [patientKey]: {
          ...current,
          date: today,
          waterGlasses: newGlasses,
        },
      };
    });
  };

  const toggleMealCompletion = (mealId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const patientKey = currentUser.id;

    setDailyTrackers((prev) => {
      const current = trackerForToday(prev[patientKey]);

      const currentChecked = current.mealsChecked[mealId] || false;
      return {
        ...prev,
        [patientKey]: {
          ...current,
          date: today,
          mealsChecked: {
            ...current.mealsChecked,
            [mealId]: !currentChecked,
          },
        },
      };
    });
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: newId('notif'),
      timestamp: 'Just now',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const updatePatientProfile = (updatedData: Partial<User>) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === currentUser.id ? { ...p, ...updatedData } : p))
    );
    setCurrentUser((prev) => ({ ...prev, ...updatedData }));
  };

  // Package & Payment Implementations
  const processPackagePurchase = async (
    packageId: string,
    paymentMethod: PaymentMethodType,
    paymentDetails: string,
    options: { upgrade?: boolean; renew?: boolean } = {}
  ): Promise<PackagePayment> => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) throw new Error('This plan is no longer available.');
    const today = todayIso();
    const current = getActivePackage(currentUser.id);
    const upgradeFrom = options.upgrade ? current : undefined;
    if (options.upgrade && !isPlanActive(upgradeFrom, today)) throw new Error('Your current plan has ended. Choose a new plan instead.');
    const renewalOf = options.renew ? current : undefined;
    if (options.renew && !canRenewEarly(renewalOf, today)) throw new Error('Early renewal is open in the last 7 days of a plan.');
    const quote = upgradeQuote(upgradeFrom, pkg.priceInr, today, {
      inFull: !!upgradeFrom && packages.find((p) => p.id === upgradeFrom.packageId)?.creditInFull === true,
    });
    const validUntilDate = newPlanValidUntil(pkg.validityDays, today, renewalOf);

    const newPayment: PackagePayment = {
      id: newId('pay'),
      transactionRef: `PAY-2026-NUTR-${Math.floor(10000 + Math.random() * 90000)}`,
      patientId: currentUser.id,
      patientName: currentUser.name,
      patientEmail: currentUser.email || 'patient@nutrifacts.in',
      patientPhone: currentUser.phone || '+91 98000 00000',
      packageId: pkg.id,
      packageTitle: pkg.title,
      amountInr: quote.amountDueInr,
      ...(upgradeFrom && { listPriceInr: pkg.priceInr, creditInr: quote.creditInr, upgradeFromPaymentId: upgradeFrom.id }),
      ...(renewalOf && { renewalOfPaymentId: renewalOf.id, bonusDays: RENEWAL_BONUS_DAYS }),
      paymentMethod,
      paymentDetails,
      status: 'successful',
      createdAt: today,
      validUntil: validUntilDate,
      invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    // Save the payment on its own and wait for the server, so "Payment Successful" is never shown
    // for a payment the server refused (e.g. the price changed since the page loaded).
    const op = { collection: 'payments' as const, id: newPayment.id, data: newPayment };
    try {
      await dataApi.save(currentUser.id, [op]);
    } catch (err) {
      await reloadFromServer().catch(() => undefined); // pick up the current price list
      throw err;
    }
    if (snapshotRef.current) markSaved(snapshotRef.current, [op]);

    setPayments((prev) => [newPayment, ...prev]);

    // Update patient assigned program & follow-up date
    setPatients((prev) =>
      prev.map((p) =>
        p.id === currentUser.id
          ? {
              ...p,
              assignedProgram: pkg.title,
              followUpDate: validUntilDate,
              scheduledPlanChange: undefined, // buying a plan replaces any scheduled change
            }
          : p
      )
    );
    setCurrentUser((prev) => ({
      ...prev,
      assignedProgram: pkg.title,
      followUpDate: validUntilDate,
      scheduledPlanChange: undefined,
    }));

    // Add notification for patient
    addNotification({
      userId: currentUser.id,
      title: 'Payment Confirmed! 🥗',
      message: `Your payment of ₹${newPayment.amountInr} for ${pkg.title}${upgradeFrom ? ' (upgrade)' : renewalOf ? ` (early renewal, ${RENEWAL_BONUS_DAYS} bonus days added)` : ''} was successful. Transaction Ref: ${newPayment.transactionRef}. Receipt generated.`,
      category: 'care',
    });

    // Add notification for dietitian
    addNotification({
      userId: DIETITIAN_PROFILE.id,
      title: 'New Package Order Received',
      message: `${currentUser.name} ${upgradeFrom ? 'upgraded to' : 'purchased'} ${pkg.title} (₹${newPayment.amountInr}) via ${paymentMethod.toUpperCase()}.`,
      category: 'care',
    });

    return newPayment;
  };

  const updatePackage = (updated: NutritionPackage) => {
    setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    addNotification({
      userId: DIETITIAN_PROFILE.id,
      title: 'Package Updated',
      message: `Package "${updated.title}" pricing updated to ₹${updated.priceInr}.`,
      category: 'care',
    });
  };

  const schedulePlanChange = (pkg: NutritionPackage) => {
    const active = getActivePackage(currentUser.id);
    if (!isPlanActive(active)) return;
    updatePatientProfile({
      scheduledPlanChange: { packageId: pkg.id, packageTitle: pkg.title, effectiveDate: addDays(active.validUntil, 1) },
    });
    addNotification({
      userId: DIETITIAN_PROFILE.id,
      title: 'Plan Change Scheduled',
      message: `${currentUser.name} will move from ${active.packageTitle} to ${pkg.title} on ${addDays(active.validUntil, 1)}.`,
      category: 'care',
    });
  };

  const cancelScheduledPlanChange = () => updatePatientProfile({ scheduledPlanChange: undefined });

  const addPackage = (newPkg: Omit<NutritionPackage, 'id'>) => {
    const created: NutritionPackage = {
      ...newPkg,
      id: newId('pkg'),
    };
    setPackages((prev) => [...prev, created]);
  };

  const togglePackageActive = (packageId: string) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === packageId ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const refundPayment = (paymentId: string, reason: string, amountInr?: number) => {
    const today = todayIso();
    const payment = payments.find((p) => p.id === paymentId);
    const refundAmountInr = amountInr ?? payment?.amountInr ?? 0;
    setPayments((prev) =>
      prev.map((pay) =>
        pay.id === paymentId
          ? {
              ...pay,
              status: 'refunded',
              refundReason: reason,
              refundedAt: today,
              refundAmountInr,
            }
          : pay
      )
    );

    if (payment) {
      addNotification({
        userId: payment.patientId,
        title: 'Refund Processed',
        message: `Refund of ₹${refundAmountInr} for ${payment.packageTitle} has been processed. Reason: ${reason}.`,
        category: 'care',
      });
    }
  };

  const getPatientPayments = (patientId: string) => {
    if (!isDietitian && currentUser.id !== patientId) {
      return [];
    }
    return payments.filter((p) => p.patientId === patientId);
  };

  const getActivePackage = (patientId: string) => {
    const userPayments = payments.filter(
      (p) => p.patientId === patientId && p.status === 'successful'
    );
    // Lists are newest-first; createdAt guards against any other order.
    return userPayments.reduce<PackagePayment | undefined>(
      (latest, p) => (!latest || p.createdAt > latest.createdAt ? p : latest),
      undefined
    );
  };

  // Daily Food Intake & Adherence Logic
  const logMealAdherence = (entry: Omit<MealAdherenceEntry, 'id' | 'loggedAt'>) => {
    // A meal has one log per day: "Update Log" replaces it instead of adding a second entry.
    const existing = adherenceRecords.find(
      (r) => r.patientId === entry.patientId && r.mealId === entry.mealId && r.dayOfWeek === entry.dayOfWeek
    );
    const newEntry: MealAdherenceEntry = {
      ...entry,
      id: existing?.id ?? newId('adh'),
      loggedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAdherenceRecords((prev) => [newEntry, ...prev.filter((r) => r.id !== newEntry.id)]);

    // If meal was skipped, alert Dt. Anchal for clinical evaluation
    if (entry.status === 'skipped') {
      addNotification({
        userId: DIETITIAN_PROFILE.id,
        title: `Meal Skipped: ${currentUser.name}`,
        message: `${currentUser.name} skipped ${entry.mealTimingLabel} (${entry.mealTitle}). Reason: ${entry.skipReason || 'Not specified'}.`,
        category: 'diet',
      });
    } else {
      // Normal meal completion notification for patient
      addNotification({
        userId: entry.patientId,
        title: 'Food Intake Recorded',
        message: `Logged ${entry.mealTimingLabel}: ${entry.portionPercentage}% consumed.`,
        category: 'diet',
      });
    }
  };

  const getPatientAdherenceHistory = (patientId: string) => {
    return adherenceRecords.filter((r) => r.patientId === patientId);
  };

  const getAdherenceStats = (patientId: string) => {
    const history = adherenceRecords.filter((r) => r.patientId === patientId);
    if (history.length === 0) {
      return { totalLogged: 0, followed: 0, skipped: 0, adherencePercentage: 100 };
    }
    const followed = history.filter((h) => h.status === 'consumed_full' || h.status === 'consumed_partial').length;
    const skipped = history.filter((h) => h.status === 'skipped').length;
    const adherencePercentage = Math.round((followed / history.length) * 100);

    return {
      totalLogged: history.length,
      followed,
      skipped,
      adherencePercentage,
    };
  };

  const assignClinicalConditionDiet = (patientId: string, conditionType: ClinicalConditionType) => {
    const condInfo = CLINICAL_CONDITIONS_DATA.find((c) => c.conditionType === conditionType);
    if (!condInfo) return;

    const today = new Date().toISOString().split('T')[0];
    const followUp = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const currentChart = dietCharts.find((c) => c.patientId === patientId);
    const patient = patients.find((p) => p.id === patientId);

    const updatedChart: DietChart = {
      id: currentChart?.id || newId('chart'),
      patientId,
      patientName: patient?.name || 'Patient',
      title: `${condInfo.title} Specialized Protocol`,
      version: currentChart ? (parseFloat(currentChart.version) + 0.5).toFixed(1) : '1.0',
      clinicalConditionCategory: conditionType,
      dateIssued: today,
      validUntil: followUp,
      followUpDate: followUp,
      dailyCalorieTarget: currentChart?.dailyCalorieTarget || 1550,
      macroDistribution: currentChart?.macroDistribution || { carbs: 45, protein: 25, fats: 30 },
      focusArea: condInfo.subtitle,
      meals: currentChart?.meals || [],
      generalInstructions: condInfo.dietaryPrinciples,
      dos: condInfo.keyFoodsToInclude.map((f) => `Include ${f} regularly`),
      donts: condInfo.keyFoodsToAvoid.map((f) => `Strictly avoid ${f}`),
      hydrationGuidelines: 'Drink 3.0 L water daily. Sip warm herb-infused water between meals.',
      lifestyleTips: ['Follow consistent meal timings', 'Walk 15 mins after lunch and dinner'],
      dietitianNotes: `Prescribed specialized clinical nutrition plan for ${condInfo.title}. Focus: ${condInfo.primaryGoals.join(', ')}.`,
      modificationHistory: [
        {
          id: newId('mod'),
          version: currentChart ? (parseFloat(currentChart.version) + 0.5).toFixed(1) : '1.0',
          modifiedAt: today,
          modifiedBy: 'Dt. Anchal Dewan',
          summaryOfChanges: `Assigned specialized clinical protocol: ${condInfo.title}`,
        },
        ...(currentChart?.modificationHistory || []),
      ],
    };

    // One notification (the specific one below), not also the generic "chart updated" one.
    upsertDietChart(updatedChart);

    addNotification({
      userId: patientId,
      title: 'New Clinical Diet Protocol Assigned',
      message: `Dt. Anchal has updated your plan to "${condInfo.title}". Tap to view your new 7-day guidelines.`,
      category: 'diet',
    });
  };

  return (
    <NutritionContext.Provider
      value={{
        currentUser,
        isDietitian,
        patients,
        dietCharts,
        weightRecords,
        appointments,
        notifications,
        dailyTrackers,
        services: NUTRITION_SERVICES,
        packages,
        payments,
        adherenceRecords,
        selectedPatientId,
        activateAccount,
        flushPendingChanges,
        resetData,
        dataOwnerId,
        syncError,
        dismissSyncError: () => setSyncError(null),
        setSelectedPatientId,
        getCurrentUserDietChart,
        getPatientDietChart,
        saveDietChart,
        uploadCustomPdfChart,
        addWeightRecord,
        getPatientWeightHistory,
        bookAppointment,
        updateAppointmentStatus,
        updateWaterIntake,
        toggleMealCompletion,
        logMealAdherence,
        getPatientAdherenceHistory,
        getAdherenceStats,
        assignClinicalConditionDiet,
        processPackagePurchase,
        schedulePlanChange,
        cancelScheduledPlanChange,
        updatePackage,
        addPackage,
        togglePackageActive,
        refundPayment,
        getPatientPayments,
        getActivePackage,
        markNotificationRead,
        addNotification,
        updatePatientProfile,
      }}
    >
      {children}
    </NutritionContext.Provider>
  );
};

export const useNutrition = () => {
  const context = useContext(NutritionContext);
  if (!context) {
    throw new Error('useNutrition must be used within a NutritionProvider');
  }
  return context;
};

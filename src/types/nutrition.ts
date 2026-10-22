export type UserRole = 'patient' | 'dietitian';

export type DietaryPreference = 'Vegetarian' | 'Vegan' | 'Eggetarian' | 'Non-Vegetarian' | 'Jain';

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface MedicalHistory {
  diagnoses: string[];
  medications: string[];
  pastIllnesses: string[];
  familyHistory?: string[];
  recentLabReports?: {
    testName: string;
    result: string;
    date: string;
    status: 'normal' | 'borderline' | 'abnormal';
  }[];
  clinicalNotes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  /** YYYY-MM-DD. When set, `age` is derived from it. */
  dateOfBirth?: string;
  age?: number;
  gender?: 'Female' | 'Male' | 'Other';
  heightCm?: number;
  currentWeightKg?: number;
  startingWeightKg?: number;
  targetWeightKg?: number;
  dietaryPreference?: DietaryPreference;
  healthGoals?: string[];
  medicalConditions?: string[];
  medicalHistory?: MedicalHistory;
  allergies?: string[];
  waterGoalLitres?: number;
  joinedDate: string;
  followUpDate?: string;
  assignedProgram?: string;
  /** A downgrade / switch chosen on My Plans, starting when the current plan ends. */
  scheduledPlanChange?: {
    packageId: string;
    packageTitle: string;
    /** YYYY-MM-DD, the day after the current plan ends. */
    effectiveDate: string;
  };
}

export type MealTiming =
  | 'early_morning'
  | 'breakfast'
  | 'mid_morning'
  | 'lunch'
  | 'evening_snack'
  | 'dinner'
  | 'bedtime';

export interface MealItem {
  id: string;
  timing: MealTiming;
  timingLabel: string;
  timeSlot: string;
  title: string;
  description: string;
  portionGuidance?: string;
  options: string[];
  healthySwap?: string;
  nutritionalFocus?: string;
  caloriesApprox?: number;
}

export interface DietPlanRevision {
  id: string;
  version: string;
  modifiedAt: string;
  modifiedBy: string;
  summaryOfChanges: string;
}

export type ClinicalConditionType =
  | 'liver_disease'
  | 'ibs'
  | 'diabetes'
  | 'hypertension'
  | 'kidney_disease'
  | 'gerd_gastritis'
  | 'thyroid'
  | 'heart_disease'
  | 'weight_management'
  | 'pcos_pcod';

export interface ClinicalConditionInfo {
  conditionType: ClinicalConditionType;
  title: string;
  subtitle: string;
  primaryGoals: string[];
  dietaryPrinciples: string[];
  keyFoodsToInclude: string[];
  keyFoodsToAvoid: string[];
  recommendedMacros: {
    carbs: number;
    protein: number;
    fats: number;
  };
  sample7DayOverview: string;
}

export interface DietChart {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  version: string;
  dateIssued: string;
  validUntil: string;
  followUpDate: string;
  dailyCalorieTarget: number;
  macroDistribution: {
    carbs: number; // percentage
    protein: number;
    fats: number;
  };
  focusArea: string;
  clinicalConditionCategory?: ClinicalConditionType;
  meals: MealItem[]; // Default or current day meals
  weeklyPlan?: Partial<Record<DayOfWeek, MealItem[]>>; // Full 7-Day meal plans
  generalInstructions: string[];
  dos: string[];
  donts: string[];
  hydrationGuidelines: string;
  lifestyleTips: string[];
  dietitianNotes: string;
  modificationHistory?: DietPlanRevision[];
  pdfFileName?: string;
  pdfUploadedDate?: string;
  pdfCustomUrl?: string; // If an external or uploaded file is attached
}

export type MealAdherenceStatus = 'consumed_full' | 'consumed_partial' | 'skipped';

export interface MealAdherenceEntry {
  id: string;
  patientId: string;
  patientName: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  mealId: string;
  mealTiming: MealTiming;
  mealTimingLabel: string;
  mealTitle: string;
  status: MealAdherenceStatus;
  portionPercentage: number; // 0, 25, 50, 75, 100
  skipReason?: string;
  notes?: string;
  loggedAt: string;
}

export interface WeightRecord {
  id: string;
  patientId: string;
  date: string;
  weightKg: number;
  waistCm?: number;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export type ConsultationType = 'online_video' | 'in_person_clinic';
export type ConsultationTier = 'first_consultation' | 'follow_up';
export type AppointmentStatus = 'confirmed' | 'pending' | 'completed' | 'rescheduled' | 'cancelled';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  consultationType: ConsultationType;
  consultationTier: ConsultationTier; // First consultation: ₹500, Follow-up: ₹300
  consultationFeeInr: number;
  serviceCategory: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  patientNotes?: string;
  dietitianNotes?: string;
  meetingLink?: string;
  createdAt: string;
}

export interface NutritionService {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  iconName: string;
  duration: string;
  idealFor: string[];
  whatIsIncluded: string[];
  dietaryPhilosophy: string;
  priceDisplay: string;
  /** Catalogue category (tabs on the home page). */
  group: ServiceGroup;
  /** 1-month price; absent when the program is priced after an assessment. */
  priceInr?: number;
  /** Consultations included in the 1-month program. */
  consultations?: number;
  /** Optional 3-month price (about 20% less than three months). */
  quarterlyPriceInr?: number;
  /** Optional 6-month price (about 27% less than six months). */
  halfYearlyPriceInr?: number;
  /** Clinically complex: a personalised quote follows a first assessment. */
  assessmentFirst?: boolean;
}

export type ServiceGroup = 'everyday' | 'conditions' | 'specialised' | 'medical';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  category: 'diet' | 'appointment' | 'weight' | 'water' | 'care';
  read: boolean;
  actionUrl?: string;
}

export interface DailyTracker {
  date: string; // YYYY-MM-DD
  waterGlasses: number; // each glass ~250ml
  mealsChecked: Record<string, boolean>; // meal id -> done
  activityMinutes: number;
  moodNote?: string;
}

export type PaymentMethodType = 'upi' | 'card' | 'netbanking' | 'wallet';
export type PaymentStatusType = 'successful' | 'pending' | 'refunded' | 'failed';

export interface NutritionPackage {
  id: string;
  title: string;
  priceInr: number;
  durationLabel: string;
  validityDays: number;
  isPopular?: boolean;
  isActive: boolean;
  tagline: string;
  description: string;
  inclusions: string[];
  terms: string;
  category: 'consultation' | 'diet_plan' | 'monthly_care' | 'specialized';
  /** Display order, lowest first. */
  sortOrder?: number;
  /** "Best value" ribbon (isPopular is "Most popular"). */
  isBestValue?: boolean;
  /** While this plan is running, its full price counts towards a bigger plan (not just the unused days). */
  creditInFull?: boolean;
  /** A multi-month bundle of another plan: shown as "₹X/month · save ₹Y". */
  bundleOf?: { packageId: string; months: number };
  /** On a plan with longer bundles: the name of the card that offers all its lengths (e.g. "Nutrition Care"). */
  familyTitle?: string;
  /** Plainly stated limits ("Good to know"), so nobody buys the wrong plan. */
  notIncluded?: string[];
  /** Version of the clinic's own catalogue entry; plans the dietitian creates have none. */
  catalogVersion?: number;
}

export interface PackagePayment {
  id: string;
  transactionRef: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  packageId: string;
  packageTitle: string;
  amountInr: number;
  paymentMethod: PaymentMethodType;
  paymentDetails: string;
  status: PaymentStatusType;
  createdAt: string;
  validUntil: string;
  invoiceNumber: string;
  refundReason?: string;
  refundedAt?: string;
  /** Upgrades: the plan's full price, the credit for the unused days of `upgradeFromPaymentId`, and amountInr = price − credit. */
  listPriceInr?: number;
  creditInr?: number;
  upgradeFromPaymentId?: string;
  /** Early renewal: the new plan starts after the current one ends, plus these free days. */
  bonusDays?: number;
  renewalOfPaymentId?: string;
  /** Refunds: the amount returned (paid − consultations used − processing charges, or as set by the clinic). */
  refundAmountInr?: number;
}

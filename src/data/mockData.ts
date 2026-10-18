import { DIETITIAN_PROFILE as DIETITIAN_BASE } from './seedData';
import type { User } from '../types/nutrition';

export * from './seedData';

import dietitianPortrait from '../assets/images/dietitian_anchal_portrait_1792148712632.jpg';
import healthyMealBowl from '../assets/images/healthy_meal_bowl_1792148712733.jpg';
import clinicConsultation from '../assets/images/wellness_consultation_1792148714021.jpg';
import freshIngredients from '../assets/images/nutrition_fresh_ingredients_1792148713222.jpg';

// Imported (not hard-coded "/src/..." paths) so Vite fingerprints and ships them in production builds.
export const IMAGES = {
  dietitianPortrait,
  healthyMealBowl,
  clinicConsultation,
  freshIngredients,
};

export const DIETITIAN_PROFILE: User = { ...DIETITIAN_BASE, avatar: IMAGES.dietitianPortrait };

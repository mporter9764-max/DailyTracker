// ── MET activity list ────────────────────────────────────────────────────────
export const ACTIVITIES = [
  { label: "Sleeping",        met: 0.9  },
  { label: "Resting",         met: 1.0  },
  { label: "Working (desk)",  met: 1.3  },
  { label: "Standing",        met: 1.8  },
  { label: "Casual activity", met: 2.1  },
  { label: "Slow Walk (2mph)",met: 2.5  },
  { label: "Yoga",            met: 2.5  },
  { label: "Moderate Walk (3mph)", met: 3.5 },
  { label: "Brisk Walk (3.5mph)",  met: 4.5 },
  { label: "Fast Walk (4mph)",     met: 5.0 },
  { label: "Biking (light)",       met: 6.0 },
  { label: "Intense Lifting",      met: 6.0 },
  { label: "Jogging (5mph)",       met: 8.0 },
  { label: "Running (6mph)",       met: 10.0 },
]

// Constants from spreadsheet
const LBM_MET_ADJ = 0.7
const THERMIC_EFFECT_PCT = 0.10
const THERMIC_EFFECT_BASE = 2500

// ── BMR (Katch-McArdle) ──────────────────────────────────────────────────────
// BMR = 370 + (21.6 × LBM in kg)
// LBM (kg) = weight (kg) × (1 - body fat %)
// weight (kg) = weight (lbs) × 0.453592
export function calcBMR(weightLbs, bodyFatPct) {
  const weightKg = weightLbs * 0.453592
  const lbmKg = weightKg * (1 - bodyFatPct / 100)
  return 370 + (21.6 * lbmKg)
}

// ── Calories burned per exercise session ─────────────────────────────────────
// Formula: Adj MET × 1.05 × weight(kg) × (duration_minutes / 60)
// where Adj MET = base MET × LBM_MET_ADJ (0.7)
export function calcExerciseCalories(activityLabel, durationMinutes, weightLbs) {
  const activity = ACTIVITIES.find(a => a.label === activityLabel)
  if (!activity) return 0
  const weightKg = weightLbs * 0.453592
  const adjMet = activity.met * LBM_MET_ADJ
  return Math.round(adjMet * 1.05 * weightKg * (durationMinutes / 60))
}

// ── TDEE from daily activity profile ─────────────────────────────────────────
// activityBlocks: [{ activity: label, hours: number }, ...]
// Each block: calories = adjMet × 1.05 × weightKg × hours
// Thermic effect: (THERMIC_EFFECT_BASE × THERMIC_EFFECT_PCT / 24) per hour = 10.4167/hr
// TDEE = sum of all hourly (pre-TE calories + thermic effect)
export function calcTDEE(weightLbs, bodyFatPct, activityBlocks) {
  const weightKg = weightLbs * 0.453592
  const thermicPerHour = (THERMIC_EFFECT_BASE * THERMIC_EFFECT_PCT) / 24

  let totalCalories = 0
  for (const block of activityBlocks) {
    const activity = ACTIVITIES.find(a => a.label === block.activity)
    if (!activity || !block.hours) continue
    const adjMet = activity.met * LBM_MET_ADJ
    const preTE = adjMet * 1.05 * weightKg * block.hours
    const thermic = thermicPerHour * block.hours
    totalCalories += preTE + thermic
  }

  return Math.round(totalCalories)
}

// ── Default profile ───────────────────────────────────────────────────────────
export const DEFAULT_PROFILE = {
  weightLbs: 210,
  bodyFatPct: 28,
  age: 41,
  activityBlocks: [
    { activity: "Sleeping",        hours: 8 },
    { activity: "Working (desk)",  hours: 9 },
    { activity: "Standing",        hours: 2 },
    { activity: "Casual activity", hours: 4 },
    { activity: "Jogging (5mph)",  hours: 1 },
  ],
}

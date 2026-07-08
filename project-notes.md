# Project Notes

## 2026-03-25
### Project: Monthly Reward System
- **Feature:** Horizontal scrolling chest reward (CS:GO style).
- **Chests:** uncommon, common, good, epic, legendary.
- **Probabilities:** 
  - Uncommon: 75% (10-30 coins)
  - Common: 12% (25-80 coins)
  - Good: 8% (100-300 coins)
  - Epic: 4% (250-500 coins)
  - Legendary: 1% (500-1500 coins)
- **Tech Stack:** React + Tailwind (Proposed).
- **Backend:** api.php (to be mocked in JS for preview).
- **Status:** Step 1 (Intake).

## 2026-03-25
### Monthly Reward System Implementation
- **Frontend:** Created `RewardModal.tsx` with `framer-motion` for the horizontal scroll and `howler` for sound effects.
- **Backend:** Added `claim_monthly_reward` action to `api/api.php` with probability logic and security checks.
- **Styling:** Applied "glowy yellow/lavender" theme with transparent backdrops and shimmer effects.
- **Dependencies Added:** `framer-motion`, `howler`.
- **Status:** Step 5 (Implementation) - Awaiting user feedback on animation and style.
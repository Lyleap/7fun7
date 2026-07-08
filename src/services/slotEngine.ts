/**
 * Slot Engine Module
 * Symbol definitions and visual helpers only.
 * All RNG, payout, and balance logic is handled by the backend.
 */

export type SlotSymbol = {
  id: string;
  label: string;
  spriteIndex: number;
  weight: number; // Used only for visual reel animation weighting
  isWild?: boolean;
  isScatter?: boolean;
};

export const SYMBOLS: SlotSymbol[] = [
  { id: 'A', label: 'A', spriteIndex: 0, weight: 5 },
  { id: 'B', label: 'B', spriteIndex: 1, weight: 8 },
  { id: 'C', label: 'C', spriteIndex: 2, weight: 12 },
  { id: 'D', label: 'D', spriteIndex: 3, weight: 20 },
  { id: 'E', label: 'E', spriteIndex: 4, weight: 30 },
  { id: 'F', label: 'F', spriteIndex: 5, weight: 45 },
  { id: 'G', label: 'G', spriteIndex: 6, weight: 60 },
  { id: 'H', label: 'H', spriteIndex: 7, weight: 80 },
  { id: 'wild', label: 'WILD', spriteIndex: 8, weight: 10, isWild: true },
  { id: 'scatter', label: 'SCATTER', spriteIndex: 9, weight: 6, isScatter: true },
  { id: 'jackpot', label: 'JACKPOT', spriteIndex: 10, weight: 2 },
];

export const REELS_COUNT = 5;
export const ROWS_COUNT = 5;

/** Response from backend POST /api?type=slot&action=spin */
export type BackendSpinResponse = {
  success: boolean;
  slot_number: number;      // Coins won (0 = loss)
  reward_type: 'S' | 'B' | 'J' | null; // Small / Big / Jackpot (null = loss)
  remaining_spins: number;
  error?: string;
};

/** Calls the backend spin endpoint. All RNG + balance handled server-side. */
export async function requestSpin(username: string): Promise<BackendSpinResponse> {
  const response = await fetch('https://db.7fun7-api.online/api?type=slot&action=spin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  if (!response.ok) {
    throw new Error(`Spin request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Generates a random visual-only reel grid for animation purposes.
 * The actual payout comes from the backend — this is just eye candy.
 */
export function generateVisualReels(): string[][] {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

  const getRandomSymbolId = (): string => {
    let random = Math.random() * totalWeight;
    for (const symbol of SYMBOLS) {
      if (random < symbol.weight) return symbol.id;
      random -= symbol.weight;
    }
    return SYMBOLS[SYMBOLS.length - 1].id;
  };

  return Array.from({ length: REELS_COUNT }, () =>
    Array.from({ length: ROWS_COUNT }, () => getRandomSymbolId())
  );
}

export const getSymbolById = (id: string) => SYMBOLS.find(s => s.id === id) || SYMBOLS[0];

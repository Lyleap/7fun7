import { Match, Settings } from '../types';

const DEFAULT_DEPOSIT_BONUS_RANGES = {
  '10':   { min: 5,   max: 15  },
  '25':   { min: 10,  max: 25  },
  '100':  { min: 20,  max: 50  },
  '500':  { min: 50,  max: 150 },
  '1000': { min: 100, max: 300 },
};

const DEFAULT_SETTINGS: Settings = {
  slotOdds: {
    '0':     { start: 0,  end: 0,  chance: 20 },
    '1_8':   { start: 1,  end: 8,  chance: 33 },
    '9_15':  { start: 9,  end: 15, chance: 20 },
    '16_25': { start: 16, end: 25, chance: 14 },
    '26_30': { start: 26, end: 30, chance: 8 },
    '31_45': { start: 31, end: 45, chance: 4 },
    '46_75': { start: 46, end: 75, chance: 2 },
  },
  dailySpinLimit: 5,
  dailyFootballLimit: 5,
  dailyChampionLimit: 5,
  defaultBetAmount: 10,
  exchangeRate: 100,
  minExchangeAmount: 500,
  footballMatches: [],
  depositBonusRanges: DEFAULT_DEPOSIT_BONUS_RANGES,
};

const normalizeLogoUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('/public/images/logos/')) {
    return url.replace('/public/images/logos/', 'https://img.7fun7-api.online/');
  }
  if (url.includes('7fun7.promo/public/images/logos/')) {
    return url.replace(/https?:\/\/7fun7\.promo\/public\/images\/logos\//, 'https://img.7fun7-api.online/');
  }
  return url;
};

const normalizeMatch = (match: Partial<Match> & { payout?: number }, index: number): Match => {
  const rewardAmount = typeof match.rewardAmount === 'number'
    ? match.rewardAmount
    : typeof match.payout === 'number'
      ? match.payout
      : 0;

  return {
    id: typeof match.id === 'number' ? match.id : index + 1,
    team1: match.team1 || 'Team A',
    team2: match.team2 || 'Team B',
    team1_logo: normalizeLogoUrl(match.team1_logo || match.logo1 || ''),
    team2_logo: normalizeLogoUrl(match.team2_logo || match.logo2 || ''),
    rewardAmount,
    timeText: match.timeText || '',
    winner: match.winner ?? null,
    finalScore1: match.finalScore1 ?? undefined,
    finalScore2: match.finalScore2 ?? undefined,
    line: match.line ?? 0,
    payoutWinnerTeam1: match.payoutWinnerTeam1 ?? rewardAmount,
    payoutWinnerTeam2: match.payoutWinnerTeam2 ?? rewardAmount,
    payoutExact: match.payoutExact ?? rewardAmount,
    payoutOver: match.payoutOver ?? rewardAmount,
    payoutUnder: match.payoutUnder ?? rewardAmount,
    payoutTotal: match.payoutTotal ?? rewardAmount,
    awarded: match.awarded ?? false,
    color: match.color || 'from-slate-700 to-slate-900'
  };
};

export const normalizeSettings = (input: Partial<Settings> | null | undefined): Settings => {
  const data = input || {};
  const matches = Array.isArray(data.footballMatches)
    ? data.footballMatches.map((match, index) => normalizeMatch(match, index))
    : [];

  // Normalize slotOdds — ensure each range has start/end/chance
  const rawOdds = data.slotOdds && typeof data.slotOdds === 'object' ? data.slotOdds : {};
  const hasValidRanges = Object.values(rawOdds).some(
    (v: any) => typeof v === 'object' && v !== null && 'chance' in v
  );
  const slotOdds = hasValidRanges
    ? Object.fromEntries(
        Object.entries(rawOdds).map(([key, val]: [string, any]) => [
          key,
          { start: val.start ?? 0, end: val.end ?? 0, chance: val.chance ?? 0 }
        ])
      )
    : DEFAULT_SETTINGS.slotOdds;

  // Normalize depositBonusRanges — preserve any saved ranges, fall back to defaults
  const depositBonusRanges = (data.depositBonusRanges && typeof data.depositBonusRanges === 'object')
    ? data.depositBonusRanges
    : DEFAULT_SETTINGS.depositBonusRanges;

  return {
    slotOdds,
    dailySpinLimit: data.dailySpinLimit ?? DEFAULT_SETTINGS.dailySpinLimit,
    dailyFootballLimit: data.dailyFootballLimit ?? DEFAULT_SETTINGS.dailyFootballLimit,
    dailyChampionLimit: (data as any).dailyChampionLimit ?? DEFAULT_SETTINGS.dailyChampionLimit,
    defaultBetAmount: data.defaultBetAmount ?? DEFAULT_SETTINGS.defaultBetAmount,
    exchangeRate: data.exchangeRate ?? DEFAULT_SETTINGS.exchangeRate,
    minExchangeAmount: data.minExchangeAmount ?? DEFAULT_SETTINGS.minExchangeAmount,
    footballMatches: matches,
    depositBonusRanges
  };
};

const API_BASE = 'https://db.7fun7-api.online/api';

export const loadSettings = async (): Promise<Settings | null> => {
  // Try API first
  try {
    const response = await fetch(`${API_BASE}?type=settings&action=get`);
    const contentType = response.headers.get("content-type");
    if (response.ok && contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return normalizeSettings(data);
    }
  } catch (err) {
    // Silently fail in PlayCode preview as PHP won't execute
  }

  // Try localStorage fallback
  const stored = localStorage.getItem('settings');
  if (stored) {
    try {
      return normalizeSettings(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to parse stored settings', e);
    }
  }

  // Try external Setting.json
  try {
    const response = await fetch('https://db.7fun7-api.online/Setting.json');
    if (response.ok) {
      const data = await response.json();
      return normalizeSettings(data);
    }
  } catch (err) {
    console.warn('External Setting.json fetch failed:', err);
  }

  // Fallback to public JSON
  try {
    const response = await fetch('/Setting.json');
    if (response.ok) {
      const data = await response.json();
      return normalizeSettings(data);
    }
  } catch (err) {
    console.warn('Public Setting.json fetch failed:', err);
  }
  
  return null;
};

export const persistSettings = async (settings: Settings): Promise<void> => {
  localStorage.setItem('settings', JSON.stringify(settings));

  try {
    await fetch(`${API_BASE}?type=settings&action=save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings, null, 2)
    });
  } catch (err) {
    console.warn('API settings save failed:', err);
  }
};

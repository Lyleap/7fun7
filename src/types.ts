export type Language = 'en' | 'km';

export interface Exchange {
  id: string;
  amount: number;
  dollars: number;
  date: string;
  username: string;
}

export type PredictionType = 'winner' | 'draw' | 'exact' | 'over' | 'under' | 'total' | 'hdp_1' | 'hdp_2';

export interface Prediction {
  matchId?: number;
  match: string;
  team?: string;
  team1_logo?: string;
  team2_logo?: string;
  type: PredictionType;
  score1?: number;
  score2?: number;
  line?: number;
  odd?: number;
  hdp?: number;
  date: string;
  receiptId?: string;
}

export interface UserData {
  username: string;
  password?: string;
  tts?: string;
  balance: number;
  promotion_balance: number;
  total_deposit: number;
  spinsLeft: number;
  football_guess: number;
  Get_monthly_reward: boolean;
  Claimed_Monthly: boolean;
  last_reset: string;
  lastSpinDate: string;
  history: string[];
  predictions: Prediction[];
  exchanges: Exchange[];
  isBlacklisted?: boolean;
  payoutRate?: number; // Multiplier for wins
  dailyFootballLimit?: number;
  lastFootballDate?: string;
  Deposit_progress?: number;        // Cumulative $ deposited (set by scraper, reset monthly)
  claimedDepositBonuses?: number[]; // Milestones already claimed, e.g. [10, 25]
}

export interface Match {
  id: number | string;
  team1: string;
  team2: string;
  league?: string;
  team1_logo?: string;
  team2_logo?: string;
  rewardAmount: number;
  timeText?: string;
  commence_time?: string;
  sport_key?: string;
  home_team?: string;
  away_team?: string;
  raw_json?: any;
  visibility?: boolean;
  winner?: 'team1' | 'team2' | 'draw' | null;
  finalScore1?: number;
  finalScore2?: number;
  line?: number;
  hdpLine?: number;
  payoutWinnerTeam1?: number;
  payoutWinnerTeam2?: number;
  payoutDraw?: number;
  payoutExact?: number;
  payoutOver?: number;
  payoutUnder?: number;
  payoutTotal?: number;
  payoutHdp1?: number;
  payoutHdp2?: number;
  awarded?: boolean;
  color: string;
}

export interface ChampionMatch {
  id: string;
  team1: string;
  team2: string;
  team1_logo?: string;
  team2_logo?: string;
  match_label?: string;
  payout: number;
  visibility?: boolean;
  winner?: 'team1' | 'team2' | null;
  awarded?: boolean;
  created_at?: string;
}

export interface ChampionPick {
  id?: number;
  username: string;
  match_id: string;
  selected_team: 'team1' | 'team2';
  payout: number;
  pick_date: string;
  status: 'pending' | 'won' | 'lost';
  created_at?: string;
  // Joined from champion table
  team1?: string;
  team2?: string;
  team1_logo?: string;
  team2_logo?: string;
  match_label?: string;
}

/** A single reward range: coins from `start` to `end`, with `chance`% probability */
export interface SlotOddsRange {
  start: number;
  end: number;
  chance: number; // percentage, all ranges must sum to 100
}

export interface DepositBonusRange {
  min: number;
  max: number;
}

export interface Settings {
  slotOdds: Record<string, SlotOddsRange>;
  dailySpinLimit: number;
  dailyFootballLimit: number;
  dailyChampionLimit: number;
  defaultBetAmount: number;
  exchangeRate: number; // e.g. 100 coins = $1
  minExchangeAmount: number;
  footballMatches: Match[];
  depositBonusRanges?: Record<string, DepositBonusRange>; // keyed by milestone string e.g. "10","25","100","500","1000"
}

export const translations = {
  en: {
    login: 'Login',
    username: 'Username',
    enterUsername: 'Enter your username',
    invalidUser: 'Invalid username. Please try again.',
    blacklisted: 'Your account has been blacklisted.',
    welcome: 'Welcome',
    predictionHistory: 'Prediction History',
    slotMachine: 'Slot Machine',
    spinsLeft: 'Spins Left',
    spin: 'Spin',
    win: 'You Won!',
    lose: 'Try Again!',
    noSpins: 'No spins left for today!',
    football: 'Football Predictions',
    predict: 'Predict Winner',
    profile: 'Profile',
    balance: 'Balance',
    history: 'History',
    logout: 'Logout',
    switchLang: 'ភាសាខ្មែរ',
    exchange: 'Exchange Center',
    exchangeRate: 'Exchange Rate',
    convert: 'Convert to $',
    receiptSaved: 'Receipt saved to clipboard!',
    admin: 'Management',
    save: 'Save Changes',
    search: 'Search...',
    users: 'Users',
    settings: 'Settings',
    transactions: 'Transactions',
    scoreGuess: 'Score Guess',
    exactScore: 'Exact Score',
    over: 'Over',
    under: 'Under',
    total: 'Total',
    line: 'Line',
    picksLeft: 'Picks Left',
    seeMore: 'See more',
    hide: 'Hide',
    worldcup: 'World Cup'
  },
  km: {
    login: 'ចូលប្រើ',
    username: 'ឈ្មោះអ្នកប្រើ',
    enterUsername: 'បញ្ចូលឈ្មោះអ្នកប្រើរបស់អ្នក',
    invalidUser: 'ឈ្មោះអ្នកប្រើមិនត្រឹមត្រូវ។ សូមព្យាយាមម្តងទៀត។',
    blacklisted: 'គណនីរបស់អ្នកត្រូវបានដាក់ក្នុងបញ្ជីខ្មៅ។',
    welcome: 'សូមស្វាគមន៍',
    predictionHistory: 'ប្រវត្តិនៃការទស្សន៍ទាយ',
    slotMachine: 'ម៉ាស៊ីនស្លត',
    spinsLeft: 'ចំនួនបង្វិលដែលនៅសល់',
    spin: 'បង្វិល',
    win: 'អ្នកបានឈ្នះ!',
    lose: 'ព្យាយាមម្តងទៀត!',
    noSpins: 'អស់ចំនួនបង្វិលសម្រាប់ថ្ងៃនេះហើយ!',
    football: 'ការទស្សន៍ទាយបាល់ទាត់',
    predict: 'ទស្សន៍ទាយអ្នកឈ្នះ',
    profile: 'ព័ត៌មានផ្ទាល់ខ្លួន',
    balance: 'សមតុល្យ',
    history: 'ប្រវត្តិ',
    logout: 'ចាកចេញ',
    switchLang: 'English',
    exchange: 'មជ្ឈមណ្ឌលប្តូរប្រាក់',
    exchangeRate: 'អត្រាប្តូរប្រាក់',
    convert: 'ប្តូរទៅជា $',
    receiptSaved: 'បង្កាន់ដៃត្រូវបានរក្សាទុក!',
    admin: 'ការគ្រប់គ្រង',
    save: 'រក្សាទុក',
    search: 'ស្វែងរក...',
    users: 'អ្នកប្រើប្រាស់',
    settings: 'ការកំណត់',
    transactions: 'ប្រតិបត្តិការ',
    scoreGuess: 'ទស្សន៍ទាយពិន្ទុ',
    exactScore: 'លទ្ធផលត្រឹមត្រូវ',
    over: 'លើស',
    under: 'ក្រោម',
    total: 'សរុប',
    line: 'លេខ',
    picksLeft: 'ការទស្សន៍ទាយនៅសល់',
    seeMore: 'មើលបន្ថែម',
    hide: 'លាក់',
    worldcup: 'ពានរង្វាន់លោក'
  }
};

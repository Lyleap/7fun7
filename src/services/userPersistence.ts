import { UserData } from '../types';

const USERS_KEY = 'users';
const SESSION_COOKIE = 'user_session';
// Change this to your live Hostinger URL for local testing
// Example: const API_BASE = 'https://yourdomain.com/api/api.php';
const API_BASE = 'https://db.7fun7-api.online/api';

export const setSessionCookie = (username: string, minutes = 30) => {
  const date = new Date();
  date.setTime(date.getTime() + (minutes * 60 * 1000));
  const expires = "; expires=" + date.toUTCString();
  document.cookie = SESSION_COOKIE + "=" + (username || "") + expires + "; path=/; SameSite=Lax";
};

export const getSessionCookie = (): string | null => {
  const nameEQ = SESSION_COOKIE + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export const clearSessionCookie = () => {
  document.cookie = SESSION_COOKIE + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
};

const normalizeUsername = (username: string) => username.trim().toLowerCase();

const parseUsers = (value: string | null): UserData[] => {
  if (!value) return [];
  try {
    return JSON.parse(value) as UserData[];
  } catch (err) {
    console.error('Failed to parse users from localStorage', err);
    return [];
  }
};

export const normalizeUserData = (user: UserData): UserData => {
  return {
    ...user,
    predictions: user.predictions || [],
    exchanges: user.exchanges || [],
    history: user.history || [],
    promotion_balance: user.promotion_balance ?? user.balance ?? 0,
    total_deposit: user.total_deposit ?? 0,
    football_guess: user.football_guess ?? 5,
    Get_monthly_reward: user.Get_monthly_reward ?? false,
    Claimed_Monthly: user.Claimed_Monthly ?? false,
    last_reset: user.last_reset || '',
    dailyFootballLimit: user.dailyFootballLimit ?? 0,
    lastFootballDate: user.lastFootballDate || '',
    Deposit_progress: user.Deposit_progress ?? 0,
    claimedDepositBonuses: user.claimedDepositBonuses ?? [],
  };
};

export const addHistoryEntry = (user: UserData, entry: string, limit = 20): UserData => {
  const history = [entry, ...(user.history || [])].slice(0, limit);
  return { ...user, history };
};

const getStoredUsers = (): UserData[] => parseUsers(localStorage.getItem(USERS_KEY));

const saveStoredUsers = (users: UserData[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const upsertStoredUser = (user: UserData) => {
  const users = getStoredUsers();
  const next = users.some(u => u.username === user.username)
    ? users.map(u => (u.username === user.username ? user : u))
    : [user, ...users];
  saveStoredUsers(next);
};

const fetchUserFromFile = async (username: string): Promise<UserData | null> => {
  try {
    let response = await fetch(`User/${username}.json`);
    if (!response.ok) {
      response = await fetch(`/User/${username}.json`);
    }
    if (!response.ok) return null;
    return normalizeUserData(await response.json());
  } catch (err) {
    console.error('Failed to load user file', err);
    return null;
  }
};

export const loadUser = async (username: string): Promise<UserData | null> => {
  const normalized = normalizeUsername(username);

  // Special test account for Ly Leap
  if (normalized === 'lyleap') {
    const testUser: UserData = {
      username: 'lyleap',
      balance: 1000000,
      promotion_balance: 1000000,
      total_deposit: 0,
      spinsLeft: 1000,
      football_guess: 1000,
      Get_monthly_reward: true,
      Claimed_Monthly: false,
      last_reset: new Date().toISOString(),
      predictions: [],
      exchanges: [],
      history: ['Test account created with 1000 free spins'],
      dailyFootballLimit: 0,
      lastFootballDate: '',
      isBlacklisted: false,
      lastSpinDate: ''
    };
    // Persist to local storage so it's available across sessions
    upsertStoredUser(testUser);
    return normalizeUserData(testUser);
  }

  try {
    const response = await fetch(`${API_BASE}?type=user&action=get&username=${normalized}`);
    const contentType = response.headers.get("content-type");
    if (response.ok && contentType && contentType.includes("application/json")) {
      const data = await response.json();
      if (data && !data.error) {
        return normalizeUserData(data);
      }
    }
  } catch (err) {
    console.error('API error loading user:', err);
  }

  // Fallback to localStorage for offline/preview support
  const local = getStoredUsers().find(u => u.username?.toLowerCase() === normalized);
  if (local) return normalizeUserData(local);

  return null;
};

export const persistUser = async (user: UserData): Promise<void> => {
  const normalized = normalizeUserData(user);
  upsertStoredUser(normalized);

  try {
    await fetch(`${API_BASE}?type=user&action=save&username=${normalizeUsername(normalized.username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized, null, 2)
    });
  } catch (err) {
    console.warn('API not reachable. Saved to localStorage only.', err);
  }
};

export const loadAllUsers = async (limit = 50, offset = 0, tts = '', search = ''): Promise<{ users: UserData[], total: number }> => {
  try {
    const url = `${API_BASE}?type=user&action=get&limit=${limit}&offset=${offset}${tts ? `&tts=${tts}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const response = await fetch(url);
    const text = await response.text();
    
    // Check if we got raw PHP (Preview Mode)
    if (text.includes('<?php')) {
      const local = getStoredUsers();
      let filtered = tts && tts !== 'teb' ? local.filter(u => u.tts === tts) : local;
      if (search) {
        filtered = filtered.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));
      }
      return {
        users: filtered.slice(offset, offset + limit).map(normalizeUserData),
        total: filtered.length
      };
    }

    const data = JSON.parse(text);
    if (data && data.users) {
      return {
        users: data.users.map(normalizeUserData),
        total: data.total
      };
    }
  } catch (err) {
    console.error('API error loading users:', err);
  }
  
  const local = getStoredUsers();
  let filtered = tts && tts !== 'teb' ? local.filter(u => u.tts === tts) : local;
  if (search) {
    filtered = filtered.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));
  }
  return {
    users: filtered.slice(offset, offset + limit).map(normalizeUserData),
    total: filtered.length
  };
};

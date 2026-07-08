import { ChampionMatch, ChampionPick } from '../types';

const API_BASE = 'https://db.7fun7-api.online/api';

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

const normalizeChampionMatch = (m: any): ChampionMatch => ({
  id: String(m.id || ''),
  team1: m.team1 || '',
  team2: m.team2 || '',
  team1_logo: normalizeLogoUrl(m.team1_logo || ''),
  team2_logo: normalizeLogoUrl(m.team2_logo || ''),
  match_label: m.match_label || '',
  payout: typeof m.payout === 'number' ? m.payout : parseFloat(m.payout) || 10,
  visibility: m.visibility !== false && m.visibility !== 0,
  winner: m.winner || null,
  awarded: !!m.awarded,
  created_at: m.created_at || '',
});

const isPreviewMode = (text: string) =>
  text.includes('<?php') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');

// Mock data shown in preview/PlayCode editor (no real DB connection)
const MOCK_MATCHES: ChampionMatch[] = [
  {
    id: 'wc_bra_arg', team1: 'Brazil', team2: 'Argentina',
    match_label: 'Group A', payout: 10, visibility: true, winner: null, awarded: false,
  },
  {
    id: 'wc_fra_ger', team1: 'France', team2: 'Germany',
    match_label: 'Group B', payout: 10, visibility: true, winner: null, awarded: false,
  },
  {
    id: 'wc_eng_spa', team1: 'England', team2: 'Spain',
    match_label: 'Quarter Final', payout: 10, visibility: true, winner: null, awarded: false,
  },
  {
    id: 'wc_por_ned', team1: 'Portugal', team2: 'Netherlands',
    match_label: 'Quarter Final', payout: 10, visibility: true, winner: null, awarded: false,
  },
];

// ─── User-facing: visible matches only ───────────────────────────────────────

export async function fetchChampionMatches(): Promise<ChampionMatch[]> {
  try {
    const res = await fetch(`${API_BASE}?type=champion&action=get`);
    const text = await res.text();
    if (isPreviewMode(text)) return MOCK_MATCHES;
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : (data.matches || []);
    return arr.map(normalizeChampionMatch);
  } catch (e) {
    console.error('[champion] fetchChampionMatches error:', e);
    return [];
  }
}

export async function fetchMyChampionPicks(username: string): Promise<ChampionPick[]> {
  try {
    const res = await fetch(
      `${API_BASE}?type=champion&action=get_picks&username=${encodeURIComponent(username)}`
    );
    const text = await res.text();
    if (isPreviewMode(text)) return [];
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : (data.picks || []);
  } catch (e) {
    console.error('[champion] fetchMyChampionPicks error:', e);
    return [];
  }
}

export async function fetchChampionPicksRemaining(username: string): Promise<number> {
  try {
    const res = await fetch(
      `${API_BASE}?type=champion&action=picks_remaining&username=${encodeURIComponent(username)}`
    );
    const text = await res.text();
    if (isPreviewMode(text)) return 5;
    const data = JSON.parse(text);
    return typeof data.remaining === 'number' ? data.remaining : 5;
  } catch (e) {
    console.error('[champion] fetchChampionPicksRemaining error:', e);
    return 5;
  }
}

export async function submitChampionPicks(
  picks: { username: string; match_id: string; selected_team: string; payout: number }[]
): Promise<{ success: boolean; error?: string; remaining?: number }> {
  try {
    // Send as plain array — Flask backend expects list or single dict
    const res = await fetch(`${API_BASE}?type=champion&action=pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(picks),
    });
    const text = await res.text();
    if (isPreviewMode(text)) return { success: true, remaining: 4 };
    return JSON.parse(text);
  } catch (e) {
    console.error('[champion] submitChampionPicks error:', e);
    return { success: false, error: 'Connection error. Please try again.' };
  }
}

// ─── Admin: all matches ───────────────────────────────────────────────────────

export async function fetchAllChampionMatches(): Promise<ChampionMatch[]> {
  try {
    const res = await fetch(`${API_BASE}?type=champion&action=get_all`);
    const text = await res.text();
    if (isPreviewMode(text)) return MOCK_MATCHES;
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : (data.matches || []);
    return arr.map(normalizeChampionMatch);
  } catch {
    return MOCK_MATCHES;
  }
}

export async function saveChampionMatch(
  match: Partial<ChampionMatch>
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const res = await fetch(`${API_BASE}?type=champion&action=save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(match),
    });
    const text = await res.text();
    if (isPreviewMode(text)) return { success: true, id: match.id || 'preview_' + Date.now() };
    return JSON.parse(text);
  } catch {
    return { success: false, error: 'Connection error' };
  }
}

export async function deleteChampionMatch(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}?type=champion&action=delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const text = await res.text();
    if (isPreviewMode(text)) return { success: true };
    return JSON.parse(text);
  } catch {
    return { success: false, error: 'Connection error' };
  }
}

export async function setChampionWinner(
  matchId: string,
  winner: 'team1' | 'team2'
): Promise<{ success: boolean; awarded_count?: number; total_pts?: number; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}?type=champion&action=set_winner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: matchId, winner }),
    });
    const text = await res.text();
    if (isPreviewMode(text)) return { success: true, awarded_count: 0, total_pts: 0 };
    return JSON.parse(text);
  } catch {
    return { success: false, error: 'Connection error' };
  }
}

export async function fetchAllChampionPicks(
  limit = 100,
  offset = 0,
  search = ''
): Promise<{ picks: any[]; total: number }> {
  try {
    const res = await fetch(
      `${API_BASE}?type=champion&action=get_all_picks&limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`
    );
    const text = await res.text();
    if (isPreviewMode(text)) return { picks: [], total: 0 };
    const data = JSON.parse(text);
    return { picks: data.picks || [], total: data.total || 0 };
  } catch {
    return { picks: [], total: 0 };
  }
}

export async function uploadChampionLogo(
  matchId: string,
  team: 1 | 2,
  file: File
): Promise<{ success: boolean; logoUrl?: string; error?: string }> {
  const formData = new FormData();
  formData.append('logo', file);
  formData.append('matchId', matchId);
  formData.append('team', String(team));
  try {
    const res = await fetch(`${API_BASE}?type=champion&action=upload_logo`, {
      method: 'POST',
      body: formData,
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Upload failed' };
  }
}

export async function toggleChampionVisibility(
  matchId: string,
  visible: boolean
): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}?type=champion&action=toggle_visibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: matchId, visibility: visible }),
    });
    const text = await res.text();
    if (isPreviewMode(text)) return { success: true };
    return JSON.parse(text);
  } catch {
    return { success: false };
  }
}

import { Match } from '../types';

export const normalizeLogoUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('/public/images/logos/')) {
    return url.replace('/public/images/logos/', 'https://img.7fun7-api.online/');
  }
  if (url.includes('7fun7.promo/public/images/logos/')) {
    return url.replace(/https?:\/\/7fun7\.promo\/public\/images\/logos\//, 'https://img.7fun7-api.online/');
  }
  return url;
};

const processBetslip = (bs: any) => {
  if (!bs || typeof bs !== 'object') return null;
  
  try {
    if (bs.match && typeof bs.match === 'object') {
      bs.match.team1_logo = normalizeLogoUrl(bs.match.team1_logo);
      bs.match.team2_logo = normalizeLogoUrl(bs.match.team2_logo);
    }
    if (Array.isArray(bs.matches)) {
      bs.matches = bs.matches.map((m: any) => {
        if (!m || typeof m !== 'object') return m;
        return {
          ...m,
          team1_logo: normalizeLogoUrl(m.team1_logo),
          team2_logo: normalizeLogoUrl(m.team2_logo)
        };
      });
    }
  } catch (e) {
    console.warn('Error processing individual betslip:', e);
  }
  return bs;
};

export async function fetchFootballMatches(): Promise<Match[]> {
  try {
    const response = await fetch('https://db.7fun7-api.online/api?type=matches&action=get');
    const text = await response.text();
    
    // Preview Mode Detection
    if (text.trim().startsWith('<?php')) {
      console.log('Preview Mode: Falling back to data.json for football matches');
      const dataJsonResponse = await fetch(`/data.json?t=${Date.now()}`);
      const dataText = await dataJsonResponse.text();
      const matchBlocks = dataText.match(/\{[\s\S]*?\n    \}/g) || [];
      const validData: any[] = [];
      for (const block of matchBlocks) {
        try {
          const cleanedBlock = block.trim().replace(/,$/, '');
          const parsed = JSON.parse(cleanedBlock);
          if (parsed.id && parsed.home_team) validData.push(parsed);
        } catch (e) { continue; }
      }
      return await processFullData(validData);
    }

    try {
      const matches = JSON.parse(text);
      if (Array.isArray(matches)) {
        return await processFullData(matches);
      }
    } catch (e) {
      console.warn('Failed to parse MySQL matches:', text.substring(0, 100));
    }

    return [];
  } catch (error) {
    console.error('Error fetching football matches:', error);
    return [];
  }
}

export async function fetchAllMatches(): Promise<Match[]> {
  try {
    const response = await fetch('https://db.7fun7-api.online/api?type=matches&action=get_all');
    const text = await response.text();

    // Preview Mode Detection
    if (text.includes('<?php')) {
      console.log('Preview Mode: Loading all matches from local storage/fallback');
      return [];
    }

    const matches = JSON.parse(text);
    if (Array.isArray(matches)) {
      return await processFullData(matches);
    }
    return [];
  } catch (error) {
    console.error('Error fetching all matches:', error);
    return [];
  }
}

export async function toggleMatchVisibility(id: string | number, visibility: boolean): Promise<boolean> {
  try {
    const response = await fetch('https://db.7fun7-api.online/api?type=matches&action=toggle_visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, visibility })
    });
    return response.ok;
  } catch (error) {
    console.error('Error toggling match visibility:', error);
    return false;
  }
}

export async function saveMatchesToMySQL(matches: Match[]): Promise<boolean> {
  try {
    const response = await fetch('https://db.7fun7-api.online/api?type=matches&action=save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(matches)
    });
    return response.ok;
  } catch (error) {
    console.error('Error saving matches to MySQL:', error);
    return false;
  }
}

export async function saveSingleMatch(match: Match): Promise<boolean> {
  try {
    const response = await fetch('https://db.7fun7-api.online/api?type=matches&action=save_single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(match)
    });
    return response.ok;
  } catch (error) {
    console.error('Error saving single match:', error);
    return false;
  }
}

export async function saveBetslip(data: any): Promise<{ success: boolean; football_guess?: number; error?: string }> {
  try {
    const response = await fetch('https://db.7fun7-api.online/api?type=betslips&action=save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      return { success: false, error: result.error || 'Failed to save betslip' };
    }
    return { success: true, football_guess: result.football_guess };
  } catch (error) {
    console.error('Error saving betslip:', error);
    return { success: false, error: 'Connection error. Please try again.' };
  }
}

export async function fetchUserBetslips(username: string): Promise<any[]> {
  try {
    const response = await fetch(`https://db.7fun7-api.online/api?type=betslips&action=get_user&username=${encodeURIComponent(username)}`);
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data.map(processBetslip) : [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching user betslips:', error);
    return [];
  }
}

export async function fetchAllBetslips(limit = 50, offset = 0, search = '', tts = ''): Promise<{ betslips: any[], total: number }> {
  try {
    const response = await fetch(`https://db.7fun7-api.online/api?type=betslips&action=get_all&limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}&tts=${encodeURIComponent(tts)}`);
    const text = await response.text();

    // Preview Mode Detection
    if (text.includes('<?php')) {
      console.log('Preview Mode: Loading betslips from local storage fallback');
      return { betslips: [], total: 0 };
    }

    const result = JSON.parse(text);
    if (result && result.betslips && Array.isArray(result.betslips)) {
      return {
        ...result,
        betslips: result.betslips.map(processBetslip).filter(Boolean)
      };
    }
    const list = Array.isArray(result) ? result : [];
    return { betslips: list.map(processBetslip).filter(Boolean), total: list.length };
  } catch (error) {
    console.error('Error fetching all betslips:', error);
    return { betslips: [], total: 0 };
  }
}

export async function updateBetslipStatus(receiptId: string, status: string, matches?: any[]): Promise<boolean> {
  try {
    const response = await fetch('https://db.7fun7-api.online/api?type=betslips&action=update_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt_id: receiptId, status, matches })
    });
    return response.ok;
  } catch (error) {
    console.error('Error updating betslip status:', error);
    return false;
  }
}

async function processFullData(data: any[]): Promise<Match[]> {
  // Deduplicate matches by ID
  const uniqueMatchesMap = new Map<string, any>();
  data.forEach((item: any) => {
    if (item && item.id && !uniqueMatchesMap.has(item.id)) {
      uniqueMatchesMap.set(item.id, item);
    }
  });

  const matches: Match[] = Array.from(uniqueMatchesMap.values()).map((item: any, index: number) => {
    try {
      // If item has raw_json, parse it for team names and league
      let rawData = item;
      if (item.raw_json) {
        try {
          rawData = typeof item.raw_json === 'string' ? JSON.parse(item.raw_json) : item.raw_json;
        } catch (e) {
          console.error('Failed to parse raw_json for match:', item.id);
        }
      }

      // Extract odds - first try PHP-provided values, then parse raw_json as fallback
      let payoutWinnerTeam1 = parseFloat(item.payoutWinnerTeam1) || 0;
      let payoutWinnerTeam2 = parseFloat(item.payoutWinnerTeam2) || 0;
      let payoutDraw = parseFloat(item.payoutDraw) || 0;
      let payoutOver = parseFloat(item.payoutOver) || 0;
      let payoutUnder = parseFloat(item.payoutUnder) || 0;
      let payoutTotal = parseFloat(item.payoutTotal) || 0;
      let payoutHdp1 = parseFloat(item.payoutHdp1) || 0;
      let payoutHdp2 = parseFloat(item.payoutHdp2) || 0;
      let hdpLine = parseFloat(item.hdpLine) || 0;

      // If PHP didn't provide odds (e.g. data.json fallback), parse from first bookmaker
      if (payoutWinnerTeam1 === 0 && payoutWinnerTeam2 === 0) {
        const bookmakers = rawData.bookmakers || [];
        if (bookmakers.length > 0) {
          const home = (rawData.home_team || item.team1 || '').toString().trim().toLowerCase();
          const away = (rawData.away_team || item.team2 || '').toString().trim().toLowerCase();
          
          let foundH2H = false, foundSpreads = false, foundTotals = false;

          for (const bm of bookmakers) {
            if (foundH2H && foundSpreads && foundTotals) break;
            for (const market of (bm.markets || [])) {
              const mk = market.key || '';
              const outcomes = market.outcomes || [];
              if (!outcomes.length) continue;
              
              if (mk === 'h2h' && !foundH2H) {
                // Try name match first, then positional fallback
                for (const o of outcomes) {
                  const name = (o.name || '').trim().toLowerCase();
                  const price = typeof o.price === 'number' ? o.price : 0;
                  if (price <= 0) continue;
                  if (name === 'draw') { payoutDraw = price; }
                  else if (name === home || name.includes(home) || home.includes(name)) { payoutWinnerTeam1 = price; }
                  else if (name === away || name.includes(away) || away.includes(name)) { payoutWinnerTeam2 = price; }
                }
                // Positional fallback if name match failed
                if (payoutWinnerTeam1 === 0 && payoutWinnerTeam2 === 0) {
                  const nonDraw = outcomes.filter((o: any) => (o.name || '').trim().toLowerCase() !== 'draw');
                  if (nonDraw.length >= 2) {
                    payoutWinnerTeam1 = nonDraw[0].price || 0;
                    payoutWinnerTeam2 = nonDraw[1].price || 0;
                  }
                  const drawO = outcomes.find((o: any) => (o.name || '').trim().toLowerCase() === 'draw');
                  if (drawO) payoutDraw = drawO.price || 0;
                }
                if (payoutWinnerTeam1 > 0) foundH2H = true;
                
              } else if (mk === 'spreads' && !foundSpreads) {
                if (outcomes.length >= 2) {
                  payoutHdp1 = outcomes[0].price || 0;
                  payoutHdp2 = outcomes[1].price || 0;
                  if (typeof outcomes[0].point === 'number') hdpLine = outcomes[0].point;
                }
                if (payoutHdp1 > 0) foundSpreads = true;
                
              } else if (mk === 'totals' && !foundTotals) {
                for (const o of outcomes) {
                  const name = (o.name || '').trim().toLowerCase();
                  if (name === 'over') { payoutOver = o.price || 0; if (typeof o.point === 'number') payoutTotal = o.point; }
                  else if (name === 'under') { payoutUnder = o.price || 0; }
                }
                if (payoutOver > 0) foundTotals = true;
              }
            }
          }
        }
      }

      return {
        id: item.id || `match-${index}`,
        team1: rawData.home_team || item.team1 || 'Unknown',
        team2: rawData.away_team || item.team2 || 'Unknown',
        team1_logo: normalizeLogoUrl(item.team1_logo || item.logo1 || ''),
        team2_logo: normalizeLogoUrl(item.team2_logo || item.logo2 || ''),
        league: rawData.sport_title || item.league || 'Other',
        rewardAmount: item.rewardAmount || 0,
        timeText: item.timeText || ((rawData.commence_time || item.commence_time) ? new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Phnom_Penh'
        }).format(new Date(rawData.commence_time || item.commence_time)) : 'TBA'),
        line: hdpLine,
        hdpLine,
        payoutWinnerTeam1,
        payoutWinnerTeam2,
        payoutDraw,
        payoutOver,
        payoutUnder,
        payoutTotal,
        payoutHdp1,
        payoutHdp2,
        color: 'from-purple-600 via-pink-500 to-orange-400',
        awarded: item.awarded || false,
        winner: item.winner || null,
        finalScore1: item.finalScore1 !== undefined ? Number(item.finalScore1) : undefined,
        finalScore2: item.finalScore2 !== undefined ? Number(item.finalScore2) : undefined,
        commence_time: rawData.commence_time || item.commence_time,
        sport_key: rawData.sport_key || item.sport_key,
        home_team: rawData.home_team || item.home_team,
        away_team: rawData.away_team || item.away_team,
        raw_json: rawData,
        visibility: item.visibility !== undefined ? item.visibility : true
      };
    } catch (err) {
      console.error('Error processing match data:', err);
      return null;
    }
  }).filter(m => m !== null) as Match[];

  // Sort by league name
  return matches.sort((a, b) => (a.league || '').localeCompare(b.league || ''));
}

// Removed getRandomGradient as we now use a consistent rim color

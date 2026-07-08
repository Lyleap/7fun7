import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, Users, Settings as SettingsIcon, History, Search, Save, Trash2, Plus, 
  ShieldAlert, Trophy, BarChart3, Printer, Camera, CheckCircle2, AlertCircle, 
  Clock, Calendar, CheckSquare, Square, Receipt, User as UserIcon, ChevronRight, ChevronDown,
  TableProperties, Edit2, Upload, ImageIcon
} from 'lucide-react';
import ExcelSection from './ExcelSection';
import { UserData, Match, Prediction } from '../types';
import { addHistoryEntry, normalizeUserData, persistUser, loadAllUsers } from '../services/userPersistence';
import { normalizeSettings, loadSettings as fetchSettings, persistSettings } from '../services/settingsPersistence';
import { 
  fetchAllMatches, toggleMatchVisibility, fetchAllBetslips, 
  updateBetslipStatus, saveMatchesToMySQL, normalizeLogoUrl 
} from '../services/footballData';
import {
  fetchAllChampionMatches, saveChampionMatch, deleteChampionMatch,
  setChampionWinner, fetchAllChampionPicks, toggleChampionVisibility,
  uploadChampionLogo,
} from '../services/championData';
import { ChampionMatch } from '../types';

interface AdminSectionProps {
  onClose: () => void;
}

const API_BASE = 'https://db.7fun7-api.online/api';

const getSafeMatches = (matches: any): any[] => {
  if (Array.isArray(matches)) return matches;
  if (typeof matches === 'string' && matches.trim()) {
    try {
      const parsed = JSON.parse(matches);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse matches JSON:', e);
      return [];
    }
  }
  return [];
};

const formatAdminChangeEntry = (label: string, before: string | number | boolean | undefined, after: string | number | boolean | undefined) => {
  return `Admin updated ${label}: ${before ?? '-'} → ${after ?? '-'}`;
};

const buildAdminHistoryEntry = (previous: UserData, updates: Partial<UserData>) => {
  if (updates.promotion_balance !== undefined && updates.promotion_balance !== previous.promotion_balance) {
    return formatAdminChangeEntry('promo balance', previous.promotion_balance, updates.promotion_balance);
  }
  if (updates.balance !== undefined && updates.balance !== previous.balance) {
    return formatAdminChangeEntry('balance', previous.balance, updates.balance);
  }
  if (updates.total_deposit !== undefined && updates.total_deposit !== previous.total_deposit) {
    return formatAdminChangeEntry('total deposit', previous.total_deposit, updates.total_deposit);
  }
  if (updates.spinsLeft !== undefined && updates.spinsLeft !== previous.spinsLeft) {
    return formatAdminChangeEntry('spins', previous.spinsLeft, updates.spinsLeft);
  }
  if (updates.football_guess !== undefined && updates.football_guess !== previous.football_guess) {
    return formatAdminChangeEntry('football guess', previous.football_guess, updates.football_guess);
  }
  if (updates.payoutRate !== undefined && updates.payoutRate !== previous.payoutRate) {
    return formatAdminChangeEntry('payout rate', previous.payoutRate, updates.payoutRate);
  }
  if (updates.isBlacklisted !== undefined && updates.isBlacklisted !== previous.isBlacklisted) {
    return formatAdminChangeEntry('blacklist', previous.isBlacklisted, updates.isBlacklisted);
  }
  if (updates.Get_monthly_reward !== undefined && updates.Get_monthly_reward !== previous.Get_monthly_reward) {
    return formatAdminChangeEntry('monthly reward', previous.Get_monthly_reward, updates.Get_monthly_reward);
  }
  if (updates.Claimed_Monthly !== undefined && updates.Claimed_Monthly !== previous.Claimed_Monthly) {
    return formatAdminChangeEntry('claimed monthly', previous.Claimed_Monthly, updates.Claimed_Monthly);
  }
  return '';
};

// Safety rendering wrapper
function SafeRender({ children, fallback = null }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch (e) {
    console.error('SafeRender caught error:', e);
    return <>{fallback}</>;
  }
}

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error('ErrorBoundary caught:', error, errorInfo); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export default function AdminSection({ onClose }: AdminSectionProps) {
  const { t, settings, setSettings, user, saveUser, matches, setMatches } = useApp();
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'transactions' | 'football' | 'matches' | 'betslips' | 'admins' | 'excel' | 'champion' | 'depositBonus'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [allBetslips, setAllBetslips] = useState<any[]>([]);
  const [totalBetslips, setTotalBetslips] = useState(0);
  const [betslipPage, setBetslipPage] = useState(0);
  const [betslipLimit, setBetslipLimit] = useState(50);
  const [loadingBetslips, setLoadingBetslips] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<Match | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savedUsers, setSavedUsers] = useState<UserData[]>(() => {
    const stored = localStorage.getItem('users');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [showFootballPercent, setShowFootballPercent] = useState(false);
  const [showFootballUsers, setShowFootballUsers] = useState(false);

  // ── Champion (Worldcup) state ─────────────────────────────────────────────
  const [championMatches, setChampionMatches] = useState<ChampionMatch[]>([]);
  const [loadingChampion, setLoadingChampion] = useState(false);
  const [championPicks, setChampionPicks] = useState<any[]>([]);
  const [totalChampionPicks, setTotalChampionPicks] = useState(0);
  const [loadingChampionPicks, setLoadingChampionPicks] = useState(false);
  const [championPickSearch, setChampionPickSearch] = useState('');
  const [pendingChampionMatch, setPendingChampionMatch] = useState<Partial<ChampionMatch> | null>(null);
  const [championSaveMsg, setChampionSaveMsg] = useState('');
  const [championError, setChampionError] = useState('');
  const [pendingLogoFiles, setPendingLogoFiles] = useState<{ team1?: File; team2?: File }>({});
  const [logoPreviewUrls, setLogoPreviewUrls] = useState<{ team1?: string; team2?: string }>({});
  const [logoUploading, setLogoUploading] = useState<{ team1?: boolean; team2?: boolean }>({});

  const loadChampionMatches = async () => {
    setLoadingChampion(true);
    try {
      const data = await fetchAllChampionMatches();
      setChampionMatches(data);
    } catch (e) {
      console.error('loadChampionMatches error:', e);
    } finally {
      setLoadingChampion(false);
    }
  };

  const loadChampionPicks = async (search = '') => {
    setLoadingChampionPicks(true);
    try {
      const result = await fetchAllChampionPicks(100, 0, search);
      setChampionPicks(result.picks);
      setTotalChampionPicks(result.total);
    } catch (e) {
      console.error('loadChampionPicks error:', e);
    } finally {
      setLoadingChampionPicks(false);
    }
  };

  const handleSaveChampionMatch = async () => {
    if (!pendingChampionMatch) return;
    if (!pendingChampionMatch.team1?.trim() || !pendingChampionMatch.team2?.trim()) {
      setChampionError('Both team names are required.');
      return;
    }
    setChampionError('');
    try {
      const result = await saveChampionMatch(pendingChampionMatch);
      if (result.success) {
        // Upload any pending logo files (use returned id for new matches)
        const matchId = (result.id || pendingChampionMatch.id) as string;
        if (matchId) {
          const uploads: Promise<any>[] = [];
          if (pendingLogoFiles.team1) {
            uploads.push(uploadChampionLogo(matchId, 1, pendingLogoFiles.team1));
          }
          if (pendingLogoFiles.team2) {
            uploads.push(uploadChampionLogo(matchId, 2, pendingLogoFiles.team2));
          }
          if (uploads.length > 0) await Promise.all(uploads);
        }
        setChampionSaveMsg('Match saved successfully!');
        setPendingChampionMatch(null);
        setPendingLogoFiles({});
        setLogoPreviewUrls({});
        setTimeout(() => setChampionSaveMsg(''), 3000);
        await loadChampionMatches();
      } else {
        setChampionError(result.error || 'Save failed');
      }
    } catch {
      setChampionError('Connection error while saving');
    }
  };

  // Helper: handle a dropped/selected logo file
  const handleLogoDrop = (team: 'team1' | 'team2', file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPendingLogoFiles(p => ({ ...p, [team]: file }));
    setLogoPreviewUrls(p => ({ ...p, [team]: url }));
  };

  // Open a file picker for logo
  const openLogoPicker = (team: 'team1' | 'team2') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleLogoDrop(team, file);
    };
    input.click();
  };

  const handleSetChampionWinner = async (matchId: string, winner: 'team1' | 'team2') => {
    try {
      const result = await setChampionWinner(matchId, winner);
      if (result.success) {
        setChampionSaveMsg(`Winner set! ${result.payoutsProcessed ?? 0} payouts processed.`);
        setTimeout(() => setChampionSaveMsg(''), 4000);
        await loadChampionMatches();
      } else {
        setChampionError(result.error || 'Failed to set winner');
      }
    } catch {
      setChampionError('Connection error setting winner');
    }
  };

  const handleDeleteChampionMatch = async (id: string) => {
    if (!confirm('Delete this match? All picks will also be removed.')) return;
    try {
      const result = await deleteChampionMatch(id);
      if (result.success) {
        await loadChampionMatches();
      } else {
        setChampionError(result.error || 'Delete failed');
      }
    } catch {
      setChampionError('Connection error deleting match');
    }
  };

  const loadSettings = async () => {
    const data = await fetchSettings();
    if (data) setSettings(data);
  };

  const loadAllBetslips = () => refreshBetslips(true);

  const refreshBetslips = async (reset = true) => {
    setLoadingBetslips(true);
    const page = reset ? 0 : betslipPage;
    const currentAdmin = sessionStorage.getItem('adminUser') || '';
    
    try {
      const result = await fetchAllBetslips(betslipLimit, page * betslipLimit, searchQuery, currentAdmin);
      if (reset) {
        setAllBetslips(result.betslips);
        setBetslipPage(0);
      } else {
        setAllBetslips(prev => [...prev, ...result.betslips]);
      }
      setTotalBetslips(result.total);
    } catch (err) {
      console.error('Failed to refresh betslips:', err);
    } finally {
      setLoadingBetslips(false);
    }
  };

  const loadMoreBetslips = () => {
    const nextPage = betslipPage + 1;
    setBetslipPage(nextPage);
    const currentAdmin = sessionStorage.getItem('adminUser') || '';
    
    setLoadingBetslips(true);
    fetchAllBetslips(betslipLimit, nextPage * betslipLimit, searchQuery, currentAdmin).then(result => {
      setAllBetslips(prev => [...prev, ...result.betslips]);
      setTotalBetslips(result.total);
      setLoadingBetslips(false);
    });
  };
  const [footballFilter, setFootballFilter] = useState<'all' | 'playing' | 'today' | 'tomorrow'>('all');
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [newAdminData, setNewAdminData] = useState({ username: '', password: '', role: 'agent' });

  const filteredMatches = allMatches.filter(match => {
    if (footballFilter === 'all') return true;
    const now = new Date();
    const start = match.commence_time ? new Date(match.commence_time) : null;
    if (!start) return false;

    if (footballFilter === 'playing') return start.getTime() <= now.getTime();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);

    if (footballFilter === 'today') return start >= today && start < tomorrow;
    if (footballFilter === 'tomorrow') return start >= tomorrow && start < dayAfter;
    return true;
  });

  const filteredStandardMatches = (settings?.footballMatches || []).filter(match => {
    if (footballFilter === 'all') return true;
    const now = new Date();
    const start = match.commence_time ? new Date(match.commence_time) : null;
    if (!start) return false;

    if (footballFilter === 'playing') return start.getTime() <= now.getTime();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);

    if (footballFilter === 'today') return start >= today && start < tomorrow;
    if (footballFilter === 'tomorrow') return start >= tomorrow && start < dayAfter;
    return true;
  });

  const loadAllMatches = async () => {
    setLoadingMatches(true);
    const data = await fetchAllMatches();
    setAllMatches(data);
    setLoadingMatches(false);
  };

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    // Also refresh users to get accurate account counts
    refreshUsers();
    try {
      const response = await fetch(`${API_BASE}?type=admin&action=get_all`);
      const text = await response.text();
      
      // Check if we got raw PHP (Preview Mode)
      if (text.includes('<?php')) {
        console.log('Preview Mode: Loading admins from localStorage');
        const localAdmins = JSON.parse(localStorage.getItem('preview_admins') || '[]');
        // Ensure teb is always there
        if (!localAdmins.find((a: any) => a.username === 'teb')) {
          localAdmins.push({ username: 'teb', role: 'superadmin', created_at: new Date().toISOString() });
        }
        setAdmins(localAdmins);
        return;
      }

      const data = JSON.parse(text);
      setAdmins(data);
    } catch (err) {
      console.error('Failed to load admins:', err);
      // Final fallback for any error
      const localAdmins = JSON.parse(localStorage.getItem('preview_admins') || '[]');
      setAdmins(localAdmins);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleSaveAdmin = async () => {
    if (!newAdminData.username || !newAdminData.password) {
      alert('Username and password are required');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}?type=admin&action=save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdminData)
      });
      
      const text = await response.text();
      
      // Preview Mode Fallback
      if (text.includes('<?php')) {
        const localAdmins = JSON.parse(localStorage.getItem('preview_admins') || '[]');
        const existingIndex = localAdmins.findIndex((a: any) => a.username === newAdminData.username);
        
        if (existingIndex >= 0) {
          localAdmins[existingIndex] = { ...newAdminData, created_at: localAdmins[existingIndex].created_at };
        } else {
          localAdmins.push({ ...newAdminData, created_at: new Date().toISOString() });
        }
        
        localStorage.setItem('preview_admins', JSON.stringify(localAdmins));
        alert('Admin saved (Preview Mode)');
        setShowCreateAdminModal(false);
        setNewAdminData({ username: '', password: '', role: 'agent' });
        loadAdmins();
        return;
      }

      const data = JSON.parse(text);
      if (data.success) {
        alert('Admin saved successfully');
        setShowCreateAdminModal(false);
        setNewAdminData({ username: '', password: '', role: 'agent' });
        loadAdmins();
      } else {
        alert(data.error || 'Failed to save admin');
      }
    } catch (err) {
      console.error('Failed to save admin:', err);
      alert('Connection error - check console');
    }
  };

  const handleDeleteAdmin = async (username: string) => {
    if (username === 'teb') return;
    if (!confirm(`Are you sure you want to delete admin ${username}?`)) return;
    
    try {
      const response = await fetch(`${API_BASE}?type=admin&action=delete&username=${username}`);
      const text = await response.text();

      // Preview Mode Fallback
      if (text.includes('<?php')) {
        const localAdmins = JSON.parse(localStorage.getItem('preview_admins') || '[]');
        const filtered = localAdmins.filter((a: any) => a.username !== username);
        localStorage.setItem('preview_admins', JSON.stringify(filtered));
        alert('Admin deleted (Preview Mode)');
        loadAdmins();
        return;
      }

      const data = JSON.parse(text);
      if (data.success) {
        alert('Admin deleted');
        loadAdmins();
      } else {
        alert(data.error || 'Failed to delete admin');
      }
    } catch (err) {
      console.error('Failed to delete admin:', err);
      alert('Connection error');
    }
  };

  const handleToggleVisibility = async (matchId: string | number, currentVisibility: boolean) => {
    const success = await toggleMatchVisibility(matchId, !currentVisibility);
    if (success) {
      setAllMatches(prev => prev.map(m => m.id === matchId ? { ...m, visibility: !currentVisibility } : m));
    }
  };

  const handleLogoUpload = async (matchId: string | number, team: 1 | 2, file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    formData.append('matchId', matchId.toString());
    formData.append('team', team.toString());

    try {
      const response = await fetch('https://db.7fun7-api.online/api?type=matches&action=upload_logo', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setAllMatches(prev => prev.map(m => m.id === matchId ? { 
          ...m, 
          [team === 1 ? 'team1_logo' : 'team2_logo']: data.logoUrl 
        } : m));
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Failed to upload logo');
    }
  };

  const getCountdown = (commenceTime: string | undefined) => {
    if (!commenceTime) return 'TBA';
    const now = new Date();
    const start = new Date(commenceTime);
    const diff = start.getTime() - now.getTime();

    if (diff <= 0) return 'Started';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `In ${days}D, ${hours}h ${minutes}m`;
    }
    return `In ${hours}h ${minutes}m`;
  };

  const getLowestOdds = (rawJson: any) => {
    if (!rawJson) return null;
    let data = rawJson;
    if (typeof rawJson === 'string') {
      try {
        data = JSON.parse(rawJson);
      } catch (e) {
        return null;
      }
    }
    if (!data.bookmakers) return null;
    
    const markets: any = {
      h2h: { home: Infinity, away: Infinity, draw: Infinity },
      spreads: { home: { price: Infinity, point: 0 }, away: { price: Infinity, point: 0 } },
      totals: { over: { price: Infinity, point: 0 }, under: { price: Infinity, point: 0 } }
    };

    data.bookmakers.forEach((bookmaker: any) => {
      bookmaker.markets.forEach((market: any) => {
        if (market.key === 'h2h') {
          market.outcomes.forEach((outcome: any) => {
            if (outcome.name === data.home_team) markets.h2h.home = Math.min(markets.h2h.home, outcome.price);
            else if (outcome.name === data.away_team) markets.h2h.away = Math.min(markets.h2h.away, outcome.price);
            else if (outcome.name === 'Draw') markets.h2h.draw = Math.min(markets.h2h.draw, outcome.price);
          });
        } else if (market.key === 'spreads') {
          market.outcomes.forEach((outcome: any) => {
            if (outcome.name === data.home_team) {
              if (outcome.price < markets.spreads.home.price) {
                markets.spreads.home = { price: outcome.price, point: outcome.point };
              }
            } else if (outcome.name === data.away_team) {
              if (outcome.price < markets.spreads.away.price) {
                markets.spreads.away = { price: outcome.price, point: outcome.point };
              }
            }
          });
        } else if (market.key === 'totals') {
          market.outcomes.forEach((outcome: any) => {
            if (outcome.name === 'Over') {
              if (outcome.price < markets.totals.over.price) {
                markets.totals.over = { price: outcome.price, point: outcome.point };
              }
            } else if (outcome.name === 'Under') {
              if (outcome.price < markets.totals.under.price) {
                markets.totals.under = { price: outcome.price, point: outcome.point };
              }
            }
          });
        }
      });
    });

    return markets;
  };

  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthed, setIsAuthed] = useState(() => {
    const stored = sessionStorage.getItem('adminAuthed');
    console.log('AdminSection: Initial auth check:', stored);
    return stored === 'true';
  });
  
  useEffect(() => {
    console.log('AdminSection: isAuthed changed:', isAuthed);
  }, [isAuthed]);
  const loadStoredUsers = () => {
    const stored = localStorage.getItem('users');
    if (stored) {
      try {
        return (JSON.parse(stored) as UserData[]).map(normalizeUserData);
      } catch (err) {
        console.error('Failed to parse users from localStorage', err);
      }
    }
    return [
      normalizeUserData(
        user || {
          username: 'lyleap',
          balance: 1000,
          spinsLeft: 5,
          lastSpinDate: '2026-01-23',
          history: [],
          predictions: [],
          exchanges: [],
          isBlacklisted: false,
          payoutRate: 1.0
        }
      ),
      normalizeUserData({
        username: 'jady',
        balance: 1000,
        spinsLeft: 5,
        lastSpinDate: '2026-01-23',
        history: [],
        predictions: [],
        exchanges: [],
        isBlacklisted: false,
        payoutRate: 1.0
      }),
      normalizeUserData({
        username: 'vannda',
        balance: 1000,
        spinsLeft: 5,
        lastSpinDate: '2026-01-23',
        history: [],
        predictions: [],
        exchanges: [],
        isBlacklisted: false,
        payoutRate: 1.0
      })
    ];
  };

  const [managedUsers, setManagedUsers] = useState<UserData[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [userLimit, setUserLimit] = useState(50);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [managedTransactions, setManagedTransactions] = useState<any[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [transactionPage, setTransactionPage] = useState(0);
  const [transactionLimit, setTransactionLimit] = useState(50);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const refreshUsers = async (reset = true) => {
    setLoadingUsers(true);
    const currentAdmin = sessionStorage.getItem('adminUser') || '';
    const page = reset ? 0 : userPage;
    
    try {
      const result = await loadAllUsers(userLimit, page * userLimit, currentAdmin, searchQuery);
      if (reset) {
        setManagedUsers(result.users);
        setUserPage(0);
      } else {
        setManagedUsers(prev => [...prev, ...result.users]);
      }
      setTotalUsers(result.total);
    } catch (err) {
      console.error('Failed to refresh users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadMoreUsers = () => {
    const nextPage = userPage + 1;
    setUserPage(nextPage);
    const currentAdmin = sessionStorage.getItem('adminUser') || '';
    
    setLoadingUsers(true);
    loadAllUsers(userLimit, nextPage * userLimit, currentAdmin, searchQuery).then(result => {
      setManagedUsers(prev => [...prev, ...result.users]);
      setTotalUsers(result.total);
      setLoadingUsers(false);
    });
  };

  const refreshTransactions = async (reset = true) => {
    setLoadingTransactions(true);
    const currentAdmin = sessionStorage.getItem('adminUser') || '';
    const page = reset ? 0 : transactionPage;
    
    try {
      const response = await fetch(`${API_BASE}?type=transactions&action=get&limit=${transactionLimit}&offset=${page * transactionLimit}&tts=${currentAdmin}&search=${encodeURIComponent(searchQuery)}`);
      const text = await response.text();
      
      if (text.includes('<?php')) {
        // Preview Mode Fallback: Flatten from managedUsers if available
        const flattened = managedUsers.flatMap(u => (u.exchanges || []).map(ex => ({ ...ex, username: u.username })));
        setManagedTransactions(flattened);
        setTotalTransactions(flattened.length);
        return;
      }

      const result = JSON.parse(text);
      if (reset) {
        setManagedTransactions(result.transactions);
        setTransactionPage(0);
      } else {
        setManagedTransactions(prev => [...prev, ...result.transactions]);
      }
      setTotalTransactions(result.total);
    } catch (err) {
      console.error('Failed to refresh transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'users') {
        refreshUsers(true);
      } else if (activeTab === 'transactions') {
        refreshTransactions(true);
      } else if (activeTab === 'betslips') {
        refreshBetslips(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab === 'users') {
      refreshUsers(true);
    } else if (activeTab === 'transactions') {
      refreshTransactions(true);
    } else if (activeTab === 'betslips') {
      refreshBetslips(true);
    } else if (activeTab === 'admins') {
      loadAdmins();
    }
  }, [activeTab]);

  const loadMoreTransactions = () => {
    const nextPage = transactionPage + 1;
    setTransactionPage(nextPage);
    const currentAdmin = sessionStorage.getItem('adminUser') || '';
    
    setLoadingTransactions(true);
    fetch(`${API_BASE}?type=transactions&action=get&limit=${transactionLimit}&offset=${nextPage * transactionLimit}&tts=${currentAdmin}&search=${encodeURIComponent(searchQuery)}`)
      .then(res => res.json())
      .then(result => {
        setManagedTransactions(prev => [...prev, ...result.transactions]);
        setTotalTransactions(result.total);
        setLoadingTransactions(false);
      })
      .catch(() => setLoadingTransactions(false));
  };

  useEffect(() => {
    const handleStorage = () => {
      refreshUsers();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleSaveSettings = async (e?: React.SyntheticEvent, newSettings?: any, newMatches?: Match[]) => {
    e?.preventDefault();
    const settingsToSave = newSettings || settings;
    if (!settingsToSave) {
      console.error('No settings to save');
      return;
    }
    
    const normalized = normalizeSettings(settingsToSave);
    setSettings(normalized);
    await persistSettings(normalized);

    if (newMatches || matches) {
      const matchesToSave = newMatches || matches;
      setMatches(matchesToSave);
      await saveMatchesToMySQL(matchesToSave);
    }

    if (e) {
      alert('Settings and matches saved successfully.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const normalizedUser = adminUser.trim().toLowerCase();
    
    try {
      const response = await fetch(`${API_BASE}?type=admin&action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: normalizedUser,
          password: adminPass
        })
      });

      const text = await response.text();

      // Preview Mode Fallback
      if (text.includes('<?php') || text.trim().startsWith('<!DOCTYPE')) {
        console.log('Preview Mode: Checking credentials locally');
        const localAdmins = JSON.parse(localStorage.getItem('preview_admins') || '[]');
        const admin = localAdmins.find((a: any) => a.username === normalizedUser && a.password === adminPass);
        
        // Default hardcoded fallback for teb/agents
        const isAgent = /^tt[a-z0-9]+$/.test(normalizedUser);
        if (admin || ((normalizedUser === 'teb' || isAgent) && adminPass === 'aaaa9999')) {
          sessionStorage.setItem('adminAuthed', 'true');
          sessionStorage.setItem('adminUser', normalizedUser);
          sessionStorage.setItem('adminRole', admin?.role || (normalizedUser === 'teb' ? 'superadmin' : 'agent'));
          setIsAuthed(true);
          setAuthError(''); // Clear any previous errors
          window.location.reload();
          return;
        }
        setAuthError('Invalid credentials (Preview Mode)');
        return;
      }

      try {
        const data = JSON.parse(text);
        if (response.ok && data.success) {
          sessionStorage.setItem('adminAuthed', 'true');
          sessionStorage.setItem('adminUser', data.username);
          sessionStorage.setItem('adminRole', data.role);
          setIsAuthed(true);
          setAuthError('');
          window.location.reload();
        } else {
          setAuthError(data.error || 'Invalid admin credentials');
        }
      } catch (e) {
        console.error('Failed to parse login response:', text);
        setAuthError('Server returned an invalid response');
      }
    } catch (err) {
      console.error('Admin login failed:', err);
      setAuthError('Connection error. Please try again.');
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim()) return;
    const normalized = newUsername.trim().toLowerCase();
    
    if (managedUsers.some(u => u.username.toLowerCase() === normalized)) {
      alert('User already exists');
      return;
    }

    const currentAdmin = sessionStorage.getItem('adminUser') || user?.username || 'admin';

    const newUser: UserData = {
      username: normalized,
      balance: 0,
      promotion_balance: 0,
      total_deposit: 0,
      spinsLeft: settings?.dailySpinLimit || 5,
      football_guess: settings?.dailyFootballLimit || 5,
      Get_monthly_reward: false,
      Claimed_Monthly: false,
      last_reset: new Date().toISOString(),
      lastSpinDate: new Date().toISOString().split('T')[0],
      history: [],
      predictions: [],
      exchanges: [],
      isBlacklisted: false,
      payoutRate: 1.0,
      dailyFootballLimit: settings?.dailyFootballLimit || 3,
      lastFootballDate: new Date().toISOString().split('T')[0],
      tts: currentAdmin
    };

    try {
      await persistUser(newUser);
      setManagedUsers(prev => [newUser, ...prev]);
      setSavedUsers(prev => [newUser, ...prev]);
      setNewUsername('');
      setShowCreateUserModal(false);
      alert(`User ${normalized} created successfully! Tied to TTS: ${currentAdmin}`);
    } catch (err) {
      console.error('Failed to create user:', err);
      alert('Failed to create user. Check console.');
    }
  };

  const updateDraftUser = (username: string, updates: Partial<UserData>) => {
    let nextUser: UserData | null = null;
    setManagedUsers(prev => {
      const next = prev.map(u => {
        if (u.username !== username) return u;
        nextUser = { ...u, ...updates } as UserData;
        return nextUser;
      });
      return next;
    });

    if (nextUser) {
      setSavedUsers(prev => prev.map(u => (u.username === username ? nextUser! : u)));
      persistUser(nextUser);
    }
  };

  const getSavedUser = (username: string) => savedUsers.find(u => u.username === username);

  const buildUserUpdates = (previous: UserData, current: UserData): Partial<UserData> => {
    const updates: Partial<UserData> = {};
    if (previous.balance !== current.balance) updates.balance = current.balance;
    if (previous.promotion_balance !== current.promotion_balance) updates.promotion_balance = current.promotion_balance;
    if (previous.total_deposit !== current.total_deposit) updates.total_deposit = current.total_deposit;
    if (previous.spinsLeft !== current.spinsLeft) updates.spinsLeft = current.spinsLeft;
    if (previous.football_guess !== current.football_guess) updates.football_guess = current.football_guess;
    if ((previous.payoutRate ?? 1) !== (current.payoutRate ?? 1)) updates.payoutRate = current.payoutRate;
    if ((previous.dailyFootballLimit ?? 0) !== (current.dailyFootballLimit ?? 0)) updates.dailyFootballLimit = current.dailyFootballLimit;
    if ((previous.isBlacklisted ?? false) !== (current.isBlacklisted ?? false)) updates.isBlacklisted = current.isBlacklisted;
    if ((previous.Get_monthly_reward ?? false) !== (current.Get_monthly_reward ?? false)) updates.Get_monthly_reward = current.Get_monthly_reward;
    if ((previous.Claimed_Monthly ?? false) !== (current.Claimed_Monthly ?? false)) updates.Claimed_Monthly = current.Claimed_Monthly;
    return updates;
  };

  const handleSaveUser = async (username: string) => {
    const current = managedUsers.find(u => u.username === username);
    if (!current) return;
    
    const saved = getSavedUser(username) || current;
    const updates = buildUserUpdates(saved, current);
    
    // Build history entry based on changes from last saved state
    const entry = buildAdminHistoryEntry(saved, updates);
    let updatedUser = { ...current };
    if (entry) {
      updatedUser = addHistoryEntry(updatedUser, entry);
    }

    // Update states immediately
    setManagedUsers(prev => prev.map(u => u.username === username ? updatedUser : u));
    setSavedUsers(prev => {
      const exists = prev.some(u => u.username === username);
      if (!exists) return [updatedUser, ...prev];
      return prev.map(u => (u.username === username ? updatedUser : u));
    });

    // Persist to localStorage and API
    try {
      if (user?.username === username) {
        await saveUser(updatedUser);
      } else {
        await persistUser(updatedUser);
      }
      alert(`User ${username} updated and saved to disk.`);
    } catch (err) {
      console.error('Failed to save user:', err);
      alert(`Failed to save user ${username}. Check console for details.`);
    }
  };

  const buildMatchLabel = (match: Match) => `${match.team1} vs ${match.team2}`;

  const isPredictionForMatch = (prediction: Prediction, match: Match, matchLabel: string) => {
    return (prediction.matchId && prediction.matchId === match.id) || prediction.match === matchLabel;
  };

  const normalizePredictionType = (prediction: Prediction) => prediction.type || 'winner';

  const getPredictionPayout = (match: Match, prediction: Prediction) => {
    const type = normalizePredictionType(prediction);
    if (type === 'winner') {
      if (prediction.team === match.team1) return match.payoutWinnerTeam1 ?? match.rewardAmount ?? 0;
      if (prediction.team === match.team2) return match.payoutWinnerTeam2 ?? match.rewardAmount ?? 0;
      return 0;
    }
    if (type === 'draw') return match.payoutDraw ?? match.rewardAmount ?? 0;
    if (type === 'exact') return match.payoutExact ?? match.rewardAmount ?? 0;
    if (type === 'hdp_1') return match.payoutUnder ?? match.rewardAmount ?? 0;
    if (type === 'hdp_2') return match.payoutOver ?? match.rewardAmount ?? 0;
    if (type === 'over') return match.payoutOver ?? match.rewardAmount ?? 0;
    if (type === 'under') return match.payoutUnder ?? match.rewardAmount ?? 0;
    if (type === 'total') return match.payoutTotal ?? match.rewardAmount ?? 0;
    return 0;
  };

  const isWinningPrediction = (match: Match, prediction: Prediction, winner: 'team1' | 'team2' | 'draw' | null, score1: number, score2: number) => {
    const type = normalizePredictionType(prediction);
    if (type === 'winner') {
      return prediction.team === (winner === 'team1' ? match.team1 : match.team2);
    }
    if (type === 'draw') {
      return winner === 'draw';
    }
    if (type === 'exact') {
      return Number(prediction.score1) === score1 && Number(prediction.score2) === score2;
    }
    const line = typeof prediction.line === 'number' ? prediction.line : (match.line ?? 0);
    if (type === 'hdp_1') {
      return (score1 - score2) > line;
    }
    if (type === 'hdp_2') {
      return (score1 - score2) < -line;
    }
    if (type === 'over') {
      return (score1 + score2) > line;
    }
    if (type === 'under') {
      return (score1 + score2) < line;
    }
    if (type === 'total') {
      return (score1 + score2) === line;
    }
    return false;
  };

  const getMatchStats = (match: Match) => {
    const team1Users: string[] = [];
    const team2Users: string[] = [];
    const drawUsers: string[] = [];
    const exactUsers: string[] = [];
    const hdp1Users: string[] = [];
    const hdp2Users: string[] = [];
    const overUsers: string[] = [];
    const underUsers: string[] = [];
    const totalUsers: string[] = [];
    const matchLabel = buildMatchLabel(match);

    managedUsers.forEach(u => {
      (u.predictions || []).forEach(prediction => {
        if (!isPredictionForMatch(prediction, match, matchLabel)) return;
        const type = normalizePredictionType(prediction);
        if (type === 'winner') {
          if (prediction.team === match.team1) team1Users.push(u.username);
          if (prediction.team === match.team2) team2Users.push(u.username);
        }
        if (type === 'draw') drawUsers.push(u.username);
        if (type === 'exact') exactUsers.push(u.username);
        if (type === 'hdp_1') hdp1Users.push(u.username);
        if (type === 'hdp_2') hdp2Users.push(u.username);
        if (type === 'over') overUsers.push(u.username);
        if (type === 'under') underUsers.push(u.username);
        if (type === 'total') totalUsers.push(u.username);
      });
    });

    const total = team1Users.length + team2Users.length + drawUsers.length + exactUsers.length + hdp1Users.length + hdp2Users.length + overUsers.length + underUsers.length + totalUsers.length;
    const buildItem = (label: string, users: string[], color: string) => ({
      label,
      users,
      count: users.length,
      percent: total ? Math.round((users.length / total) * 100) : 0,
      color
    });

    return {
      total,
      items: [
        buildItem(match.team1, team1Users, 'bg-blue-500'),
        buildItem(match.team2, team2Users, 'bg-orange-500'),
        buildItem('Draw', drawUsers, 'bg-slate-500'),
        buildItem('Exact', exactUsers, 'bg-emerald-500'),
        buildItem('HDP 1', hdp1Users, 'bg-indigo-500'),
        buildItem('HDP 2', hdp2Users, 'bg-cyan-500'),
        buildItem('Over', overUsers, 'bg-purple-500'),
        buildItem('Under', underUsers, 'bg-amber-500'),
        buildItem('Total', totalUsers, 'bg-rose-500')
      ]
    };
  };

  const settleMatchPredictions = async (match: Match): Promise<boolean> => {
    const winner = match.winner ?? null;
    const score1 = match.finalScore1;
    const score2 = match.finalScore2;
    if (!winner || typeof score1 !== 'number' || typeof score2 !== 'number') return false;
    if (match.awarded) return false;

    const matchLabel = buildMatchLabel(match);
    const updatedUsers: UserData[] = [];
    const nextUsers = managedUsers.map(u => {
      let payout = 0;
      (u.predictions || []).forEach(prediction => {
        if (!isPredictionForMatch(prediction, match, matchLabel)) return;
        if (!isWinningPrediction(match, prediction, winner, score1, score2)) return;
        payout += getPredictionPayout(match, prediction);
      });

      if (payout <= 0) return u;
      const updated = addHistoryEntry({ 
        ...u, 
        balance: u.balance + payout,
        promotion_balance: (u.promotion_balance || 0) + payout 
      }, `Football win: ${matchLabel} +$${payout}`);
      updatedUsers.push(updated);
      return updated;
    });

    setManagedUsers(nextUsers);
    if (updatedUsers.length === 0) {
      return true;
    }

    setSavedUsers(prev => prev.map(u => {
      const updated = updatedUsers.find(item => item.username === u.username);
      return updated ?? u;
    }));

    for (const updated of updatedUsers) {
      if (user?.username === updated.username) {
        await saveUser(updated);
      } else {
        await persistUser(updated);
      }
    }

    return true;
  };

  const handleSaveSingleMatch = async (match: Match) => {
    const success = await saveSingleMatch(match);
    if (success) {
      alert('Match updated successfully');
      if (sessionStorage.getItem('adminUser') === 'teb') {
        loadAllMatches();
      } else {
        loadSettings();
      }
    } else {
      alert('Failed to update match');
    }
  };

  const updateMatch = (matchId: number | string, updates: Partial<Match>) => {
    if (sessionStorage.getItem('adminUser') === 'teb') {
      setAllMatches(prev => prev.map(match =>
        match.id === matchId ? { ...match, ...updates } : match
      ));
    } else {
      const nextMatches = matches.map(match =>
        match.id === matchId ? { ...match, ...updates } : match
      );
      setSettings(prev => prev ? { ...prev, footballMatches: nextMatches } : null);
    }
  };

  const handleWinnerSelect = (matchId: number, winner: 'team1' | 'team2' | 'draw' | null) => {
    updateMatch(matchId, { winner, awarded: false });
  };

  const handleSetResult = async (match: Match) => {
    const settled = await settleMatchPredictions(match);
    if (!settled) return;
    const nextMatches = matches.map(item =>
      item.id === match.id ? { ...item, awarded: true } : item
    );
    handleSaveSettings(undefined, undefined, nextMatches);
  };

  const handleResetResult = (matchId: number) => {
    updateMatch(matchId, { winner: null, finalScore1: undefined, finalScore2: undefined, awarded: false });
  };

  const handleAddMatch = () => {
    const nextId = Math.max(0, ...matches.map(m => m.id)) + 1;
    const newMatch: Match = {
      id: nextId,
      team1: 'Team A',
      team2: 'Team B',
      team1_logo: '',
      team2_logo: '',
      rewardAmount: 10,
      line: 0,
      payoutWinnerTeam1: 10,
      payoutWinnerTeam2: 10,
      payoutExact: 10,
      payoutOver: 10,
      payoutUnder: 10,
      payoutTotal: 10,
      finalScore1: undefined,
      finalScore2: undefined,
      timeText: '',
      winner: null,
      awarded: false,
      color: 'from-slate-700 to-slate-900'
    };
    setPendingMatch(newMatch);
  };

  const confirmAddMatch = () => {
    if (!pendingMatch) return;
    handleSaveSettings(undefined, undefined, [pendingMatch, ...matches]);
    setPendingMatch(null);
  };

  const handleDeleteMatch = (matchId: number) => {
    const nextMatches = matches.filter(match => match.id !== matchId);
    handleSaveSettings(undefined, undefined, nextMatches);
  };

  const filteredTransactions = managedUsers
    .filter(u => {
      const currentAdmin = sessionStorage.getItem('adminUser');
      if (currentAdmin === 'teb') return true;
      return u.tts === currentAdmin;
    })
    .flatMap(u => u.exchanges || [])
    .filter(ex => 
      ex.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ex.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

  if (!isAuthed) {
    console.log('AdminSection: Rendering Login Form');
    return (
      <div className="fixed inset-0 z-[10000] bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
          <h2 className="text-2xl font-black mb-6 text-center">Admin Login</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-70">Username</label>
              <input
                type="text"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-70">Password</label>
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
            >
              Login
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-sm opacity-60 hover:opacity-100 transition-all"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10 bg-zinc-900">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black uppercase tracking-tighter">{t.admin}</h1>
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar max-w-[50vw] sm:max-w-[60vw] md:max-w-none">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              {t.users}
            </button>
            {sessionStorage.getItem('adminUser') === 'teb' && (
              <button
                onClick={() => {
                  setActiveTab('settings');
                  loadSettings();
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
              >
                {t.settings}
              </button>
            )}
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeTab === 'transactions' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              {t.transactions}
            </button>
            {sessionStorage.getItem('adminUser') === 'teb' && (
              <button
                onClick={() => {
                  setActiveTab('football');
                  loadAllMatches();
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeTab === 'football' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
              >
                Football
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('betslips');
                loadAllBetslips();
              }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeTab === 'betslips' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              Betslips
            </button>
            <button
              onClick={() => {
                setActiveTab('champion');
                loadChampionMatches();
                loadChampionPicks();
              }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 flex items-center gap-1.5 ${activeTab === 'champion' ? 'bg-amber-500 text-black' : 'text-white/40 hover:text-white'}`}
            >
              🏆 Worldcup
            </button>
            {sessionStorage.getItem('adminUser') === 'teb' && (
              <button
                onClick={() => {
                  setActiveTab('admins');
                  loadAdmins();
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeTab === 'admins' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
              >
                Admins
              </button>
            )}
            <button
              onClick={() => setActiveTab('excel')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 flex items-center gap-1.5 ${activeTab === 'excel' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-white/40 hover:text-white'}`}
            >
              <TableProperties size={14} />
              Excel
            </button>
            <button
              onClick={() => setActiveTab('depositBonus')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 flex items-center gap-1.5 ${activeTab === 'depositBonus' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-white/40 hover:text-white'}`}
            >
              💰 Deposit Bonus
            </button>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar min-h-0">
        <ErrorBoundary fallback={
          <div className="p-12 text-center bg-zinc-900 border border-white/5 rounded-[2.5rem] max-w-2xl mx-auto mt-12">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-4">Admin Panel Error</h2>
            <p className="text-white/40 font-medium mb-8">
              A rendering error occurred in this section. This is usually caused by corrupted or malformed data in the database.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all"
              >
                Reload Application
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-2xl font-black uppercase tracking-widest transition-all border border-white/5"
              >
                Go to Users Tab
              </button>
            </div>
          </div>
        }>
          {activeTab === 'users' && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={20} />
                <input
                  type="text"
                  placeholder={t.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  console.log('Admin: Opening Create User Modal');
                  setNewUsername('');
                  setShowCreateUserModal(true);
                }}
                className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg"
              >
                <Plus size={20} />
                Create User
              </button>
            </div>

            <div className="grid gap-4">
              {managedUsers.map(u => (
                <div key={u.username} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${u.isBlacklisted ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                      <Users size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{u.username}</h3>
                      <p className="text-sm text-white/40">Balance: ${u.balance} {u.tts && <span className="ml-2 text-blue-400/60">TTS: {u.tts}</span>}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 flex-[4]">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/40">Balance</label>
                      <input
                        type="number"
                        value={u.balance}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateDraftUser(u.username, { balance: val, promotion_balance: val });
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/40">Promo Bal</label>
                      <input
                        type="number"
                        value={u.promotion_balance}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateDraftUser(u.username, { balance: val, promotion_balance: val });
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/40">Deposit</label>
                      <input
                        type="number"
                        value={u.total_deposit}
                        onChange={(e) => updateDraftUser(u.username, { total_deposit: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/40">Payout Rate</label>
                      <input
                        type="number"
                        step="0.1"
                        value={u.payoutRate || 1.0}
                        onChange={(e) => updateDraftUser(u.username, { payoutRate: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/40">Spins</label>
                      <input
                        type="number"
                        value={u.spinsLeft}
                        onChange={(e) => updateDraftUser(u.username, { spinsLeft: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/40">Football</label>
                      <input
                        type="number"
                        value={u.football_guess}
                        onChange={(e) => updateDraftUser(u.username, { football_guess: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/40">Monthly</label>
                      <select
                        value={u.Get_monthly_reward ? 'true' : 'false'}
                        onChange={(e) => updateDraftUser(u.username, { Get_monthly_reward: e.target.value === 'true' })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/40">Claimed</label>
                      <select
                        value={u.Claimed_Monthly ? 'true' : 'false'}
                        onChange={(e) => updateDraftUser(u.username, { Claimed_Monthly: e.target.value === 'true' })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveUser(u.username)}
                      className="p-3 rounded-xl transition-all bg-green-500/20 text-green-300 hover:bg-green-500/40"
                      title="Save User"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      onClick={() => updateDraftUser(u.username, { isBlacklisted: !u.isBlacklisted })}
                      className={`p-3 rounded-xl transition-all ${u.isBlacklisted ? 'bg-red-500 text-white' : 'bg-white/5 text-white/40 hover:text-red-500'}`}
                      title="Blacklist"
                    >
                      <ShieldAlert size={20} />
                    </button>
                  </div>
                </div>
              ))}

              {managedUsers.length === 0 && !loadingUsers && (
                <div className="text-center py-12 text-white/20">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No users found.</p>
                </div>
              )}

              {managedUsers.length < totalUsers && (
                <div className="flex justify-center pt-6">
                  <button
                    onClick={loadMoreUsers}
                    disabled={loadingUsers}
                    className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingUsers ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ChevronRight size={20} className="rotate-90" />
                    )}
                    Load More ({managedUsers.length} / {totalUsers})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && !settings && (
          <div className="max-w-3xl mx-auto text-center py-24 text-white/40 space-y-4">
            <p>Settings not loaded.</p>
            <button
              type="button"
              onClick={loadSettings}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
            >
              Reload Settings
            </button>
          </div>
        )}

        {activeTab === 'settings' && settings && (() => {
          // --- Slot Odds Graph Logic ---
          const oddsEntries = Object.entries(settings.slotOdds).map(([key, range]) => ({
            key,
            label: range.start === 0 && range.end === 0
              ? 'No Win (0)'
              : `${range.start}–${range.end}`,
            start: range.start,
            end: range.end,
            chance: range.chance,
          }));
          const totalChance = oddsEntries.reduce((sum, e) => sum + e.chance, 0);

          const COLORS = [
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'
          ];

          const handleSliderChange = (index: number, newValue: number) => {
            const entries = [...oddsEntries];
            const oldValue = entries[index].chance;
            const delta = newValue - oldValue;
            if (delta === 0) return;

            entries[index].chance = newValue;

            // Distribute the difference proportionally across other entries
            const others = entries.filter((_, i) => i !== index);
            const othersTotal = others.reduce((s, e) => s + e.chance, 0);

            if (othersTotal > 0) {
              let remaining = -delta;
              others.forEach((entry, i) => {
                if (i === others.length - 1) {
                  // Last one gets whatever is left to ensure exact 100%
                  entry.chance = Math.max(0, entry.chance + remaining);
                } else {
                  const share = Math.round((entry.chance / othersTotal) * (-delta));
                  const adjusted = Math.max(0, entry.chance + share);
                  remaining -= (adjusted - entry.chance);
                  entry.chance = adjusted;
                }
              });
            }

            // Rebuild slotOdds from entries
            const newOdds: Record<string, { start: number; end: number; chance: number }> = {};
            entries.forEach(e => {
              newOdds[e.key] = { start: e.start, end: e.end, chance: Math.round(e.chance * 10) / 10 };
            });
            setSettings({ ...settings, slotOdds: newOdds });
          };

          // SVG line graph dimensions
          const graphW = 600;
          const graphH = 200;
          const padL = 45;
          const padR = 20;
          const padT = 20;
          const padB = 40;
          const plotW = graphW - padL - padR;
          const plotH = graphH - padT - padB;
          const maxChance = Math.max(...oddsEntries.map(e => e.chance), 10);
          const yScale = (v: number) => padT + plotH - (v / maxChance) * plotH;
          const xStep = oddsEntries.length > 1 ? plotW / (oddsEntries.length - 1) : plotW;
          const points = oddsEntries.map((e, i) => ({
            x: padL + i * xStep,
            y: yScale(e.chance),
          }));
          const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
          const areaPath = `${linePath} L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`;

          return (
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Slot Reward Distribution */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BarChart3 className="text-blue-500" />
                  Slot Reward Distribution
                </h2>
                <button
                  type="button"
                  onClick={() => handleSaveSettings()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all text-sm"
                >
                  <Save size={16} />
                  Save
                </button>
              </div>

              {/* Total indicator */}
              <div className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl ${
                Math.round(totalChance) === 100
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                <span>Total: {Math.round(totalChance * 10) / 10}%</span>
                {Math.round(totalChance) === 100
                  ? <CheckCircle2 size={16} />
                  : <AlertCircle size={16} />
                }
              </div>

              {/* Line Graph */}
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                <svg viewBox={`0 0 ${graphW} ${graphH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].filter(v => v <= maxChance + 10).map(v => (
                    <g key={v}>
                      <line x1={padL} y1={yScale(v)} x2={graphW - padR} y2={yScale(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                      <text x={padL - 8} y={yScale(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10">{v}%</text>
                    </g>
                  ))}

                  {/* Gradient fill under line */}
                  <defs>
                    <linearGradient id="graphGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#graphGrad)" />

                  {/* Line */}
                  <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                  {/* Data points + labels */}
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="5" fill={COLORS[i % COLORS.length]} stroke="#0a0a0a" strokeWidth="2" />
                      <text x={p.x} y={p.y - 12} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                        {oddsEntries[i].chance}%
                      </text>
                      <text x={p.x} y={padT + plotH + 16} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">
                        {oddsEntries[i].label}
                      </text>
                      <text x={p.x} y={padT + plotH + 28} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8">
                        coins
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              {/* Sliders */}
              <div className="space-y-4">
                {oddsEntries.map((entry, i) => (
                  <div key={entry.key} className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm font-bold text-white/80">
                          {entry.start === 0 && entry.end === 0 ? 'No Win (0 coins)' : `${entry.start}–${entry.end} coins`}
                        </span>
                      </div>
                      <span className="text-sm font-black tabular-nums" style={{ color: COLORS[i % COLORS.length] }}>
                        {entry.chance}%
                      </span>
                    </div>
                    <div className="relative">
                      <style>{`
                        .slot-slider-${i}::-webkit-slider-thumb {
                          appearance: none; width: 20px; height: 20px; border-radius: 50%;
                          background: ${COLORS[i % COLORS.length]}; border: 2px solid rgba(255,255,255,0.5);
                          cursor: grab; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                        }
                        .slot-slider-${i}::-moz-range-thumb {
                          width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.5);
                          background: ${COLORS[i % COLORS.length]}; cursor: grab; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                        }
                        .slot-slider-${i}:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.15); }
                        .slot-slider-${i}:active::-moz-range-thumb { cursor: grabbing; transform: scale(1.15); }
                      `}</style>
                      <div className="absolute inset-y-0 left-0 rounded-full h-2 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          width: `${entry.chance}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                          opacity: 0.3
                        }}
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.5"
                        value={entry.chance}
                        onChange={(e) => handleSliderChange(i, Number(e.target.value))}
                        className={`slot-slider-${i} w-full h-2 appearance-none bg-white/10 rounded-full cursor-pointer relative z-10`}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-white/20">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Settings */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <SettingsIcon className="text-blue-500" />
                General Settings
              </h2>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Daily Spins', key: 'dailySpinLimit' as const, value: settings.dailySpinLimit },
                    { label: 'Daily Football Limit', key: 'dailyFootballLimit' as const, value: settings.dailyFootballLimit },
                    { label: 'Default Bet Amount', key: 'defaultBetAmount' as const, value: settings.defaultBetAmount },
                    { label: 'Exchange Rate (coins/$1)', key: 'exchangeRate' as const, value: settings.exchangeRate },
                    { label: 'Min Exchange Amount', key: 'minExchangeAmount' as const, value: settings.minExchangeAmount },
                  ].map(field => (
                    <div key={field.key} className="flex justify-between items-center gap-4 bg-black/20 px-4 py-3 rounded-xl">
                      <span className="text-sm text-white/60">{field.label}</span>
                      <input
                        type="number"
                        value={field.value}
                        onChange={(e) => setSettings({ ...settings, [field.key]: Number(e.target.value) })}
                        className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-right text-sm font-bold"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveSettings()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all"
            >
              <Save size={20} />
              {t.save}
            </button>
          </div>
          );
        })()}

        {activeTab === 'football' && !settings && (
          <div className="max-w-3xl mx-auto text-center py-24 text-white/40 space-y-4">
            <p>Settings not loaded.</p>
            <button
              type="button"
              onClick={loadSettings}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
            >
              Reload Settings
            </button>
          </div>
        )}

        {activeTab === 'football' && sessionStorage.getItem('adminUser') === 'teb' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Trophy className="text-yellow-500" />
                  Odds API Matches
                </h2>
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                  <Clock size={18} className="text-blue-400" />
                  <span className="text-sm font-bold text-white/60">
                    {filteredMatches.length} Matches Found
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'playing', label: 'Playing' },
                  { id: 'today', label: 'Today' },
                  { id: 'tomorrow', label: 'Tomorrow' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFootballFilter(f.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      footballFilter === f.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingMatches ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-white/40 font-medium">Fetching latest odds...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredMatches.map((match) => {
                  const countdown = getCountdown(match.commence_time);
                  const isStarted = countdown === 'Started';

                  return (
                    <div 
                      key={match.id}
                      className={`group relative bg-zinc-900/50 border transition-all duration-300 rounded-[2rem] p-6 flex items-center gap-6 ${
                        match.visibility ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      {/* Visibility Toggle */}
                      <button
                        onClick={() => handleToggleVisibility(match.id, !!match.visibility)}
                        className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                          match.visibility 
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                            : 'bg-white/5 text-white/20 hover:bg-white/10'
                        }`}
                      >
                        {match.visibility ? <CheckSquare size={24} /> : <Square size={24} />}
                      </button>

                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                            <Calendar size={12} className="text-white/40" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                              {match.league || match.sport_key || 'Unknown League'}
                            </span>
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            isStarted ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            <Clock size={12} />
                            {countdown}
                          </div>
                        </div>

                          <div className="flex flex-col items-center gap-3 flex-1">
                            <div className="relative group/logo w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden border border-white/5">
                              {match.team1_logo ? (
                                <img src={normalizeLogoUrl(match.team1_logo)} alt="" className="w-8 h-8 object-contain" />
                              ) : (
                                <Trophy size={20} className="text-white/10" />
                              )}
                              <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer">
                                <Camera size={16} className="text-white" />
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleLogoUpload(match.id, 1, file);
                                  }}
                                />
                              </label>
                            </div>
                            <div className="text-center">
                              <span className="text-sm font-bold line-clamp-1 mb-2">{match.team1 || match.home_team}</span>
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  value={match.finalScore1 ?? ''}
                                  placeholder="0"
                                  onChange={(e) => updateMatch(match.id, { finalScore1: e.target.value === '' ? undefined : Number(e.target.value) })}
                                  className="w-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-sm font-bold focus:border-blue-500 outline-none transition-colors"
                                />
                                <button 
                                  onClick={() => handleSaveSingleMatch(match)}
                                  className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all"
                                  title="Save Score"
                                >
                                  <Save size={14} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-center justify-center">
                            <div className="text-xs font-black text-white/10 uppercase italic">VS</div>
                          </div>

                          <div className="flex flex-col items-center gap-3 flex-1">
                            <div className="relative group/logo w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden border border-white/5">
                              {match.team2_logo ? (
                                <img src={normalizeLogoUrl(match.team2_logo)} alt="" className="w-8 h-8 object-contain" />
                              ) : (
                                <Trophy size={20} className="text-white/10" />
                              )}
                              <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer">
                                <Camera size={16} className="text-white" />
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleLogoUpload(match.id, 2, file);
                                  }}
                                />
                              </label>
                            </div>
                            <div className="text-center">
                              <span className="text-sm font-bold line-clamp-1 mb-2">{match.team2 || match.away_team}</span>
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  value={match.finalScore2 ?? ''}
                                  placeholder="0"
                                  onChange={(e) => updateMatch(match.id, { finalScore2: e.target.value === '' ? undefined : Number(e.target.value) })}
                                  className="w-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-sm font-bold focus:border-blue-500 outline-none transition-colors"
                                />
                                <button 
                                  onClick={() => handleSaveSingleMatch(match)}
                                  className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all"
                                  title="Save Score"
                                >
                                  <Save size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                      </div>

                      {/* Status Indicator */}
                      <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${
                        match.visibility ? 'bg-blue-500 animate-pulse' : 'bg-white/10'
                      }`} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'football' && sessionStorage.getItem('adminUser') !== 'teb' && settings && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Trophy className="text-yellow-500" />
                  Football Matches
                </h2>
                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'playing', label: 'Playing' },
                    { id: 'today', label: 'Today' },
                    { id: 'tomorrow', label: 'Tomorrow' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFootballFilter(f.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        footballFilter === f.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                          : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowFootballPercent(prev => !prev)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold flex items-center gap-2"
                >
                  <BarChart3 size={16} />
                  {showFootballPercent ? 'Show Counts' : 'Show %'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFootballUsers(prev => !prev)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold"
                >
                  {showFootballUsers ? 'Hide Users' : 'Show Users'}
                </button>
                <button
                  type="button"
                  onClick={handleAddMatch}
                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Match
                </button>
              </div>
            </div>

            <div className="grid gap-6">
              {filteredStandardMatches.map(match => {
                const stats = getMatchStats(match);
                return (
                  <div key={match.id} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <h3 className="text-lg font-bold">{match.team1} vs {match.team2}</h3>
                          <div className="flex items-center gap-2 text-xs text-white/40">
                            <Clock size={12} />
                            {match.timeText || 'No time set'}
                            {match.commence_time && (
                              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                                {new Date(match.commence_time).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-black text-white/20 uppercase">Scores</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={match.finalScore1 ?? ''}
                              placeholder="0"
                              onChange={(e) => updateMatch(match.id, { finalScore1: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-sm font-bold"
                            />
                            <span className="text-white/20 font-black">:</span>
                            <input
                              type="number"
                              value={match.finalScore2 ?? ''}
                              placeholder="0"
                              onChange={(e) => updateMatch(match.id, { finalScore2: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-12 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-sm font-bold"
                            />
                            <button
                              onClick={() => handleSaveSingleMatch(match)}
                              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg shadow-blue-600/20 ml-2"
                              title="Save Score"
                            >
                              <Save size={16} />
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMatch(match.id as number)}
                          className="text-red-500 hover:text-red-400 p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Team 1</label>
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={match.team1}
                            onChange={(e) => updateMatch(match.id, { team1: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                            placeholder="Team 1 Name"
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] text-white/20 uppercase font-black">Score:</label>
                            <input
                              type="number"
                              value={match.finalScore1 ?? ''}
                              placeholder="0"
                              onChange={(e) => updateMatch(match.id, { finalScore1: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-16 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1 text-center text-sm font-bold text-blue-400"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={match.team1_logo || ''}
                          onChange={(e) => updateMatch(match.id, { team1_logo: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs"
                          placeholder="Team 1 Logo URL"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Team 2</label>
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={match.team2}
                            onChange={(e) => updateMatch(match.id, { team2: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                            placeholder="Team 2 Name"
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] text-white/20 uppercase font-black">Score:</label>
                            <input
                              type="number"
                              value={match.finalScore2 ?? ''}
                              placeholder="0"
                              onChange={(e) => updateMatch(match.id, { finalScore2: e.target.value === '' ? undefined : Number(e.target.value) })}
                              className="w-16 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1 text-center text-sm font-bold text-blue-400"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={match.team2_logo || ''}
                          onChange={(e) => updateMatch(match.id, { team2_logo: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs"
                          placeholder="Team 2 Logo URL"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Match Timing</label>
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-white/20 uppercase">Display Text (e.g. "Tonight 8pm")</span>
                            <input
                              type="text"
                              value={match.timeText || ''}
                              onChange={(e) => updateMatch(match.id, { timeText: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                              placeholder="Tonight 8pm"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-white/20 uppercase">Machine Time (For Filters)</span>
                            <input
                              type="datetime-local"
                              value={match.commence_time ? new Date(new Date(match.commence_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                              onChange={(e) => updateMatch(match.id, { commence_time: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout Winner (Team 1)</label>
                        <input
                          type="number"
                          value={match.payoutWinnerTeam1 ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutWinnerTeam1: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout Winner (Team 2)</label>
                        <input
                          type="number"
                          value={match.payoutWinnerTeam2 ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutWinnerTeam2: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout Draw</label>
                        <input
                          type="number"
                          value={match.payoutDraw ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutDraw: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout Exact Score</label>
                        <input
                          type="number"
                          value={match.payoutExact ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutExact: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout Over</label>
                        <input
                          type="number"
                          value={match.payoutOver ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutOver: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout Under</label>
                        <input
                          type="number"
                          value={match.payoutUnder ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutUnder: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout HDP 1</label>
                        <input
                          type="number"
                          value={match.payoutHdp1 ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutHdp1: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout HDP 2</label>
                        <input
                          type="number"
                          value={match.payoutHdp2 ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutHdp2: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">Payout Total (O/U Line)</label>
                        <input
                          type="number"
                          value={match.payoutTotal ?? match.rewardAmount ?? 0}
                          onChange={(e) => updateMatch(match.id, { payoutTotal: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-white/40">HDP Line</label>
                        <input
                          type="number"
                          value={match.hdpLine ?? 0}
                          onChange={(e) => updateMatch(match.id, { hdpLine: Number(e.target.value) })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-white/60">Winner</label>
                        <select
                          value={match.winner ?? ''}
                          onChange={(e) => handleWinnerSelect(match.id, (e.target.value || null) as 'team1' | 'team2' | 'draw' | null)}
                          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm"
                        >
                          <option value="">Not set</option>
                          <option value="team1">{match.team1}</option>
                          <option value="team2">{match.team2}</option>
                          <option value="draw">Draw</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-white/60">Final Score</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={match.finalScore1 ?? ''}
                            onChange={(e) => updateMatch(match.id, { finalScore1: Number(e.target.value) })}
                            className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            placeholder="0"
                          />
                          <span className="text-white/40">:</span>
                          <input
                            type="number"
                            min={0}
                            value={match.finalScore2 ?? ''}
                            onChange={(e) => updateMatch(match.id, { finalScore2: Number(e.target.value) })}
                            className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSetResult(match)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                      >
                        Set Result & Award
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetResult(match.id)}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-sm font-semibold"
                      >
                        Reset Result
                      </button>
                      {match.awarded && (
                        <span className="text-xs font-semibold text-green-400">Winners awarded</span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-white/60">Predictions</div>
                      {stats.items.map(item => (
                        <div key={item.label} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>{item.label}</span>
                            <span className="text-white/60">
                              {showFootballPercent ? `${item.percent}%` : `${item.count} users`}
                            </span>
                          </div>
                          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${item.color}`}
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                          {showFootballUsers && item.users.length > 0 && (
                            <div className="text-xs text-white/50">{item.users.join(', ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all"
            >
              <Save size={20} />
              Save Football Settings
            </button>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="max-w-6xl mx-auto space-y-6 pb-32 overflow-y-auto custom-scrollbar">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={20} />
              <input
                type="text"
                placeholder="Search by Username or Unique ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-white/5 text-white/40 text-[10px] uppercase font-black tracking-widest">
                    <th className="p-6">ID</th>
                    <th className="p-6">Username</th>
                    <th className="p-6">Coins</th>
                    <th className="p-6">Dollars</th>
                    <th className="p-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {managedTransactions.map((ex, idx) => (
                    <tr key={`${ex.id}-${idx}`} className="hover:bg-white/5 transition-all">
                      <td className="p-6 font-mono text-xs text-blue-400">{ex.id}</td>
                      <td className="p-6 font-bold">{ex.username}</td>
                      <td className="p-6 text-yellow-500 font-bold">{ex.amount}</td>
                      <td className="p-6 text-green-400 font-bold">${ex.dollars}</td>
                      <td className="p-6 text-white/40 text-sm">{ex.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {managedTransactions.length === 0 && !loadingTransactions && (
                <div className="p-12 text-center text-white/20 italic">No transactions found</div>
              )}
              
              {loadingTransactions && managedTransactions.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
                </div>
              )}
            </div>

            {managedTransactions.length < totalTransactions && (
              <div className="flex justify-center pt-6">
                <button
                  onClick={loadMoreTransactions}
                  disabled={loadingTransactions}
                  className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingTransactions ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ChevronRight size={20} className="rotate-90" />
                  )}
                  Load More ({managedTransactions.length} / {totalTransactions})
                </button>
              </div>
            )}
          </div>
        )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>

      {pendingMatch && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Confirm New Match</h2>
              <button onClick={() => setPendingMatch(null)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Team 1 Name</label>
                <input
                  type="text"
                  value={pendingMatch.team1}
                  onChange={(e) => setPendingMatch({ ...pendingMatch, team1: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Team 2 Name</label>
                <input
                  type="text"
                  value={pendingMatch.team2}
                  onChange={(e) => setPendingMatch({ ...pendingMatch, team2: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Team 1 Logo URL</label>
                <input
                  type="text"
                  value={pendingMatch.team1_logo || ''}
                  onChange={(e) => setPendingMatch({ ...pendingMatch, team1_logo: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Team 2 Logo URL</label>
                <input
                  type="text"
                  value={pendingMatch.team2_logo || ''}
                  onChange={(e) => setPendingMatch({ ...pendingMatch, team2_logo: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Reward Amount ($)</label>
                <input
                  type="number"
                  value={pendingMatch.rewardAmount}
                  onChange={(e) => setPendingMatch({ ...pendingMatch, rewardAmount: Number(e.target.value) })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Display Time (Text)</label>
                <input
                  type="text"
                  value={pendingMatch.timeText || ''}
                  onChange={(e) => setPendingMatch({ ...pendingMatch, timeText: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Tonight 8:00 PM"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Machine Time (For Filters)</label>
                <input
                  type="datetime-local"
                  value={pendingMatch.commence_time ? new Date(new Date(pendingMatch.commence_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setPendingMatch({ ...pendingMatch, commence_time: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-white"
                />
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button
                onClick={() => setPendingMatch(null)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddMatch}
                className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={20} />
                Confirm & Add Match
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'matches' && sessionStorage.getItem('adminUser') === 'teb' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Match Management</h2>
              <p className="text-white/40 text-sm font-medium">Toggle visibility for users and view upcoming matches</p>
            </div>
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <Trophy size={18} className="text-blue-400" />
              <span className="text-sm font-bold">{allMatches.length} Total Matches</span>
            </div>
          </div>

          <div className="grid gap-4">
            {loadingMatches ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-white/40 font-bold animate-pulse">Fetching matches from MySQL...</p>
              </div>
            ) : allMatches.length === 0 ? (
              <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                  <Calendar size={32} className="text-white/20" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">No matches found</h3>
                  <p className="text-white/40 text-sm">Matches will appear here once they are synced from the API.</p>
                </div>
              </div>
            ) : (
              allMatches.map((match) => {
                const getTimeRemaining = (commenceTime?: string) => {
                  if (!commenceTime) return 'Time TBD';
                  const now = new Date();
                  const start = new Date(commenceTime);
                  const diff = start.getTime() - now.getTime();
                  
                  if (diff <= 0) return 'Started';
                  
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  
                  if (days > 0) {
                    return `In ${days}D, ${hours}h ${minutes}m`;
                  }
                  return `In ${hours}h ${minutes}m`;
                };

                const handleToggle = async () => {
                  const success = await toggleMatchVisibility(match.id, !match.visibility);
                  if (success) {
                    setAllMatches(prev => prev.map(m => 
                      m.id === match.id ? { ...m, visibility: !m.visibility } : m
                    ));
                  }
                };

                const odds = getLowestOdds(match.raw_json);

                return (
                  <div 
                    key={match.id}
                    className={`group relative bg-zinc-900/50 border transition-all duration-300 rounded-[2rem] p-6 flex flex-col gap-6 ${
                      match.visibility ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={handleToggle}
                        className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                          match.visibility 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                            : 'bg-white/5 text-white/20 hover:bg-white/10 hover:text-white/40'
                        }`}
                      >
                        {match.visibility ? <CheckSquare size={24} /> : <Square size={24} />}
                      </button>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-3">
                            <div className="w-10 h-10 rounded-full bg-white/5 border-2 border-zinc-900 flex items-center justify-center overflow-hidden">
                              {match.team1_logo ? <img src={normalizeLogoUrl(match.team1_logo)} className="w-6 h-6 object-contain" /> : <div className="w-4 h-4 bg-white/10 rounded-full" />}
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/5 border-2 border-zinc-900 flex items-center justify-center overflow-hidden">
                              {match.team2_logo ? <img src={normalizeLogoUrl(match.team2_logo)} className="w-6 h-6 object-contain" /> : <div className="w-4 h-4 bg-white/10 rounded-full" />}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black uppercase tracking-tight">{match.team1}</span>
                              <span className="text-[10px] font-bold text-white/20">VS</span>
                              <span className="text-sm font-black uppercase tracking-tight">{match.team2}</span>
                            </div>
                            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{match.league || 'Unknown League'}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-center">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
                            <Clock size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-white/80">{getTimeRemaining(match.commence_time)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-4">
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Status</div>
                            <div className={`text-xs font-black uppercase ${match.visibility ? 'text-blue-400' : 'text-white/20'}`}>
                              {match.visibility ? 'Visible to Users' : 'Hidden'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {odds && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
                        {/* H2H */}
                        <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Win/Draw/Lose (H2H)</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-black/40 rounded-xl p-2 text-center">
                              <div className="text-[8px] text-white/40 uppercase">Home</div>
                              <div className="text-xs font-black text-blue-400">{odds.h2h.home === Infinity ? '-' : odds.h2h.home}</div>
                            </div>
                            <div className="bg-black/40 rounded-xl p-2 text-center">
                              <div className="text-[8px] text-white/40 uppercase">Draw</div>
                              <div className="text-xs font-black text-blue-400">{odds.h2h.draw === Infinity ? '-' : odds.h2h.draw}</div>
                            </div>
                            <div className="bg-black/40 rounded-xl p-2 text-center">
                              <div className="text-[8px] text-white/40 uppercase">Away</div>
                              <div className="text-xs font-black text-blue-400">{odds.h2h.away === Infinity ? '-' : odds.h2h.away}</div>
                            </div>
                          </div>
                        </div>

                        {/* Spreads */}
                        <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Handicap (HDP)</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/40 rounded-xl p-2 text-center">
                              <div className="text-[8px] text-white/40 uppercase">Home ({odds.spreads.home.point > 0 ? '+' : ''}{odds.spreads.home.point})</div>
                              <div className="text-xs font-black text-blue-400">{odds.spreads.home.price === Infinity ? '-' : odds.spreads.home.price}</div>
                            </div>
                            <div className="bg-black/40 rounded-xl p-2 text-center">
                              <div className="text-[8px] text-white/40 uppercase">Away ({odds.spreads.away.point > 0 ? '+' : ''}{odds.spreads.away.point})</div>
                              <div className="text-xs font-black text-blue-400">{odds.spreads.away.price === Infinity ? '-' : odds.spreads.away.price}</div>
                            </div>
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Over/Under</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/40 rounded-xl p-2 text-center">
                              <div className="text-[8px] text-white/40 uppercase">Over {odds.totals.over.point}</div>
                              <div className="text-xs font-black text-blue-400">{odds.totals.over.price === Infinity ? '-' : odds.totals.over.price}</div>
                            </div>
                            <div className="bg-black/40 rounded-xl p-2 text-center">
                              <div className="text-[8px] text-white/40 uppercase">Under {odds.totals.under.point}</div>
                              <div className="text-xs font-black text-blue-400">{odds.totals.under.price === Infinity ? '-' : odds.totals.under.price}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'betslips' && (
        <ErrorBoundary fallback={
          <div className="p-12 text-center bg-red-500/10 border border-red-500/20 rounded-3xl">
            <h3 className="text-xl font-black text-red-500 uppercase">Rendering Error</h3>
            <p className="text-white/60 mt-2">There was a problem displaying the betslips. Some data might be corrupted.</p>
            <button 
              onClick={() => refreshBetslips(true)}
              className="mt-6 px-6 py-2 bg-red-500 text-white font-bold rounded-xl"
            >
              Retry Loading
            </button>
          </div>
        }>
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 overflow-y-auto custom-scrollbar">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Betslip Management</h2>
                <p className="text-white/40 text-sm font-medium">Update status for user betslips and individual matches</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  <input
                    type="text"
                    placeholder="Search Receipt ID or Username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && refreshBetslips(true)}
                    className="bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-all"
                  />
                </div>
                <button 
                  onClick={() => refreshBetslips(true)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all"
                  title="Refresh Betslips"
                >
                  <Clock size={20} className={loadingBetslips ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="grid gap-6">
              {allBetslips.length === 0 && !loadingBetslips ? (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
                  <Receipt size={48} className="text-white/10" />
                  <p className="text-white/40 font-medium">No betslips found.</p>
                </div>
              ) : (
                <>
                  {(Array.isArray(allBetslips) ? allBetslips : []).map((slip, slipIdx) => {
                    if (!slip || typeof slip !== 'object') return null;
                    
                    return (
                      <ErrorBoundary key={slip.receipt_id || slipIdx} fallback={<div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-[10px] text-red-500 font-bold uppercase">Slip #{slip.receipt_id} failed to render</div>}>
                        <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] overflow-hidden">
                          <div className="p-6 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400">
                                <Receipt size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-black text-white">{String(slip.receipt_id || 'N/A')}</span>
                                  <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full text-white/40 font-bold uppercase tracking-widest">
                                    {slip.created_at && !isNaN(new Date(slip.created_at).getTime()) ? new Date(slip.created_at).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-white/40">
                                  <UserIcon size={14} />
                                  <span className="font-bold">{String(slip.username || 'Unknown')}</span>
                                  <span className="mx-1">•</span>
                                  <span>{Number(slip.match_quantity || 0)} Matches</span>
                                  <span className="mx-1">•</span>
                                  <span className="text-yellow-500 font-black">@{Number(slip.total_odd || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <select 
                                value={String(slip.status || 'ACCEPTED')}
                                onChange={async (e) => {
                                  const newStatus = e.target.value;
                                  const success = await updateBetslipStatus(slip.receipt_id, newStatus);
                                  if (success) {
                                    setAllBetslips(prev => prev.map(s => s.receipt_id === slip.receipt_id ? { ...s, status: newStatus } : s));
                                  }
                                }}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="ACCEPTED">ACCEPTED</option>
                                <option value="Win All">Win All</option>
                                <option value="Win Half">Win Half</option>
                                <option value="Lose All">Lose All</option>
                                <option value="Lose half">Lose half</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                              <a 
                                href={`https://db.7fun7-api.online/receipt.php?id=${slip.receipt_id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/40 hover:text-white transition-all"
                              >
                                <Printer size={18} />
                              </a>
                            </div>
                          </div>

                          <div className="p-6 bg-black/20">
                            <div className="space-y-4">
                              {getSafeMatches(slip.matches).map((match: any, idx: number) => {
                                if (!match || typeof match !== 'object') return null;
                                return (
                                  <div key={idx} className="flex items-center justify-between gap-4 group">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-[10px] font-black text-white/20">
                                        {idx + 1}
                                      </div>
                                      <div>
                                        <div className="text-xs font-black uppercase tracking-tight text-white/80">{String(match.matchName || 'Unknown Match')}</div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-blue-400">{String(match.selection || 'N/A')}</span>
                                          {match.type && (
                                            <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-white/40 font-black uppercase tracking-widest">
                                              {String(match.type).replace('_', ' ') || 'N/A'}
                                            </span>
                                          )}
                                          {match.line !== undefined && match.line !== 0 && (
                                            <span className="text-[8px] px-1.5 py-0.5 bg-yellow-500/10 rounded text-yellow-500 font-black uppercase tracking-widest">
                                              L: {String(match.line)}
                                            </span>
                                          )}
                                          <span className="text-[10px] font-black text-white/20 ml-1">@{Number(match.odd || 0).toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <select 
                                      value={String(match.status || 'ACCEPTED')}
                                      onChange={async (e) => {
                                        const newMatchStatus = e.target.value;
                                        const currentMatches = getSafeMatches(slip.matches);
                                        const updatedMatches = [...currentMatches];
                                        updatedMatches[idx] = { ...match, status: newMatchStatus };
                                        
                                        const success = await updateBetslipStatus(slip.receipt_id, slip.status, updatedMatches);
                                        if (success) {
                                          setAllBetslips(prev => prev.map(s => s.receipt_id === slip.receipt_id ? { ...s, matches: updatedMatches } : s));
                                        }
                                      }}
                                      className="bg-black/60 border border-white/5 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                      <option value="ACCEPTED">ACCEPTED</option>
                                      <option value="Win All">Win All</option>
                                      <option value="Win Half">Win Half</option>
                                      <option value="Lose All">Lose All</option>
                                      <option value="Lose half">Lose half</option>
                                      <option value="Draw">Draw</option>
                                      <option value="Rejected">Rejected</option>
                                      <option value="Cancelled">Cancelled</option>
                                    </select>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </ErrorBoundary>
                    );
                  })}

                  {allBetslips.length < totalBetslips && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={loadMoreBetslips}
                        disabled={loadingBetslips}
                        className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-white/60 hover:text-white transition-all flex items-center gap-3 disabled:opacity-50"
                      >
                        {loadingBetslips ? (
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                        Load More Betslips ({allBetslips.length} / {totalBetslips})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </ErrorBoundary>
      )}

      {activeTab === 'excel' && (
        <ExcelSection />
      )}

      {/* ── Deposit Bonus Milestones Tab ── */}
      {activeTab === 'depositBonus' && (
        <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-500">

          {/* Header */}
          <div>
            <h3 className="text-2xl font-black flex items-center gap-2">
              💰 Deposit Bonus Milestones
            </h3>
            <p className="text-white/40 text-sm mt-1">
              Set the coin reward range for each deposit milestone ($). When a user's
              Deposit_progress reaches a milestone, their arrow glows. On click they
              receive a random amount between Min and Max (added to their coin balance).
            </p>
          </div>

          {/* Table */}
          <div className="bg-white/5 rounded-[2rem] border border-white/10 overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-3 border-b border-white/10">
              <div className="p-4 text-xs font-black uppercase tracking-widest text-white/30">
                Milestone ($)
              </div>
              <div className="p-4 text-xs font-black uppercase tracking-widest text-white/30">
                Min Reward (coins)
              </div>
              <div className="p-4 text-xs font-black uppercase tracking-widest text-white/30">
                Max Reward (coins)
              </div>
            </div>

            {/* Milestone rows */}
            {[10, 25, 100, 500, 1000].map((milestone) => {
              const ranges = settings?.depositBonusRanges ?? {};
              const range  = ranges[milestone.toString()] ?? { min: 5, max: 15 };
              return (
                <div
                  key={milestone}
                  className="grid grid-cols-3 border-b border-white/5 hover:bg-white/5 transition-all last:border-0"
                >
                  {/* Milestone label */}
                  <div className="p-4 flex items-center">
                    <span className="font-black text-yellow-400 text-xl">
                      ${milestone.toLocaleString()}
                    </span>
                  </div>

                  {/* Min input */}
                  <div className="p-4 flex items-center">
                    <input
                      type="number"
                      value={range.min}
                      min={0}
                      onChange={e => {
                        const newRanges = {
                          ...(settings?.depositBonusRanges ?? {}),
                          [milestone.toString()]: {
                            ...range,
                            min: Math.max(0, Number(e.target.value))
                          }
                        };
                        if (settings) setSettings({ ...settings, depositBonusRanges: newRanges });
                      }}
                      className="w-28 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-yellow-500 transition-all"
                    />
                  </div>

                  {/* Max input */}
                  <div className="p-4 flex items-center">
                    <input
                      type="number"
                      value={range.max}
                      min={0}
                      onChange={e => {
                        const newRanges = {
                          ...(settings?.depositBonusRanges ?? {}),
                          [milestone.toString()]: {
                            ...range,
                            max: Math.max(0, Number(e.target.value))
                          }
                        };
                        if (settings) setSettings({ ...settings, depositBonusRanges: newRanges });
                      }}
                      className="w-28 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-yellow-500 transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Example preview */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
            <p className="text-[10px] uppercase font-black tracking-widest text-white/30 mb-2">
              Preview — current ranges
            </p>
            <div className="flex flex-wrap gap-2">
              {[10, 25, 100, 500, 1000].map((m) => {
                const r = (settings?.depositBonusRanges ?? {})[m.toString()] ?? { min: 5, max: 15 };
                return (
                  <div
                    key={m}
                    className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5"
                  >
                    <span className="font-black text-yellow-400 text-xs">${m}</span>
                    <span className="text-white/30 text-xs">→</span>
                    <span className="text-white/70 text-xs font-bold">{r.min}–{r.max} coins</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSaveSettings}
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl transition-all shadow-xl shadow-yellow-500/20 flex items-center gap-2"
          >
            <Save size={18} />
            Save Deposit Bonus Settings
          </button>
        </div>
      )}

      {/* ── Champion / Worldcup Tab ─────────────────────────────────────────── */}
      {activeTab === 'champion' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto pb-32">

          {/* Header + Messages */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
                🏆 World Cup Matches
              </h2>
              <p className="text-white/40 text-sm font-medium mt-0.5">
                Create matches, set team logos, declare winners and trigger payouts
              </p>
            </div>
            <button
              onClick={() => {
                setChampionError('');
                setPendingLogoFiles({});
                setLogoPreviewUrls({});
                setPendingChampionMatch({ team1: '', team2: '', payout: 10, visibility: true });
              }}
              className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-amber-500/30 text-sm"
            >
              <Plus size={18} />
              New Match
            </button>
          </div>

          {championSaveMsg && (
            <div className="px-4 py-3 bg-emerald-500/20 text-emerald-300 rounded-2xl text-sm font-bold border border-emerald-500/30 flex items-center gap-2">
              <CheckCircle2 size={16} /> {championSaveMsg}
            </div>
          )}
          {championError && (
            <div className="px-4 py-3 bg-red-500/20 text-red-300 rounded-2xl text-sm font-bold border border-red-500/30 flex items-center gap-2">
              <AlertCircle size={16} /> {championError}
            </div>
          )}

          {/* New / Edit Match Form */}
          {pendingChampionMatch && (
            <div className="bg-zinc-900/80 border border-amber-500/30 rounded-[2rem] p-6 space-y-5 shadow-xl shadow-amber-500/5">
              <h3 className="font-black text-lg text-amber-300">
                {pendingChampionMatch.id ? 'Edit Match' : 'New Match'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40">Team 1 Name *</label>
                  <input
                    type="text"
                    value={pendingChampionMatch.team1 ?? ''}
                    onChange={e => setPendingChampionMatch(p => ({ ...p!, team1: e.target.value }))}
                    placeholder="e.g. Brazil"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40">Team 2 Name *</label>
                  <input
                    type="text"
                    value={pendingChampionMatch.team2 ?? ''}
                    onChange={e => setPendingChampionMatch(p => ({ ...p!, team2: e.target.value }))}
                    placeholder="e.g. Argentina"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                {/* Team 1 Logo — drag & drop */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40">Team 1 Logo</label>
                  <div
                    onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).setAttribute('data-drag', 'true'); }}
                    onDragLeave={e => { (e.currentTarget as HTMLDivElement).removeAttribute('data-drag'); }}
                    onDrop={e => {
                      e.preventDefault();
                      (e.currentTarget as HTMLDivElement).removeAttribute('data-drag');
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleLogoDrop('team1', file);
                    }}
                    onClick={() => openLogoPicker('team1')}
                    className="relative w-full bg-black/40 border-2 border-dashed border-white/10 hover:border-amber-500/60 data-[drag]:border-amber-500 rounded-xl p-4 cursor-pointer transition-all flex flex-col items-center gap-2 group min-h-[96px] justify-center"
                  >
                    {(logoPreviewUrls.team1 || pendingChampionMatch.team1_logo) ? (
                      <div className="relative flex flex-col items-center gap-1">
                        <img
                          src={logoPreviewUrls.team1 || pendingChampionMatch.team1_logo}
                          alt="Team 1"
                          className="w-14 h-14 object-contain rounded-lg bg-white/5 p-1"
                        />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all rounded-lg flex flex-col items-center justify-center gap-1">
                          <Upload size={14} className="text-amber-400" />
                          <span className="text-[9px] text-amber-300 font-bold">Replace</span>
                        </div>
                        {pendingLogoFiles.team1 && (
                          <span className="text-[9px] text-amber-400/80 font-medium truncate max-w-[100px]">{pendingLogoFiles.team1.name}</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <Upload size={18} className="text-white/20 group-hover:text-amber-400 transition-all" />
                        <span className="text-[11px] text-white/30 group-hover:text-white/60 text-center transition-all leading-tight">
                          Drop image or <span className="text-amber-400/70">browse</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Team 2 Logo — drag & drop */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40">Team 2 Logo</label>
                  <div
                    onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).setAttribute('data-drag', 'true'); }}
                    onDragLeave={e => { (e.currentTarget as HTMLDivElement).removeAttribute('data-drag'); }}
                    onDrop={e => {
                      e.preventDefault();
                      (e.currentTarget as HTMLDivElement).removeAttribute('data-drag');
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleLogoDrop('team2', file);
                    }}
                    onClick={() => openLogoPicker('team2')}
                    className="relative w-full bg-black/40 border-2 border-dashed border-white/10 hover:border-amber-500/60 data-[drag]:border-amber-500 rounded-xl p-4 cursor-pointer transition-all flex flex-col items-center gap-2 group min-h-[96px] justify-center"
                  >
                    {(logoPreviewUrls.team2 || pendingChampionMatch.team2_logo) ? (
                      <div className="relative flex flex-col items-center gap-1">
                        <img
                          src={logoPreviewUrls.team2 || pendingChampionMatch.team2_logo}
                          alt="Team 2"
                          className="w-14 h-14 object-contain rounded-lg bg-white/5 p-1"
                        />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all rounded-lg flex flex-col items-center justify-center gap-1">
                          <Upload size={14} className="text-amber-400" />
                          <span className="text-[9px] text-amber-300 font-bold">Replace</span>
                        </div>
                        {pendingLogoFiles.team2 && (
                          <span className="text-[9px] text-amber-400/80 font-medium truncate max-w-[100px]">{pendingLogoFiles.team2.name}</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <Upload size={18} className="text-white/20 group-hover:text-amber-400 transition-all" />
                        <span className="text-[11px] text-white/30 group-hover:text-white/60 text-center transition-all leading-tight">
                          Drop image or <span className="text-amber-400/70">browse</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40">Match Label</label>
                  <input
                    type="text"
                    value={pendingChampionMatch.match_label ?? ''}
                    onChange={e => setPendingChampionMatch(p => ({ ...p!, match_label: e.target.value }))}
                    placeholder="e.g. Quarter Final"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40">Payout (pts)</label>
                  <input
                    type="number"
                    value={pendingChampionMatch.payout ?? 10}
                    onChange={e => setPendingChampionMatch(p => ({ ...p!, payout: Number(e.target.value) }))}
                    min={1}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!pendingChampionMatch.visibility}
                    onChange={e => setPendingChampionMatch(p => ({ ...p!, visibility: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-sm font-bold text-white/70">Visible to users</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setPendingChampionMatch(null);
                    setChampionError('');
                    setPendingLogoFiles({});
                    setLogoPreviewUrls({});
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChampionMatch}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save Match
                </button>
              </div>
            </div>
          )}

          {/* Match List */}
          {loadingChampion ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-white/30 font-bold animate-pulse text-sm">Loading matches…</p>
            </div>
          ) : championMatches.length === 0 ? (
            <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center text-center gap-3">
              <Trophy size={48} className="text-white/10" />
              <p className="text-white/40 font-bold">No champion matches yet.</p>
              <p className="text-white/20 text-sm">Click "New Match" to create the first one.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {championMatches.map(match => (
                <div
                  key={match.id}
                  className={`bg-zinc-900/60 border rounded-[2rem] p-5 transition-all ${
                    match.winner ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    {/* Teams */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {match.team1_logo && (
                        <img src={match.team1_logo} alt={match.team1} className="w-10 h-10 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {match.match_label && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/70 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              {match.match_label}
                            </span>
                          )}
                          {!match.visibility && (
                            <span className="text-[10px] font-black uppercase text-white/30 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="font-black text-base mt-0.5">
                          {match.team1} <span className="text-white/20 font-medium">vs</span> {match.team2}
                        </p>
                        <p className="text-xs text-white/30">Payout: +{match.payout} pts</p>
                      </div>
                      {match.team2_logo && (
                        <img src={match.team2_logo} alt={match.team2} className="w-10 h-10 rounded-xl object-contain bg-white/5 p-1 flex-shrink-0" />
                      )}
                    </div>

                    {/* Winner Status or Set Winner */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {match.winner ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30 text-sm font-black">
                          <CheckCircle2 size={14} />
                          <span>
                            Winner: {match.winner === 'team1' ? match.team1 : match.team2}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs text-white/30 font-bold">Set winner:</span>
                          <button
                            onClick={() => handleSetChampionWinner(match.id, 'team1')}
                            className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-xl text-xs font-black transition-all border border-amber-500/30"
                          >
                            {match.team1}
                          </button>
                          <button
                            onClick={() => handleSetChampionWinner(match.id, 'team2')}
                            className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-xl text-xs font-black transition-all border border-amber-500/30"
                          >
                            {match.team2}
                          </button>
                        </>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setChampionError('');
                          setPendingLogoFiles({});
                          setLogoPreviewUrls({});
                          setPendingChampionMatch({ ...match });
                        }}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-400 hover:text-blue-300 transition-all"
                        title="Edit match"
                      >
                        <Edit2 size={16} />
                      </button>

                      {/* Toggle visibility */}
                      <button
                        onClick={async () => {
                          await toggleChampionVisibility(match.id, !match.visibility);
                          await loadChampionMatches();
                        }}
                        className={`p-2 rounded-xl transition-all text-sm font-black border ${
                          match.visibility
                            ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/40 hover:text-white'
                            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
                        }`}
                        title={match.visibility ? 'Hide match' : 'Show match'}
                      >
                        {match.visibility ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteChampionMatch(match.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 transition-all"
                        title="Delete match"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pick History */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-black text-lg uppercase tracking-tight text-white/70">
                Pick History
                {totalChampionPicks > 0 && (
                  <span className="ml-2 text-sm font-medium text-white/30">({totalChampionPicks} total)</span>
                )}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={championPickSearch}
                  onChange={e => setChampionPickSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadChampionPicks(championPickSearch)}
                  placeholder="Search by username…"
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 w-48"
                />
                <button
                  onClick={() => loadChampionPicks(championPickSearch)}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl text-amber-300 text-sm font-bold transition-all flex items-center gap-1"
                >
                  <Search size={14} /> Search
                </button>
              </div>
            </div>

            {loadingChampionPicks ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : championPicks.length === 0 ? (
              <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-8 text-center text-white/30 text-sm font-bold">
                No picks found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5">
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/40">User</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/40">Match</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/40">Pick</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/40">Status</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/40">Payout</th>
                      <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/40">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {championPicks.map((pick, idx) => (
                      <tr key={pick.id ?? idx} className="border-b border-white/5 hover:bg-white/5 transition-all">
                        <td className="px-4 py-3 font-bold text-white/80">{pick.username}</td>
                        <td className="px-4 py-3 text-white/50 text-xs">
                          {pick.team1} vs {pick.team2}
                          {pick.match_label && (
                            <span className="ml-1 text-amber-400/60">({pick.match_label})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-white/70">
                          {pick.selected_team === 'team1' ? (pick.team1 ?? pick.selected_team) : (pick.team2 ?? pick.selected_team)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide border ${
                            pick.status === 'won'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : pick.status === 'lost'
                              ? 'bg-red-500/20 text-red-300 border-red-500/30'
                              : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                          }`}>
                            {pick.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-black text-emerald-400">
                          {pick.status === 'won' ? `+${pick.payout}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-white/30 text-xs">{pick.pick_date ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Settings: daily champion limit */}
          {settings && (
            <div className="bg-zinc-900/60 border border-white/5 rounded-[2rem] p-6 space-y-4">
              <h3 className="font-black uppercase tracking-tight text-white/60 text-sm flex items-center gap-2">
                <SettingsIcon size={16} />
                Daily Pick Limit
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-white/40">Picks Per Day</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.dailyChampionLimit ?? 5}
                    onChange={e => setSettings(s => s ? { ...s, dailyChampionLimit: Number(e.target.value) } : s)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!settings) return;
                    await persistSettings(settings);
                    setChampionSaveMsg('Daily limit saved!');
                    setTimeout(() => setChampionSaveMsg(''), 3000);
                  }}
                  className="px-6 py-3 mt-5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-2xl text-sm transition-all flex items-center gap-2"
                >
                  <Save size={16} /> Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'admins' && sessionStorage.getItem('adminUser') === 'teb' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-32 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Admin Management</h2>
              <p className="text-white/40 text-sm font-medium">Create and manage agent accounts</p>
            </div>
            <button
              onClick={() => {
                setNewAdminData({ username: '', password: '', role: 'agent' });
                setShowCreateAdminModal(true);
              }}
              className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg"
            >
              <Plus size={20} />
              Create Admin
            </button>
          </div>

          <div className="grid gap-4">
            {loadingAdmins ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-white/40 font-bold animate-pulse">Loading admins...</p>
              </div>
            ) : admins.length === 0 ? (
              <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
                <ShieldAlert size={48} className="text-white/10" />
                <p className="text-white/40 font-medium">No admin accounts found.</p>
              </div>
            ) : (
              (Array.isArray(admins) ? admins : []).map((admin) => {
                if (!admin || !admin.username) return null;
                
                const safeDate = (dateStr: string) => {
                  try {
                    const d = new Date(dateStr);
                    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
                  } catch (e) {
                    return 'N/A';
                  }
                };

                return (
                  <div key={admin.username} className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-6 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${admin.role === 'superadmin' ? 'bg-purple-500/20 text-purple-500' : 'bg-blue-500/20 text-blue-500'}`}>
                        <ShieldAlert size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          {String(admin.username)}
                          {admin.role === 'superadmin' && (
                            <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full uppercase tracking-widest">Super</span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full uppercase tracking-widest border border-blue-500/20">
                            {(Array.isArray(managedUsers) ? managedUsers : []).filter(u => u && u.tts === admin.username).length} Accounts
                          </span>
                        </h3>
                        <p className="text-sm text-white/40">Role: {String(admin.role)} • Created: {safeDate(admin.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setNewAdminData({ username: admin.username, password: '', role: admin.role });
                          setShowCreateAdminModal(true);
                        }}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/40 hover:text-white transition-all"
                        title="Edit Admin"
                      >
                        <SettingsIcon size={20} />
                      </button>
                      {admin.username !== 'teb' && (
                        <button
                          onClick={() => handleDeleteAdmin(admin.username)}
                          className="p-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/20 text-red-400 transition-all"
                          title="Delete Admin"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
        </ErrorBoundary>
      </div>

      {showCreateAdminModal && (
        <div className="fixed inset-0 z-[20000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase tracking-tighter">
                {admins.some(a => a.username === newAdminData.username) ? 'Edit Admin' : 'Create Admin'}
              </h2>
              <button onClick={() => setShowCreateAdminModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Username</label>
                <input
                  type="text"
                  value={newAdminData.username}
                  onChange={(e) => setNewAdminData({ ...newAdminData, username: e.target.value.toLowerCase() })}
                  placeholder="Enter username"
                  disabled={admins.some(a => a.username === newAdminData.username)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Password</label>
                <input
                  type="password"
                  value={newAdminData.password}
                  onChange={(e) => setNewAdminData({ ...newAdminData, password: e.target.value })}
                  placeholder={admins.some(a => a.username === newAdminData.username) ? "Leave blank to keep current" : "Enter password"}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Role</label>
                <select
                  value={newAdminData.role}
                  onChange={(e) => setNewAdminData({ ...newAdminData, role: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="agent">Agent</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button
                onClick={() => setShowCreateAdminModal(false)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdmin}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all"
              >
                <Save size={20} />
                Save Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateUserModal && (
        <div className="fixed inset-0 z-[20000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Create New User</h2>
              <button onClick={() => setShowCreateUserModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-white/40">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
              <p className="text-xs text-white/40 italic">
                Note: New users start with $0 balance and default spin/football limits.
              </p>
            </div>

            <div className="pt-4 flex gap-4">
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={20} />
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
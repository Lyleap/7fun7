import React, { useState, useEffect, useCallback } from 'react';
import { Users, Receipt, BarChart3, RefreshCw, TrendingUp, Coins } from 'lucide-react';

const API_BASE = 'https://db.7fun7-api.online/api';

type Period = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

interface UserStat {
  username: string;
  betslip_count: number;
  total_bet: number;
  coins_earned: number;
}

interface ExcelStats {
  registrations: number;
  betslip_count: number;
  total_bet: number;
  coins_earned: number;
  user_stats: UserStat[];
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getDateRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };

    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }

    case 'this_week': {
      const day = today.getDay(); // 0=Sun
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { from: fmt(monday), to: fmt(today) };
    }

    case 'last_week': {
      const day = today.getDay();
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      return { from: fmt(lastMonday), to: fmt(lastSunday) };
    }

    case 'this_month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(first), to: fmt(today) };
    }

    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }

    case 'custom':
      return { from: customFrom, to: customTo };

    default:
      return { from: fmt(today), to: fmt(today) };
  }
}

function formatPeriodLabel(period: Period, customFrom: string, customTo: string): string {
  const { from, to } = getDateRange(period, customFrom, customTo);
  if (!from) return '—';
  return from === to ? from : `${from}  →  ${to}`;
}

export default function ExcelSection() {
  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [stats, setStats] = useState<ExcelStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'betslip_count' | 'total_bet' | 'coins_earned'>('betslip_count');

  const adminUser = sessionStorage.getItem('adminUser') || '';

  const fetchStats = useCallback(async () => {
    const { from, to } = getDateRange(period, customFrom, customTo);
    if (!from || !to) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}?type=stats&action=get&from_date=${from}&to_date=${to}&tts=${encodeURIComponent(adminUser)}`
      );
      const text = await res.text();

      if (text.includes('<?php') || text.trim().startsWith('<!DOCTYPE')) {
        // Preview mode — show zeros
        setStats({
          registrations: 0,
          betslip_count: 0,
          total_bet: 0,
          coins_earned: 0,
          user_stats: [],
        });
        return;
      }

      const data: ExcelStats = JSON.parse(text);
      setStats(data);
      setLastFetched(new Date());
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, adminUser]);

  // Auto-fetch when period changes (except custom — user must click Apply)
  useEffect(() => {
    if (period !== 'custom') {
      fetchStats();
    }
  }, [period]);

  const sortedUserStats = [...(stats?.user_stats ?? [])].sort((a, b) => b[sortBy] - a[sortBy]);

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'last_week', label: 'Last Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500 pb-24">

      {/* ── Period Selector ── */}
      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6">
        <div className="flex flex-wrap gap-2">
          {periods.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                period === p.key
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {period === 'custom' && (
          <div className="flex flex-wrap gap-4 mt-5 items-end">
            <div>
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1 block">
                From
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1 block">
                To
              </label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
            <button
              onClick={fetchStats}
              disabled={!customFrom || !customTo || loading}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all text-sm"
            >
              Apply
            </button>
          </div>
        )}

        {/* Date range label */}
        {period !== 'custom' && (
          <p className="text-xs text-white/25 mt-3 font-mono">
            {formatPeriodLabel(period, customFrom, customTo)}
          </p>
        )}
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Registrations */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600/20 to-blue-900/10 border border-blue-500/20 rounded-[2rem] p-6">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-blue-400" />
            </div>
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Registrations</span>
          </div>
          {loading ? (
            <div className="h-10 w-24 bg-white/10 rounded-xl animate-pulse" />
          ) : (
            <p className="text-5xl font-black text-white tabular-nums">
              {stats?.registrations ?? '—'}
            </p>
          )}
          <p className="text-xs text-blue-400/60 mt-2 font-medium">New accounts created</p>
        </div>

        {/* Betslips */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-purple-900/10 border border-purple-500/20 rounded-[2rem] p-6">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Receipt size={20} className="text-purple-400" />
            </div>
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Betslips</span>
          </div>
          {loading ? (
            <div className="h-10 w-24 bg-white/10 rounded-xl animate-pulse" />
          ) : (
            <p className="text-5xl font-black text-white tabular-nums">
              {stats?.betslip_count ?? '—'}
            </p>
          )}
          <p className="text-xs text-purple-400/60 mt-2 font-medium">
            {stats ? `${stats.total_bet.toLocaleString()} coins bet total` : 'Total bets placed'}
          </p>
        </div>

        {/* Coins Earned */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-600/20 to-amber-900/10 border border-amber-500/20 rounded-[2rem] p-6">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-amber-400" />
            </div>
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Coins Earned</span>
          </div>
          {loading ? (
            <div className="h-10 w-32 bg-white/10 rounded-xl animate-pulse" />
          ) : (
            <p className="text-5xl font-black text-white tabular-nums">
              {stats ? stats.coins_earned.toLocaleString() : '—'}
            </p>
          )}
          <p className="text-xs text-amber-400/60 mt-2 font-medium">From won betslips</p>
        </div>
      </div>

      {/* ── Per-User Breakdown Table ── */}
      <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden">

        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <h3 className="text-base font-black uppercase tracking-tighter">Per User Breakdown</h3>
            <p className="text-xs text-white/30 mt-0.5">
              {sortedUserStats.length} user{sortedUserStats.length !== 1 ? 's' : ''} active in this period
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Sort selector */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs font-bold bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white/60 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="betslip_count">Sort: Betslips</option>
              <option value="total_bet">Sort: Coins Bet</option>
              <option value="coins_earned">Sort: Coins Earned</option>
            </select>

            {lastFetched && (
              <span className="text-[10px] text-white/20 font-mono hidden sm:block">
                {lastFetched.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={fetchStats}
              disabled={loading}
              title="Refresh"
              className="p-2 hover:bg-white/10 rounded-xl transition-all disabled:opacity-40"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-400' : 'text-white/40'} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="text-left px-6 py-3 text-[10px] font-bold text-white/25 uppercase tracking-widest w-10">#</th>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-white/25 uppercase tracking-widest">Username</th>
                <th className="text-right px-6 py-3 text-[10px] font-bold text-white/25 uppercase tracking-widest">
                  <button onClick={() => setSortBy('betslip_count')} className={`hover:text-white transition-colors ${sortBy === 'betslip_count' ? 'text-purple-400' : ''}`}>
                    Betslips ↕
                  </button>
                </th>
                <th className="text-right px-6 py-3 text-[10px] font-bold text-white/25 uppercase tracking-widest">
                  <button onClick={() => setSortBy('total_bet')} className={`hover:text-white transition-colors ${sortBy === 'total_bet' ? 'text-blue-400' : ''}`}>
                    Coins Bet ↕
                  </button>
                </th>
                <th className="text-right px-6 py-3 text-[10px] font-bold text-white/25 uppercase tracking-widest">
                  <button onClick={() => setSortBy('coins_earned')} className={`hover:text-white transition-colors ${sortBy === 'coins_earned' ? 'text-amber-400' : ''}`}>
                    Coins Earned ↕
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-white/5 rounded-lg animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sortedUserStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-white/20">
                      <BarChart3 size={40} strokeWidth={1} />
                      <p className="font-medium text-sm">No activity in this period</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedUserStats.map((u, i) => (
                  <tr
                    key={u.username}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-6 py-4 text-white/20 font-mono text-xs">{i + 1}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-white">{u.username}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-purple-300 font-bold">{u.betslip_count}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-white/60">{u.total_bet.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono font-bold ${u.coins_earned > 0 ? 'text-amber-400' : 'text-white/30'}`}>
                        {u.coins_earned > 0 ? '+' : ''}{u.coins_earned.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Totals footer */}
            {!loading && sortedUserStats.length > 0 && (
              <tfoot>
                <tr className="border-t border-white/10 bg-white/[0.03]">
                  <td className="px-6 py-4" colSpan={2}>
                    <span className="text-xs font-black uppercase tracking-widest text-white/30">Total</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-black text-purple-300">
                    {sortedUserStats.reduce((s, u) => s + u.betslip_count, 0)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-white/50">
                    {sortedUserStats.reduce((s, u) => s + u.total_bet, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-black text-amber-400">
                    +{sortedUserStats.reduce((s, u) => s + u.coins_earned, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

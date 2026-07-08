import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Trophy, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChampionMatch, ChampionPick } from '../types';
import {
  fetchChampionMatches,
  fetchMyChampionPicks,
  fetchChampionPicksRemaining,
  submitChampionPicks,
} from '../services/championData';
import LazyLogo from './LazyLogo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusStyles = (status: string) => {
  if (status === 'won') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (status === 'lost') return 'text-red-400 bg-red-500/10 border-red-500/30';
  return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
};

const statusIcon = (status: string) => {
  if (status === 'won') return <CheckCircle2 size={14} />;
  if (status === 'lost') return <XCircle size={14} />;
  return <Clock size={14} />;
};

const statusLabel = (status: string) => {
  if (status === 'won') return 'Won';
  if (status === 'lost') return 'Lost';
  return 'Pending';
};

// ─── Team Logo Box ─────────────────────────────────────────────────────────────

const TeamBox = ({
  name,
  logo,
  isSelected,
  isMyPick,
  isWinner,
}: {
  name: string;
  logo?: string;
  isSelected: boolean;
  isMyPick: boolean;
  isWinner: boolean;
}) => (
  <div className="flex flex-col items-center gap-2 flex-1">
    <div
      className={`w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center border-2 transition-all duration-300 ${
        isSelected
          ? 'border-amber-500 shadow-lg shadow-amber-500/30 bg-amber-500/10 scale-105'
          : isMyPick
          ? 'border-emerald-500/60 bg-emerald-500/10'
          : isWinner
          ? 'border-white/30 bg-white/5'
          : 'border-white/10 bg-white/5'
      }`}
    >
      {logo ? (
        <LazyLogo src={logo} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-2xl font-black text-white/50">{name.charAt(0)}</span>
      )}
    </div>
    <span className={`text-sm font-black text-center leading-tight max-w-[90px] line-clamp-2 ${
      isSelected ? 'text-amber-300' : 'text-white/80'
    }`}>
      {name}
    </span>
  </div>
);

// ─── Match Card ────────────────────────────────────────────────────────────────

const MatchCard = ({
  match,
  existingPick,
  selection,
  onSelect,
  picksRemaining,
}: {
  match: ChampionMatch;
  existingPick?: ChampionPick;
  selection?: 'team1' | 'team2';
  onSelect: (matchId: string, team: 'team1' | 'team2') => void;
  picksRemaining: number;
}) => {
  const isWinnerSet = match.winner != null;
  const alreadyPicked = !!existingPick;
  const cannotPick = alreadyPicked || isWinnerSet || (picksRemaining <= 0 && !selection);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-zinc-900/80 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl border transition-all duration-300 ${
        selection
          ? 'border-amber-500/40 shadow-amber-500/10'
          : alreadyPicked
          ? 'border-white/8'
          : 'border-white/5 hover:border-white/10'
      }`}
    >
      {/* Match Label */}
      {match.match_label && (
        <div className="px-5 pt-4">
          <span className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-amber-400/80 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            {match.match_label}
          </span>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Teams Row */}
        <div className="flex items-center justify-between gap-3">
          <TeamBox
            name={match.team1}
            logo={match.team1_logo}
            isSelected={selection === 'team1'}
            isMyPick={existingPick?.selected_team === 'team1'}
            isWinner={match.winner === 'team1'}
          />

          {/* VS + Payout */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <span className="text-white/20 font-black text-sm">VS</span>
            <div className="flex items-center gap-1 text-[11px] font-black text-amber-400/70">
              <Trophy size={11} />
              <span>+{match.payout} pts</span>
            </div>
          </div>

          <TeamBox
            name={match.team2}
            logo={match.team2_logo}
            isSelected={selection === 'team2'}
            isMyPick={existingPick?.selected_team === 'team2'}
            isWinner={match.winner === 'team2'}
          />
        </div>

        {/* Bottom Section */}
        {alreadyPicked ? (
          /* Already submitted this pick */
          <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${statusStyles(existingPick!.status)}`}>
            <div className="flex items-center gap-2">
              {statusIcon(existingPick!.status)}
              <span className="text-sm font-black">
                Picked: {existingPick!.selected_team === 'team1' ? match.team1 : match.team2}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {existingPick!.status === 'won' && (
                <span className="text-xs font-black text-emerald-300">+{existingPick!.payout} pts</span>
              )}
              <span className="text-xs font-black uppercase tracking-wider">{statusLabel(existingPick!.status)}</span>
            </div>
          </div>
        ) : isWinnerSet ? (
          /* Winner declared but user didn't pick */
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-sm text-white/40 font-bold">
              Result: {match.winner === 'team1' ? match.team1 : match.team2} wins
            </span>
            <span className="text-xs text-white/20 font-bold uppercase">Closed</span>
          </div>
        ) : picksRemaining <= 0 && !selection ? (
          /* No picks left */
          <div className="flex items-center justify-center px-4 py-3 rounded-2xl bg-red-500/5 border border-red-500/20">
            <AlertCircle size={14} className="text-red-400/60 mr-2" />
            <span className="text-sm text-red-400/60 font-bold">No picks remaining today</span>
          </div>
        ) : (
          /* Active pick buttons */
          <div className="grid grid-cols-2 gap-3">
            {(['team1', 'team2'] as const).map((team) => {
              const teamName = team === 'team1' ? match.team1 : match.team2;
              const isActive = selection === team;
              return (
                <button
                  key={team}
                  onClick={() => onSelect(match.id, team)}
                  className={`py-3 px-3 rounded-2xl font-black text-sm transition-all duration-200 truncate ${
                    isActive
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30 scale-[1.02]'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10 hover:border-white/20'
                  }`}
                >
                  {teamName}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function WorldcupSection() {
  const { user } = useApp();

  const [matches, setMatches] = useState<ChampionMatch[]>([]);
  const [myPicks, setMyPicks] = useState<ChampionPick[]>([]);
  const [selectedPicks, setSelectedPicks] = useState<Record<string, 'team1' | 'team2'>>({});
  const [picksRemaining, setPicksRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [matchData, pickData, remaining] = await Promise.all([
        fetchChampionMatches(),
        fetchMyChampionPicks(user.username),
        fetchChampionPicksRemaining(user.username),
      ]);
      setMatches(matchData);
      setMyPicks(pickData);
      setPicksRemaining(remaining);
    } catch (e) {
      console.error('WorldcupSection load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getExistingPick = (matchId: string) =>
    myPicks.find((p) => p.match_id === matchId);

  const handleSelectTeam = (matchId: string, team: 'team1' | 'team2') => {
    if (getExistingPick(matchId)) return;
    setSelectedPicks((prev) => {
      if (prev[matchId] === team) {
        const next = { ...prev };
        delete next[matchId];
        return next;
      }
      return { ...prev, [matchId]: team };
    });
  };

  const selectedCount = Object.keys(selectedPicks).length;

  const handleSubmit = async () => {
    if (!user || selectedCount === 0 || submitting) return;
    if (selectedCount > picksRemaining) {
      setError(`You only have ${picksRemaining} pick${picksRemaining !== 1 ? 's' : ''} left today.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const picksToSubmit = Object.entries(selectedPicks).map(([match_id, selected_team]) => ({
        username: user.username,
        match_id,
        selected_team,
        payout: matches.find((m) => m.id === match_id)?.payout ?? 10,
      }));

      const result = await submitChampionPicks(picksToSubmit);

      if (result.success) {
        setSuccessMsg(
          `${selectedCount} pick${selectedCount > 1 ? 's' : ''} submitted! Good luck! 🏆`
        );
        setSelectedPicks({});
        setTimeout(() => setSuccessMsg(''), 4500);
        const [pickData, remaining] = await Promise.all([
          fetchMyChampionPicks(user.username),
          fetchChampionPicksRemaining(user.username),
        ]);
        setMyPicks(pickData);
        setPicksRemaining(typeof result.remaining === 'number' ? result.remaining : remaining);
      } else {
        setError(result.error || 'Failed to submit. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Globe size={48} className="mx-auto text-white/10" />
          <p className="text-white/30 font-bold">Login to access World Cup picks</p>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500" />
          <p className="text-white/30 text-sm font-bold animate-pulse">Loading World Cup…</p>
        </div>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
      <div className="w-full min-h-full flex flex-col items-center px-4 pt-16 pb-40 md:pt-8">

        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-6 mt-2">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/25 blur-2xl rounded-full animate-pulse pointer-events-none" />
            <Globe size={48} className="text-amber-400 relative z-10 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]" />
          </div>
          <h2 className="text-3xl font-black tracking-tighter text-white">World Cup</h2>
          <p className="text-white/30 text-sm text-center">Pick the winning team — earn +pts for every correct call</p>
        </div>

        {/* Picks Left + Refresh */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border font-black text-sm transition-all ${
              picksRemaining > 0
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <Trophy size={16} />
            <span>Picks Left Today:</span>
            <span className="text-xl tabular-nums">{picksRemaining}</span>
          </div>
          <button
            onClick={loadData}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-white/30 hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 w-full max-w-2xl px-4 py-3 bg-red-500/20 text-red-300 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-500/30"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 w-full max-w-2xl px-4 py-3 bg-emerald-500/20 text-emerald-300 rounded-2xl text-sm font-bold flex items-center gap-2 border border-emerald-500/30"
            >
              <CheckCircle2 size={16} />
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Match Cards */}
        {matches.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-white/20">
            <Globe size={56} className="opacity-10" />
            <p className="font-bold text-lg">No matches available yet</p>
            <p className="text-sm">Come back soon for upcoming World Cup matches</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                existingPick={getExistingPick(match.id)}
                selection={selectedPicks[match.id]}
                onSelect={handleSelectTeam}
                picksRemaining={picksRemaining}
              />
            ))}
          </div>
        )}

        {/* Pick History */}
        {myPicks.length > 0 && (
          <div className="w-full max-w-2xl mt-8 space-y-2">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl transition-all text-white font-bold"
            >
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-amber-400" />
                My Picks History
                <span className="text-white/30 font-medium">({myPicks.length})</span>
              </div>
              {showHistory ? <ChevronUp size={18} className="text-white/40" /> : <ChevronDown size={18} className="text-white/40" />}
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-2"
                >
                  {myPicks.map((pick) => (
                    <div
                      key={pick.id ?? `${pick.match_id}-${pick.selected_team}`}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border ${statusStyles(pick.status)}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        {pick.match_label && (
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                            {pick.match_label}
                          </span>
                        )}
                        <span className="text-sm font-bold">
                          {pick.team1 ?? '?'} vs {pick.team2 ?? '?'}
                        </span>
                        <span className="text-xs opacity-70">
                          Picked:{' '}
                          <strong>
                            {pick.selected_team === 'team1' ? (pick.team1 ?? '?') : (pick.team2 ?? '?')}
                          </strong>
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-xs font-black uppercase">
                          {statusIcon(pick.status)}
                          <span>{statusLabel(pick.status)}</span>
                        </div>
                        {pick.status === 'won' && (
                          <span className="text-xs font-black text-emerald-300">+{pick.payout} pts</span>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Floating Submit Button */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          >
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`pointer-events-auto flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black rounded-[2rem] shadow-2xl shadow-amber-500/40 text-sm uppercase tracking-widest transition-all ${
                submitting
                  ? 'opacity-70 cursor-not-allowed'
                  : 'hover:scale-105 active:scale-95 hover:shadow-amber-500/60'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Trophy size={20} />
                  Submit {selectedCount} Pick{selectedCount > 1 ? 's' : ''}
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

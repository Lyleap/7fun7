import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Trophy, ChevronDown, ChevronUp, Trash2, Receipt, AlertCircle, X, Search, Printer } from 'lucide-react';
import { Match, Prediction, PredictionType, Settings, UserData } from '../types';
import { fetchFootballMatches, saveBetslip } from '../services/footballData';
import LazyLogo from './LazyLogo';

interface BetSlipItem {
  matchId: string | number;
  matchName: string;
  selection: string;
  type: PredictionType;
  odd: number;
  payload: { team?: string; line?: number };
  match: Match;
}

const todayKey = () => new Date().toISOString().split('T')[0];

const buildMatchLabel = (match: Match) => `${match.team1} vs ${match.team2}`;

const getDailyRemaining = (user: UserData | null, settings: Settings | null) => {
  if (!user) return 0;
  return user.football_guess ?? 0;
};

const resetDailyLimitIfNeeded = (user: UserData, settings: Settings | null) => {
  return user;
};

const formatPredictionLabel = (prediction: Prediction) => {
  const type = prediction.type || 'winner';
  let label = '';
  
  if (type === 'winner') label = prediction.team || 'Winner';
  else if (type === 'draw') label = 'Draw';
  else if (type === 'exact') label = `Exact ${prediction.score1 ?? 0}-${prediction.score2 ?? 0}`;
  else {
    const lineText = typeof prediction.line === 'number' ? prediction.line : 0;
    if (type === 'hdp_1') label = `HDP ${lineText}`;
    else if (type === 'hdp_2') label = `HDP -${lineText}`;
    else if (type === 'over') label = `Over ${lineText}`;
    else if (type === 'under') label = `Under ${lineText}`;
    else label = `Total ${lineText}`;
  }

  if (prediction.odd) {
    label += ` @${prediction.odd.toFixed(2)}`;
  }
  return label;
};

const buildHistoryEntry = (prediction: Prediction) => {
  const base = `Prediction: ${prediction.match}`;
  return `${base} - ${formatPredictionLabel(prediction)}`;
};

const parseNumberInput = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function FootballSection() {
  const { t, user, updateUser, settings, matches, setMatches } = useApp();
  const [loading, setLoading] = useState(false);
  const picksLeft = getDailyRemaining(user, settings);
  const [expandedMatches, setExpandedMatches] = useState<Record<string | number, boolean>>({});
  const [expandedLeagues, setExpandedLeagues] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);
  const [showSlipOnMobile, setShowSlipOnMobile] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [limitNotification, setLimitNotification] = useState(false);
  const [placedReceiptId, setPlacedReceiptId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notEnoughGuesses, setNotEnoughGuesses] = useState(false);

  useEffect(() => {
    if (matches.length > 0) {
      // Expand all leagues by default
      const initialLeagues: Record<string, boolean> = {};
      matches.forEach(m => {
        if (m.league) initialLeagues[m.league] = true;
      });
      setExpandedLeagues(initialLeagues);
    }
  }, [matches.length]);

  const toggleExpand = (matchId: string | number) => {
    setExpandedMatches(prev => ({ ...prev, [matchId]: !prev[matchId] }));
  };

  const toggleLeague = (league: string) => {
    setExpandedLeagues(prev => ({ ...prev, [league]: !prev[league] }));
  };

  const canPredict = (match: Match) => {
    if (!user) {
      setError('Please login first.');
      return false;
    }
    if (match.winner) {
      setError('Match ended.');
      return false;
    }
    const preparedUser = resetDailyLimitIfNeeded(user, settings);
    if ((preparedUser.dailyFootballLimit ?? 0) <= 0) {
      setError('No picks left today.');
      return false;
    }
    return true;
  };

  const addToSlip = (match: Match, type: PredictionType, payload: { team?: string; line?: number }) => {
    if (!canPredict(match)) return;

    let selection = '';
    let odd = 0;

    if (type === 'winner') {
      selection = payload.team || '';
      odd = payload.team === match.team1 ? (match.payoutWinnerTeam1 || 0) : (match.payoutWinnerTeam2 || 0);
    } else if (type === 'draw') {
      selection = 'Draw';
      odd = match.payoutDraw || 0;
    } else if (type === 'hdp_1') {
      selection = `${match.team1} HDP ${match.line}`;
      odd = match.payoutHdp1 || 0;
    } else if (type === 'hdp_2') {
      selection = `${match.team2} HDP -${match.line}`;
      odd = match.payoutHdp2 || 0;
    } else if (type === 'over') {
      selection = `Over ${payload.line || 2.5}`;
      odd = match.payoutOver || 0;
    } else if (type === 'under') {
      selection = `Under ${payload.line || 2.5}`;
      odd = match.payoutUnder || 0;
    }

    const itemKey = `${match.id}-${type}-${selection}`;
    const existsExact = betSlip.find(item => `${item.matchId}-${item.type}-${item.selection}` === itemKey);
    const existsSameMatch = betSlip.find(item => item.matchId === match.id);
    
    // If it's a NEW match (not already in slip) and slip is full → block
    if (!existsSameMatch && betSlip.length >= picksLeft) {
      setLimitNotification(true);
      setTimeout(() => setLimitNotification(false), 3000);
      return;
    }

    const newItem: BetSlipItem = {
      matchId: match.id,
      matchName: buildMatchLabel(match),
      selection,
      type,
      odd,
      payload,
      match
    };

    setBetSlip(prev => {
      if (existsExact) {
        // Exact same selection clicked again → remove it (toggle off)
        return prev.filter(item => `${item.matchId}-${item.type}-${item.selection}` !== itemKey);
      }
      // Different bet type on same match → replace the old one
      const withoutThisMatch = prev.filter(item => item.matchId !== match.id);
      return [...withoutThisMatch, newItem];
    });
    setError('');
  };

  const removeFromSlip = (uniqueKey: string) => {
    setBetSlip(prev => prev.filter(item => `${item.matchId}-${item.type}-${item.selection}` !== uniqueKey));
  };

  const placeBets = async () => {
    if (betSlip.length === 0 || isSubmitting) return;
    if (betSlip.length > picksLeft) {
      setError(`You only have ${picksLeft} picks left.`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const totalCost = settings?.defaultBetAmount ?? 10;
      const receiptId = 'R' + Math.random().toString(36).substr(2, 9).toUpperCase();

      const newPredictions: Prediction[] = betSlip.map(item => {
        const basePrediction: Prediction = {
          matchId: item.matchId as number,
          match: item.matchName,
          team1_logo: item.match.team1_logo,
          team2_logo: item.match.team2_logo,
          type: item.type,
          odd: item.odd,
          date: new Date().toLocaleDateString(),
          receiptId: receiptId
        };

        if (item.type === 'winner' || item.type === 'draw') {
          return { ...basePrediction, team: item.selection };
        }
        
        // For HDP and Over/Under, we store the line/hdp value
        const line = item.payload.line ?? item.match.line ?? 0;
        return { 
          ...basePrediction, 
          team: item.selection,
          line: line,
          hdp: line // Store in both for compatibility
        };
      });

      // Save to MySQL betslips table
      const betslipData = {
        receipt_id: receiptId,
        username: user.username,
        bet_amount: totalCost,
        total_odd: totalOdds,
        match_quantity: betSlip.length,
        matches: betSlip.map(item => ({
          matchName: item.matchName,
          selection: item.selection,
          type: item.type,
          line: item.payload.line ?? item.match.line ?? 0,
          odd: item.odd,
          team1_logo: item.match.team1_logo,
          team2_logo: item.match.team2_logo,
          status: 'ACCEPTED'
        })),
        status: 'ACCEPTED'
      };

      const result = await saveBetslip(betslipData);

      if (!result.success) {
        if (result.error?.toLowerCase().includes('not enough') || result.error?.toLowerCase().includes('guess')) {
          setNotEnoughGuesses(true);
          setTimeout(() => setNotEnoughGuesses(false), 3000);
        } else {
          setError(result.error || 'Failed to save betslip. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      updateUser(current => {
        return {
          ...current,
          football_guess: typeof result.football_guess === 'number' 
            ? result.football_guess 
            : Math.max(0, (current.football_guess ?? 0) - betSlip.length),
          predictions: [...newPredictions, ...(current.predictions || [])].slice(0, 20)
        };
      }, `Football Bet Placed [Receipt: ${receiptId}]`);

      setBetSlip([]);
      setPlacedReceiptId(receiptId);
      setShowSuccessModal(true);
      setSuccessMessage('Bets placed successfully!');
    } catch (err) {
      console.error('Error placing bets:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalOdds = betSlip.reduce((acc, item) => acc * (item.odd || 1), 1);

  const BetslipContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-hide">
        {betSlip.map((item) => {
          const itemKey = `${item.matchId}-${item.type}-${item.selection}`;
          return (
            <div key={itemKey} className="bg-white/5 rounded-xl p-3 border border-white/10 group relative">
              <button 
                onClick={() => removeFromSlip(itemKey)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
              >
                <X size={12} />
              </button>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest truncate max-w-[180px]">
                  {item.matchName}
                </span>
                <span className="text-xs font-black text-yellow-500">@{item.odd.toFixed(2)}</span>
              </div>
              <div className="text-sm font-bold text-white">
                {item.selection}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Total Odds</span>
          <span className="text-xl font-black text-yellow-500 tabular-nums">{totalOdds.toFixed(2)}</span>
        </div>
        
        <button
          onClick={placeBets}
          disabled={isSubmitting}
          className={`w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-purple-600/20 transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            `Place ${betSlip.length} ${betSlip.length === 1 ? 'Bet' : 'Bets'}`
          )}
        </button>
      </div>
    </div>
  );

  // Filter and Group matches by league
  const filteredMatches = matches.filter(match => {
    const search = searchTerm.toLowerCase();
    
    // Don't show matches that have already started
    if (match.commence_time) {
      const startTime = new Date(match.commence_time).getTime();
      const now = Date.now();
      if (now >= startTime) return false;
    }

    return (
      match.team1.toLowerCase().includes(search) ||
      match.team2.toLowerCase().includes(search) ||
      (match.league || '').toLowerCase().includes(search)
    );
  });

  const groupedMatches = filteredMatches.reduce((acc, match) => {
    const league = match.league || 'Other';
    if (!acc[league]) acc[league] = [];
    acc[league].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto 
    scrollbar-hide">
      <div className="w-full min-h-full flex flex-col items-center justify-start px-4 pt-16 pb-10 md:pt-6">
        <h2 className="text-3xl font-black mb-4 flex items-center gap-3">
          <Trophy className="text-yellow-500" size={32} />
          {t.football}
        </h2>

        <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 text-sm text-white/60 mb-6">
          <Trophy size={16} className="text-yellow-500" />
          Picks Left: <span className="text-yellow-300 font-black tabular-nums">{picksLeft}</span>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-500/20 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 px-4 py-3 bg-emerald-500/20 text-emerald-300 rounded-2xl text-sm font-bold flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/30 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Receipt size={16} />
              </div>
              <div className="flex flex-col">
                <span>{successMessage}</span>
                {placedReceiptId && (
                  <span className="text-[10px] opacity-60 font-medium uppercase tracking-widest">Receipt: {placedReceiptId}</span>
                )}
              </div>
            </div>
            {placedReceiptId && (
              <button
                onClick={() => window.open(`/api/receipt.php?id=${placedReceiptId}`, '_blank', 'width=600,height=800')}
                className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-white transition-all flex items-center gap-2"
              >
                <Printer size={14} />
                View Receipt
              </button>
            )}
          </div>
        )}

        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 items-start">
          {/* Bet Slip - Desktop Version */}
          <div className="hidden lg:block lg:sticky lg:top-6 space-y-4">
            <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 p-4">
                <h3 className="text-white font-black flex items-center gap-2">
                  <Receipt size={20} />
                  BET SLIP
                </h3>
              </div>
              <div className="p-4 space-y-4">
                {betSlip.length === 0 ? (
                  <div className="py-10 text-center text-white/20 space-y-2">
                    <Receipt size={40} className="mx-auto opacity-10" />
                    <p className="text-sm font-bold">Your slip is empty</p>
                    <p className="text-[10px]">Click on any odd to add a bet</p>
                  </div>
                ) : (
                  <BetslipContent />
                )}
              </div>
            </div>
            
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 text-white/40 mb-2">
                <AlertCircle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Rules</span>
              </div>
              <ul className="text-[10px] text-white/30 space-y-1 list-disc pl-4">
                <li>Maximum {settings?.dailyFootballLimit ?? 5} picks per day</li>
                <li>Odds are calculated based on current market</li>
                <li>Bets cannot be changed once placed</li>
              </ul>
            </div>
          </div>

          {/* Mobile Bet Slip - Portaled to Body */}
          {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
              {showSlipOnMobile && (
                <div className="fixed inset-0 z-[9999] flex flex-col justify-end lg:hidden">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    onClick={() => setShowSlipOnMobile(false)}
                  />
                  
                  <motion.div 
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 overflow-hidden shadow-2xl relative h-[80vh] w-full rounded-t-[2.5rem]"
                  >
                    <div className="flex items-center justify-between p-6 pb-2">
                      <div className="w-12 h-1.5 bg-white/10 rounded-full absolute top-3 left-1/2 -translate-x-1/2" />
                      <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <Receipt size={24} />
                        BET SLIP
                      </h3>
                      <button 
                        onClick={() => setShowSlipOnMobile(false)}
                        className="p-2 bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                      >
                        <X size={24} />
                      </button>
                    </div>
                    
                    <div className="p-4 space-y-4 overflow-y-auto h-full pb-32">
                      {betSlip.length === 0 ? (
                        <div className="py-10 text-center text-white/20 space-y-2">
                          <Receipt size={40} className="mx-auto opacity-10" />
                          <p className="text-sm font-bold">Your slip is empty</p>
                        </div>
                      ) : (
                        <BetslipContent isMobile />
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body
          )}

          {/* Matches List */}
          <div className="space-y-6 order-1 lg:order-2">
            {/* Search Bar */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-yellow-500 transition-colors">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Search teams or leagues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500/50 focus:bg-zinc-900 transition-all shadow-xl"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-4 flex items-center text-white/20 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {Object.keys(groupedMatches).length === 0 ? (
              <div className="text-center py-20 text-white/20 bg-zinc-900/30 rounded-3xl border border-dashed border-white/5">
                <Search size={48} className="mx-auto mb-4 opacity-10" />
                <p className="text-lg font-bold">No matches found</p>
                <p className="text-sm">Try searching for a different team or league.</p>
              </div>
            ) : (
              Object.entries(groupedMatches).map(([league, leagueMatches]) => {
                const isLeagueExpanded = expandedLeagues[league];
                return (
                  <div key={league} className="space-y-4">
                    <button 
                      onClick={() => toggleLeague(league)}
                      className="w-full flex items-center justify-between group"
                    >
                      <h3 className="text-lg font-black text-white/40 uppercase tracking-widest px-2 border-l-4 border-yellow-500/50 group-hover:text-white/60 transition-colors">
                        {league}
                      </h3>
                      <div className="text-white/20 group-hover:text-white/40 transition-colors">
                        {isLeagueExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </button>
                    
                    {isLeagueExpanded && (
                      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {leagueMatches.map((match) => {
                          const matchPredictions = user?.predictions?.filter(p => p.matchId === match.id) || [];
                          const isPredicted = matchPredictions.length > 0;
                          const isLocked = !!match.winner;
                          const isInSlip = betSlip.some(item => item.matchId === match.id);
                          const isExpanded = expandedMatches[match.id];
                          const canPick = !!user && !isLocked && picksLeft > 0;

                          const isSelected = (type: PredictionType, team?: string) => {
                            return betSlip.some(item => 
                              item.matchId === match.id && 
                              item.type === type && 
                              (team ? item.payload.team === team : true)
                            );
                          };

                          return (
                            <div
                              key={match.id}
                              className={`relative overflow-hidden bg-gradient-to-r ${match.color} p-[1.5px] rounded-2xl shadow-lg transition-all ${isInSlip ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-950' : ''}`}
                            >
                              <div className="bg-zinc-900/95 backdrop-blur-xl rounded-[0.9rem] p-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex flex-col gap-1.5 flex-1">
                                    {/* Team 1 */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <LazyLogo src={match.team1_logo} size={24} className="rounded-full bg-white/5" />
                                        <span className="font-bold text-xs text-white/90 truncate">{match.team1}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => addToSlip(match, 'winner', { team: match.team1 })}
                                          disabled={!canPick}
                                          className={`w-10 h-10 rounded-lg transition-all flex flex-col items-center justify-center border border-white/5 ${isSelected('winner', match.team1) ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-400' : 'bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-40'}`}
                                        >
                                          <span className="font-black text-sm">1</span>
                                          <span className={`text-[11px] font-black ${isSelected('winner', match.team1) ? 'text-yellow-400' : 'text-yellow-500'}`}>
                                            {match.payoutWinnerTeam1?.toFixed(2)}
                                          </span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Team 2 */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <LazyLogo src={match.team2_logo} size={24} className="rounded-full bg-white/5" />
                                        <span className="font-bold text-xs text-white/90 truncate">{match.team2}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => addToSlip(match, 'winner', { team: match.team2 })}
                                          disabled={!canPick}
                                          className={`w-10 h-10 rounded-lg transition-all flex flex-col items-center justify-center border border-white/5 ${isSelected('winner', match.team2) ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-400' : 'bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-40'}`}
                                        >
                                          <span className="font-black text-sm">2</span>
                                          <span className={`text-[11px] font-black ${isSelected('winner', match.team2) ? 'text-yellow-400' : 'text-yellow-500'}`}>
                                            {match.payoutWinnerTeam2?.toFixed(2)}
                                          </span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Draw */}
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-[10px] text-white/30 italic">Draw</span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => addToSlip(match, 'draw', {})}
                                          disabled={!canPick}
                                          className={`w-10 h-10 rounded-lg transition-all flex flex-col items-center justify-center border border-white/5 ${isSelected('draw') ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-400' : 'bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-40'}`}
                                        >
                                          <span className="font-black text-sm">X</span>
                                          <span className={`text-[11px] font-black ${isSelected('draw') ? 'text-yellow-400' : 'text-yellow-500'}`}>
                                            {match.payoutDraw?.toFixed(2)}
                                          </span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-center justify-center border-l border-white/5 pl-3 min-w-[70px]">
                                    <div className="text-[9px] text-white/30 font-medium mb-1 text-center leading-tight">
                                      {(match.timeText || '').split(' ').map((part, i) => (
                                        <div key={i}>{part}</div>
                                      ))}
                                    </div>
                                    {isPredicted && (
                                      <div className="flex flex-col gap-1 mt-1">
                                        {matchPredictions.map((p, idx) => (
                                          <div key={idx} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-[7px] font-bold uppercase tracking-tighter text-center">
                                            {formatPredictionLabel(p)}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <button
                                      onClick={() => toggleExpand(match.id)}
                                      className={`mt-2 p-2 rounded-xl transition-all flex items-center justify-center gap-2 w-full border ${isExpanded ? 'bg-yellow-500 text-slate-950 border-yellow-400 shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-yellow-500 border-white/10 hover:bg-white/10'}`}
                                    >
                                      <span className="text-[10px] font-black uppercase tracking-widest">{isExpanded ? 'Hide Options' : 'More Options'}</span>
                                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="pt-3 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="grid grid-cols-2 gap-4">
                                      {/* HDP */}
                                      <div className="space-y-2">
                                        <div className="text-[8px] uppercase font-black tracking-widest text-white/20">Handicap</div>
                                        <div className="flex flex-col gap-1">
                                          <button
                                            onClick={() => addToSlip(match, 'hdp_1', { line: match.line })}
                                            disabled={!canPick}
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all border ${isSelected('hdp_1') ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80 disabled:opacity-40'}`}
                                          >
                                            <span className="text-[11px] font-black text-white/90">{match.team1} HDP <span className="text-yellow-500">{match.line}</span></span>
                                            <span className={`text-[11px] font-black ${isSelected('hdp_1') ? 'text-yellow-400' : 'text-yellow-500'}`}>{match.payoutHdp1?.toFixed(2)}</span>
                                          </button>
                                          <button
                                            onClick={() => addToSlip(match, 'hdp_2', { line: match.line })}
                                            disabled={!canPick}
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all border ${isSelected('hdp_2') ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80 disabled:opacity-40'}`}
                                          >
                                            <span className="text-[11px] font-black text-white/90">{match.team2} HDP <span className="text-yellow-500">-{match.line}</span></span>
                                            <span className={`text-[11px] font-black ${isSelected('hdp_2') ? 'text-yellow-400' : 'text-yellow-500'}`}>{match.payoutHdp2?.toFixed(2)}</span>
                                          </button>
                                        </div>
                                      </div>

                                      {/* O/U */}
                                      <div className="space-y-2">
                                        <div className="text-[8px] uppercase font-black tracking-widest text-white/20">Over / Under</div>
                                        <div className="flex flex-col gap-1">
                                          <button
                                            onClick={() => addToSlip(match, 'over', { line: match.payoutTotal })}
                                            disabled={!canPick}
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all border ${isSelected('over') ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80 disabled:opacity-40'}`}
                                          >
                                            <span className="text-[11px] font-black text-white/90">Over <span className="text-yellow-500">{match.payoutTotal}</span></span>
                                            <span className={`text-[11px] font-black ${isSelected('over') ? 'text-yellow-400' : 'text-yellow-500'}`}>{match.payoutOver?.toFixed(2)}</span>
                                          </button>
                                          <button
                                            onClick={() => addToSlip(match, 'under', { line: match.payoutTotal })}
                                            disabled={!canPick}
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all border ${isSelected('under') ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80 disabled:opacity-40'}`}
                                          >
                                            <span className="text-[11px] font-black text-white/90">Under <span className="text-yellow-500">{match.payoutTotal}</span></span>
                                            <span className={`text-[11px] font-black ${isSelected('under') ? 'text-yellow-400' : 'text-yellow-500'}`}>{match.payoutUnder?.toFixed(2)}</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Success Modal (Option A) */}
      {showSuccessModal && placedReceiptId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Receipt size={40} className="text-emerald-400" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Bet Confirmed!</h3>
                <p className="text-white/40 text-sm font-medium">Your bet has been accepted and saved to your history.</p>
                <div className="inline-block px-4 py-1 bg-white/5 rounded-full border border-white/10">
                  <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">ID: {placedReceiptId}</span>
                </div>
              </div>

              <div className="w-full grid grid-cols-1 gap-3 pt-4">
                <a 
                  href={`/api/receipt.php?id=${placedReceiptId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 font-bold uppercase tracking-widest text-sm"
                >
                  <Printer size={18} />
                  Print Receipt
                </a>
                
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setPlacedReceiptId(null);
                    setSuccessMessage('');
                  }}
                  className="px-8 py-4 bg-white/5 text-white/60 rounded-2xl hover:bg-white/10 transition-all font-bold uppercase tracking-widest text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Limit Notification */}
      {limitNotification && (
        <div className="fixed bottom-6 left-6 z-[100] bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-left-10 fade-in duration-300 border border-white/10">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-black uppercase tracking-tighter text-sm">Limit Reached</span>
            <span className="text-xs opacity-80 font-medium">You have reached your daily pick limit!</span>
          </div>
        </div>
      )}

      {/* Not Enough Guesses Alert */}
      {notEnoughGuesses && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-zinc-900 border border-red-500/30 rounded-3xl shadow-2xl shadow-red-500/10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center">
                <AlertCircle size={28} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white mb-1">Not Enough Picks</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  You don't have enough football guesses to place this bet. Contact your agent for more.
                </p>
              </div>
              <button
                onClick={() => setNotEnoughGuesses(false)}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Slip Button */}
      {betSlip.length > 0 && !showSlipOnMobile && createPortal(
        <button
          onClick={() => setShowSlipOnMobile(true)}
          className="lg:hidden fixed bottom-40 right-6 z-[9999] bg-gradient-to-r from-purple-600 to-pink-500 text-white p-4 rounded-full shadow-2xl animate-bounce flex items-center gap-2 border-2 border-white/20"
        >
          <Receipt size={24} />
          <span className="font-black text-sm">{betSlip.length}</span>
        </button>,
        document.body
      )}
    </div>
  );
}

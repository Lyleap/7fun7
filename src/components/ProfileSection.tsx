import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { User, Wallet, History, LogOut, Printer, ExternalLink, Trophy } from 'lucide-react';
import { fetchUserBetslips } from '../services/footballData';
import LazyLogo from './LazyLogo';
import RewardModal from './RewardModal';

export default function ProfileSection() {
  const { t, user, setUser, saveUser, settings } = useApp();
  const [betslips, setBetslips] = useState<any[]>([]);
  const [loadingSlips, setLoadingSlips] = useState(false);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [bonusPopup, setBonusPopup] = useState<{ milestone: number; amount: number } | null>(null);

  useEffect(() => {
    if (user?.username) {
      const loadSlips = async () => {
        setLoadingSlips(true);
        try {
          const slips = await fetchUserBetslips(user.username);
          console.log('Loaded betslips for', user.username, slips);
          setBetslips(slips);
        } catch (err) {
          console.error('Failed to load betslips:', err);
        } finally {
          setLoadingSlips(false);
        }
      };
      loadSlips();
    }
  }, [user?.username]);

  const handleLogout = () => {
    setUser(null);
  };

  const openReceipt = (receiptId: string) => {
    window.open(`/api/receipt.php?id=${receiptId}`, '_blank', 'width=600,height=800');
  };

  // Group predictions by receiptId
  const groupedPredictions = (user?.predictions || []).reduce((acc, p) => {
    const receiptMatch = p.match?.match(/\[Receipt: (R[A-Z0-9]+)\]/);
    const receiptId = p.receiptId || (receiptMatch ? receiptMatch[1] : null);
    
    if (receiptId) {
      if (!acc[receiptId]) {
        acc[receiptId] = {
          receiptId,
          predictions: [],
          totalOdd: 1,
          date: p.date
        };
      }
      acc[receiptId].predictions.push(p);
      if (p.odd) acc[receiptId].totalOdd *= p.odd;
    } else {
      // Individual prediction without receiptId
      const id = `indiv-${p.match}-${p.date}-${Math.random()}`;
      acc[id] = {
        receiptId: null,
        predictions: [p],
        totalOdd: p.odd || 1,
        date: p.date
      };
    }
    return acc;
  }, {} as Record<string, { receiptId: string | null, predictions: any[], totalOdd: number, date: string }>);

  const groupedList = Object.values(groupedPredictions)
    .filter(group => !betslips.some(s => s.receipt_id === group.receiptId))
    .sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (!user) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm p-6">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <User size={48} className="text-white/20" />
          </div>
          <h2 className="text-3xl font-bold text-white/40">{t.profile}</h2>
          <p className="text-white/20">Please login to view your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center p-6 overflow-y-auto scrollbar-hide">
      <div className="w-full max-w-2xl space-y-8 py-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-white/15 p-8 rounded-[2.5rem] border border-white/50">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-xl">
              <User size={40} className="text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black">{user.username}</h2>
              <p className="text-white/40">Member since Jan 2026</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all"
          >
            <LogOut size={24} />
          </button>
        </div>

        {/* Monthly Reward Notification */}
        {user.Get_monthly_reward && !user.Claimed_Monthly && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 p-6 rounded-[2.5rem] border border-yellow-500/50 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Wallet size={24} className="text-black" />
              </div>
              <div>
                <h4 className="text-lg font-black text-yellow-400">Claim Monthly Reward</h4>
                <p className="text-white/60 text-sm">You have a special reward waiting!</p>
              </div>
            </div>
            <button 
              onClick={() => setIsRewardModalOpen(true)}
              className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl transition-all shadow-lg active:scale-95"
            >
              CLAIM
            </button>
          </div>
        )}

        <RewardModal 
          isOpen={isRewardModalOpen} 
          onClose={() => setIsRewardModalOpen(false)} 
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/15 p-6 rounded-[2rem] border border-white/50 flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div className="absolute inset-0 bg-yellow-500/20 blur-lg rounded-full animate-pulse" />
              <img src="/currency.png" alt="coin" className="w-6 h-6 object-contain relative z-10" />
            </div>
            <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Balance</span>
            <span className="text-xl font-black text-yellow-400 mt-1 tabular-nums">{user.promotion_balance.toLocaleString()}</span>
          </div>
          <div className="bg-white/15 p-6 rounded-[2rem] border border-white/50 flex flex-col items-center text-center">
            <History className="text-blue-400 mb-3" size={24} />
            <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Spins</span>
            <span className="text-xl font-black text-white mt-1">{user.spinsLeft}</span>
          </div>
          <div className="bg-white/15 p-6 rounded-[2rem] border border-white/50 flex flex-col items-center text-center">
            <ExternalLink className="text-green-400 mb-3" size={24} />
            <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">Bets</span>
            <span className="text-xl font-black text-white mt-1">{user.football_guess}</span>
          </div>
        </div>

        {/* ── Deposit Bonus Progress ── */}
        {(() => {
          const MILESTONES = [10, 25, 100, 500, 1000];
          const progress = user.Deposit_progress ?? 0;
          const claimed  = user.claimedDepositBonuses ?? [];
          // Log scale spreads milestones evenly: $10→33%, $25→47%, $100→67%, $500→90%, $1000→100%
          const toLogPct = (v: number) => v <= 0 ? 0 : Math.min(100, (Math.log10(v) / 3) * 100);
          const progressPct   = toLogPct(progress);
          const nextMilestone = MILESTONES.find(m => progress < m);
          const toNext        = nextMilestone != null ? nextMilestone - progress : null;

          const handleClaim = async (milestone: number) => {
            const ranges = settings?.depositBonusRanges ?? {};
            const range  = ranges[milestone.toString()] ?? { min: 5, max: 15 };
            const reward = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
            const updated = {
              ...user,
              promotion_balance: (user.promotion_balance ?? 0) + reward,
              claimedDepositBonuses: [...(user.claimedDepositBonuses ?? []), milestone],
            };
            await saveUser(updated);
            setBonusPopup({ milestone, amount: reward });
            setTimeout(() => setBonusPopup(null), 3000);
          };

          return (
            <div className="bg-white/15 p-6 rounded-[2.5rem] border border-white/50 relative overflow-hidden">
              {/* Decorative glow */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-black tracking-wide flex items-center gap-1.5">
                  💰 <span>Deposit Bonus</span>
                </h3>
                <span className="text-sm font-mono text-white/70">
                  {progress.toLocaleString()} / 1000
                </span>
              </div>
              <p className="text-sm text-white/65 mb-4">
                {toNext != null
                  ? `$${toNext} more to next reward`
                  : '🎉 All milestones reached!'}
              </p>

              {/* Bar track */}
              <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-orange-300 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Milestone markers (tick + arrow + label) */}
              <div className="relative mt-0.5" style={{ height: '60px' }}>
                {MILESTONES.map((milestone) => {
                  const pos      = toLogPct(milestone);
                  const isReached = progress >= milestone;
                  const isClaimed = claimed.includes(milestone);
                  const canClaim  = isReached && !isClaimed;
                  const label     = milestone >= 1000 ? '1K' : `$${milestone}`;

                  return (
                    <div
                      key={milestone}
                      className="absolute flex flex-col items-center"
                      style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                    >
                      {/* Tick dot sits on the bar */}
                      <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        isReached ? 'bg-yellow-400' : 'bg-white/20'
                      }`} />

                      {/* Arrow button */}
                      <button
                        onClick={() => canClaim && handleClaim(milestone)}
                        disabled={!canClaim}
                        title={
                          canClaim
                            ? `Claim $${milestone} milestone bonus!`
                            : isClaimed
                            ? 'Already claimed ✓'
                            : `$${milestone - progress} more to unlock`
                        }
                        className={`text-base leading-none mt-0.5 transition-all select-none ${
                          canClaim
                            ? 'cursor-pointer text-yellow-300 animate-bounce drop-shadow-[0_0_12px_rgba(253,224,71,0.9)]'
                            : isClaimed
                            ? 'cursor-default text-green-400 text-sm'
                            : 'cursor-default text-white/15'
                        }`}
                      >
                        {isClaimed ? '✅' : '▼'}
                      </button>

                      {/* Label */}
                      <span className={`text-[9px] font-black mt-0.5 leading-none ${
                        isReached ? 'text-yellow-400' : 'text-white/25'
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* History */}
        <div className="bg-white/15 p-8 rounded-[2.5rem] border border-white/50">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <History size={20} className="text-white/40" />
            Bet History
          </h3>
          
          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {/* Betslips Section */}
            {betslips.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] uppercase font-black tracking-widest text-white/90 mb-2">Football Betslips</h4>
                {betslips.map((slip) => (
                  <div key={slip.receipt_id} className="p-4 bg-white/15 rounded-2xl border border-white/50 flex items-center justify-between group hover:bg-white/10 transition-all">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-blue-400">{slip.receipt_id}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          slip.status.toLowerCase().includes('win') ? 'bg-green-500/20 text-green-400' :
                          slip.status.toLowerCase().includes('lose') ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {slip.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-white/40 font-medium">
                        {slip.match_quantity} Matches • @{slip.total_odd.toFixed(2)} • {new Date(slip.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button 
                      onClick={() => openReceipt(slip.receipt_id)}
                      className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all flex items-center gap-2"
                      title="View Receipt"
                    >
                      <Printer size={18} />
                      <span className="text-[10px] font-bold uppercase">Receipt</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Predictions Section */}
            {groupedList.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] uppercase font-black tracking-widest text-white/20 mb-2">Bet History</h4>
                {groupedList.map((group, i) => {
                  const { receiptId, predictions, totalOdd, date } = group;
                  const isSingle = predictions.length === 1;

                  return (
                    <div key={i} className="p-4 bg-white/15 rounded-2xl border border-white/50 flex items-center justify-between group hover:bg-white/10 transition-all">
                      <div className="flex flex-col">
                        {receiptId ? (
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                              {predictions.slice(0, 2).map((p, idx) => (
                                <LazyLogo key={idx} src={p.team1_logo} size={20} className="rounded-full border border-zinc-900 bg-white/5" />
                              ))}
                            </div>
                            <div>
                              <div className="text-xs font-black text-blue-400 uppercase tracking-tight mb-1">
                                Betslip: {receiptId}
                              </div>
                              <div className="text-[10px] font-bold text-white/60 flex items-center gap-2">
                                <span>{predictions.length} Matches</span>
                                <span className="text-yellow-500 font-black">@{totalOdd.toFixed(2)}</span>
                                <span className="text-white/40 ml-2">{date}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                              <LazyLogo src={predictions[0].team1_logo} size={20} className="rounded-full border border-zinc-900 bg-white/5" />
                              <LazyLogo src={predictions[0].team2_logo} size={20} className="rounded-full border border-zinc-900 bg-white/5" />
                            </div>
                            <div>
                              <div className="text-xs font-black text-white/80 uppercase tracking-tight mb-1">
                                {predictions[0].match.replace(/ \[Receipt: R[A-Z0-9]+\]/, '')}
                              </div>
                              <div className="text-[10px] font-bold text-blue-400 flex items-center gap-2">
                                <span>{predictions[0].team ? `${predictions[0].team} - ` : ''}{(predictions[0].type || 'BET').toUpperCase()}</span>
                                {(predictions[0].line !== undefined || predictions[0].hdp !== undefined) && (
                                  <span className="bg-blue-500/20 px-1.5 py-0.5 rounded text-[9px]">
                                    {predictions[0].line ?? predictions[0].hdp}
                                  </span>
                                )}
                                {predictions[0].odd !== undefined && (
                                  <span className="text-yellow-500 font-black">@{predictions[0].odd.toFixed(2)}</span>
                                )}
                                <span className="text-white/40 ml-2">{date}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      {receiptId && (
                        <button 
                          onClick={() => openReceipt(receiptId)}
                          className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all flex items-center gap-1.5"
                          title="View Receipt"
                        >
                          <Printer size={14} />
                          <span className="text-[9px] font-bold uppercase">Receipt</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Regular History Section */}
            <div className="space-y-3">
              <h4 className="text-[10px] uppercase font-black tracking-widest text-white/20 mb-2">Activity Log</h4>
              {(user.history || []).length > 0 ? (
                (user.history || []).map((item, i) => {
                  // Extract receipt ID if present in the history string
                  const receiptMatch = item.match(/\[Receipt: (R[A-Z0-9]+)\]/);
                  const receiptId = receiptMatch ? receiptMatch[1] : null;

                  return (
                    <div key={i} className="p-4 bg-white/15 rounded-xl text-sm font-medium border border-white/50 text-white/60 flex items-center justify-between group">
                      <span className="flex-1">{item}</span>
                      {receiptId && (
                        <button 
                          onClick={() => openReceipt(receiptId)}
                          className="ml-4 p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all flex items-center gap-1.5"
                          title="Print Receipt"
                        >
                          <Printer size={14} />
                          <span className="text-[9px] font-bold uppercase">Receipt</span>
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-white/20 text-center py-4 italic text-xs">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Deposit Bonus Claim Popup ── */}
      {bonusPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setBonusPopup(null)}
        >
          <div
            className="relative bg-gradient-to-br from-yellow-900/70 to-orange-900/70 backdrop-blur-2xl border border-yellow-500/50 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-xs mx-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-[2.5rem] border-2 border-yellow-400/20 animate-pulse pointer-events-none" />

            <div className="text-5xl mb-3 animate-bounce select-none">🎉</div>
            <h2 className="text-lg font-black text-yellow-400 mb-1 uppercase tracking-widest">
              Deposit Bonus!
            </h2>
            <p className="text-white/40 text-xs mb-5">
              ${bonusPopup.milestone} milestone reached
            </p>

            <div className="py-3">
              <span className="text-5xl font-black text-white tabular-nums">
                +{bonusPopup.amount}
              </span>
              <span className="text-yellow-400 font-bold text-xl ml-2">coins</span>
            </div>

            <p className="text-white/25 text-[10px] mt-3 uppercase tracking-wider">
              Added to your balance
            </p>

            {/* 3-second auto-dismiss countdown bar */}
            <div className="mt-5 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full bonus-shrink" />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        @keyframes bonus-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
        .bonus-shrink {
          animation: bonus-shrink 3s linear forwards;
        }
      `}</style>
    </div>
  );
}

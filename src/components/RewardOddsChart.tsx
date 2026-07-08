import React from 'react';
import { X, BarChart3, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RewardOddsChartProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIERS = [
  {
    key: 'legendary',
    label: 'Legendary',
    chance: 1,
    min: 500,
    max: 1500,
    color: '#EAB308',       // yellow
    glow: 'rgba(234,179,8,0.35)',
    bg: 'rgba(234,179,8,0.08)',
    border: 'rgba(234,179,8,0.3)',
    emoji: '🏆',
  },
  {
    key: 'epic',
    label: 'Epic',
    chance: 4,
    min: 250,
    max: 500,
    color: '#A855F7',       // purple
    glow: 'rgba(168,85,247,0.35)',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.3)',
    emoji: '💎',
  },
  {
    key: 'good',
    label: 'Good',
    chance: 8,
    min: 100,
    max: 300,
    color: '#3B82F6',       // blue
    glow: 'rgba(59,130,246,0.35)',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.3)',
    emoji: '⭐',
  },
  {
    key: 'common',
    label: 'Common',
    chance: 12,
    min: 25,
    max: 80,
    color: '#22C55E',       // green
    glow: 'rgba(34,197,94,0.35)',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.3)',
    emoji: '✨',
  },
  {
    key: 'uncommon',
    label: 'Uncommon',
    chance: 75,
    min: 10,
    max: 30,
    color: '#9CA3AF',       // gray
    glow: 'rgba(156,163,175,0.25)',
    bg: 'rgba(156,163,175,0.06)',
    border: 'rgba(156,163,175,0.2)',
    emoji: '📦',
  },
];

const MAX_COINS = 1500;

export default function RewardOddsChart({ isOpen, onClose }: RewardOddsChartProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-[2.5rem] overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(15,10,30,0.97) 0%, rgba(20,15,40,0.97) 100%)',
              border: '1.5px solid rgba(234,179,8,0.25)',
              boxShadow: '0 0 60px rgba(234,179,8,0.12), 0 25px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(234,179,8,0.18)', boxShadow: '0 0 16px rgba(234,179,8,0.3)' }}
                >
                  <BarChart3 size={20} className="text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Prize Odds</h3>
                  <p className="text-xs text-white/35 font-semibold">Monthly reward chest probabilities</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chart Body */}
            <div className="px-8 py-6 space-y-3">

              {/* Column Labels */}
              <div className="flex items-center gap-3 mb-1">
                <div className="w-32 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-bold text-white/25 tracking-widest">Chance</span>
                </div>
                <div className="w-48 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-white/25 tracking-widest">Coin Range (min → max)</span>
                </div>
              </div>

              {TIERS.map((tier, idx) => {
                // probability bar: use sqrt scale for visual clarity (so 75% doesn't dwarf 1%)
                const probBarPct = Math.sqrt(tier.chance / 75) * 100;
                // coin range bar positions as % of MAX_COINS
                const minPct = (tier.min / MAX_COINS) * 100;
                const maxPct = (tier.max / MAX_COINS) * 100;
                const rangePct = maxPct - minPct;

                return (
                  <motion.div
                    key={tier.key}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.35 }}
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{
                      background: tier.bg,
                      border: `1px solid ${tier.border}`,
                    }}
                  >
                    {/* Tier Label */}
                    <div className="w-32 shrink-0 flex items-center gap-2">
                      <span className="text-base">{tier.emoji}</span>
                      <div>
                        <div className="text-sm font-black" style={{ color: tier.color }}>
                          {tier.label}
                        </div>
                        <div className="text-xs font-bold text-white/40">{tier.chance}%</div>
                      </div>
                    </div>

                    {/* Probability Bar */}
                    <div className="flex-1">
                      <div className="h-5 bg-white/5 rounded-full overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${probBarPct}%` }}
                          transition={{ delay: idx * 0.06 + 0.2, duration: 0.6, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})`,
                            boxShadow: `0 0 8px ${tier.glow}`,
                          }}
                        />
                        <span
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black"
                          style={{ color: tier.color }}
                        >
                          {tier.chance}%
                        </span>
                      </div>
                    </div>

                    {/* Coin Range Bar */}
                    <div className="w-48 shrink-0">
                      <div className="h-5 bg-white/5 rounded-full overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0, left: `${minPct}%` }}
                          animate={{ width: `${rangePct}%`, left: `${minPct}%` }}
                          transition={{ delay: idx * 0.06 + 0.3, duration: 0.6, ease: 'easeOut' }}
                          className="absolute h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${tier.color}66, ${tier.color})`,
                            boxShadow: `0 0 8px ${tier.glow}`,
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white/70">
                          {tier.min.toLocaleString()} – {tier.max.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Summary Footer */}
            <div className="px-8 pb-8">
              <div
                className="rounded-2xl p-4 grid grid-cols-3 gap-4 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div>
                  <div className="text-xs text-white/30 font-bold uppercase tracking-widest mb-1">Best Prize</div>
                  <div className="flex items-center justify-center gap-1 text-yellow-400 font-black text-lg">
                    <Coins size={16} />
                    1,500
                  </div>
                  <div className="text-[10px] text-white/25 mt-0.5">Legendary max</div>
                </div>
                <div>
                  <div className="text-xs text-white/30 font-bold uppercase tracking-widest mb-1">Avg Reward</div>
                  <div className="flex items-center justify-center gap-1 text-blue-400 font-black text-lg">
                    <Coins size={16} />
                    ~34
                  </div>
                  <div className="text-[10px] text-white/25 mt-0.5">Expected value</div>
                </div>
                <div>
                  <div className="text-xs text-white/30 font-bold uppercase tracking-widest mb-1">Rare Chance</div>
                  <div className="flex items-center justify-center gap-1 text-purple-400 font-black text-lg">
                    5%
                  </div>
                  <div className="text-[10px] text-white/25 mt-0.5">Epic or better</div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

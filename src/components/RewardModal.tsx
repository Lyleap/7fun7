import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Coins, Sparkles, BarChart3 } from 'lucide-react';
import { Howl } from 'howler';
import { useApp } from '../context/AppContext';
import RewardOddsChart from './RewardOddsChart';

interface RewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ChestTier = 'uncommon' | 'common' | 'good' | 'epic' | 'legendary';

interface RewardResult {
  tier: ChestTier;
  amount: number;
}

const CHEST_CONFIG: Record<ChestTier, { label: string; color: string; border: string; glow: string; chance: number }> = {
  uncommon: { label: 'Uncommon', color: 'text-gray-400', border: 'border-gray-500/30', glow: 'shadow-gray-500/50', chance: 75 },
  common: { label: 'Common', color: 'text-green-400', border: 'border-green-500/30', glow: 'shadow-green-500/50', chance: 12 },
  good: { label: 'Good', color: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/50', chance: 8 },
  epic: { label: 'Epic', color: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-purple-500/50', chance: 4 },
  legendary: { label: 'Legendary', color: 'text-yellow-400', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/50', chance: 1 },
};

// Generate a random sequence of chests for the reel
const generateReel = (count: number) => {
  const tiers: ChestTier[] = ['uncommon', 'common', 'good', 'epic', 'legendary'];
  return Array.from({ length: count }, () => {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const tier of tiers) {
      cumulative += CHEST_CONFIG[tier as ChestTier].chance;
      if (rand <= cumulative) return tier as ChestTier;
    }
    return 'uncommon' as ChestTier;
  });
};

export default function RewardModal({ isOpen, onClose }: RewardModalProps) {
  const { user, setUser } = useApp();
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<RewardResult | null>(null);
  const [reel, setReel] = useState<ChestTier[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const tickSound = useRef<Howl | null>(null);
  const winSound = useRef<Howl | null>(null);
  const whooshSound = useRef<Howl | null>(null);

  useEffect(() => {
    // Initialize sounds
    tickSound.current = new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'], volume: 0.5 });
    winSound.current = new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'], volume: 0.7 });
    whooshSound.current = new Howl({ src: ['https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'], volume: 0.5 });

    if (isOpen) {
      setReel(generateReel(50));
      setResult(null);
      setShowResult(false);
      setIsSpinning(false);
    }
  }, [isOpen]);

  const handleSpin = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    whooshSound.current?.play();

    try {
      // Call API
      const response = await fetch('https://db.7fun7-api.online/api?type=user&action=claim_monthly_reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username })
      });
      const data = await response.json();

      if (data.success) {
        const winTier = data.tier as ChestTier;
        const winAmount = data.amount;
        
        // Insert the winning chest at a specific position in the reel (e.g., index 40)
        const winIndex = 40;
        const newReel = [...reel];
        
        // Near-miss logic: Place high-tier chests near the winning chest
        // This makes the user feel like they almost got something better
        const highTiers: ChestTier[] = ['epic', 'legendary'];
        
        // Always place a high-tier chest right next to the winner
        // This is the "near-miss" that creates addiction
        newReel[winIndex - 1] = highTiers[Math.floor(Math.random() * highTiers.length)];
        newReel[winIndex + 1] = highTiers[Math.floor(Math.random() * highTiers.length)];
        
        // Randomly place others in nearby slots
        const nearMissPositions = [winIndex - 2, winIndex + 2, winIndex - 3, winIndex + 3];
        nearMissPositions.forEach(pos => {
          if (pos >= 0 && pos < newReel.length && pos !== winIndex) {
            // 60% chance to put a high tier chest in other near-miss positions
            if (Math.random() > 0.4) {
              newReel[pos] = highTiers[Math.floor(Math.random() * highTiers.length)];
            }
          }
        });

        newReel[winIndex] = winTier;
        setReel(newReel);
        setResult({ tier: winTier, amount: winAmount });

        // Start animation after a short delay to ensure React has updated the DOM
        setTimeout(() => {
          const itemBaseWidth = 160; // w-40 is 160px
          const gap = 16; // gap-4 is 16px
          const itemWidth = itemBaseWidth + gap;
          const containerWidth = scrollRef.current?.offsetWidth || 0;
          
          // Calculate target scroll to center the winning item
          // We add a small random offset so it doesn't land exactly in the dead center every time
          const randomOffset = (Math.random() - 0.5) * 80; // +/- 40px
          const targetScroll = (winIndex * itemWidth) + (itemBaseWidth / 2) - (containerWidth / 2) + randomOffset;

          // Animate scroll
          let currentScroll = 0;
          const startTime = performance.now();
          const duration = 8000; // 8 seconds for maximum suspense

          const animate = (time: number) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Custom ease-out for a long, dramatic slow down
            const easeOut = 1 - Math.pow(1 - progress, 5);
            const scrollPos = easeOut * targetScroll;
            
            if (scrollRef.current) {
              scrollRef.current.scrollLeft = scrollPos;
            }

            // Play tick sound as items pass the center line
            const centerLine = scrollPos + (containerWidth / 2);
            const currentItemIndex = Math.floor(centerLine / itemWidth);
            
            if (currentItemIndex !== Math.floor(((currentScroll || 0) + (containerWidth / 2)) / itemWidth)) {
              tickSound.current?.play();
            }
            currentScroll = scrollPos;

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              // Animation finished
              setTimeout(() => {
                winSound.current?.play();
                setShowResult(true);
                setIsSpinning(false);
                
                // Update user balance in context
                if (user) {
                  setUser({
                    ...user,
                    balance: (user.balance || 0) + winAmount,
                    promotion_balance: (user.promotion_balance || 0) + winAmount,
                    Claimed_Monthly: true
                  });
                }
              }, 500);
            }
          };

          requestAnimationFrame(animate);
        }, 100);
      } else {
        alert(data.error || 'Failed to claim reward');
        setIsSpinning(false);
      }
    } catch (err) {
      console.error('Spin error:', err);
      setIsSpinning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-4xl bg-lavender-900/20 border-2 border-yellow-500/50 rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.2)] backdrop-blur-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(230, 230, 250, 0.1) 0%, rgba(234, 179, 8, 0.05) 100%)',
        }}
      >
        {/* Glowy Edges */}
        <div className="absolute inset-0 pointer-events-none border border-yellow-500/30 rounded-[3rem] shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]" />
        
        {/* Header */}
        <div className="p-8 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.4)]">
              <Trophy size={24} className="text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-yellow-400 uppercase tracking-tighter">Monthly Reward</h2>
              <p className="text-white/40 text-sm font-bold">Spin to reveal your special prize!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOdds(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white/40 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all text-xs font-bold border border-white/10 hover:border-yellow-500/30"
              title="View prize odds"
            >
              <BarChart3 size={14} />
              Odds
            </button>
            {!isSpinning && (
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white">
                <X size={24} />
              </button>
            )}
          </div>
        </div>

        {/* Reel Container */}
        <div className="relative py-12 px-4 bg-black/40">
          {/* Center Indicator */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-yellow-500 z-10 shadow-[0_0_15px_rgba(234,179,8,0.8)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rotate-45" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rotate-45" />
          </div>

          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-hidden whitespace-nowrap py-4"
          >
            {reel.map((tier, i) => (
              <div 
                key={i}
                className={clsx(
                  "inline-block w-40 h-48 rounded-3xl border-2 transition-all flex-shrink-0",
                  "bg-white/5 flex flex-col items-center justify-center gap-4",
                  CHEST_CONFIG[tier].border,
                  "relative group"
                )}
              >
                <div className={clsx(
                  "w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl",
                  CHEST_CONFIG[tier].glow,
                  "bg-gradient-to-br from-white/10 to-transparent"
                )}>
                  {/* Placeholder for Chest Image */}
                  <img 
                    src={`/images/${tier}.png`} 
                    alt={tier}
                    className="w-20 h-20 object-contain drop-shadow-2xl"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/2854/2854567.png';
                    }}
                  />
                </div>
                <span className={clsx("text-xs font-black uppercase tracking-widest", CHEST_CONFIG[tier].color)}>
                  {CHEST_CONFIG[tier].label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer / Action */}
        <div className="p-12 flex flex-col items-center gap-6">
          <AnimatePresence mode="wait">
            {showResult && result ? (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center space-y-4"
              >
                <div className="flex items-center justify-center gap-3 text-5xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                  <Coins size={48} />
                  <span>+{result.amount.toLocaleString()}</span>
                </div>
                <p className="text-white/60 font-bold text-lg">
                  Congratulations! You won a <span className={CHEST_CONFIG[result.tier].color}>{CHEST_CONFIG[result.tier].label}</span> chest!
                </p>
                <button 
                  onClick={onClose}
                  className="mt-4 px-12 py-4 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl transition-all border border-white/20"
                >
                  COLLECT & CLOSE
                </button>
              </motion.div>
            ) : (
              <motion.button
                disabled={isSpinning}
                onClick={handleSpin}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={clsx(
                  "relative px-20 py-6 rounded-[2rem] font-black text-2xl uppercase tracking-tighter transition-all overflow-hidden group",
                  isSpinning ? "bg-white/10 text-white/20 cursor-not-allowed" : "bg-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.4)]"
                )}
              >
                <span className="relative z-10 flex items-center gap-3">
                  {isSpinning ? 'Spinning...' : 'Spin Now'}
                  {!isSpinning && <Sparkles className="animate-pulse" />}
                </span>
                {!isSpinning && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                )}
              </motion.button>
            )}
          </AnimatePresence>
          
          {!showResult && (
            <div className="flex gap-6 text-[10px] font-black text-white/20 uppercase tracking-widest">
              {Object.entries(CHEST_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={clsx("w-2 h-2 rounded-full", config.color.replace('text-', 'bg-'))} />
                  <span>{key} {config.chance}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Odds Chart Overlay */}
      <RewardOddsChart isOpen={showOdds} onClose={() => setShowOdds(false)} />
    </div>
  );
}

function clsx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

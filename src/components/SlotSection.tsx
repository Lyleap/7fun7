import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Coins, Zap, Play, Trophy, Star, Info } from 'lucide-react';
import { SYMBOLS, getSymbolById, REELS_COUNT, ROWS_COUNT, requestSpin, generateVisualReels, BackendSpinResponse } from '../services/slotEngine';

// --- Constants & Assets ---
const REEL_WIDTH = 80;
const SYMBOL_HEIGHT = 110;
const VISIBLE_ROWS = 5;
const SPIN_DURATION = 1200; 
const REEL_DELAY = 100;     

// Sound placeholders
const playSound = (type: 'spin' | 'stop' | 'win' | 'bigwin' | 'jackpot') => {
  console.log(`[Sound] ${type}`);
};

// --- Components ---

const SlotSymbol = ({ id, blur, highlight }: { id: string; blur: boolean; highlight?: boolean }) => {
  const symbol = getSymbolById(id);
  if (!symbol) return null;
  
  const isJackpot = id === 'jackpot';
  const isWild = symbol.isWild;
  const isScatter = symbol.isScatter;
  
  return (
    <div 
      className={`w-full h-[80px] md:h-[110px] flex items-center justify-center p-1 md:p-2 ${
        blur ? 'blur-[1px] scale-y-110 opacity-90' : 'transition-all duration-300 blur-0 scale-100'
      } ${highlight ? 'relative z-10' : !blur && highlight === false ? 'opacity-40 grayscale-[0.3]' : 'opacity-100'}`}
    >
      <div className={`relative w-full h-full flex items-center justify-center rounded-lg bg-gradient-to-b from-stone-100 to-stone-300 border-2 border-stone-400 shadow-md overflow-hidden ${highlight ? 'animate-pulse-gold' : ''} ${isJackpot ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : ''}`}>
        {highlight && (
          <div className="absolute inset-0 bg-yellow-400/30 blur-md rounded-lg animate-pulse" />
        )}
        
        <div className={`w-full h-full flex items-center justify-center p-1 ${isJackpot ? 'animate-bounce-subtle' : ''}`}>
          <div className={`text-3xl md:text-5xl font-black text-center select-none ${
            isJackpot ? 'text-yellow-600' : 
            isWild ? 'text-blue-600' : 
            isScatter ? 'text-purple-600' : 
            'text-stone-800'
          }`}>
            {symbol.label}
          </div>
        </div>
        
        {/* Tile Side Detail */}
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-stone-400/50 rounded-r-lg" />
      </div>
    </div>
  );
};

const Reel = ({ 
  index, 
  targetSymbols, 
  isSpinning, 
  onStop,
  winningRows = []
}: { 
  index: number; 
  targetSymbols: string[]; 
  isSpinning: boolean; 
  onStop: () => void;
  winningRows?: number[];
}) => {
  const reelRef = useRef<HTMLDivElement>(null);
  const [displaySymbols, setDisplaySymbols] = useState<string[]>([]);
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const [isBlurry, setIsBlurry] = useState(false);
  const [symbolHeight, setSymbolHeight] = useState(110);
  const offsetRef = useRef(0);
  const isDoneRef = useRef(true);

  useEffect(() => {
    const updateHeight = () => {
      setSymbolHeight(window.innerWidth < 768 ? 80 : 110);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Initialize with a long strip of random symbols
  useEffect(() => {
    const initial = Array.from({ length: 40 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id);
    setDisplaySymbols(initial);
  }, []);

  useEffect(() => {
    if (!isSpinning) {
      isDoneRef.current = true;
      return;
    }

    if (!isDoneRef.current) return;
    isDoneRef.current = false;
    startTimeRef.current = undefined;

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const duration = SPIN_DURATION + index * REEL_DELAY;

      if (elapsed < duration) {
        // Spinning phase
        const speed = 80; // Faster spin
        offsetRef.current = (offsetRef.current + speed) % (symbolHeight * 30);
        
        if (reelRef.current) {
          reelRef.current.style.transform = `translate3d(0, -${offsetRef.current}px, 0)`;
        }
        
        setIsBlurry(true);
        requestRef.current = requestAnimationFrame(animate);
      } else {
        // Stopping phase
        setIsBlurry(false);
        offsetRef.current = 0;
        
        if (reelRef.current) {
          // Add a slight bounce effect
          reelRef.current.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          reelRef.current.style.transform = 'translate3d(0, 0, 0)';
          
          // Clean up transition after it finishes
          setTimeout(() => {
            if (reelRef.current) reelRef.current.style.transition = 'none';
          }, 300);
        }
        
        // Update the top of the strip with target symbols
        setDisplaySymbols(prev => {
          const next = [...prev];
          targetSymbols.forEach((id, i) => {
            if (id) next[i] = id;
          });
          return next;
        });
        
        onStop();
        playSound('stop');
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isSpinning, index, targetSymbols, onStop, symbolHeight]);

  return (
    <div className="relative flex-1 h-[400px] md:h-[550px] overflow-hidden bg-gradient-to-b from-stone-900/80 via-stone-800/40 to-stone-900/80 border-x border-yellow-900/20 shadow-inner">
      <div 
        ref={reelRef}
        className="absolute w-full will-change-transform"
        style={{ transform: `translate3d(0, -${offsetRef.current}px, 0)` }}
      >
        {displaySymbols.map((id, i) => (
          <SlotSymbol 
            key={`${index}-${i}`} 
            id={id} 
            blur={isBlurry} 
            highlight={!isSpinning && winningRows.includes(i)}
          />
        ))}
      </div>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/40" />
    </div>
  );
};

export default function SlotSection() {
  const { t, user, updateUser, settings } = useApp();
  const [spinning, setSpinning] = useState(false);
  const [reelsStopped, setReelsStopped] = useState(0);
  const [visualReels, setVisualReels] = useState<string[][]>([]);
  const [showWinOverlay, setShowWinOverlay] = useState<'big' | 'mega' | 'none'>('none');
  const [winAmount, setWinAmount] = useState(0);
  const [processed, setProcessed] = useState(true);
  const [spinError, setSpinError] = useState('');

  // Store backend response so we can process it after reels stop
  const backendResultRef = useRef<BackendSpinResponse | null>(null);

  const handleReelStop = useCallback(() => {
    setReelsStopped(prev => prev + 1);
  }, []);

  // Process result after all reels have stopped spinning
  useEffect(() => {
    if (reelsStopped === REELS_COUNT && !processed) {
      setProcessed(true);
      setSpinning(false);

      const backendResult = backendResultRef.current;
      if (!backendResult || !backendResult.success) return;

      const payout = backendResult.slot_number;
      setWinAmount(payout);

      // Show win overlay — only if there's an actual prize
      if (payout > 0) {
        if (backendResult.reward_type === 'J') {
          setShowWinOverlay('mega');
          playSound('bigwin');
        } else if (backendResult.reward_type === 'B') {
          setShowWinOverlay('big');
          playSound('bigwin');
        } else {
          playSound('win');
        }
      }

      // Sync user state from backend — backend already updated balance + spins
      const historyEntry = `Slot Spin: ${payout > 0 ? 'WIN ' + payout + ' Coins' : 'LOSS'}`;
      updateUser(current => ({
        ...current,
        balance: current.balance + payout,
        promotion_balance: current.promotion_balance + payout,
        spinsLeft: backendResult.remaining_spins
      }), historyEntry);
    }
  }, [reelsStopped, processed, updateUser]);

  const spin = async () => {
    if (!user || user.spinsLeft <= 0 || spinning) return;

    // Reset state
    setSpinning(true);
    setProcessed(false);
    setReelsStopped(0);
    setShowWinOverlay('none');
    setWinAmount(0);
    setSpinError('');
    backendResultRef.current = null;

    // Generate visual-only reels for animation (eye candy, not used for payout)
    const reels = generateVisualReels();
    setVisualReels(reels);
    playSound('spin');

    try {
      // Call backend — this is where the real RNG + balance update happens
      const response = await requestSpin(user.username);

      if (!response.success) {
        // Backend rejected the spin (e.g., no spins left, server-side check)
        setSpinning(false);
        setProcessed(true);
        setSpinError(response.error || 'Spin failed. Please try again.');
        return;
      }

      // Store result — will be processed after reels finish animating
      backendResultRef.current = response;
    } catch (err) {
      // Network error or server down
      setSpinning(false);
      setProcessed(true);
      setSpinError('Connection error. Please try again.');
      console.error('Spin error:', err);
    }
  };

  const [bgIndex, setBgIndex] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex(prev => (prev % 4) + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white overflow-hidden font-sans p-4 relative">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url('/test${bgIndex}.png')`,
          filter: 'brightness(0.4) contrast(1.2)'
        }}
      />
      
      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 5px rgba(234,179,8,0.5); border-color: rgba(234,179,8,0.5); }
          50% { box-shadow: 0 0 20px rgba(234,179,8,0.8); border-color: rgba(234,179,8,1); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 1s ease-in-out infinite;
        }
        .animate-pulse-gold {
          animation: pulse-gold 1.5s ease-in-out infinite;
        }
      `}</style>
      
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-50" />
      </div>

      {/* Header */}
      <div className="relative z-10 mb-4 md:mb-6 text-center">
        <div className="flex items-center justify-center gap-4 mb-1">
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-500 to-orange-700 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]">
            7Fun7 Slot
          </h1>
        </div>
        <p className="text-yellow-500/60 uppercase tracking-[0.3em] text-[10px] md:text-sm font-bold">Classic Edition</p>
      </div>

      {/* Slot Machine Body */}
      <div className="relative z-10 w-full max-w-5xl p-2 md:p-4 bg-gradient-to-b from-amber-900 via-amber-800 to-amber-950 rounded-[2rem] md:rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.9),inset_0_2px_20px_rgba(255,255,255,0.1)] border-4 border-yellow-600/30">
        
        <div className="relative bg-[#0a0a0a] rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border-4 border-amber-950 shadow-[inset_0_0_60px_rgba(0,0,0,1)]">
          
          {/* Reels Container */}
          <div className="flex bg-[#050505] p-1 md:p-2 gap-1 md:gap-2">
            {Array.from({ length: REELS_COUNT }).map((_, i) => (
              <Reel 
                key={i} 
                index={i} 
                isSpinning={spinning} 
                targetSymbols={visualReels[i] || []}
                onStop={handleReelStop}
                winningRows={[]}
              />
            ))}
          </div>

          {/* Win Indicator Overlay */}
          {!spinning && winAmount > 0 && (
            <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
              <div className="absolute inset-0 bg-yellow-500/10 animate-pulse" />
              <div className="bg-black/90 border-2 border-yellow-500 px-10 py-6 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.6)] animate-bounce-subtle flex flex-col items-center">
                <div className="text-yellow-500 text-xs font-black uppercase tracking-[0.3em] mb-2">
                  WINNER
                </div>
                <div className="text-5xl md:text-7xl font-black text-white tabular-nums drop-shadow-lg">
                  +{winAmount.toLocaleString()}
                </div>
                <div className="mt-2 text-yellow-500/60 text-[10px] font-bold uppercase tracking-widest">
                  {backendResultRef.current?.reward_type === 'J' ? 'MEGA WIN!' : backendResultRef.current?.reward_type === 'B' ? 'BIG WIN!' : 'Nice Win!'}
                </div>
              </div>
            </div>
          )}

          {/* Spin Error Message */}
          {spinError && (
            <div className="absolute inset-0 pointer-events-none z-30 flex items-end justify-center pb-8">
              <div className="bg-red-900/90 border border-red-500 px-6 py-3 rounded-xl text-red-200 text-sm font-medium">
                {spinError}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Panel */}
        <div className="mt-4 md:mt-6 px-6 md:px-10 py-4 md:py-6 flex items-center justify-between gap-4 md:gap-8 bg-black/60 rounded-b-[1.5rem] md:rounded-b-[2.5rem] border-t border-yellow-900/30">
          
          {/* Balance */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-yellow-500/50 text-[10px] md:text-xs uppercase font-black tracking-widest">
              <Coins size={14} />
              Balance
            </div>
            <div className="text-2xl md:text-4xl font-black text-yellow-500 tabular-nums drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">
              {user?.promotion_balance.toLocaleString() || '0'}
            </div>
          </div>

          {/* Spin Button */}
          <button
            onClick={spin}
            disabled={spinning || (user?.spinsLeft || 0) <= 0}
            className={`group relative flex items-center justify-center gap-3 px-8 md:px-16 py-4 md:py-6 rounded-2xl md:rounded-3xl font-black text-xl md:text-3xl uppercase tracking-tighter transition-all duration-300 ${
              spinning || (user?.spinsLeft || 0) <= 0
                ? 'bg-stone-800 text-stone-600 cursor-not-allowed'
                : 'bg-gradient-to-b from-yellow-400 via-yellow-500 to-orange-600 text-amber-950 hover:scale-105 active:scale-95 shadow-[0_10px_40px_rgba(234,179,8,0.4)] hover:shadow-[0_15px_50px_rgba(234,179,8,0.6)]'
            }`}
          >
            {spinning ? (
              <Zap className="animate-spin" size={32} />
            ) : (
              <>
                <Play fill="currentColor" size={32} />
                Spin
              </>
            )}
            
            {/* Button Glow */}
            {!spinning && (user?.spinsLeft || 0) > 0 && (
              <div className="absolute inset-0 rounded-2xl md:rounded-3xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>

          {/* Spins Left */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 text-yellow-500/50 text-[10px] md:text-xs uppercase font-black tracking-widest">
              Spins Left
              <Star size={14} />
            </div>
            <div className="text-2xl md:text-4xl font-black text-white tabular-nums">
              {user?.spinsLeft || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Win Overlays */}
      {showWinOverlay !== 'none' && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500"
          onClick={() => setShowWinOverlay('none')}
        >
          <div className="text-center animate-in zoom-in duration-500">
            <div className="text-yellow-500 text-4xl md:text-6xl font-black uppercase mb-4 drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]">
              {showWinOverlay === 'mega' ? 'MEGA WIN!' : 'BIG WIN!'}
            </div>
            <div className="text-7xl md:text-9xl font-black text-white mb-8 tabular-nums">
              {winAmount.toLocaleString()}
            </div>
            <div className="text-white/60 text-xl uppercase tracking-[0.5em] animate-pulse">Click to continue</div>
          </div>
          
          {/* Particle effects would go here */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <div 
                key={i}
                className="absolute text-4xl animate-bounce"
                style={{ 
                  left: `${Math.random() * 100}%`, 
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  opacity: 0.3
                }}
              >
                🀄
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-8 md:mt-12 flex gap-4 md:gap-8 text-yellow-500/20 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2"><Info size={14} /> 97.2% RTP</div>
        <div className="flex items-center gap-2"><Zap size={14} /> High Volatility</div>
        <div className="flex items-center gap-2"><Star size={14} /> 5x5 Grid</div>
      </div>

      {!user && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-x1 flex items-center justify-center z-[110] p-6">
          <div className="text-center p-10 md:p-16 border-2 border-yellow-600/20 rounded-[3rem] bg-amber-950/10 w-full max-w-md">
            <h3 className="text-3xl md:text-4xl font-black mb-4 uppercase tracking-tighter text-yellow-500">Access Restricted</h3>
            <p className="text-yellow-500/40 mb-8 text-base">Please login to enter the 7Fun7 Casino.</p>
          </div>
        </div>
      )}
    </div>
  );
}

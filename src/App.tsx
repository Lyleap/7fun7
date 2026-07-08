import React, { useState, useEffect, useRef } from 'react';
import { Language, UserData, Settings, translations, Match } from './types';
import { AppContext, AppContextType } from './context/AppContext';
import LoginSection from './components/LoginSection';
import SlotSection from './components/SlotSection';
import FootballSection from './components/FootballSection';
import WorldcupSection from './components/WorldcupSection';
import ExchangeSection from './components/ExchangeSection';
import AdminSection from './components/AdminSection';
import LanguageToggle from './components/LanguageToggle';
import { LogOut, User, Gamepad2, Trophy, Globe, ArrowLeftRight } from 'lucide-react';
import { addHistoryEntry, normalizeUserData, persistUser, getSessionCookie, loadUser, clearSessionCookie } from './services/userPersistence';
import { normalizeSettings, loadSettings as fetchSettings } from './services/settingsPersistence';
import { fetchFootballMatches } from './services/footballData';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [user, setUser] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showIndicator, setShowIndicator] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetHideTimer = () => {
    setShowIndicator(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setShowIndicator(false);
    }, 4000);
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    resetHideTimer();
  }, [scrollProgress]);

  const saveUser = async (next: UserData) => {
    const normalized = normalizeUserData(next);
    setUser(normalized);
    await persistUser(normalized);
  };

  const updateUser = async (updater: (current: UserData) => UserData, historyEntry?: string) => {
    if (!user) return;
    let next = updater(user);
    if (historyEntry) {
      next = addHistoryEntry(next, historyEntry);
    }
    await saveUser(next);
  };
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    const loadSettings = async () => {
      const data = await fetchSettings();
      if (data) setSettings(data);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadMatches = async () => {
      const data = await fetchFootballMatches();
      setMatches(data);
    };
    loadMatches();
  }, []);

  useEffect(() => {
    const checkAdminHash = () => {
      setIsAdmin(window.location.hash === '#adminManagePage');
    };
    checkAdminHash();
    window.addEventListener('hashchange', checkAdminHash);
    return () => window.removeEventListener('hashchange', checkAdminHash);
  }, []);

  useEffect(() => {
    const autoLogin = async () => {
      const savedUsername = getSessionCookie();
      if (savedUsername && !user) {
        const userData = await loadUser(savedUsername);
        if (userData) {
          if (userData.isBlacklisted) {
            clearSessionCookie();
          } else {
            setUser(userData);
          }
        }
      }
    };
    autoLogin();
  }, []);

  const handleLogout = () => {
    setUser(null);
    clearSessionCookie();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!container || container.clientWidth === 0) return;
      const progress = container.scrollLeft / container.clientWidth;
      if (isNaN(progress)) return;
      setScrollProgress(progress);
      const page = Math.round(progress);
      setCurrentPage(prev => {
        if (prev !== page) return page;
        return prev;
      });
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    isDragging.current = true;
    startX.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeft.current = containerRef.current.scrollLeft;
    containerRef.current.style.scrollSnapType = 'none';
    containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleMouseUp = () => {
    if (!isDragging.current || !containerRef.current) return;
    isDragging.current = false;
    containerRef.current.style.cursor = 'default';
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Snap to nearest page
    const page = Math.round(containerRef.current.scrollLeft / containerRef.current.clientWidth);
    containerRef.current.scrollTo({
      left: page * containerRef.current.clientWidth,
      behavior: 'smooth'
    });

    // Re-enable snap after smooth scroll finishes
    scrollTimeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.scrollSnapType = 'x mandatory';
      }
      scrollTimeoutRef.current = null;
    }, 600);
  };

  const t = translations[lang];

  const pageIcons = [
    { icon: User, label: t.profile },
    { icon: Gamepad2, label: t.slotMachine },
    { icon: Trophy, label: t.football },
    { icon: Globe, label: t.worldcup },
    { icon: ArrowLeftRight, label: t.exchange }
  ];

  const scrollToPage = (page: number) => {
    if (!containerRef.current) return;
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Temporarily disable snap to prevent jumping
    containerRef.current.style.scrollSnapType = 'none';
    
    containerRef.current.scrollTo({
      left: page * containerRef.current.clientWidth,
      behavior: 'smooth'
    });
    
    setCurrentPage(page);

    // Re-enable snap after smooth scroll finishes
    scrollTimeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.scrollSnapType = 'x mandatory';
      }
      scrollTimeoutRef.current = null;
    }, 600);
  };

  const backgrounds = [
    "/test1.png",
    "/test2.png",
    "/test3.png",
    "/test3.png",
    "/test4.png"
  ];

  // Preload images to prevent flickering and server choking
  useEffect(() => {
    backgrounds.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  if (isAdmin) {
    console.log('App: Rendering AdminSection');
    return (
      <AppContext.Provider value={{ 
        lang, setLang, user, setUser, saveUser, updateUser, 
        settings, setSettings, matches, setMatches, t 
      }}>
        <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex items-center justify-center">
          <React.Suspense fallback={<div className="text-white font-black animate-pulse">LOADING ADMIN...</div>}>
            <AdminSection onClose={() => {
              console.log('App: Closing AdminSection');
              setIsAdmin(false);
              window.location.hash = '';
            }} />
          </React.Suspense>
        </div>
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={{ 
      lang, setLang, user, setUser, saveUser, updateUser, 
      settings, setSettings, matches, setMatches, t 
    }}>
      <div className="relative h-screen w-screen overflow-hidden bg-black text-white font-sans">
        {/* Fixed Background Layers */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          {backgrounds.map((bg, i) => (
            <div 
              key={i}
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ 
                backgroundImage: `url("${bg}")`,
                opacity: Math.max(0, 1 - Math.abs(scrollProgress - i)),
                filter: 'blur(4px)'
              }}
            />
          ))}
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Desktop Balance Display */}
        {user && (
          <div className="fixed top-4 left-4 z-50 hidden lg:flex items-center gap-3 px-5 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-left-4 duration-700">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500/20 blur-lg rounded-full animate-pulse" />
              <img src="/currency.png" alt="coin" className="w-6 h-6 object-contain relative z-10" />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-[10px] uppercase font-black text-white/30 tracking-widest">Your Coins</span>
              <span className="text-xl font-black text-yellow-400 tracking-tighter tabular-nums">
                {user.promotion_balance.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <div className="fixed top-4 right-4 z-50 flex gap-2">
          {user && (
            <button
              onClick={handleLogout}
              className="p-2 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-full hover:bg-red-500/40 transition-all text-red-400"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          )}
          <LanguageToggle />
        </div>
        
        <div 
          ref={containerRef}
          className="snap-container relative z-10"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <section className="snap-section">
            <div className="section-content">
              <LoginSection />
            </div>
          </section>
          
          <section className="snap-section">
            <div className="section-content">
              <SlotSection />
            </div>
          </section>
          
          <section className="snap-section">
            <div className="section-content">
              <FootballSection />
            </div>
          </section>

          <section className="snap-section">
            <div className="section-content">
              <WorldcupSection />
            </div>
          </section>
          
          <section className="snap-section">
            <div className="section-content">
              <ExchangeSection />
            </div>
          </section>
        </div>

        {/* Page Indicator */}
        <div 
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-6 px-8 py-4 bg-black/50 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl transition-all duration-700 ${
            showIndicator ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0'
          }`}
          onMouseEnter={() => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            setShowIndicator(true);
          }}
          onMouseLeave={resetHideTimer}
        >
          {pageIcons.map((item, i) => {
            const Icon = item.icon;
            const isActive = currentPage === i;
            return (
              <button
                key={i}
                onClick={() => scrollToPage(i)}
                className={`group relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-500 ${
                  isActive 
                    ? 'bg-blue-600 text-white scale-125 shadow-xl shadow-blue-500/50 z-10' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/80 hover:scale-110'
                }`}
              >
                {/* Hover Label */}
                <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
                  {item.label}
                </span>

                <Icon size={isActive ? 28 : 24} strokeWidth={isActive ? 2.5 : 2} />
                
                {isActive && (
                  <div className="absolute -bottom-2 w-2 h-2 bg-white rounded-full animate-in zoom-in duration-300 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </AppContext.Provider>
  );
}

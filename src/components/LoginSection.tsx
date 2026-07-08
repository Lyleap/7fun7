import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LogIn, User, Wallet, History } from 'lucide-react';
import { loadUser, setSessionCookie } from '../services/userPersistence';
import ProfileSection from './ProfileSection';

export default function LoginSection() {
  const { t, user, setUser, saveUser } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalized = username.trim().toLowerCase();
      const userData = await loadUser(normalized);

      if (!userData) {
        setError(t.invalidUser);
        return;
      }

      if (userData.isBlacklisted) {
        setError(t.blacklisted);
        return;
      }

      setUser(userData);
      setSessionCookie(userData.username);
      await saveUser(userData);
      setShowModal(false);
    } catch (err) {
      setError(t.invalidUser);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <ProfileSection />;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden ">
      <div className="absolute bottom-4 left-6 z-20 text-xs text-white/60 font-semibold">
        Version 1.3
      </div>

      {/* Content */}
      <div className="relative z-10 w-full flex flex-col items-center px-4">
        <div className="flex flex-col items-center">
          <div className="relative mb-12 text-center">
            <h1 className="text-4xl md:text-6xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.7)]">
              7Fun7 Promo
            </h1>
            <span className="breathing absolute -top-3 -right-12 text-[12px] font-black tracking-[0.3em] text-yellow-300">
              BETA
            </span>
          </div>

          {!showModal && (
            <button
              onClick={() => setShowModal(true)}
              className="relative z-10 flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xl font-bold shadow-2xl transform hover:scale-105 transition-all"
            >
              <LogIn size={24} />
              {t.login}
            </button>
          )}

          {showModal && (
            <div className="relative z-20 w-full max-w-md mx-4 p-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl">
              <h2 className="text-3xl font-bold mb-6 text-center">{t.login}</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 opacity-80">{t.username}</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.enterUsername}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    required
                  />
                </div>
                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl animate-shake">
                    <p className="text-red-400 text-sm font-bold text-center">{error}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl font-bold transition-all"
                >
                  {loading ? '...' : t.login}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full py-2 text-sm opacity-60 hover:opacity-100 transition-all"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes breathing {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        .breathing {
          animation: breathing 2.2s ease-in-out infinite;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}

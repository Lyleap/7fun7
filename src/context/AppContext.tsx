import React, { createContext, useContext } from 'react';
import { Language, UserData, Settings, translations, Match } from '../types';

export interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  user: UserData | null;
  setUser: (user: UserData | null) => void;
  saveUser: (next: UserData) => Promise<void>;
  updateUser: (updater: (current: UserData) => UserData, historyEntry?: string) => Promise<void>;
  settings: Settings | null;
  setSettings: (settings: Settings) => void;
  matches: Match[];
  setMatches: (matches: Match[]) => void;
  t: typeof translations.en;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

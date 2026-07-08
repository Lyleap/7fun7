import React from 'react';
import { useApp } from '../context/AppContext';

export default function LanguageToggle() {
  const { lang, setLang, t } = useApp();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'km' : 'en')}
      className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-sm font-medium hover:bg-white/20 transition-all"
    >
      {t.switchLang}
    </button>
  );
}

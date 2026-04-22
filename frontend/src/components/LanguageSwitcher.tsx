import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
      <button
        onClick={() => changeLanguage('es')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '2rem',
          opacity: i18n.language === 'es' ? 1 : 0.4,
          transition: 'opacity 0.3s',
          filter: i18n.language === 'es' ? 'drop-shadow(0 0 10px rgba(0,240,255,0.8))' : 'none'
        }}
        title="Español"
      >
        <span role="img" aria-label="Español">🇪🇸</span>
      </button>
      <button
        onClick={() => changeLanguage('en')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '2rem',
          opacity: i18n.language.startsWith('en') ? 1 : 0.4,
          transition: 'opacity 0.3s',
          filter: i18n.language.startsWith('en') ? 'drop-shadow(0 0 10px rgba(255,0,60,0.8))' : 'none'
        }}
        title="English"
      >
        <span role="img" aria-label="English">🇬🇧</span>
      </button>
      <button
        onClick={() => changeLanguage('it')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '2rem',
          opacity: i18n.language === 'it' ? 1 : 0.4,
          transition: 'opacity 0.3s',
          filter: i18n.language === 'it' ? 'drop-shadow(0 0 10px rgba(0,255,0,0.8))' : 'none'
        }}
        title="Italiano"
      >
        <span role="img" aria-label="Italiano">🇮🇹</span>
      </button>
    </div>
  );
};

export default LanguageSwitcher;

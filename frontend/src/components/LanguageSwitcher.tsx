import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  return (
    <div className="language-switcher" aria-label="Language selector">
      <button
        className={i18n.language === 'es' ? 'active' : ''}
        onClick={() => i18n.changeLanguage('es')}
        title="Español"
        type="button"
      >
        ES
      </button>
      <button
        className={i18n.language.startsWith('en') ? 'active' : ''}
        onClick={() => i18n.changeLanguage('en')}
        title="English"
        type="button"
      >
        EN
      </button>
      <button
        className={i18n.language === 'it' ? 'active' : ''}
        onClick={() => i18n.changeLanguage('it')}
        title="Italiano"
        type="button"
      >
        IT
      </button>
    </div>
  );
};

export default LanguageSwitcher;

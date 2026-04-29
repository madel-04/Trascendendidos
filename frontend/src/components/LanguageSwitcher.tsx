import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.startsWith('en')
    ? 'en'
    : i18n.language.startsWith('it')
      ? 'it'
      : 'es';

  return (
    <label className="language-switcher" aria-label="Language selector">
      <span className="language-switcher-label">🌐</span>
      <select
        value={currentLanguage}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
        title="Language"
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
        <option value="it">IT</option>
      </select>
    </label>
  );
};

export default LanguageSwitcher;

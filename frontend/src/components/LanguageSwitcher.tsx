import React from "react";
import { useTranslation } from "react-i18next";

function SpainFlag() {
  return (
    <svg viewBox="0 0 24 18" width="18" height="14" aria-hidden="true" focusable="false">
      <rect width="24" height="18" rx="3" fill="#AA151B" />
      <rect y="4.5" width="24" height="9" fill="#F1BF00" />
    </svg>
  );
}

function ItalyFlag() {
  return (
    <svg viewBox="0 0 24 18" width="18" height="14" aria-hidden="true" focusable="false">
      <rect width="24" height="18" rx="3" fill="#F4F5F0" />
      <rect width="8" height="18" rx="3" fill="#009246" />
      <rect x="16" width="8" height="18" rx="3" fill="#CE2B37" />
    </svg>
  );
}

function UkFlag() {
  return (
    <svg viewBox="0 0 24 18" width="18" height="14" aria-hidden="true" focusable="false">
      <rect width="24" height="18" rx="3" fill="#012169" />
      <path d="M0 0l24 18M24 0L0 18" stroke="#FFF" strokeWidth="4" />
      <path d="M0 0l24 18M24 0L0 18" stroke="#C8102E" strokeWidth="2" />
      <path d="M12 0v18M0 9h24" stroke="#FFF" strokeWidth="6" />
      <path d="M12 0v18M0 9h24" stroke="#C8102E" strokeWidth="3" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Zm6.92 8h-3.08a14.9 14.9 0 0 0-1.3-5.02A7.02 7.02 0 0 1 18.92 11ZM12 5c.88 0 2.25 2.24 2.76 6H9.24C9.75 7.24 11.12 5 12 5ZM5.08 13h3.08a14.9 14.9 0 0 0 1.3 5.02A7.02 7.02 0 0 1 5.08 13ZM5.08 11A7.02 7.02 0 0 1 9.46 5.98A14.9 14.9 0 0 0 8.16 11H5.08Zm6.92 8c-.88 0-2.25-2.24-2.76-6h5.52C14.25 16.76 12.88 19 12 19Zm2.54-.98A14.9 14.9 0 0 0 15.84 13h3.08a7.02 7.02 0 0 1-4.38 5.02Z"
        fill="currentColor"
      />
    </svg>
  );
}

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.startsWith("en")
    ? "en"
    : i18n.language.startsWith("it")
      ? "it"
      : "es";

  const icons: Record<string, React.ReactNode> = {
    es: <SpainFlag />,
    en: <UkFlag />,
    it: <ItalyFlag />,
  };

  return (
    <label className="language-switcher" aria-label="Language selector">
      <span className="language-switcher-label" aria-hidden="true">
        {icons[currentLanguage] || <GlobeIcon />}
      </span>
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

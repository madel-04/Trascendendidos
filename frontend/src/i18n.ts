import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Traducciones en inglés y español
const resources = {
  en: {
    translation: {
      "TRANSCENDENCE PONG": "TRANSCENDENCE PONG",
      "PLAY LOCAL (2P)": "PLAY LOCAL (2P)",
      "MULTIPLAYER (COMING SOON)": "MULTIPLAYER (COMING SOON)",
      "LOGIN / REGISTER": "LOGIN / REGISTER",
      "LOCAL MATCH": "LOCAL MATCH",
      "EXIT TO MENU": "EXIT TO MENU",
      "PLAYER 1": "PLAYER 1",
      "PLAYER 2": "PLAYER 2",
      "W / S to move": "W / S to move",
      "Up / Down to move": "Up / Down to move",
      "Privacy Policy": "Privacy Policy",
      "Terms of Service": "Terms of Service"
    }
  },
  es: {
    translation: {
      "TRANSCENDENCE PONG": "PONG TRASCENDENCIA",
      "PLAY LOCAL (2P)": "JUGAR LOCAL (2P)",
      "MULTIPLAYER (COMING SOON)": "MULTIJUGADOR (PRÓXIMO)",
      "LOGIN / REGISTER": "INICIAR SESIÓN / REGISTRO",
      "LOCAL MATCH": "PARTIDA LOCAL",
      "EXIT TO MENU": "SALIR AL MENÚ",
      "PLAYER 1": "JUGADOR 1",
      "PLAYER 2": "JUGADOR 2",
      "W / S to move": "W / S para mover",
      "Up / Down to move": "Arriba / Abajo para mover",
      "Privacy Policy": "Política de Privacidad",
      "Terms of Service": "Términos de Servicio"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "es", // Idioma por defecto
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // No necesario para React
    }
  });

export default i18n;

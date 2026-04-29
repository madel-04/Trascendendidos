import { useTranslation } from "react-i18next";

const content = {
  en: {
    title: "Privacy Policy",
    meta: "Last updated: March 31, 2026",
    intro: "This Privacy Policy explains how Trascendence collects, uses, stores, and protects personal information when you use the platform.",
    sections: [
      ["1. Data We Collect", ["Account data: email, username, hashed password, and optional profile fields.", "Security data: two-factor authentication status and related verification metadata.", "User content: avatar uploads and profile bio information.", "Social activity: friend requests, friendships, blocks, and related timestamps.", "Technical data: logs needed for stability, abuse prevention, and troubleshooting."]],
      ["2. Why We Process Data", ["To create and secure user accounts.", "To provide profile and social features.", "To prevent abuse, spam, and unauthorized access.", "To maintain and improve service reliability."]],
      ["3. Legal Basis and Consent", "We process data based on service operation needs, security requirements, and, where applicable, your consent for optional features."],
      ["4. Data Retention", "Personal data is retained while your account is active and for a limited period afterward when required for legal compliance, security investigations, or system integrity."],
      ["5. Data Sharing", "We do not sell personal data. Data may be shared only with infrastructure providers needed to run the platform, or if required by law."],
      ["6. Security Measures", ["Passwords are stored as hashes, never in plaintext.", "Authentication uses signed tokens and optional 2FA.", "Rate limiting is applied to sensitive endpoints.", "Avatar uploads are validated and normalized server-side."]],
      ["7. Your Rights", ["Access your account data.", "Update profile details.", "Request account deletion where applicable.", "Object to non-essential processing where legally available."]],
      ["8. International Users", "If you access the service from outside the hosting region, you acknowledge that your data may be processed in jurisdictions with different privacy laws."],
      ["9. Children", "The platform is not intended for children under the minimum digital consent age in your jurisdiction."],
      ["10. Changes to This Policy", "We may update this policy from time to time. Significant changes will be published in the application with a revised update date."],
      ["11. Contact", "For privacy questions or data requests, contact the platform administrator through official project channels."],
    ],
  },
  es: {
    title: "Política de privacidad",
    meta: "Última actualización: 31 de marzo de 2026",
    intro: "Esta política explica cómo Trascendence recopila, usa, guarda y protege la información personal al usar la plataforma.",
    sections: [
      ["1. Datos que recopilamos", ["Datos de cuenta: email, username, contraseña cifrada y campos opcionales del perfil.", "Datos de seguridad: estado de autenticación 2FA y metadatos relacionados.", "Contenido del usuario: avatar y biografía del perfil.", "Actividad social: solicitudes de amistad, amistades, bloqueos y fechas.", "Datos técnicos: logs necesarios para estabilidad, prevención de abuso y diagnóstico."]],
      ["2. Por qué procesamos datos", ["Crear y proteger cuentas.", "Ofrecer funciones de perfil y social.", "Prevenir abuso, spam y accesos no autorizados.", "Mantener y mejorar la fiabilidad del servicio."]],
      ["3. Base legal y consentimiento", "Procesamos datos por necesidades operativas, requisitos de seguridad y, cuando corresponde, tu consentimiento para funciones opcionales."],
      ["4. Conservación de datos", "Los datos personales se conservan mientras la cuenta está activa y durante un periodo limitado cuando sea necesario por ley, seguridad o integridad del sistema."],
      ["5. Compartición de datos", "No vendemos datos personales. Solo pueden compartirse con proveedores necesarios para operar la plataforma o si la ley lo exige."],
      ["6. Medidas de seguridad", ["Las contraseñas se guardan como hashes, nunca en texto plano.", "La autenticación usa tokens firmados y 2FA opcional.", "Se aplica rate limiting en endpoints sensibles.", "Los avatares se validan y normalizan en servidor."]],
      ["7. Tus derechos", ["Acceder a tus datos.", "Actualizar detalles del perfil.", "Solicitar eliminación de cuenta cuando aplique.", "Oponerte a procesamientos no esenciales cuando sea legalmente posible."]],
      ["8. Usuarios internacionales", "Si accedes desde otra región, aceptas que tus datos pueden procesarse en jurisdicciones con leyes de privacidad distintas."],
      ["9. Menores", "La plataforma no está dirigida a menores de la edad mínima de consentimiento digital en su jurisdicción."],
      ["10. Cambios", "Podemos actualizar esta política. Los cambios importantes se publicarán en la aplicación con una nueva fecha."],
      ["11. Contacto", "Para dudas o solicitudes de privacidad, contacta con el administrador por los canales oficiales del proyecto."],
    ],
  },
  it: {
    title: "Informativa sulla privacy",
    meta: "Ultimo aggiornamento: 31 marzo 2026",
    intro: "Questa informativa spiega come Trascendence raccoglie, usa, conserva e protegge i dati personali quando usi la piattaforma.",
    sections: [
      ["1. Dati raccolti", ["Dati account: email, username, password cifrata e campi opzionali del profilo.", "Dati di sicurezza: stato 2FA e metadati correlati.", "Contenuti utente: avatar e bio.", "Attività social: richieste di amicizia, amicizie, blocchi e timestamp.", "Dati tecnici: log per stabilità, prevenzione abusi e troubleshooting."]],
      ["2. Perché trattiamo i dati", ["Creare e proteggere account.", "Fornire funzioni profilo e social.", "Prevenire abusi, spam e accessi non autorizzati.", "Mantenere e migliorare l'affidabilità del servizio."]],
      ["3. Base legale e consenso", "Trattiamo i dati per esigenze operative, requisiti di sicurezza e, dove applicabile, consenso per funzioni opzionali."],
      ["4. Conservazione", "I dati personali sono conservati mentre l'account è attivo e per un periodo limitato quando richiesto da legge, sicurezza o integrità del sistema."],
      ["5. Condivisione", "Non vendiamo dati personali. Possono essere condivisi solo con provider necessari alla piattaforma o se richiesto dalla legge."],
      ["6. Sicurezza", ["Le password sono salvate come hash, mai in chiaro.", "L'autenticazione usa token firmati e 2FA opzionale.", "Il rate limiting protegge endpoint sensibili.", "Gli avatar sono validati e normalizzati lato server."]],
      ["7. I tuoi diritti", ["Accedere ai dati dell'account.", "Aggiornare il profilo.", "Richiedere eliminazione account dove applicabile.", "Opporti a trattamenti non essenziali quando previsto dalla legge."]],
      ["8. Utenti internazionali", "Se accedi da fuori regione, riconosci che i dati possono essere trattati in giurisdizioni con leggi privacy diverse."],
      ["9. Minori", "La piattaforma non è destinata a minori sotto l'età minima di consenso digitale nella loro giurisdizione."],
      ["10. Modifiche", "Possiamo aggiornare questa informativa. Le modifiche importanti saranno pubblicate nell'app con data aggiornata."],
      ["11. Contatto", "Per domande privacy o richieste dati, contatta l'amministratore tramite i canali ufficiali del progetto."],
    ],
  },
};

export default function Privacy() {
  const { i18n } = useTranslation();
  const page = content[i18n.language.startsWith("it") ? "it" : i18n.language.startsWith("en") ? "en" : "es"];

  return (
    <div className="legal-layout">
      <article className="legal-panel">
        <h1>{page.title}</h1>
        <p className="legal-meta">{page.meta}</p>
        <p>{page.intro}</p>
        {page.sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            {Array.isArray(body) ? <ul>{body.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{body}</p>}
          </section>
        ))}
      </article>
    </div>
  );
}

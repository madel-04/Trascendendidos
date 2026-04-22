import { useTranslation } from "react-i18next";

const content = {
  en: {
    title: "Terms of Service",
    meta: "Effective date: March 31, 2026",
    intro: "These Terms govern access to and use of Trascendence. By creating an account or using the platform, you agree to these conditions.",
    sections: [
      ["1. Eligibility and Accounts", ["You must provide accurate registration information.", "You are responsible for maintaining account security.", "You must not share credentials with unauthorized third parties."]],
      ["2. Acceptable Use", ["No cheating, automation abuse, or service disruption attempts.", "No harassment, hate speech, or illegal content.", "No attempts to bypass authentication or authorization controls."]],
      ["3. User Content", "You retain ownership of content you upload, but grant the service a limited license to store and display it as needed for platform operation."],
      ["4. Moderation and Enforcement", "We may suspend, restrict, or terminate accounts that violate these Terms, compromise security, or harm other users."],
      ["5. Service Availability", "The platform is provided on an as-is and as-available basis. Features may change, pause, or disappear for maintenance or security reasons."],
      ["6. Intellectual Property", "Platform software, branding, design, and documentation are protected by applicable intellectual property laws."],
      ["7. Liability Limits", ["We do not guarantee uninterrupted, error-free operation.", "Liability is limited to direct, provable damages to the extent allowed by law.", "We are not responsible for third-party services or external links."]],
      ["8. Termination", "You may stop using the service at any time. We may terminate access for legal, security, or Terms violations."],
      ["9. Governing Law", "These Terms are governed by the laws applicable to the project owner jurisdiction, unless mandatory consumer rules apply otherwise."],
      ["10. Changes", "We may update these Terms for legal, technical, or product changes. Continued use means acceptance."],
      ["11. Contact", "For legal or Terms-related inquiries, contact the project administrator through official channels."],
    ],
  },
  es: {
    title: "Términos y condiciones",
    meta: "Fecha efectiva: 31 de marzo de 2026",
    intro: "Estos términos regulan el acceso y uso de Trascendence. Al crear una cuenta o usar la plataforma, aceptas estas condiciones.",
    sections: [
      ["1. Elegibilidad y cuentas", ["Debes proporcionar información de registro precisa.", "Eres responsable de mantener la seguridad de tu cuenta.", "No debes compartir credenciales con terceros no autorizados."]],
      ["2. Uso aceptable", ["No se permiten trampas, abuso de automatización ni intentos de interrumpir el servicio.", "No se permite acoso, discurso de odio ni contenido ilegal.", "No se permite intentar saltarse controles de autenticación o autorización."]],
      ["3. Contenido del usuario", "Conservas la propiedad del contenido que subes, pero concedes al servicio una licencia limitada para almacenarlo y mostrarlo cuando sea necesario."],
      ["4. Moderación", "Podemos suspender, restringir o terminar cuentas que violen estos términos, comprometan la seguridad o dañen a otros usuarios."],
      ["5. Disponibilidad", "La plataforma se ofrece tal cual y según disponibilidad. Las funciones pueden cambiar, pausarse o desaparecer por mantenimiento o seguridad."],
      ["6. Propiedad intelectual", "El software, marca, diseño y documentación están protegidos por leyes de propiedad intelectual."],
      ["7. Límites de responsabilidad", ["No garantizamos operación ininterrumpida o libre de errores.", "La responsabilidad se limita a daños directos y demostrables en la medida permitida por la ley.", "No somos responsables de servicios de terceros o enlaces externos."]],
      ["8. Terminación", "Puedes dejar de usar el servicio en cualquier momento. Podemos terminar el acceso por motivos legales, de seguridad o incumplimiento."],
      ["9. Ley aplicable", "Estos términos se rigen por las leyes aplicables a la jurisdicción del propietario del proyecto, salvo normas obligatorias de consumo."],
      ["10. Cambios", "Podemos actualizar estos términos por cambios legales, técnicos o de producto. El uso continuado implica aceptación."],
      ["11. Contacto", "Para consultas legales o sobre estos términos, contacta con el administrador por los canales oficiales."],
    ],
  },
  it: {
    title: "Termini di servizio",
    meta: "Data effettiva: 31 marzo 2026",
    intro: "Questi termini regolano l'accesso e l'uso di Trascendence. Creando un account o usando la piattaforma, accetti queste condizioni.",
    sections: [
      ["1. Idoneità e account", ["Devi fornire informazioni di registrazione accurate.", "Sei responsabile della sicurezza dell'account.", "Non devi condividere credenziali con terzi non autorizzati."]],
      ["2. Uso accettabile", ["Niente cheating, abuso di automazione o tentativi di interruzione del servizio.", "Niente molestie, odio o contenuti illegali.", "Nessun tentativo di bypassare autenticazione o autorizzazione."]],
      ["3. Contenuto utente", "Mantieni la proprietà dei contenuti caricati, ma concedi al servizio una licenza limitata per conservarli e mostrarli quando necessario."],
      ["4. Moderazione", "Possiamo sospendere, limitare o terminare account che violano i termini, compromettono la sicurezza o danneggiano altri utenti."],
      ["5. Disponibilità", "La piattaforma è fornita così com'è e secondo disponibilità. Le funzionalità possono cambiare, sospendersi o sparire per manutenzione o sicurezza."],
      ["6. Proprietà intellettuale", "Software, brand, design e documentazione sono protetti dalle leggi sulla proprietà intellettuale."],
      ["7. Limiti di responsabilità", ["Non garantiamo funzionamento ininterrotto o privo di errori.", "La responsabilità è limitata ai danni diretti e dimostrabili nei limiti di legge.", "Non siamo responsabili per servizi di terze parti o link esterni."]],
      ["8. Terminazione", "Puoi smettere di usare il servizio in qualsiasi momento. Possiamo terminare l'accesso per motivi legali, sicurezza o violazioni."],
      ["9. Legge applicabile", "Questi termini sono regolati dalle leggi della giurisdizione del proprietario del progetto, salvo norme obbligatorie per consumatori."],
      ["10. Modifiche", "Possiamo aggiornare i termini per cambi legali, tecnici o di prodotto. L'uso continuato implica accettazione."],
      ["11. Contatto", "Per richieste legali o sui termini, contatta l'amministratore tramite i canali ufficiali."],
    ],
  },
};

export default function Terms() {
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

export default function Privacy() {
  return (
    <div className="legal-layout">
      <article className="legal-panel">
        <h1>Privacy Policy</h1>
        <p className="legal-meta">Last updated: March 31, 2026</p>

        <p>
          This Privacy Policy explains how Trascendence collects, uses, stores, and protects personal
          information when you use the platform.
        </p>

        <h2>1. Data We Collect</h2>
        <ul>
          <li>Account data: email, username, hashed password, and optional profile fields.</li>
          <li>Security data: two-factor authentication status and related verification metadata.</li>
          <li>User content: avatar uploads and profile bio information.</li>
          <li>Social activity: friend requests, friendships, blocks, and related timestamps.</li>
          <li>Technical data: logs needed for stability, abuse prevention, and troubleshooting.</li>
        </ul>

        <h2>2. Why We Process Data</h2>
        <ul>
          <li>To create and secure user accounts.</li>
          <li>To provide profile and social features.</li>
          <li>To prevent abuse, spam, and unauthorized access.</li>
          <li>To maintain and improve service reliability.</li>
        </ul>

        <h2>3. Legal Basis and Consent</h2>
        <p>
          We process data based on service operation needs, security requirements, and, where applicable,
          your consent for optional features.
        </p>

        <h2>4. Data Retention</h2>
        <p>
          Personal data is retained while your account is active and for a limited period afterward when
          required for legal compliance, security investigations, or system integrity.
        </p>

        <h2>5. Data Sharing</h2>
        <p>
          We do not sell personal data. Data may be shared only with infrastructure providers needed to run
          the platform, or if required by law.
        </p>

        <h2>6. Security Measures</h2>
        <ul>
          <li>Passwords are stored as hashes, never in plaintext.</li>
          <li>Authentication uses signed tokens and optional 2FA.</li>
          <li>Rate limiting is applied to sensitive endpoints.</li>
          <li>Avatar uploads are validated and normalized server-side.</li>
        </ul>

        <h2>7. Your Rights</h2>
        <ul>
          <li>Access your account data.</li>
          <li>Update profile details.</li>
          <li>Request account deletion where applicable.</li>
          <li>Object to non-essential processing where legally available.</li>
        </ul>

        <h2>8. International Users</h2>
        <p>
          If you access the service from outside the hosting region, you acknowledge that your data may be
          processed in jurisdictions with different privacy laws.
        </p>

        <h2>9. Children</h2>
        <p>
          The platform is not intended for children under the minimum digital consent age in your
          jurisdiction.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Significant changes will be published in the
          application with a revised update date.
        </p>

        <h2>11. Contact</h2>
        <p>
          For privacy questions or data requests, contact the platform administrator through official project
          channels.
        </p>
      </article>
    </div>
  );
}
export default function Privacy() {
  return (
    <div className="static-page glass-panel">
      <h1>Privacy Policy</h1>
      <p>This application collects only the data necessary to provide the Pong gaming service:</p>
      <ul>
        <li>Email address and username for account creation</li>
        <li>Password (stored as a secure hash, never in plain text)</li>
        <li>Optional TOTP secret for two-factor authentication</li>
      </ul>
      <p>Your data is never sold to third parties. You can request deletion of your account at any time.</p>
    </div>
  );
}

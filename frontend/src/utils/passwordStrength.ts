export type PasswordRule = {
  key: string;
  label: string;
  passed: boolean;
};

export type PasswordStrength = {
  score: number;
  level: "weak" | "medium" | "strong";
  rules: PasswordRule[];
};

export function evaluatePasswordStrength(
  password: string,
  context?: { email?: string; username?: string }
): PasswordStrength {
  const lowered = password.toLowerCase();
  const emailLocal = context?.email?.split("@")[0]?.trim().toLowerCase() ?? "";
  const username = context?.username?.trim().toLowerCase() ?? "";

  const rules: PasswordRule[] = [
    { key: "length", label: "PASSWORD_RULE_LENGTH", passed: password.length >= 12 },
    { key: "upper", label: "PASSWORD_RULE_UPPER", passed: /[A-Z]/.test(password) },
    { key: "lower", label: "PASSWORD_RULE_LOWER", passed: /[a-z]/.test(password) },
    { key: "digit", label: "PASSWORD_RULE_DIGIT", passed: /\d/.test(password) },
    { key: "symbol", label: "PASSWORD_RULE_SYMBOL", passed: /[^A-Za-z0-9]/.test(password) },
    { key: "space", label: "PASSWORD_RULE_SPACE", passed: !/\s/.test(password) },
    {
      key: "username",
      label: "PASSWORD_RULE_USERNAME",
      passed: username.length < 3 || !lowered.includes(username),
    },
    {
      key: "email",
      label: "PASSWORD_RULE_EMAIL",
      passed: emailLocal.length < 3 || !lowered.includes(emailLocal),
    },
  ];

  const score = rules.filter((rule) => rule.passed).length;
  const level: PasswordStrength["level"] = score >= 7 ? "strong" : score >= 5 ? "medium" : "weak";

  return { score, level, rules };
}

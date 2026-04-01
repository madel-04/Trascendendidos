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
    { key: "length", label: "Al menos 12 caracteres", passed: password.length >= 12 },
    { key: "upper", label: "Una letra mayuscula", passed: /[A-Z]/.test(password) },
    { key: "lower", label: "Una letra minuscula", passed: /[a-z]/.test(password) },
    { key: "digit", label: "Un numero", passed: /\d/.test(password) },
    { key: "symbol", label: "Un simbolo especial", passed: /[^A-Za-z0-9]/.test(password) },
    { key: "space", label: "Sin espacios", passed: !/\s/.test(password) },
    {
      key: "username",
      label: "No contiene tu username",
      passed: username.length < 3 || !lowered.includes(username),
    },
    {
      key: "email",
      label: "No contiene tu email",
      passed: emailLocal.length < 3 || !lowered.includes(emailLocal),
    },
  ];

  const score = rules.filter((rule) => rule.passed).length;
  const level: PasswordStrength["level"] = score >= 7 ? "strong" : score >= 5 ? "medium" : "weak";

  return { score, level, rules };
}

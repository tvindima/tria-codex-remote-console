const HIGH_RISK_PATTERNS = [
  /rm\s+-rf/i,
  /sudo\b/i,
  /chmod\s+777/i,
  /chown\b/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean/i,
  /docker\s+system\s+prune/i,
  /npm\s+publish/i,
  /vercel\s+deploy\s+--prod/i,
  /supabase\s+db\s+push/i,
  /drop\s+table/i,
  /truncate\b/i,
  /delete\s+from/i,
  /\.env/i,
  /id_rsa/i,
  /private_key/i,
];

const MEDIUM_RISK_PATTERNS = [/deploy/i, /production/i, /publish/i];

export function classifyRisk(command: string): "low" | "medium" | "high" {
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(command))) {
    return "high";
  }

  if (MEDIUM_RISK_PATTERNS.some((pattern) => pattern.test(command))) {
    return "medium";
  }

  return "low";
}

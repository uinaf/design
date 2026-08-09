export type Severity = "error" | "warn";

export type Violation = {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  /** What to do instead. A rule name alone tells an agent nothing actionable. */
  fix: string;
};

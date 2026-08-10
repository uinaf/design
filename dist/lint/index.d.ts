export type Severity = "error" | "warn";
export type Violation = {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  fix: string;
};
export type CheckOptions = { paths?: string[]; ignore?: string[] };
export type RatchetResult = {
  passed: boolean;
  risen: Array<{ rule: string; was: number; now: number }>;
  improved: Array<{ rule: string; was: number; now: number }>;
};
export declare const check: (options?: CheckOptions) => Violation[];
export declare const checkFile: (file: string, options?: CheckOptions) => Violation[];
export declare const checkCss: (css: string, file: string) => Violation[];
export declare const checkMarkup: (source: string, file: string) => Violation[];
export declare const collectFiles: (roots: string[], ignore?: string[]) => string[];
export declare const countByRule: (violations: Violation[]) => Record<string, number>;
export declare const compareRatchet: (
  baseline: Record<string, number>,
  current: Record<string, number>,
) => RatchetResult;
export declare const formatViolation: (violation: Violation) => string;
export declare const hasErrors: (violations: Violation[]) => boolean;
export declare const summarise: (violations: Violation[]) => string;

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { checkCss } from "./rules-css.ts";
import { checkMarkup, setJsxStyleChecker, type MarkupOptions } from "./rules-markup.ts";
import type { Violation } from "./types.ts";

export type { Severity, Violation } from "./types.ts";
export { checkCss } from "./rules-css.ts";
export { checkMarkup } from "./rules-markup.ts";

const CSS_EXTENSIONS = new Set([".css"]);
const MARKUP_EXTENSIONS = new Set([".html", ".htm", ".jsx", ".tsx", ".astro", ".svelte", ".vue"]);
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".wrangler",
  "coverage",
  ".turbo",
  "vendor",
]);

export type CheckOptions = MarkupOptions & {
  /** Files or directories to scan; defaults to the working directory. */
  paths?: string[];
  ignore?: string[];
};

// JSX object styles are judged by the same CSS rules as everything else.
setJsxStyleChecker((property, value, classes) => {
  const selector =
    classes
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => `.${c}`)
      .join("") || "*";
  return checkCss(`${selector}{${property}:${value}}`, "jsx").map((v) => ({ ...v, line: 1 }));
});

export const collectFiles = (roots: string[], ignore: string[] = []): string[] => {
  const found: string[] = [];
  const ignored = (file: string): boolean => ignore.some((pattern) => file.includes(pattern));
  // statSync follows symlinks, so a directory linking to an ancestor would
  // recurse forever. Real paths are visited at most once.
  const seen = new Set<string>();

  const walk = (target: string): void => {
    const stat = fs.statSync(target, { throwIfNoEntry: false });
    if (!stat) return;
    const real = fs.realpathSync.native(target);
    if (seen.has(real)) return;
    seen.add(real);
    if (stat.isFile()) {
      const ext = path.extname(target).toLowerCase();
      // Skipped directories apply to explicit file arguments too. A caller
      // passing a glob or a `git ls-files` result should never end up linting
      // its own dependencies.
      const inSkipped = target
        .split(path.sep)
        .slice(0, -1)
        .some((segment) => SKIP_DIRECTORIES.has(segment));
      if (
        (CSS_EXTENSIONS.has(ext) || MARKUP_EXTENSIONS.has(ext)) &&
        !ignored(target) &&
        !inSkipped
      ) {
        found.push(target);
      }
      return;
    }
    if (!stat.isDirectory()) return;
    if (SKIP_DIRECTORIES.has(path.basename(target))) return;
    for (const entry of fs.readdirSync(target)) walk(path.join(target, entry));
  };

  for (const root of roots) walk(root);
  return found.sort();
};

/**
 * `<!-- design-check-disable-next-line rule -->` or the CSS comment form.
 * Documentation that demonstrates an anti-pattern has to be able to say so;
 * without an escape hatch the only option is excluding whole files, which
 * silently drops every other rule too. Omit the rule name to suppress all.
 */
const DISABLE_NEXT_LINE =
  /(?:<!--|\/\*)\s{0,8}design-check-disable-next-line\s{0,8}([a-z-]*)\s{0,8}(?:-->|\*\/)/g;

const suppressions = (source: string): Array<{ line: number; rule: string }> =>
  [...source.matchAll(DISABLE_NEXT_LINE)].map((match) => ({
    line: source.slice(0, match.index ?? 0).split("\n").length + 1,
    rule: match[1] ?? "",
  }));

const applySuppressions = (source: string, violations: Violation[]): Violation[] => {
  const rules = suppressions(source);
  if (rules.length === 0) return violations;
  return violations.filter(
    (violation) =>
      !rules.some((s) => s.line === violation.line && (s.rule === "" || s.rule === violation.rule)),
  );
};

/**
 * Files this branch touched: committed changes against the base, uncommitted
 * edits to tracked files, and untracked new files. All three matter — a Stop
 * hook runs mid-work, so the most common case is an edit that is not committed
 * yet, and a brand new component is untracked.
 *
 * Enumerated through git argv rather than a shell pipeline, so a filename with
 * a space in it survives.
 */
export const changedFiles = (base = "origin/main"): string[] => {
  const run = (args: string[]): string[] => {
    try {
      return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
    } catch {
      return [];
    }
  };
  const [repoRoot] = run(["rev-parse", "--show-toplevel"]);
  if (!repoRoot) {
    throw new Error("--changed needs a git repository");
  }
  // Every subsequent command runs from the repository root. Git reports paths
  // relative to the current directory, so running from a subdirectory would
  // return paths that resolve nowhere and report a clean tree.
  // Enumeration must not swallow failures. A `base...HEAD` diff fails outright
  // when the two have no merge base (shallow clone, unrelated histories), and
  // treating that as "no files changed" reports a clean tree.
  const git = (args: string[]): string[] => {
    try {
      return execFileSync("git", ["-C", repoRoot, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
        .split("\n")
        .filter(Boolean);
    } catch (error) {
      const stderr = String((error as { stderr?: Buffer }).stderr ?? "").trim();
      throw new Error(
        `--changed could not run \`git ${args.join(" ")}\`${stderr ? `: ${stderr}` : ""}`,
      );
    }
  };
  let hasBase = true;
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${base}^{commit}`], {
      stdio: "ignore",
    });
  } catch {
    hasBase = false;
  }
  // Failing open here would drop every committed change and report a clean
  // tree, which is the one thing this check must never do.
  if (!hasBase) {
    throw new Error(
      `--changed cannot resolve base ref \`${base}\`. Fetch it, or pass --base <ref> (e.g. --base main).`,
    );
  }
  const linted = (file: string): boolean => {
    const ext = path.extname(file).toLowerCase();
    return CSS_EXTENSIONS.has(ext) || MARKUP_EXTENSIONS.has(ext);
  };
  return [
    ...new Set([
      ...git(["diff", "--name-only", "--diff-filter=d", `${base}...HEAD`]),
      ...git(["diff", "--name-only", "--diff-filter=d", "HEAD"]),
      ...git(["ls-files", "--others", "--exclude-standard"]),
    ]),
  ]
    .filter(linted)
    .map((file) => path.resolve(repoRoot, file))
    .filter((file) => fs.existsSync(file))
    .sort();
};

export const checkFile = (file: string, options: CheckOptions = {}): Violation[] => {
  const source = fs.readFileSync(file, "utf8");
  const ext = path.extname(file).toLowerCase();
  if (CSS_EXTENSIONS.has(ext)) return applySuppressions(source, checkCss(source, file));
  // Markup files can carry <style> blocks; both rule sets apply.
  const violations = checkMarkup(source, file, options);
  for (const block of source.matchAll(/<style[^>]{0,500}>([\s\S]{0,100000}?)<\/style\s{0,8}>/g)) {
    const offset = source.slice(0, block.index ?? 0).split("\n").length - 1;
    for (const violation of checkCss(block[1], file)) {
      violations.push({ ...violation, line: violation.line + offset });
    }
  }
  // Inline style attributes, which is where raw values most often appear. The
  // declarations are wrapped in a selector so the CSS rules see normal input;
  // the surrounding element's classes carry through so context-sensitive rules
  // (pill radius on a dot, uppercase on a label) still judge correctly.
  for (const tag of source.matchAll(/<[a-z][a-z0-9-]{0,40}\s[^>]{0,2000}>/gi)) {
    // Attributes are read independently: requiring class before style would
    // check `<i style="…" class="u-dot">` with no selector at all.
    const declarations = /\sstyle\s{0,8}=\s{0,8}["']([^"']*)["']/i.exec(tag[0])?.[1]?.trim();
    if (!declarations) continue;
    const classes = /\s(?:class|className)\s*=\s*["'{]([^"'}]*)["'}]/i.exec(tag[0])?.[1];
    const line = source.slice(0, tag.index ?? 0).split("\n").length;
    const selector = (classes ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => `.${c}`)
      .join("");
    for (const violation of checkCss(`${selector || "*"}{${declarations}}`, file)) {
      violations.push({ ...violation, line });
    }
  }
  return applySuppressions(source, violations);
};

export const check = (options: CheckOptions = {}): Violation[] => {
  const roots = options.paths?.length ? options.paths : [process.cwd()];
  // A typo must not read as a clean run. Silently scanning nothing is how a
  // quality gate gets disabled without anyone noticing.
  const missing = roots.filter((root) => !fs.existsSync(root));
  if (missing.length > 0) {
    throw new Error(`no such path: ${missing.join(", ")}`);
  }
  return collectFiles(roots, options.ignore ?? []).flatMap((file) => checkFile(file, options));
};

export const countByRule = (violations: Violation[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const violation of violations) {
    counts[violation.rule] = (counts[violation.rule] ?? 0) + 1;
  }
  return counts;
};

export type RatchetResult = {
  passed: boolean;
  risen: Array<{ rule: string; was: number; now: number }>;
  improved: Array<{ rule: string; was: number; now: number }>;
};

/**
 * Compare against the recorded baseline. Legacy pages migrate gradually; new
 * violations are blocked. Falling counts are reported as `improved` so the
 * caller can re-record the baseline; this function does not write anything.
 */
export const compareRatchet = (
  baseline: Record<string, number>,
  current: Record<string, number>,
): RatchetResult => {
  const rules = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  const risen: RatchetResult["risen"] = [];
  const improved: RatchetResult["improved"] = [];
  for (const rule of rules) {
    const was = baseline[rule] ?? 0;
    const now = current[rule] ?? 0;
    if (now > was) risen.push({ rule, was, now });
    if (now < was) improved.push({ rule, was, now });
  }
  return { passed: risen.length === 0, risen, improved };
};

export const formatViolation = (violation: Violation): string =>
  `${violation.file}:${violation.line}  ${violation.severity === "error" ? "error" : "warn "}  ${violation.rule}\n    ${violation.message}\n    → ${violation.fix}`;

export const hasErrors = (violations: Violation[]): boolean =>
  violations.some((v) => v.severity === "error");

export const summarise = (violations: Violation[]): string => {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.length - errors;
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(errors, "error")}, ${plural(warnings, "warning")}`;
};

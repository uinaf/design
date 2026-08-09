import { splitTopLevel } from "./split.ts";
import type { Violation } from "./types.ts";

/**
 * Markup rules over HTML and JSX. There is no full parse here on purpose: JSX
 * is not HTML, and a parser that chokes on one dialect is worse than a targeted
 * scan that is honest about its limits. Every rule below keys off class
 * attributes and tag shapes, which survive both dialects.
 *
 * Known limits: class values built at runtime (`className={cx(...)}`) are not
 * visible, and neither is markup assembled from fragments across files.
 */

const DEFAULT_ABBREVIATIONS = [
  "PR",
  "PRs",
  "AI",
  "API",
  "CLI",
  "URL",
  "URLs",
  "OG",
  "KV",
  "R2",
  "D1",
  "SHA",
  "HDR",
  "HLS",
  "TCC",
  "macOS",
  "iOS",
  "MCP",
  "CSS",
  "HTML",
  "JSON",
  "UI",
  "CI",
  "npm",
  "uinaf",
];

const lineOf = (source: string, index: number): number => source.slice(0, index).split("\n").length;

/** Class attribute in either dialect, static values only. */
// Anchored so `data-class=` and `subclass=` are not read as class attributes.
const CLASS_ATTR =
  /(?<![\w-])(?:class|className)\s{0,8}=\s{0,8}(?:"([^"]*)"|'([^']*)'|\{\s{0,8}"([^"]*)"\s{0,8}\}|\{\s{0,8}'([^']*)'\s{0,8}\})/g;

const classOccurrences = (source: string, wanted: string): number[] => {
  const hits: number[] = [];
  for (const match of source.matchAll(CLASS_ATTR)) {
    const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    if (value.split(/\s+/).includes(wanted)) hits.push(match.index ?? 0);
  }
  return hits;
};

// Emoji_Presentation only, plus explicit VS16 sequences. A blanket dingbat
// range would flag ✓ ✗ ↗ → ·, which the system uses *as* its iconography.
const EMOJI = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

/**
 * Matched per class token, not across the whole file, so prose mentioning
 * "fa-check" is not a violation. Deliberately excludes short generic prefixes
 * like `bi-` and `ti-`: `bi-weekly` is not an icon font, and a false positive
 * in a check that gates "done" is worse than a missed one.
 */
const ICON_FONT_CLASS =
  /^(?:(?:fa|fas|far|fab|fa-solid|fa-regular|glyphicon|mdi)-[a-z0-9-]+|material-icons(?:-[a-z]+)?|glyphicon)$/;

/** React leaves these unitless; everything else gets px appended to a number. */
const UNITLESS_PROPERTIES = new Set([
  "line-height",
  "font-weight",
  "opacity",
  "z-index",
  "flex",
  "flex-grow",
  "flex-shrink",
  "order",
  "zoom",
]);

export type MarkupOptions = { abbreviations?: string[] };

/** Injected by the runner so JSX object styles reuse the real CSS rules. */
let jsxStyleRules: (property: string, value: string, classes: string) => Violation[] = () => [];
export const setJsxStyleChecker = (
  checker: (property: string, value: string, classes: string) => Violation[],
): void => {
  jsxStyleRules = checker;
};

export const checkMarkup = (
  source: string,
  file: string,
  options: MarkupOptions = {},
): Violation[] => {
  const violations: Violation[] = [];
  const add = (
    index: number,
    rule: string,
    severity: Violation["severity"],
    message: string,
    fix: string,
  ): void => {
    violations.push({ rule, severity, file, line: lineOf(source, index), message, fix });
  };

  const accents = classOccurrences(source, "u-btn-accent");
  if (accents.length > 1) {
    for (const index of accents.slice(1)) {
      add(
        index,
        "one-accent-per-view",
        "error",
        `${accents.length} accent buttons in one view`,
        "the accent is a laser pointer: keep one .u-btn-accent per view and make the rest .u-btn-primary or .u-btn-ghost",
      );
    }
  }

  // Counted per topbar, not per file: a page may legitimately contain more
  // than one topbar, and the rule is that no single one stacks its rows.
  for (const header of source.matchAll(
    /<header\b[^>]{0,2000}\bu-topbar\b[^>]{0,2000}>([\s\S]{0,20000}?)<\/header\s{0,8}>/gi,
  )) {
    const rows = classOccurrences(header[1], "u-topbar-row");
    if (rows.length <= 1) continue;
    const base = (header.index ?? 0) + header[0].indexOf(header[1]);
    for (const offset of rows.slice(1)) {
      add(
        base + offset,
        "topbar-single-row",
        "error",
        `${rows.length} .u-topbar-row elements in one .u-topbar — product nav is ONE row`,
        "collapse to a single 56px row: mark and name left, links right, at most one small button",
      );
    }
  }

  // The topbar row and the page content must share a shell class, or the page
  // gets two different gutters and the nav visibly fails to line up.
  const shellOnRow =
    /(?:class|className)\s{0,8}=\s{0,8}["'{][^"'}]{0,300}\bu-shell-(\w{1,40})[^"'}]{0,300}\bu-topbar-row\b/.exec(
      source,
    );
  const shellOnRowReversed =
    /(?:class|className)\s{0,8}=\s{0,8}["'{][^"'}]{0,300}\bu-topbar-row\b[^"'}]{0,300}\bu-shell-(\w{1,40})/.exec(
      source,
    );
  // A pattern chunk is a fragment: it demonstrates the topbar and legitimately
  // has no page content to share a gutter with. Only a full page can violate this.
  const isFullPage = /<(main|article|section)\b/i.test(source) || /<\/header>\s*<\w/i.test(source);
  const shell = shellOnRow?.[1] ?? shellOnRowReversed?.[1];
  if (shell && isFullPage) {
    const shellClass = `u-shell-${shell}`;
    // Must appear on an element that is not a topbar row: two stacked rows both
    // carrying the shell class would otherwise satisfy a naive count.
    const onContent = [...source.matchAll(CLASS_ATTR)].some((match) => {
      const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
      const classes = value.split(/\s+/);
      return classes.includes(shellClass) && !classes.includes("u-topbar-row");
    });
    if (!onContent) {
      add(
        shellOnRow?.index ?? shellOnRowReversed?.index ?? 0,
        "shared-gutter",
        "error",
        `.${shellClass} appears only on the topbar row`,
        `put .${shellClass} on the page's main content wrapper too — the row and the content share one gutter`,
      );
    }
  }

  // Only text that actually renders: an emoji in a comment or a JS string is
  // source, not UI, and flagging it makes the rule noise in any .tsx file.
  const blank = (m: string): string => " ".repeat(m.length);
  // Bodies are bounded: an unterminated `<!--` would otherwise make each start
  // position scan to end of file, which is quadratic on a crafted input.
  const renderable = source
    .replace(/<!--[\s\S]{0,4000}?-->/g, blank)
    .replace(/\/\*[\s\S]{0,4000}?\*\//g, blank)
    .replace(/(^|\n)[^\S\n]{0,80}\/\/[^\n]{0,2000}/g, blank)
    // `</script >` is a valid end tag; a bare `</script>` match can be evaded.
    .replace(/<script\b[\s\S]{0,20000}?<\/script\s{0,8}>/gi, blank)
    .replace(/<style\b[\s\S]{0,20000}?<\/style\s{0,8}>/gi, blank);
  for (const match of renderable.matchAll(EMOJI)) {
    add(
      match.index ?? 0,
      "no-emoji",
      "error",
      `emoji ${match[0]} in markup`,
      "the system has no emoji; iconography is ↗ → · and hairlines",
    );
  }

  for (const match of source.matchAll(CLASS_ATTR)) {
    const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    for (const token of value.split(/\s+/)) {
      if (!ICON_FONT_CLASS.test(token)) continue;
      add(
        match.index ?? 0,
        "no-icon-fonts",
        "error",
        `icon font class ${token}`,
        "no icon fonts; use ↗ → · or an inline SVG hairline",
      );
    }
  }

  // JSX expresses inline styles as objects, so the quoted-string scan misses
  // them entirely on the .jsx/.tsx inputs this check advertises.
  for (const match of source.matchAll(
    /<[a-z][a-z0-9-]{0,40}\s[^>]{0,2000}?style\s{0,8}=\s{0,8}\{\{((?:[^{}]|\{[^{}]*\})*)\}\}/gi,
  )) {
    const body = match[1];
    // Carry the element's classes through, so a pill radius still passes on a
    // .u-dot in JSX exactly as it does in HTML.
    const jsxClasses = /(?<![\w-])(?:class|className)\s{0,8}=\s{0,8}["'{]([^"'}]*)["'}]/i.exec(
      match[0],
    )?.[1];
    for (const pair of splitTopLevel(body)) {
      const [rawKey, ...rest] = pair.split(":");
      if (rest.length === 0) continue;
      const key = rawKey.trim().replace(/["']/g, "");
      const rawText = rest.join(":").trim();
      const quoted = /^["']/.test(rawText);
      const raw = rawText.replace(/^["']|["']$/g, "");
      if (!key || !raw) continue;
      const property = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      // React reads a bare number on a length property as pixels, so
      // `{ padding: 7, borderRadius: 20 }` is 7px and 20px.
      const value =
        !quoted && /^-?\d+(?:\.\d+)?$/.test(raw) && !UNITLESS_PROPERTIES.has(property)
          ? `${raw}px`
          : raw;
      for (const violation of jsxStyleRules(property, value, jsxClasses ?? "")) {
        add(match.index ?? 0, violation.rule, violation.severity, violation.message, violation.fix);
      }
    }
  }

  // A filled band with a coloured left edge is the SaaS alert box the system
  // replaces with a dot and a word.
  for (const match of source.matchAll(/style\s{0,8}=\s{0,8}["'{]([^"'}]*)["'}]/g)) {
    const style = match[1].toLowerCase();
    if (/border-left\s*:/.test(style) && /background(-color)?\s*:/.test(style)) {
      add(
        match.index ?? 0,
        "status-shape",
        "warn",
        "filled band with an accent left border",
        "status is a small dot plus a lowercase word, never a filled banner",
      );
    }
  }

  // A <button> defaults to type="submit". Inside a form that turns a styled
  // button into an accidental submit, and this markup is meant to be copied.
  // Bounded quantifier: the attribute list is scanned once, never backtracked.
  for (const match of source.matchAll(/<button\b([^>]{0,2000})>/gi)) {
    const attributes = match[1] ?? "";
    if (/\btype\s{0,8}=/i.test(attributes)) continue;
    add(
      match.index ?? 0,
      "button-type",
      "warn",
      "<button> without an explicit type",
      'add type="button" — a bare <button> defaults to type="submit" and will submit any form it sits in',
    );
  }

  const abbreviations = new Set([...DEFAULT_ABBREVIATIONS, ...(options.abbreviations ?? [])]);
  // Visible copy inside elements that carry uinaf classes; anything outside the
  // design system is somebody else's text and not this check's business.
  for (const match of source.matchAll(
    /<(button|h1|h2|h3|a|span|label|th)\b[^>]{0,2000}(?:class|className)\s{0,8}=\s{0,8}["'{][^"'}]{0,300}\bu-[^"'}]{0,300}["'}][^>]{0,2000}>([^<>{]{2,80})</g,
  )) {
    const copy = match[2].trim();
    const firstWord = copy.split(/\s+/)[0]?.replace(/[^\w-]/g, "") ?? "";
    if (!/^[A-Z]/.test(firstWord)) continue;
    if (abbreviations.has(firstWord)) continue;
    if (/^[A-Z0-9]+$/.test(firstWord)) continue; // an all-caps token is an abbreviation
    add(
      match.index ?? 0,
      "lowercase-copy",
      "warn",
      `"${copy.slice(0, 40)}" starts with a capital`,
      `uinaf copy is lowercase except abbreviations (${[...abbreviations].slice(0, 6).join(", ")}, …)`,
    );
  }

  return violations;
};

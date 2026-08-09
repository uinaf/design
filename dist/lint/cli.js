#!/usr/bin/env node

// src/lint/cli.ts
import fs2 from "node:fs";
import path2 from "node:path";

// src/lint/index.ts
import fs from "node:fs";
import path from "node:path";

// src/lint/rules-css.ts
import postcss from "postcss";
var TYPE_SCALE = /* @__PURE__ */ new Set([
  "10px",
  "11px",
  "13px",
  "14px",
  "16px",
  "20px",
  "24px",
  "32px",
  "40px"
]);
var GRANDFATHERED_SIZE = "12px";
var MAX_RADIUS_PX = 6;
var SPACING_PROPERTIES = /^(margin|padding)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^gap$|^(row|column)-gap$/;
var SPACED_PROPERTY_SPLIT = /\s+/;
var isToken = (value2) => /var\(\s*--/.test(value2);
var withoutTokenReferences = (value2) => {
  let out = value2;
  let previous;
  do {
    previous = out;
    out = out.replace(
      /var\(\s*--[a-z0-9-]+\s*(?:,([^()]*))?\)/gi,
      (_, fallback) => fallback ?? " "
    );
  } while (out !== previous);
  return out;
};
var hasRawColor = (value2) => /#[0-9a-f]{3,8}\b/i.test(value2) || /\b(rgba?|hsla?|oklch|lab|color)\s*\(/i.test(value2);
var ALLOWED_RAW_COLORS = /* @__PURE__ */ new Set([
  "#000",
  "#000000",
  "#fff",
  "#ffffff",
  "transparent",
  "currentcolor",
  "inherit",
  "none",
  "unset",
  "initial"
]);
var ONE_DIMENSIONAL_SEGMENT = /(^|[-_])(dot|pill|bar|spark|tick|avatar)s?([-_]|$)/i;
var looksOneDimensional = (selector) => [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].some((m) => ONE_DIMENSIONAL_SEGMENT.test(m[1]));
var LABEL_CONTEXT = /label|tag|kicker|caps|micro|crumb|th\b/i;
var checkCss = (css, file) => {
  const violations2 = [];
  let root;
  try {
    root = postcss.parse(css, { from: file });
  } catch (error) {
    return [
      {
        rule: "parse-error",
        severity: "error",
        file,
        line: 1,
        message: `could not parse as CSS: ${error.message}`,
        fix: "check the file is valid CSS, or exclude it from design:check"
      }
    ];
  }
  const add = (node, rule, severity, message, fix) => {
    violations2.push({
      rule,
      severity,
      file,
      line: node.source?.start?.line ?? 1,
      message,
      fix
    });
  };
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    const value2 = decl.value.trim();
    const lower = value2.toLowerCase();
    const selector = decl.parent?.selector ?? "";
    const inTokenDefinition = prop.startsWith("--");
    const withoutTokens = withoutTokenReferences(value2);
    if (!inTokenDefinition && hasRawColor(withoutTokens) && !ALLOWED_RAW_COLORS.has(lower)) {
      add(
        decl,
        "no-raw-color",
        "error",
        `raw color in \`${prop}: ${value2}\``,
        "use a token: var(--fg), var(--bg), var(--border), var(--accent) \u2014 see /tokens.json"
      );
    }
    if (prop === "border-radius" || /^border-[a-z]+-radius$/.test(prop)) {
      for (const part of value2.split(SPACED_PROPERTY_SPLIT)) {
        const px = /^(\d+(?:\.\d+)?)px$/.exec(part);
        if (!px) continue;
        const size = Number.parseFloat(px[1]);
        if (size === 9999 || size >= 999) {
          if (!looksOneDimensional(selector)) {
            add(
              decl,
              "radius-ceiling",
              "error",
              `pill radius on \`${selector || prop}\``,
              "9999px is only for one-dimension elements like dots and bars; use var(--radius-sm)"
            );
          }
          continue;
        }
        if (size > MAX_RADIUS_PX) {
          add(
            decl,
            "radius-ceiling",
            "error",
            `border-radius ${part} exceeds ${MAX_RADIUS_PX}px`,
            "uinaf corners are square-ish: use var(--radius-xs), var(--radius-sm), or var(--radius-md)"
          );
        }
      }
    }
    if (prop === "box-shadow" && lower !== "none") {
      const allowed = /var\(\s*--(accent-glow|shadow-glow-accent|shadow-none)\s*\)/.test(value2);
      if (!allowed) {
        add(
          decl,
          "no-box-shadow",
          "error",
          `box-shadow: ${value2}`,
          "the system has no shadows; the one exception is var(--shadow-glow-accent)"
        );
      }
    }
    if (prop === "font-family" && !inTokenDefinition) {
      const verbatim = lower.includes("berkeley mono");
      if (!isToken(value2) && !verbatim && lower !== "inherit") {
        add(
          decl,
          "font-family-locked",
          "error",
          `font-family: ${value2}`,
          "Berkeley Mono is the only face: use var(--font-mono)"
        );
      }
    }
    if (prop === "font-size" && !inTokenDefinition) {
      const known = TYPE_SCALE.has(lower) || lower === GRANDFATHERED_SIZE;
      const relative = /^(inherit|smaller|larger|\d*\.?\d+(em|rem|%|ex|ch))$/.test(lower);
      if (!isToken(value2) && !known && !relative) {
        add(
          decl,
          "type-scale-only",
          "error",
          `font-size: ${value2} is not on the scale`,
          `use one of ${[...TYPE_SCALE].join(", ")} or var(--text-*)`
        );
      }
    }
    if (SPACING_PROPERTIES.test(prop) && !inTokenDefinition && !isToken(value2)) {
      for (const part of value2.split(SPACED_PROPERTY_SPLIT)) {
        const px = /^(-?\d+(?:\.\d+)?)px$/.exec(part);
        if (!px) continue;
        const size = Math.abs(Number.parseFloat(px[1]));
        if (size > 2 && size % 4 !== 0) {
          add(
            decl,
            "spacing-grid",
            "warn",
            `${prop}: ${part} is off the 4px grid`,
            "round to a multiple of 4, or use var(--sp-*)"
          );
        }
      }
    }
    if (prop === "text-transform" && lower === "uppercase") {
      if (!LABEL_CONTEXT.test(selector)) {
        add(
          decl,
          "no-uppercase",
          "warn",
          `uppercase on \`${selector || prop}\``,
          "uppercase belongs to 11px micro-labels and tags only; everything else is lowercase"
        );
      }
    }
  });
  return violations2;
};

// src/lint/rules-markup.ts
var DEFAULT_ABBREVIATIONS = [
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
  "uinaf"
];
var lineOf = (source, index) => source.slice(0, index).split("\n").length;
var CLASS_ATTR = /(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;
var classOccurrences = (source, wanted) => {
  const hits = [];
  for (const match of source.matchAll(CLASS_ATTR)) {
    const value2 = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    if (value2.split(/\s+/).includes(wanted)) hits.push(match.index ?? 0);
  }
  return hits;
};
var EMOJI = new RegExp("\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F", "gu");
var ICON_FONT_CLASS = /^(?:(?:fa|fas|far|fab|fa-solid|fa-regular|glyphicon|mdi)-[a-z0-9-]+|material-icons(?:-[a-z]+)?|glyphicon)$/;
var checkMarkup = (source, file, options = {}) => {
  const violations2 = [];
  const add = (index, rule, severity, message, fix) => {
    violations2.push({ rule, severity, file, line: lineOf(source, index), message, fix });
  };
  const accents = classOccurrences(source, "u-btn-accent");
  if (accents.length > 1) {
    for (const index of accents.slice(1)) {
      add(
        index,
        "one-accent-per-view",
        "error",
        `${accents.length} accent buttons in one view`,
        "the accent is a laser pointer: keep one .u-btn-accent per view and make the rest .u-btn-primary or .u-btn-ghost"
      );
    }
  }
  const topbars = classOccurrences(source, "u-topbar");
  const rows = classOccurrences(source, "u-topbar-row");
  if (topbars.length > 0 && rows.length > 1) {
    for (const index of rows.slice(1)) {
      add(
        index,
        "topbar-single-row",
        "error",
        `${rows.length} .u-topbar-row elements \u2014 product nav is ONE row`,
        "collapse to a single 56px row: mark and name left, links right, at most one small button"
      );
    }
  }
  const shellOnRow = /(?:class|className)\s*=\s*["'{][^"'}]*\bu-shell-(\w+)[^"'}]*\bu-topbar-row\b/.exec(source);
  const shellOnRowReversed = /(?:class|className)\s*=\s*["'{][^"'}]*\bu-topbar-row\b[^"'}]*\bu-shell-(\w+)/.exec(source);
  const isFullPage = /<(main|article|section)\b/i.test(source) || /<\/header>\s*<\w/i.test(source);
  const shell = shellOnRow?.[1] ?? shellOnRowReversed?.[1];
  if (shell && isFullPage) {
    const shellClass = `u-shell-${shell}`;
    const onContent = [...source.matchAll(CLASS_ATTR)].some((match) => {
      const value2 = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
      const classes = value2.split(/\s+/);
      return classes.includes(shellClass) && !classes.includes("u-topbar-row");
    });
    if (!onContent) {
      add(
        shellOnRow?.index ?? shellOnRowReversed?.index ?? 0,
        "shared-gutter",
        "error",
        `.${shellClass} appears only on the topbar row`,
        `put .${shellClass} on the page's main content wrapper too \u2014 the row and the content share one gutter`
      );
    }
  }
  for (const match of source.matchAll(EMOJI)) {
    add(
      match.index ?? 0,
      "no-emoji",
      "error",
      `emoji ${match[0]} in markup`,
      "the system has no emoji; iconography is \u2197 \u2192 \xB7 and hairlines"
    );
  }
  for (const match of source.matchAll(CLASS_ATTR)) {
    const value2 = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    for (const token of value2.split(/\s+/)) {
      if (!ICON_FONT_CLASS.test(token)) continue;
      add(
        match.index ?? 0,
        "no-icon-fonts",
        "error",
        `icon font class ${token}`,
        "no icon fonts; use \u2197 \u2192 \xB7 or an inline SVG hairline"
      );
    }
  }
  for (const match of source.matchAll(/style\s*=\s*["'{]([^"'}]*)["'}]/g)) {
    const style = match[1].toLowerCase();
    if (/border-left\s*:/.test(style) && /background(-color)?\s*:/.test(style)) {
      add(
        match.index ?? 0,
        "status-shape",
        "warn",
        "filled band with an accent left border",
        "status is a small dot plus a lowercase word, never a filled banner"
      );
    }
  }
  const abbreviations = /* @__PURE__ */ new Set([...DEFAULT_ABBREVIATIONS, ...options.abbreviations ?? []]);
  for (const match of source.matchAll(
    /<(button|h1|h2|h3|a|span|label|th)\b[^>]*(?:class|className)\s*=\s*["'{][^"'}]*\bu-[^"'}]*["'}][^>]*>([^<>{]{2,80})</g
  )) {
    const copy = match[2].trim();
    const firstWord = copy.split(/\s+/)[0]?.replace(/[^\w-]/g, "") ?? "";
    if (!/^[A-Z]/.test(firstWord)) continue;
    if (abbreviations.has(firstWord)) continue;
    if (/^[A-Z0-9]+$/.test(firstWord)) continue;
    add(
      match.index ?? 0,
      "lowercase-copy",
      "warn",
      `"${copy.slice(0, 40)}" starts with a capital`,
      `uinaf copy is lowercase except abbreviations (${[...abbreviations].slice(0, 6).join(", ")}, \u2026)`
    );
  }
  return violations2;
};

// src/lint/index.ts
var CSS_EXTENSIONS = /* @__PURE__ */ new Set([".css"]);
var MARKUP_EXTENSIONS = /* @__PURE__ */ new Set([".html", ".htm", ".jsx", ".tsx", ".astro", ".svelte", ".vue"]);
var SKIP_DIRECTORIES = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".wrangler",
  "coverage",
  ".turbo",
  "vendor"
]);
var collectFiles = (roots, ignore2 = []) => {
  const found = [];
  const ignored = (file) => ignore2.some((pattern) => file.includes(pattern));
  const walk = (target) => {
    const stat = fs.statSync(target, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isFile()) {
      const ext = path.extname(target).toLowerCase();
      if ((CSS_EXTENSIONS.has(ext) || MARKUP_EXTENSIONS.has(ext)) && !ignored(target)) {
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
var DISABLE_NEXT_LINE = /(?:<!--|\/\*)\s*design-check-disable-next-line\s*([a-z-]*)\s*(?:-->|\*\/)/g;
var suppressions = (source) => [...source.matchAll(DISABLE_NEXT_LINE)].map((match) => ({
  line: source.slice(0, match.index ?? 0).split("\n").length + 1,
  rule: match[1] ?? ""
}));
var applySuppressions = (source, violations2) => {
  const rules = suppressions(source);
  if (rules.length === 0) return violations2;
  return violations2.filter(
    (violation) => !rules.some((s) => s.line === violation.line && (s.rule === "" || s.rule === violation.rule))
  );
};
var checkFile = (file, options = {}) => {
  const source = fs.readFileSync(file, "utf8");
  const ext = path.extname(file).toLowerCase();
  if (CSS_EXTENSIONS.has(ext)) return applySuppressions(source, checkCss(source, file));
  const violations2 = checkMarkup(source, file, options);
  for (const block of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const offset = source.slice(0, block.index ?? 0).split("\n").length - 1;
    for (const violation of checkCss(block[1], file)) {
      violations2.push({ ...violation, line: violation.line + offset });
    }
  }
  for (const tag of source.matchAll(/<[a-z][a-z0-9-]*\s[^>]*>/gi)) {
    const declarations = /\sstyle\s*=\s*["']([^"']*)["']/i.exec(tag[0])?.[1]?.trim();
    if (!declarations) continue;
    const classes = /\s(?:class|className)\s*=\s*["'{]([^"'}]*)["'}]/i.exec(tag[0])?.[1];
    const line = source.slice(0, tag.index ?? 0).split("\n").length;
    const selector = (classes ?? "").split(/\s+/).filter(Boolean).map((c) => `.${c}`).join("");
    for (const violation of checkCss(`${selector || "*"}{${declarations}}`, file)) {
      violations2.push({ ...violation, line });
    }
  }
  return applySuppressions(source, violations2);
};
var check = (options = {}) => {
  const roots = options.paths?.length ? options.paths : [process.cwd()];
  return collectFiles(roots, options.ignore ?? []).flatMap((file) => checkFile(file, options));
};
var countByRule = (violations2) => {
  const counts2 = {};
  for (const violation of violations2) {
    counts2[violation.rule] = (counts2[violation.rule] ?? 0) + 1;
  }
  return counts2;
};
var compareRatchet = (baseline, current) => {
  const rules = /* @__PURE__ */ new Set([...Object.keys(baseline), ...Object.keys(current)]);
  const risen = [];
  const improved = [];
  for (const rule of rules) {
    const was = baseline[rule] ?? 0;
    const now = current[rule] ?? 0;
    if (now > was) risen.push({ rule, was, now });
    if (now < was) improved.push({ rule, was, now });
  }
  return { passed: risen.length === 0, risen, improved };
};
var formatViolation = (violation) => `${violation.file}:${violation.line}  ${violation.severity === "error" ? "error" : "warn "}  ${violation.rule}
    ${violation.message}
    \u2192 ${violation.fix}`;
var hasErrors = (violations2) => violations2.some((v) => v.severity === "error");
var summarise = (violations2) => {
  const errors = violations2.filter((v) => v.severity === "error").length;
  const warnings = violations2.length - errors;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(errors, "error")}, ${plural(warnings, "warning")}`;
};

// src/lint/cli.ts
var RATCHET_FILE = ".design-ratchet.json";
var argv = process.argv.slice(2);
var flag = (name) => argv.includes(`--${name}`);
var value = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? void 0 : argv[index + 1];
};
if (flag("help")) {
  console.log(`design-check \u2014 uinaf design adherence

  design-check [paths...]        check files or directories (default: cwd)
  design-check --ratchet         compare against ${RATCHET_FILE}, fail if any count rises
  design-check --update-ratchet  write the current counts as the new baseline
  design-check --json            machine-readable output
  design-check --ignore <part>   skip paths containing this substring (repeatable)

Exit code is 0 when clean, 1 when there are errors (or, with --ratchet, when a
count rises). Warnings alone do not fail.`);
  process.exit(0);
}
var ignore = argv.reduce((acc, arg, index) => {
  if (arg === "--ignore" && argv[index + 1]) acc.push(argv[index + 1]);
  return acc;
}, []);
var abbreviationsArg = value("abbreviations");
var paths = argv.filter((arg, index) => {
  if (arg.startsWith("--")) return false;
  const previous = argv[index - 1];
  return previous !== "--ignore" && previous !== "--abbreviations";
});
var violations = check({
  paths,
  ignore,
  abbreviations: abbreviationsArg ? abbreviationsArg.split(",") : void 0
});
var counts = countByRule(violations);
if (flag("json")) {
  console.log(JSON.stringify({ violations, counts }, null, 2));
  process.exit(hasErrors(violations) ? 1 : 0);
}
var ratchetPath = path2.resolve(RATCHET_FILE);
if (flag("update-ratchet")) {
  fs2.writeFileSync(ratchetPath, `${JSON.stringify(counts, null, 2)}
`);
  console.log(`wrote ${RATCHET_FILE} \u2014 ${summarise(violations)}`);
  process.exit(0);
}
if (flag("ratchet")) {
  if (!fs2.existsSync(ratchetPath)) {
    console.error(
      `no ${RATCHET_FILE} found. Record the current state first:
  design-check --update-ratchet`
    );
    process.exit(1);
  }
  const baseline = JSON.parse(fs2.readFileSync(ratchetPath, "utf8"));
  const result = compareRatchet(baseline, counts);
  for (const { rule, was, now } of result.risen) {
    console.error(`${rule}: ${was} \u2192 ${now}`);
    for (const violation of violations.filter((v) => v.rule === rule)) {
      console.error(formatViolation(violation));
    }
  }
  if (result.improved.length > 0) {
    console.log(
      `improved: ${result.improved.map(({ rule, was, now }) => `${rule} ${was}\u2192${now}`).join(", ")}`
    );
    console.log(`run \`design-check --update-ratchet\` to lock the improvement in`);
  }
  if (!result.passed) {
    console.error(`
design:check ratchet failed \u2014 ${result.risen.length} rule(s) got worse`);
    process.exit(1);
  }
  console.log(`design:check ratchet ok \u2014 ${summarise(violations)}, none worse than baseline`);
  process.exit(0);
}
for (const violation of violations) console.log(formatViolation(violation));
if (violations.length === 0) {
  console.log("design:check clean");
  process.exit(0);
}
console.log(`
design:check \u2014 ${summarise(violations)}`);
process.exit(hasErrors(violations) ? 1 : 0);

// src/lint/index.ts
import fs from "node:fs";
import path from "node:path";

// src/lint/rules-css.ts
import postcss from "postcss";

// src/lint/split.ts
var splitTopLevel = (value, separator = ",") => {
  const parts = [];
  let depth = 0;
  let quote;
  let current = "";
  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = void 0;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
};

// src/lint/rules-css.ts
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
var isToken = (value) => /var\(\s*--/.test(value);
var withoutTokenReferences = (value) => {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    if (!/^var\(\s*--/i.test(value.slice(i, i + 8))) {
      out += value[i];
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < value.length; j += 1) {
      if (value[j] === "(") depth += 1;
      if (value[j] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out += " ";
    i = j;
  }
  return out;
};
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
var NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet
   brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
   darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen
   darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey
   darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
   forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew
   hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue
   lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon
   lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime
   limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple
   mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue
   mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
   palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
   powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen
   seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal
   thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/).filter(Boolean)
);
var COLOR_PROPERTY = /(^|-)color$|^(background|border|outline|fill|stroke|box-shadow|text-shadow|caret|accent|column-rule|text-emphasis|text-decoration|border-(top|right|bottom|left|block|inline)(-(start|end))?)($|-)/;
var COLOR_TOKEN = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\((?:[^()]|\([^()]*\))*\)|\b[a-z]{3,20}\b/gi;
var withoutLiterals = (value) => value.replace(/"[^"]*"|'[^']*'/g, " ").replace(/url\([^)]*\)/gi, " ");
var disallowedColors = (rawValue, property) => {
  const acceptsColor = COLOR_PROPERTY.test(property);
  return [...withoutLiterals(rawValue).matchAll(COLOR_TOKEN)].map((m) => m[0].trim()).filter((color) => {
    const lower = color.toLowerCase();
    if (ALLOWED_RAW_COLORS.has(lower)) return false;
    if (/^[a-z]+$/i.test(lower)) return acceptsColor && NAMED_COLORS.has(lower);
    return true;
  });
};
var ONE_DIMENSIONAL_SEGMENT = /(^|[-_])(dot|pill|bar|spark|tick|avatar)s?([-_]|$)/i;
var looksOneDimensional = (selector) => [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].some((m) => ONE_DIMENSIONAL_SEGMENT.test(m[1]));
var LABEL_CONTEXT = /label|tag|kicker|caps|micro|crumb|th\b/i;
var checkCss = (css, file) => {
  const violations = [];
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
    violations.push({
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
    const value = decl.value.trim();
    const lower = value.toLowerCase();
    const selector = decl.parent?.selector ?? "";
    const inTokenDefinition = prop.startsWith("--");
    const offending = inTokenDefinition ? [] : disallowedColors(withoutTokenReferences(value), prop);
    if (offending.length > 0) {
      add(
        decl,
        "no-raw-color",
        "error",
        `raw color ${offending.join(", ")} in \`${prop}: ${value}\``,
        "use a token: var(--fg), var(--bg), var(--border), var(--accent) \u2014 see /tokens.json"
      );
    }
    if (prop === "border-radius" || /^border-([a-z]+-)+radius$/.test(prop)) {
      const parts = /calc\(/i.test(value) ? [...value.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => m[0]) : value.split(SPACED_PROPERTY_SPLIT);
      for (const part of parts) {
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
      const layers = splitTopLevel(value);
      const allowed = layers.every(
        (layer) => layer.toLowerCase() === "none" || /^var\(\s*--(accent-glow|shadow-glow-accent|shadow-none)\s*\)$/.test(layer)
      );
      if (!allowed) {
        add(
          decl,
          "no-box-shadow",
          "error",
          `box-shadow: ${value}`,
          "the system has no shadows; the one exception is var(--shadow-glow-accent)"
        );
      }
    }
    if (prop === "font-family" && !inTokenDefinition) {
      const verbatim = lower.includes("berkeley mono");
      if (!isToken(value) && !verbatim && lower !== "inherit") {
        add(
          decl,
          "font-family-locked",
          "error",
          `font-family: ${value}`,
          "Berkeley Mono is the only face: use var(--font-mono)"
        );
      }
    }
    if (prop === "font-size" && !inTokenDefinition) {
      const known = TYPE_SCALE.has(lower) || lower === GRANDFATHERED_SIZE;
      const relative = /^(inherit|smaller|larger|\d*\.?\d+(em|rem|%|ex|ch))$/.test(lower);
      if (!isToken(value) && !known && !relative) {
        add(
          decl,
          "type-scale-only",
          "error",
          `font-size: ${value} is not on the scale`,
          `use one of ${[...TYPE_SCALE].join(", ")} or var(--text-*)`
        );
      }
    }
    if (SPACING_PROPERTIES.test(prop) && !inTokenDefinition) {
      for (const part of withoutTokenReferences(value).split(SPACED_PROPERTY_SPLIT)) {
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
  return violations;
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
var CLASS_ATTR = /(?<![\w-])(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;
var classOccurrences = (source, wanted) => {
  const hits = [];
  for (const match of source.matchAll(CLASS_ATTR)) {
    const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    if (value.split(/\s+/).includes(wanted)) hits.push(match.index ?? 0);
  }
  return hits;
};
var EMOJI = new RegExp("\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F", "gu");
var ICON_FONT_CLASS = /^(?:(?:fa|fas|far|fab|fa-solid|fa-regular|glyphicon|mdi)-[a-z0-9-]+|material-icons(?:-[a-z]+)?|glyphicon)$/;
var UNITLESS_PROPERTIES = /* @__PURE__ */ new Set([
  "line-height",
  "font-weight",
  "opacity",
  "z-index",
  "flex",
  "flex-grow",
  "flex-shrink",
  "order",
  "zoom"
]);
var jsxStyleRules = () => [];
var setJsxStyleChecker = (checker) => {
  jsxStyleRules = checker;
};
var checkMarkup = (source, file, options = {}) => {
  const violations = [];
  const add = (index, rule, severity, message, fix) => {
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
        `put .${shellClass} on the page's main content wrapper too \u2014 the row and the content share one gutter`
      );
    }
  }
  const renderable = source.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length)).replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length)).replace(/(^|\n)\s*\/\/[^\n]*/g, (m) => " ".repeat(m.length)).replace(/<script[\s\S]*?<\/script>/gi, (m) => " ".repeat(m.length)).replace(/<style[\s\S]*?<\/style>/gi, (m) => " ".repeat(m.length));
  for (const match of renderable.matchAll(EMOJI)) {
    add(
      match.index ?? 0,
      "no-emoji",
      "error",
      `emoji ${match[0]} in markup`,
      "the system has no emoji; iconography is \u2197 \u2192 \xB7 and hairlines"
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
        "no icon fonts; use \u2197 \u2192 \xB7 or an inline SVG hairline"
      );
    }
  }
  for (const match of source.matchAll(
    /<[a-z][a-z0-9-]*\s[^>]*?style\s*=\s*\{\{((?:[^{}]|\{[^{}]*\})*)\}\}/gi
  )) {
    const body = match[1];
    const jsxClasses = /(?<![\w-])(?:class|className)\s*=\s*["'{]([^"'}]*)["'}]/i.exec(
      match[0]
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
      const value = !quoted && /^-?\d+(?:\.\d+)?$/.test(raw) && !UNITLESS_PROPERTIES.has(property) ? `${raw}px` : raw;
      for (const violation of jsxStyleRules(property, value, jsxClasses ?? "")) {
        add(match.index ?? 0, violation.rule, violation.severity, violation.message, violation.fix);
      }
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
  return violations;
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
setJsxStyleChecker((property, value, classes) => {
  const selector = classes.split(/\s+/).filter(Boolean).map((c) => `.${c}`).join("") || "*";
  return checkCss(`${selector}{${property}:${value}}`, "jsx").map((v) => ({ ...v, line: 1 }));
});
var collectFiles = (roots, ignore = []) => {
  const found = [];
  const ignored = (file) => ignore.some((pattern) => file.includes(pattern));
  const seen = /* @__PURE__ */ new Set();
  const walk = (target) => {
    const stat = fs.statSync(target, { throwIfNoEntry: false });
    if (!stat) return;
    const real = fs.realpathSync.native(target);
    if (seen.has(real)) return;
    seen.add(real);
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
var applySuppressions = (source, violations) => {
  const rules = suppressions(source);
  if (rules.length === 0) return violations;
  return violations.filter(
    (violation) => !rules.some((s) => s.line === violation.line && (s.rule === "" || s.rule === violation.rule))
  );
};
var checkFile = (file, options = {}) => {
  const source = fs.readFileSync(file, "utf8");
  const ext = path.extname(file).toLowerCase();
  if (CSS_EXTENSIONS.has(ext)) return applySuppressions(source, checkCss(source, file));
  const violations = checkMarkup(source, file, options);
  for (const block of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const offset = source.slice(0, block.index ?? 0).split("\n").length - 1;
    for (const violation of checkCss(block[1], file)) {
      violations.push({ ...violation, line: violation.line + offset });
    }
  }
  for (const tag of source.matchAll(/<[a-z][a-z0-9-]*\s[^>]*>/gi)) {
    const declarations = /\sstyle\s*=\s*["']([^"']*)["']/i.exec(tag[0])?.[1]?.trim();
    if (!declarations) continue;
    const classes = /\s(?:class|className)\s*=\s*["'{]([^"'}]*)["'}]/i.exec(tag[0])?.[1];
    const line = source.slice(0, tag.index ?? 0).split("\n").length;
    const selector = (classes ?? "").split(/\s+/).filter(Boolean).map((c) => `.${c}`).join("");
    for (const violation of checkCss(`${selector || "*"}{${declarations}}`, file)) {
      violations.push({ ...violation, line });
    }
  }
  return applySuppressions(source, violations);
};
var check = (options = {}) => {
  const roots = options.paths?.length ? options.paths : [process.cwd()];
  const missing = roots.filter((root) => !fs.existsSync(root));
  if (missing.length > 0) {
    throw new Error(`no such path: ${missing.join(", ")}`);
  }
  return collectFiles(roots, options.ignore ?? []).flatMap((file) => checkFile(file, options));
};
var countByRule = (violations) => {
  const counts = {};
  for (const violation of violations) {
    counts[violation.rule] = (counts[violation.rule] ?? 0) + 1;
  }
  return counts;
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
var hasErrors = (violations) => violations.some((v) => v.severity === "error");
var summarise = (violations) => {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.length - errors;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(errors, "error")}, ${plural(warnings, "warning")}`;
};
export {
  check,
  checkCss,
  checkFile,
  checkMarkup,
  collectFiles,
  compareRatchet,
  countByRule,
  formatViolation,
  hasErrors,
  summarise
};

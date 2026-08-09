import postcss from "postcss";
import { splitTopLevel } from "./split.ts";
import type { Violation } from "./types.ts";

/**
 * CSS rules, over a real AST rather than regexes. Comments and strings are
 * already excluded by the parser, which is the difference between a check that
 * guards the system and one that produces noise nobody trusts.
 */

const TYPE_SCALE = new Set([
  "10px",
  "11px",
  "13px",
  "14px",
  "16px",
  "20px",
  "24px",
  "32px",
  "40px",
]);
// 12px predates the scale and survives only in log/terminal surfaces.
const GRANDFATHERED_SIZE = "12px";
const MAX_RADIUS_PX = 6;
const SPACING_PROPERTIES =
  /^(margin|padding)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^gap$|^(row|column)-gap$/;
const SPACED_PROPERTY_SPLIT = /\s+/;

const isToken = (value: string): boolean => /var\(\s*--/.test(value);

/**
 * Strip whole `var(--x, fallback)` references, leaving the part of the value
 * that is not token-driven. A fallback inside var() is a safety net for when
 * the stylesheet has not loaded and stays allowed; a raw color sitting *beside*
 * a token — `linear-gradient(var(--accent), #ff0000)` — is a real violation and
 * survives the strip.
 */
const withoutTokenReferences = (value: string): string => {
  let out = value;
  let previous: string;
  do {
    previous = out;
    out = out.replace(/var\(\s*--[a-z0-9-]+\s*(?:,[^()]*)?\)/gi, " ");
  } while (out !== previous);
  return out;
};
const ALLOWED_RAW_COLORS = new Set([
  "#000",
  "#000000",
  "#fff",
  "#ffffff",
  "transparent",
  "currentcolor",
  "inherit",
  "none",
  "unset",
  "initial",
]);

// Named CSS colors bypass a hex/function-only matcher entirely.
const NAMED_COLORS = new Set(
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
   thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`
    .split(/\s+/)
    .filter(Boolean),
);

const COLOR_TOKEN =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\([^()]*\)|\b[a-z]{3,20}\b/gi;

/**
 * Quoted strings and url() payloads are content, not colour: `content: "red"`
 * and `background-image: url(red-arrow.svg)` must not read as violations.
 */
const withoutLiterals = (value: string): string =>
  value.replace(/"[^"]*"|'[^']*'/g, " ").replace(/url\([^)]*\)/gi, " ");

/** Each colour is judged on its own: `border: 1px solid #000` is allowed. */
const disallowedColors = (rawValue: string): string[] =>
  [...withoutLiterals(rawValue).matchAll(COLOR_TOKEN)]
    .map((m) => m[0].trim())
    .filter((color) => {
      const lower = color.toLowerCase();
      if (ALLOWED_RAW_COLORS.has(lower)) return false;
      // Bare words are only colors if they are named colors; `solid`, `inset`,
      // and every other keyword in a compound value are not.
      if (/^[a-z]+$/i.test(lower)) return NAMED_COLORS.has(lower);
      return true;
    });

/**
 * A one-dimension pill (a dot, a bar) may use the pill radius. Matched against
 * whole class-name segments, so `.sidebar` and `.toolbar` are not mistaken for
 * bars and quietly exempted.
 */
const ONE_DIMENSIONAL_SEGMENT = /(^|[-_])(dot|pill|bar|spark|tick|avatar)s?([-_]|$)/i;
const looksOneDimensional = (selector: string): boolean =>
  [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].some((m) => ONE_DIMENSIONAL_SEGMENT.test(m[1]));

const LABEL_CONTEXT = /label|tag|kicker|caps|micro|crumb|th\b/i;

export const checkCss = (css: string, file: string): Violation[] => {
  const violations: Violation[] = [];
  let root: postcss.Root;
  try {
    root = postcss.parse(css, { from: file });
  } catch (error) {
    return [
      {
        rule: "parse-error",
        severity: "error",
        file,
        line: 1,
        message: `could not parse as CSS: ${(error as Error).message}`,
        fix: "check the file is valid CSS, or exclude it from design:check",
      },
    ];
  }

  const add = (
    node: postcss.Node,
    rule: string,
    severity: Violation["severity"],
    message: string,
    fix: string,
  ): void => {
    violations.push({
      rule,
      severity,
      file,
      line: node.source?.start?.line ?? 1,
      message,
      fix,
    });
  };

  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    const value = decl.value.trim();
    const lower = value.toLowerCase();
    const selector = (decl.parent as postcss.Rule | undefined)?.selector ?? "";

    // Custom properties are where raw values are supposed to live.
    const inTokenDefinition = prop.startsWith("--");

    const offending = inTokenDefinition ? [] : disallowedColors(withoutTokenReferences(value));
    if (offending.length > 0) {
      add(
        decl,
        "no-raw-color",
        "error",
        `raw color ${offending.join(", ")} in \`${prop}: ${value}\``,
        "use a token: var(--fg), var(--bg), var(--border), var(--accent) — see /tokens.json",
      );
    }

    // border-top-left-radius and the logical start/end variants all count.
    if (prop === "border-radius" || /^border-([a-z]+-)+radius$/.test(prop)) {
      for (const part of value.split(SPACED_PROPERTY_SPLIT)) {
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
              "9999px is only for one-dimension elements like dots and bars; use var(--radius-sm)",
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
            "uinaf corners are square-ish: use var(--radius-xs), var(--radius-sm), or var(--radius-md)",
          );
        }
      }
    }

    if (prop === "box-shadow" && lower !== "none") {
      // Split on top-level commas: an allowed token must not license extra
      // layers beside it, as `var(--shadow-none), 0 2px 4px red` would.
      const layers = splitTopLevel(value);
      const allowed = layers.every(
        (layer) =>
          layer.toLowerCase() === "none" ||
          /^var\(\s*--(accent-glow|shadow-glow-accent|shadow-none)\s*\)$/.test(layer),
      );
      if (!allowed) {
        add(
          decl,
          "no-box-shadow",
          "error",
          `box-shadow: ${value}`,
          "the system has no shadows; the one exception is var(--shadow-glow-accent)",
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
          "Berkeley Mono is the only face: use var(--font-mono)",
        );
      }
    }

    if (prop === "font-size" && !inTokenDefinition) {
      const known = TYPE_SCALE.has(lower) || lower === GRANDFATHERED_SIZE;
      // Relative sizes scale from a scale value; they are not a scale violation.
      const relative = /^(inherit|smaller|larger|\d*\.?\d+(em|rem|%|ex|ch))$/.test(lower);
      if (!isToken(value) && !known && !relative) {
        add(
          decl,
          "type-scale-only",
          "error",
          `font-size: ${value} is not on the scale`,
          `use one of ${[...TYPE_SCALE].join(", ")} or var(--text-*)`,
        );
      }
    }

    if (SPACING_PROPERTIES.test(prop) && !inTokenDefinition && !isToken(value)) {
      for (const part of value.split(SPACED_PROPERTY_SPLIT)) {
        const px = /^(-?\d+(?:\.\d+)?)px$/.exec(part);
        if (!px) continue;
        const size = Math.abs(Number.parseFloat(px[1]));
        // 1–2px are hairlines and optical nudges, not layout spacing.
        if (size > 2 && size % 4 !== 0) {
          add(
            decl,
            "spacing-grid",
            "warn",
            `${prop}: ${part} is off the 4px grid`,
            "round to a multiple of 4, or use var(--sp-*)",
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
          "uppercase belongs to 11px micro-labels and tags only; everything else is lowercase",
        );
      }
    }
  });

  return violations;
};

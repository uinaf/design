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

/**
 * Two regimes, not one grid. Layout spacing sits on the published scale; micro
 * spacing — under 16px, between elements inside one row or control — has a legal
 * 2px resolution, because 2/6/10/14 are deliberate optical half-steps with their
 * own tokens. A flat `size % 4` test flagged all four of them as drift.
 *
 * Only gap, margin and padding reach here. Widths, heights and control geometry
 * (a 18px switch, a 26px button) are not spacing and are never judged against
 * either scale.
 */
const LAYOUT_STEPS = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96];
const MICRO_STEPS = [2, 4, 6, 8, 10, 12, 14];
const MICRO_CEILING = 16;

/** Ties round down — denser is on-brand. Ascending steps plus a strict `<` gives that. */
const nearestStep = (size: number, steps: readonly number[]): number =>
  steps.reduce((best, step) => (Math.abs(step - size) < Math.abs(best - size) ? step : best));

/**
 * The token name is the value: 4px is `--sp-1`, and a half-step writes its
 * fraction with a dash — 6px is `--sp-1-5`. Derived rather than tabulated, so a
 * new step cannot arrive with no name or the wrong one.
 */
const spacingToken = (px: number): string => `--sp-${String(px / 4).replace(".", "-")}`;

const isToken = (value: string): boolean => /var\(\s*--/.test(value);

/**
 * Strip whole `var(--x, fallback)` references, leaving the part of the value
 * that is not token-driven. A fallback inside var() is a safety net for when
 * the stylesheet has not loaded and stays allowed; a raw color sitting *beside*
 * a token — `linear-gradient(var(--accent), #ff0000)` — is a real violation and
 * survives the strip.
 */
const withoutTokenReferences = (value: string): string => {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    // Whitespace inside var( is valid and unbounded in principle; slicing a
    // fixed window would miss `var(   --fg)` and report a false raw colour.
    if (!/^var\(\s*--/i.test(value.slice(i, i + 64))) {
      out += value[i];
      continue;
    }
    // Consume the whole call, including a fallback that itself has parens.
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

/**
 * Bare words are only colours on properties that take one. `grid-area: red`
 * and `animation-name: blue` are identifiers, not colours. Hex and functional
 * syntax stay unambiguous everywhere.
 */
const COLOR_PROPERTY =
  /(^|-)color$|^(background|border|outline|fill|stroke|box-shadow|text-shadow|caret|accent|column-rule|text-emphasis|text-decoration|border-(top|right|bottom|left|block|inline)(-(start|end))?)($|-)/;

const COLOR_TOKEN =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\((?:[^()]|\([^()]*\))*\)|\b[a-z]{3,20}\b/gi;

/**
 * Quoted strings and url() payloads are content, not colour: `content: "red"`
 * and `background-image: url(red-arrow.svg)` must not read as violations.
 */
const withoutLiterals = (value: string): string =>
  value.replace(/"[^"]*"|'[^']*'/g, " ").replace(/url\([^)]*\)/gi, " ");

/**
 * `color-mix()` composes colours it is given, so it is exactly as raw as its
 * arguments — `color-mix(in srgb, var(--neutral-900) 40%, transparent)` is the
 * supported way to write a translucent token, and flagging it would leave no
 * compliant spelling at all. Judged by recursion into the body, so a literal
 * mixed in still fails. `color()` is not here: it names an absolute colour in a
 * colour space, token or not.
 */
const COMPOSED_COLOR = /\bcolor-mix\s*\(((?:[^()]|\([^()]*\))*)\)/gi;

/** Each colour is judged on its own: `border: 1px solid #000` is allowed. */
const disallowedColors = (rawValue: string, property: string): string[] => {
  const acceptsColor = COLOR_PROPERTY.test(property);
  const offending: string[] = [];
  // Lifted out before the token strip, and judged by its arguments: the strip is
  // what leaves `color-mix(in srgb, var(--x) 40%, transparent)` an empty shell
  // that then reads as a raw colour of its own.
  const value = withoutLiterals(rawValue).replace(COMPOSED_COLOR, (_call, body: string) => {
    offending.push(...disallowedColors(body, property));
    return " ";
  });
  for (const match of withoutTokenReferences(value).matchAll(COLOR_TOKEN)) {
    const color = match[0].trim();
    const lower = color.toLowerCase();
    if (ALLOWED_RAW_COLORS.has(lower)) continue;
    if (/^[a-z]+$/i.test(lower)) {
      if (acceptsColor && NAMED_COLORS.has(lower)) offending.push(color);
      continue;
    }
    offending.push(color);
  }
  return offending;
};

/**
 * A one-dimension pill (a dot, a bar) may use the pill radius. Matched against
 * whole class-name segments, so `.sidebar` and `.toolbar` are not mistaken for
 * bars and quietly exempted.
 */
const ONE_DIMENSIONAL_SEGMENT = /(^|[-_])(dot|pill|bar|spark|tick|avatar)s?([-_]|$)/i;
const looksOneDimensional = (selector: string): boolean =>
  [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].some((m) => ONE_DIMENSIONAL_SEGMENT.test(m[1]));

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

    const offending = inTokenDefinition ? [] : disallowedColors(value, prop);
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
      // calc() hides the number from a plain px match; pull any px out of it.
      const parts = /calc\(/i.test(value)
        ? [...value.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => m[0])
        : value.split(SPACED_PROPERTY_SPLIT);
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

    if (SPACING_PROPERTIES.test(prop) && !inTokenDefinition) {
      // Strip tokens rather than skipping the declaration: `var(--sp-2) 7px`
      // must still flag the 7px sitting beside the token.
      for (const part of withoutTokenReferences(value).split(SPACED_PROPERTY_SPLIT)) {
        const px = /^(-?\d+(?:\.\d+)?)px$/.exec(part);
        if (!px) continue;
        const size = Math.abs(Number.parseFloat(px[1]));
        if (size <= 1) continue; // a hairline nudge is position, not spacing
        const micro = size < MICRO_CEILING;
        const steps = micro ? MICRO_STEPS : LAYOUT_STEPS;
        if (steps.includes(size)) continue;
        const nearest = nearestStep(size, steps);
        add(
          decl,
          "spacing-grid",
          "warn",
          `${prop}: ${part} is not a ${micro ? "micro" : "layout"} step`,
          `use var(${spacingToken(nearest)}) — ${nearest}px${
            micro
              ? ". Micro spacing (under 16px, inside one row or control) has a 2px resolution"
              : ". Layout spacing sits on the published scale"
          }`,
        );
      }
    }
  });

  return violations;
};

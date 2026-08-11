import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { checkCss, checkMarkup, compareRatchet, countByRule } from "../src/lint/index";
import { modifierBase } from "../src/lint/rules-markup";

const root = path.resolve(import.meta.dirname, "..");
const rules = (violations: Array<{ rule: string }>): string[] => violations.map((v) => v.rule);

const definedUtilityClasses = (...files: string[]): Set<string> =>
  new Set(
    [
      ...files
        .map((f) => fs.readFileSync(path.join(root, f), "utf8"))
        .join("\n")
        .matchAll(/\.(u-[a-zA-Z0-9_-]+)/g),
    ].map((m) => m[1] ?? ""),
  );
const css = (source: string) => checkCss(source, "test.css");
const markup = (source: string) => checkMarkup(source, "test.html");

describe("no-raw-color", () => {
  it("passes on tokens", () => {
    expect(rules(css("a{color:var(--fg);background:var(--bg)}"))).not.toContain("no-raw-color");
  });
  it("fails on a raw hex or rgba", () => {
    expect(rules(css("a{color:#ff0000}"))).toContain("no-raw-color");
    expect(rules(css("a{background:rgba(1,2,3,.5)}"))).toContain("no-raw-color");
  });
  it("allows the documented escapes and token definitions", () => {
    expect(rules(css("a{color:transparent;border-color:currentColor}"))).not.toContain(
      "no-raw-color",
    );
    expect(rules(css(":root{--accent:#d4ff3f}"))).not.toContain("no-raw-color");
  });
});

describe("radius-ceiling", () => {
  it("passes at or below the ceiling", () => {
    expect(rules(css("a{border-radius:6px}"))).not.toContain("radius-ceiling");
    expect(rules(css("a{border-radius:var(--radius-sm)}"))).not.toContain("radius-ceiling");
  });
  it("fails above it", () => {
    expect(rules(css("a{border-radius:12px}"))).toContain("radius-ceiling");
  });
  it("allows a pill only on one-dimension elements", () => {
    expect(rules(css(".u-dot{border-radius:9999px}"))).not.toContain("radius-ceiling");
    expect(rules(css(".card{border-radius:9999px}"))).toContain("radius-ceiling");
  });
});

describe("no-box-shadow", () => {
  it("passes on none and the accent glow", () => {
    expect(rules(css("a{box-shadow:none}"))).not.toContain("no-box-shadow");
    expect(rules(css("a{box-shadow:var(--shadow-glow-accent)}"))).not.toContain("no-box-shadow");
  });
  it("fails on any other shadow", () => {
    expect(rules(css("a{box-shadow:0 2px 8px rgba(0,0,0,.4)}"))).toContain("no-box-shadow");
  });
});

describe("font-family-locked", () => {
  it("passes on the token or the verbatim stack", () => {
    expect(rules(css("a{font-family:var(--font-mono)}"))).not.toContain("font-family-locked");
    expect(rules(css('a{font-family:"Berkeley Mono",monospace}'))).not.toContain(
      "font-family-locked",
    );
  });
  it("fails on anything else", () => {
    expect(rules(css("a{font-family:Inter,sans-serif}"))).toContain("font-family-locked");
  });
});

describe("type-scale-only", () => {
  it("passes on scale values and tokens", () => {
    expect(rules(css("a{font-size:13px}"))).not.toContain("type-scale-only");
    expect(rules(css("a{font-size:var(--text-sm)}"))).not.toContain("type-scale-only");
  });
  it("fails off the scale", () => {
    expect(rules(css("a{font-size:18px}"))).toContain("type-scale-only");
  });
  it("allows relative sizes, which scale from a scale value", () => {
    expect(rules(css("a{font-size:0.95em}"))).not.toContain("type-scale-only");
  });
});

describe("spacing-grid", () => {
  it("passes on the grid", () => {
    expect(rules(css("a{padding:8px 16px}"))).not.toContain("spacing-grid");
  });
  it("warns off the grid", () => {
    const found = css("a{padding:7px}");
    expect(rules(found)).toContain("spacing-grid");
    expect(found[0].severity).toBe("warn");
  });
  it("allows hairlines and optical nudges", () => {
    expect(rules(css("a{padding:1px;gap:2px}"))).not.toContain("spacing-grid");
  });

  // The two regimes. A flat `% 4` test flagged every one of the micro half-steps,
  // which is how 38 of 76 reported violations turned out to be the design system
  // being deliberate and the rule being too crude.
  it("accepts the micro half-steps under 16px", () => {
    for (const size of [2, 6, 10, 14]) {
      expect(rules(css(`a{gap:${size}px}`)), `${size}px`).not.toContain("spacing-grid");
    }
  });
  it("accepts the layout steps the scale added", () => {
    for (const size of [28, 36, 56, 72]) {
      expect(rules(css(`a{padding:${size}px}`)), `${size}px`).not.toContain("spacing-grid");
    }
  });
  it("rejects a value off the micro resolution", () => {
    for (const size of [3, 5, 7, 15]) {
      expect(rules(css(`a{gap:${size}px}`)), `${size}px`).toContain("spacing-grid");
    }
  });
  it("rounds an exact layout tie down, because denser is on-brand", () => {
    expect(css("a{padding:18px}")[0].fix).toContain("var(--sp-4) — 16px");
    expect(css("a{padding:22px}")[0].fix).toContain("var(--sp-5) — 20px");
  });
  it("names a real token, fraction and all", () => {
    // The name is derived from the value, so a new step cannot arrive unnamed.
    expect(css("a{gap:7px}")[0].fix).toContain("var(--sp-1-5)");
  });
  it("never judges width, height, or control geometry", () => {
    // An 18px switch and a 26px button are geometry, not spacing.
    expect(rules(css("a{width:18px;height:26px;max-width:40ch}"))).not.toContain("spacing-grid");
  });
  it("accepts a spacing token outright", () => {
    expect(rules(css("a{gap:var(--sp-1-5);padding:var(--sp-7)}"))).not.toContain("spacing-grid");
  });
});

describe("one-accent-per-view", () => {
  it("passes with one", () => {
    expect(rules(markup('<a class="u-btn u-btn--accent">go</a>'))).not.toContain(
      "one-accent-per-view",
    );
  });
  it("fails with two", () => {
    expect(
      rules(markup('<a class="u-btn u-btn--accent">go</a><a class="u-btn u-btn--accent">also</a>')),
    ).toContain("one-accent-per-view");
  });
});

describe("topbar-single-row", () => {
  const row = '<div class="u-shell-base u-topbar-row"></div>';
  it("passes with one row", () => {
    expect(rules(markup(`<header class="u-topbar">${row}</header>`))).not.toContain(
      "topbar-single-row",
    );
  });
  it("fails when stacked — the classic agent failure", () => {
    expect(rules(markup(`<header class="u-topbar">${row}${row}</header>`))).toContain(
      "topbar-single-row",
    );
  });
});

describe("shared-gutter", () => {
  it("passes when the shell class reappears on the content", () => {
    const page = `<header class="u-topbar"><div class="u-shell-base u-topbar-row"></div></header><main class="u-shell-base">x</main>`;
    expect(rules(markup(page))).not.toContain("shared-gutter");
  });
  it("fails when the content uses a different gutter", () => {
    const page = `<header class="u-topbar"><div class="u-shell-base u-topbar-row"></div></header><main class="u-shell-wide">x</main>`;
    expect(rules(markup(page))).toContain("shared-gutter");
  });
  it("ignores a fragment, which has no content to share a gutter with", () => {
    const chunk = `<header class="u-topbar"><div class="u-shell-base u-topbar-row"></div></header>`;
    expect(rules(markup(chunk))).not.toContain("shared-gutter");
  });
  it("ignores a layout that slots its content in from elsewhere", () => {
    const layout = `<header class="u-topbar"><div class="u-shell-base u-topbar-row"></div></header><main><slot /></main>`;
    expect(rules(markup(layout))).not.toContain("shared-gutter");
  });
  it("ignores a jsx layout that renders children", () => {
    const layout = `<header className="u-topbar"><div className="u-shell-base u-topbar-row" /></header><main>{children}</main>`;
    expect(rules(markup(layout))).not.toContain("shared-gutter");
  });
});

describe("design-check-disable-next-line precision", () => {
  // A suppression is a bypass, so it earns more tests than the rule it mutes.
  // "suppresses the named rule, and nothing else in the file" is covered above.
  const check = async (body: string): Promise<string[]> => {
    const { checkFile } = await import("../src/lint/index");
    const { tmpdir } = await import("node:os");
    const file = path.join(fs.mkdtempSync(path.join(tmpdir(), "design-suppress-")), "page.html");
    fs.writeFileSync(file, body);
    return checkFile(file).map((v) => v.rule);
  };

  it("rejects the blanket form, which muted every rule on the line", async () => {
    expect(await check("<!-- design-check-disable-next-line -->\n<p>ship it 🚀</p>\n")).toContain(
      "no-emoji",
    );
  });
  it("does not suppress a rule it does not name", async () => {
    expect(
      await check("<!-- design-check-disable-next-line button-type -->\n<p>ship it 🚀</p>\n"),
    ).toContain("no-emoji");
  });
  it("reaches only the next line", async () => {
    expect(
      await check(
        "<!-- design-check-disable-next-line no-emoji -->\n<p>a</p>\n<p>ship it 🚀</p>\n",
      ),
    ).toContain("no-emoji");
  });
});

describe("rules watch classes that actually ship", () => {
  // one-accent-per-view watched `.u-btn-accent` for one commit after the handoff
  // renamed it to `.u-btn--accent`. An error-level rule guarding the single most
  // distinctive brand constraint could not fire, and its own test passed because
  // the test had drifted with it. A rule keyed to a class the CSS never defines is
  // silent, not strict.
  it("references no class the CSS does not define", () => {
    const defined = definedUtilityClasses("src/tokens.css", "src/components.css");
    const ruleSource = ["src/lint/rules-markup.ts", "src/lint/rules-css.ts"]
      .map((f) => fs.readFileSync(path.join(root, f), "utf8"))
      .join("\n");
    const referenced = new Set([...ruleSource.matchAll(/"(u-[a-zA-Z0-9-]+)"/g)].map((m) => m[1]));
    expect(referenced.size).toBeGreaterThan(0);
    expect([...referenced].filter((c) => !defined.has(c)).sort()).toEqual([]);
  });
});

describe("no-emoji", () => {
  it("passes on the system's own iconography", () => {
    // ✓ ✗ ↗ → · are dingbats the design system uses as icons, not emoji.
    expect(rules(markup("<p>done ✓ failed ✗ open ↗ next → dot ·</p>"))).not.toContain("no-emoji");
  });
  it("fails on real emoji", () => {
    expect(rules(markup("<p>ship it 🚀</p>"))).toContain("no-emoji");
    expect(rules(markup("<p>strong 💪</p>"))).toContain("no-emoji");
  });
});

describe("no-icon-fonts", () => {
  it("passes without them", () => {
    expect(rules(markup('<span class="u-label">x</span>'))).not.toContain("no-icon-fonts");
  });
  it("fails on font-awesome and material", () => {
    expect(rules(markup('<i class="fa-solid fa-check"></i>'))).toContain("no-icon-fonts");
    expect(rules(markup('<i class="material-icons">check</i>'))).toContain("no-icon-fonts");
  });
});

describe("button-type", () => {
  it("passes when the type is explicit", () => {
    expect(rules(markup('<button type="button" class="u-btn">save</button>'))).not.toContain(
      "button-type",
    );
    expect(rules(markup('<button type="submit" class="u-btn">save</button>'))).not.toContain(
      "button-type",
    );
  });
  it("warns on a bare button, which defaults to submit", () => {
    const found = markup('<button class="u-btn">save</button>');
    expect(rules(found)).toContain("button-type");
    // A new rule must not turn every consumer's build red on upgrade.
    expect(found.find((v) => v.rule === "button-type")?.severity).toBe("warn");
  });
  it("accepts JSX and attribute spacing", () => {
    expect(rules(markup('<button type={kind} className="u-btn">go</button>'))).not.toContain(
      "button-type",
    );
    expect(rules(markup('<button  TYPE = "button" class="u-btn">go</button>'))).not.toContain(
      "button-type",
    );
  });
  it("does not mistake another attribute ending in type", () => {
    // A word boundary matches inside `data-type=` too, which would let a bare
    // button pass. Both spellings must still report.
    expect(rules(markup('<button data-mimetype="x" class="u-btn">go</button>'))).toContain(
      "button-type",
    );
    expect(rules(markup('<button data-type="x" class="u-btn">go</button>'))).toContain(
      "button-type",
    );
    expect(rules(markup('<button formtype="x" class="u-btn">go</button>'))).toContain(
      "button-type",
    );
  });
  it("reports each offender, so the ratchet counts them", () => {
    const found = markup('<button class="u-btn">a</button><button class="u-btn">b</button>');
    expect(found.filter((v) => v.rule === "button-type")).toHaveLength(2);
  });
});

describe("modifier-base", () => {
  it("passes when the base rides along", () => {
    expect(
      rules(markup('<button type="button" class="u-btn u-btn--primary">go</button>')),
    ).not.toContain("modifier-base");
    expect(rules(markup('<span class="u-dot u-dot--ok"></span>'))).not.toContain("modifier-base");
  });
  it("warns on a modifier alone, which renders as one property on nothing", () => {
    const found = markup('<button type="button" class="u-btn--primary">go</button>');
    expect(rules(found)).toContain("modifier-base");
    expect(found.find((v) => v.rule === "modifier-base")?.message).toContain("u-btn");
    // A new rule must not turn every consumer's build red on upgrade.
    expect(found.find((v) => v.rule === "modifier-base")?.severity).toBe("warn");
  });
  it("takes the longest base, so a compound name is not truncated", () => {
    const found = markup('<div class="u-skeleton--stat"></div>');
    expect(found.find((v) => v.rule === "modifier-base")?.message).toContain("u-skeleton");
  });
  it("says nothing about a standalone utility, which gets one hyphen", () => {
    expect(rules(markup('<a class="u-link-plain" href="#">x</a>'))).not.toContain("modifier-base");
    expect(rules(markup('<pre class="u-pre u-code-bleed">x</pre>'))).not.toContain("modifier-base");
  });
  it("splits on the last separator a real base can precede", () => {
    // `u-btn---b` is `u-btn` plus the modifier `-b`: the middle hyphen cannot
    // end a base, so the separator is the pair before it.
    //
    // Asserted on the split itself, not through the markup pass: `u-btn---b`
    // is a class nothing defines, so `unknown-class` owns that token and
    // modifier-base never sees it.
    expect(modifierBase("u-btn---b")).toBe("u-btn");
  });
  it("stays linear on a token built to make a split search backtrack", () => {
    // Regression: the rule reads class names out of a consumer's markup, so a
    // polynomial split search here is theirs to trigger, not ours.
    // The trailing `!` is what makes a split search exhaustive: every `--` gets
    // tried before the token can be rejected.
    const token = `u-${"0--".repeat(20000)}!`;
    const started = process.hrtime.bigint();
    rules(markup(`<div class="${token}"></div>`));
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    expect(ms).toBeLessThan(250);
  });

  // This rule shipped with a two-entry exemption list, because two standalone
  // utilities were named `u-link--plain` and `u-code--bleed` — the spelling
  // claimed a dependency neither had. The names went back to one hyphen and the
  // list went away. What keeps it away is the naming convention itself, so hold
  // the CSS to it: every `--` class owes a base, or the exemptions come back.
  //
  // Split with the rule's own function, not a second `lastIndexOf("--")` one.
  // They disagree on `u-btn---b` — the rule reads `u-btn`, `lastIndexOf` reads
  // `u-btn-` — so a hand-rolled split here would hold the CSS to a convention
  // the shipped rule does not enforce.
  it("has a base in the CSS for every -- class the CSS defines", () => {
    const defined = definedUtilityClasses("src/tokens.css", "src/components.css");
    const baseless = [...defined].filter((c) => {
      const base = modifierBase(c);
      return base !== undefined && !defined.has(base);
    });
    expect(baseless.sort()).toEqual([]);
  });
});

describe("unknown-class", () => {
  it("errors on a u- class the package does not define", () => {
    const found = markup('<a class="u-btn u-btn-primary" href="#">go</a>');
    const violation = found.find((v) => v.rule === "unknown-class");
    expect(violation?.severity).toBe("error");
    expect(violation?.message).toContain("u-btn-primary");
  });

  // The rename that earned this rule: `.u-btn-primary` became
  // `.u-btn--primary`, and the old name matched nothing without failing, so a
  // styled button rendered as bare inline text through two green builds.
  it("names the class the author meant when a separator moved", () => {
    const found = markup('<a class="u-btn u-btn-primary" href="#">go</a>');
    expect(found.find((v) => v.rule === "unknown-class")?.fix).toContain("u-btn--primary");
  });

  it("says nothing about a class the CSS defines", () => {
    expect(rules(markup('<a class="u-btn u-btn--primary" href="#">go</a>'))).not.toContain(
      "unknown-class",
    );
    expect(rules(markup('<pre class="u-pre u-code-bleed">x</pre>'))).not.toContain("unknown-class");
  });

  // Consumers own every other namespace. A Tailwind or app-local class is not
  // this package's to judge, and judging it would make the check unusable.
  it("judges only the u- namespace", () => {
    expect(
      rules(markup('<div class="mt-10 flex sm:grid-cols-3 card__title"></div>')),
    ).not.toContain("unknown-class");
  });

  it("owns the token, so modifier-base does not also fire on it", () => {
    const found = rules(markup('<div class="u-nope--x"></div>'));
    expect(found).toContain("unknown-class");
    expect(found).not.toContain("modifier-base");
  });

  it("reports each offender, so the ratchet counts them", () => {
    const found = markup('<a class="u-btn-ghost">a</a><a class="u-btn-accent">b</a>');
    expect(found.filter((v) => v.rule === "unknown-class")).toHaveLength(2);
  });

  // The list is derived from the CSS the consumer imports. A hand-kept copy
  // would drift, and a drifted copy reports live classes as undefined.
  it("accepts every u- class the stylesheet defines", () => {
    const defined = [...definedUtilityClasses("src/tokens.css", "src/components.css")];
    const source = defined.map((c) => `<div class="${c}"></div>`).join("");
    expect(markup(source).filter((v) => v.rule === "unknown-class")).toEqual([]);
  });
});

describe("icon-size-ramp", () => {
  const ramp = (source: string) => markup(source).filter((v) => v.rule === "icon-size-ramp");

  it("passes on each of the three pairs, in either spelling", () => {
    expect(ramp('<svg width="16" height="16" stroke-width="1.5"></svg>')).toEqual([]);
    expect(ramp('<svg style="width:12px;height:12px;stroke-width:1.75"></svg>')).toEqual([]);
    expect(ramp('<svg style="width:20px;height:20px;stroke-width:1.25"></svg>')).toEqual([]);
  });

  it("says nothing about an svg carrying neither a size nor a stroke", () => {
    // Sparklines, charts, and icons sized by a class. Reading the 16-grid
    // viewBox as a 16px render would flag every one of them.
    expect(ramp('<svg class="u-spark" viewBox="0 0 100 28"></svg>')).toEqual([]);
    expect(ramp('<svg class="icon" viewBox="0 0 16 16"></svg>')).toEqual([]);
  });

  it("warns on a stroke that does not match the size", () => {
    const [violation] = ramp('<svg width="20" height="20" stroke-width="1.5"></svg>');
    expect(violation.message).toContain("1.5");
    expect(violation.fix).toContain("1.25");
    // Same reason as modifier-base: the rule ships in the tarball.
    expect(violation.severity).toBe("warn");
  });

  it("warns on a size off the ramp, before judging its stroke", () => {
    const found = ramp('<svg width="18" height="18" stroke-width="1.5"></svg>');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("18px");
  });

  it("warns on a non-square icon", () => {
    expect(ramp('<svg width="16" height="20" stroke-width="1.5"></svg>')[0].message).toContain(
      "16×20",
    );
  });

  it("warns on an off-ramp stroke even when the size comes from a class", () => {
    expect(
      ramp('<svg class="icon" stroke-width="2" viewBox="0 0 16 16"></svg>')[0].message,
    ).toContain("2");
    expect(ramp('<svg class="icon" stroke-width="1.75" viewBox="0 0 16 16"></svg>')).toEqual([]);
  });

  it("lets inline style win over the presentation attribute, as CSS does", () => {
    expect(ramp('<svg width="16" style="width:20px;height:20px;stroke-width:1.25"></svg>')).toEqual(
      [],
    );
  });
});

describe("status-shape", () => {
  it("passes on a dot and a word", () => {
    expect(rules(markup('<span><i class="u-dot u-dot--ok"></i>ok</span>'))).not.toContain(
      "status-shape",
    );
  });
  it("warns on a filled alert band", () => {
    expect(
      rules(markup('<div style="background:#222;border-left:3px solid red">alert</div>')),
    ).toContain("status-shape");
  });
});

describe("ratchet", () => {
  const baseline = { "spacing-grid": 10, "no-raw-color": 2 };

  it("passes when counts hold", () => {
    expect(compareRatchet(baseline, { "spacing-grid": 10, "no-raw-color": 2 }).passed).toBe(true);
  });
  it("passes and reports when counts fall", () => {
    const result = compareRatchet(baseline, { "spacing-grid": 4, "no-raw-color": 2 });
    expect(result.passed).toBe(true);
    expect(result.improved).toEqual([{ rule: "spacing-grid", was: 10, now: 4 }]);
  });
  it("fails when any count rises", () => {
    const result = compareRatchet(baseline, { "spacing-grid": 11, "no-raw-color": 2 });
    expect(result.passed).toBe(false);
    expect(result.risen).toEqual([{ rule: "spacing-grid", was: 10, now: 11 }]);
  });
  it("fails on a rule that did not exist in the baseline", () => {
    expect(compareRatchet(baseline, { ...baseline, "no-emoji": 1 }).passed).toBe(false);
  });
});

describe("violation messages", () => {
  it("name the rule, the line, and what to do instead", () => {
    const [violation] = css("a{\n  font-size:18px\n}");
    expect(violation.line).toBe(2);
    expect(violation.rule).toBe("type-scale-only");
    expect(violation.fix).toContain("var(--text-*)");
  });
});

describe("countByRule", () => {
  it("groups violations for the ratchet", () => {
    expect(countByRule(css("a{color:#fff000;font-size:18px;border-radius:20px}"))).toEqual({
      "no-raw-color": 1,
      "type-scale-only": 1,
      "radius-ceiling": 1,
    });
  });
});

describe("no-icon-fonts precision", () => {
  it("does not flag ordinary classes that merely start with those letters", () => {
    // A false positive in a check that gates "done" is worse than a miss.
    expect(rules(markup('<div class="bi-weekly"></div>'))).not.toContain("no-icon-fonts");
    expect(rules(markup('<div class="u-panel-grid"></div>'))).not.toContain("no-icon-fonts");
  });
  it("does not flag prose that mentions an icon class", () => {
    expect(rules(markup("<p>the fa-check class is banned</p>"))).not.toContain("no-icon-fonts");
  });
  it("catches the bare family form", () => {
    expect(rules(markup('<i class="material-icons">check</i>'))).toContain("no-icon-fonts");
  });
});

describe("suppression comments", () => {
  it("are respected for the named rule only", async () => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-check-"));
    const file = join(dir, "page.html");
    writeFileSync(
      file,
      `<!-- design-check-disable-next-line no-emoji -->\n<p>ship it 🚀</p>\n<i class="fa-check"></i>\n`,
    );
    const found = checkFile(file).map((v) => v.rule);
    expect(found).not.toContain("no-emoji");
    // Suppressing one rule must not silence the rest of the file.
    expect(found).toContain("no-icon-fonts");
  });
});

describe("shared-gutter precision", () => {
  it("is not satisfied by the shell class appearing on another topbar row", () => {
    // Two stacked rows both carrying the shell class must not count as content.
    const page = `<header class="u-topbar"><div class="u-shell-base u-topbar-row"></div><div class="u-shell-base u-topbar-row"></div></header><main class="u-shell-wide">x</main>`;
    expect(rules(markup(page))).toContain("shared-gutter");
  });
});

describe("inline style attributes", () => {
  it("are checked, since that is where raw values usually appear", async () => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-inline-"));
    const file = join(dir, "page.html");
    writeFileSync(file, `<div class="u-panel" style="border-radius:20px;color:#f00">x</div>\n`);
    const found = checkFile(file).map((v) => v.rule);
    expect(found).toContain("radius-ceiling");
    expect(found).toContain("no-raw-color");
  });

  it("carry element classes through so context-sensitive rules still hold", async () => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-inline2-"));
    const file = join(dir, "dot.html");
    // A pill radius is legitimate on a dot and must not fire here.
    writeFileSync(file, `<i class="u-dot" style="border-radius:9999px"></i>\n`);
    expect(checkFile(file).map((v) => v.rule)).not.toContain("radius-ceiling");
  });
});

describe("no-raw-color cannot hide behind a token", () => {
  it("allows a fallback inside var(), which only applies if the sheet failed to load", () => {
    expect(rules(css("a{color:var(--fg, #f00)}"))).not.toContain("no-raw-color");
  });
  it("catches a raw stop in a gradient beside a token", () => {
    expect(rules(css("a{background:linear-gradient(var(--accent), #ff0000)}"))).toContain(
      "no-raw-color",
    );
  });
  it("applies the allowlist per colour, not to the whole declaration", () => {
    expect(rules(css("a{border:1px solid #000}"))).not.toContain("no-raw-color");
    expect(rules(css("a{border:1px solid #a1b2c3}"))).toContain("no-raw-color");
  });
  it("still passes when every colour is a token", () => {
    expect(rules(css("a{background:linear-gradient(var(--accent), var(--bg))}"))).not.toContain(
      "no-raw-color",
    );
    expect(rules(css("a{color:var(--fg, var(--fg-muted))}"))).not.toContain("no-raw-color");
  });
});

describe("no-raw-color judges color-mix by its arguments", () => {
  it("allows a token mixed toward transparent — the way to write a translucent token", () => {
    expect(
      rules(css("a{background:color-mix(in srgb, var(--neutral-900) 40%, transparent)}")),
    ).not.toContain("no-raw-color");
  });
  it("allows two tokens mixed together", () => {
    expect(rules(css("a{color:color-mix(in oklab, var(--fg) 60%, var(--accent))}"))).not.toContain(
      "no-raw-color",
    );
  });
  it("catches a literal mixed in", () => {
    expect(rules(css("a{background:color-mix(in srgb, #ff0000 40%, transparent)}"))).toContain(
      "no-raw-color",
    );
    expect(rules(css("a{background:color-mix(in srgb, var(--fg) 40%, rebeccapurple)}"))).toContain(
      "no-raw-color",
    );
  });
  it("still catches a raw colour sitting beside the mix", () => {
    expect(
      rules(
        css("a{background:linear-gradient(color-mix(in srgb, var(--fg) 40%, transparent), #f00)}"),
      ),
    ).toContain("no-raw-color");
  });
  it("does not exempt color(), which names an absolute colour rather than composing tokens", () => {
    expect(rules(css("a{color:color(display-p3 1 0 0)}"))).toContain("no-raw-color");
  });
});

describe("pill radius exemption is segment-scoped", () => {
  it("exempts genuine one-dimension elements", () => {
    expect(rules(css(".u-dot{border-radius:9999px}"))).not.toContain("radius-ceiling");
    expect(rules(css(".u-bars i{border-radius:9999px}"))).not.toContain("radius-ceiling");
  });
  it("does not exempt selectors that merely contain those letters", () => {
    expect(rules(css(".sidebar{border-radius:9999px}"))).toContain("radius-ceiling");
    expect(rules(css(".toolbar{border-radius:9999px}"))).toContain("radius-ceiling");
  });
});

describe("inline styles are attribute-order independent", () => {
  it("keeps element classes when style comes first", async () => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-order-"));
    const file = join(dir, "dot.html");
    writeFileSync(file, `<i style="border-radius:9999px" class="u-dot"></i>\n`);
    expect(checkFile(file).map((v) => v.rule)).not.toContain("radius-ceiling");
  });
});

describe("JSX object styles", () => {
  it("are checked, since .jsx/.tsx is an advertised input", async () => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-jsx-"));
    const file = join(dir, "Card.tsx");
    writeFileSync(
      file,
      `export const Card = () => <div style={{ color: "#f00", borderRadius: "20px", fontSize: "18px" }} />;\n`,
    );
    const found = checkFile(file).map((v) => v.rule);
    expect(found).toContain("no-raw-color");
    expect(found).toContain("radius-ceiling");
    expect(found).toContain("type-scale-only");
  });

  it("passes on token-driven JSX styles", async () => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-jsx2-"));
    const file = join(dir, "Ok.tsx");
    writeFileSync(file, `export const Ok = () => <div style={{ color: "var(--fg)" }} />;\n`);
    expect(checkFile(file).map((v) => v.rule)).toEqual([]);
  });
});

describe("no-raw-color catches named colors", () => {
  it("flags CSS named colors", () => {
    expect(rules(css("a{color:red}"))).toContain("no-raw-color");
    expect(rules(css("a{background:rebeccapurple}"))).toContain("no-raw-color");
  });
  it("does not mistake ordinary keywords for colors", () => {
    expect(rules(css("a{display:flex;position:absolute;overflow:hidden}"))).not.toContain(
      "no-raw-color",
    );
    expect(rules(css("a{transition:color 160ms ease}"))).not.toContain("no-raw-color");
    expect(rules(css("a{border:1px solid var(--border)}"))).not.toContain("no-raw-color");
  });
});

describe("radius-ceiling covers corner properties", () => {
  it("catches corner-specific and logical variants", () => {
    expect(rules(css("a{border-top-left-radius:20px}"))).toContain("radius-ceiling");
    expect(rules(css("a{border-start-end-radius:20px}"))).toContain("radius-ceiling");
  });
});

describe("no-box-shadow checks every layer", () => {
  it("does not let an allowed token license extra layers", () => {
    expect(rules(css("a{box-shadow:var(--shadow-none), 0 2px 4px currentColor}"))).toContain(
      "no-box-shadow",
    );
  });
  it("still passes the single allowed glow", () => {
    expect(rules(css("a{box-shadow:var(--shadow-glow-accent)}"))).not.toContain("no-box-shadow");
  });
});

describe("modern color functions", () => {
  it("catches hwb, lch, oklab, and color-mix", () => {
    for (const value of ["lch(50% 20 30)", "hwb(90 10% 10%)", "oklab(59% 0.1 0.1)"]) {
      expect(rules(css(`a{color:${value}}`))).toContain("no-raw-color");
    }
  });
});

describe("missing scan roots", () => {
  it("throw rather than reading as a clean run", async () => {
    const { check: runCheck } = await import("../src/lint/index");
    // A typo must not silently disable the gate.
    expect(() => runCheck({ paths: ["definitely-not-a-real-path"] })).toThrow(/no such path/);
  });
});

describe("JSX object styles with commas", () => {
  it("do not break on a value containing its own commas", async () => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-jsx3-"));
    const file = join(dir, "G.tsx");
    writeFileSync(
      file,
      `export const G = () => <div style={{ background: "linear-gradient(var(--fg), var(--bg))" }} />;\n`,
    );
    expect(checkFile(file).map((v) => v.rule)).toEqual([]);
  });
});

describe("colour detection ignores content", () => {
  it("does not read strings or url() payloads as colours", () => {
    expect(rules(css('a{content:"red"}'))).not.toContain("no-raw-color");
    expect(rules(css("a{background-image:url(red-arrow.svg)}"))).not.toContain("no-raw-color");
  });
});

describe("class matching is attribute-anchored", () => {
  it("does not treat data-class or subclass as a class attribute", () => {
    const markupSource =
      '<div data-class="u-btn--accent"></div><div data-class="u-btn--accent"></div>';
    expect(rules(markup(markupSource))).not.toContain("one-accent-per-view");
  });
});

describe("file collection survives symlink cycles", () => {
  it("visits each real path once", async () => {
    const { collectFiles } = await import("../src/lint/index");
    const { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-cycle-"));
    mkdirSync(join(dir, "a"));
    writeFileSync(join(dir, "a", "page.html"), "<p>x</p>");
    // A directory linking back to its ancestor would otherwise recurse forever.
    symlinkSync(dir, join(dir, "a", "loop"));
    const files = collectFiles([dir]);
    expect(files.filter((f) => f.endsWith("page.html")).length).toBe(1);
  });
});

describe("React numeric style values", () => {
  const jsx = async (source: string) => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-num-"));
    const file = join(dir, "C.tsx");
    writeFileSync(file, source);
    return checkFile(file).map((v) => v.rule);
  };

  it("are treated as pixels, the way React does", async () => {
    const found = await jsx(
      `export const C = () => <div style={{ padding: 7, borderRadius: 20 }} />;`,
    );
    expect(found).toContain("spacing-grid");
    expect(found).toContain("radius-ceiling");
  });

  it("leaves genuinely unitless properties alone", async () => {
    expect(
      await jsx(`export const C = () => <div style={{ lineHeight: 2, zIndex: 40 }} />;`),
    ).toEqual([]);
  });
});

describe("token references with functional fallbacks", () => {
  it("are consumed whole, parens and all", () => {
    expect(rules(css("a{color:var(--fg, rgb(1 2 3))}"))).not.toContain("no-raw-color");
  });
});

describe("spacing-grid is not disabled by a sibling token", () => {
  it("still flags a raw value beside a token", () => {
    expect(rules(css("a{padding:var(--sp-2) 7px}"))).toContain("spacing-grid");
  });
  it("passes when the raw sibling is on the grid", () => {
    expect(rules(css("a{padding:var(--sp-2) 8px}"))).not.toContain("spacing-grid");
  });
});

describe("named colours only on colour properties", () => {
  it("does not flag identifiers that happen to be colour names", () => {
    // grid-area: red is a named grid area, not a colour.
    expect(rules(css("a{grid-area:red}"))).not.toContain("no-raw-color");
    expect(rules(css("a{animation-name:blue}"))).not.toContain("no-raw-color");
  });
  it("still flags them on properties that take a colour", () => {
    expect(rules(css("a{color:red}"))).toContain("no-raw-color");
    expect(rules(css("a{border-color:red}"))).toContain("no-raw-color");
    expect(rules(css("a{background:tan}"))).toContain("no-raw-color");
  });
  it("catches hex and functional syntax on any property", () => {
    expect(rules(css("a{grid-area:#ff0000}"))).toContain("no-raw-color");
  });
});

describe("nested colour functions", () => {
  it("are still detected", () => {
    expect(rules(css("a{color:rgb(calc(255) 0 0)}"))).toContain("no-raw-color");
  });
});

describe("JSX style objects with nested expressions", () => {
  it("are still checked rather than skipped entirely", async () => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-nested-"));
    const file = join(dir, "C.tsx");
    writeFileSync(
      file,
      'export const C = () => <div style={{ color: "#f00", transform: `translateX(${x}px)` }} />;\n',
    );
    expect(checkFile(file).map((v) => v.rule)).toContain("no-raw-color");
  });
});

describe("radius-ceiling sees through calc()", () => {
  it("catches an oversized value inside calc", () => {
    expect(rules(css("a{border-radius:calc(20px + 2px)}"))).toContain("radius-ceiling");
  });
  it("passes a small one", () => {
    expect(rules(css("a{border-radius:calc(4px)}"))).not.toContain("radius-ceiling");
  });
});

describe("no-emoji ignores non-rendered source", () => {
  it("does not flag emoji in comments or scripts", () => {
    expect(rules(markup("<!-- ship it 🚀 --><p>ok</p>"))).not.toContain("no-emoji");
    expect(rules(markup('<script>const msg = "done 🚀";</script>'))).not.toContain("no-emoji");
  });
  it("still flags emoji in rendered text", () => {
    expect(rules(markup("<p>ship it 🚀</p>"))).toContain("no-emoji");
  });
});

describe("JSX object styles keep selector context", () => {
  const jsx = async (source: string) => {
    const { checkFile } = await import("../src/lint/index");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-ctx-"));
    const file = join(dir, "C.tsx");
    writeFileSync(file, source);
    return checkFile(file).map((v) => v.rule);
  };

  it("allows a pill radius on a dot, as in HTML", async () => {
    expect(
      await jsx(`export const D = () => <i className="u-dot" style={{ borderRadius: 9999 }} />;`),
    ).not.toContain("radius-ceiling");
  });
  it("still fails on anything else", async () => {
    expect(
      await jsx(`export const C = () => <div className="card" style={{ borderRadius: 9999 }} />;`),
    ).toContain("radius-ceiling");
  });
});

describe("script and style stripping is not evadable", () => {
  it("handles end tags with whitespace, which a bare </script> match misses", () => {
    expect(rules(markup('<script>const m = "🚀";</script >\n<p>ok</p>'))).not.toContain("no-emoji");
    expect(rules(markup("<style>/* 🚀 */</style >\n<p>ok</p>"))).not.toContain("no-emoji");
  });
});

describe("pathological input does not hang the check", () => {
  it("completes on adversarial repetition", () => {
    // CodeQL flagged polynomial backtracking on these shapes; the quantifiers
    // are bounded so a crafted file cannot stall a CI run.
    const start = Date.now();
    checkMarkup(`${'class="'.repeat(20000)}`, "t.html");
    checkMarkup(`${"<!--".repeat(20000)}`, "t.html");
    checkMarkup(`${"<a ".repeat(20000)}`, "t.html");
    checkMarkup(`${"class={{".repeat(20000)}`, "t.html");
    expect(Date.now() - start).toBeLessThan(3000);
  });
});

describe("token references with unusual whitespace", () => {
  it("are still recognised", () => {
    // `var(   --fg)` is valid CSS; a fixed-window check would miss it.
    expect(rules(css("a{color:var(   --fg)}"))).not.toContain("no-raw-color");
    expect(rules(css("a{padding:var(  --sp-2  )}"))).not.toContain("spacing-grid");
  });
});

describe("topbar-single-row is scoped to one topbar", () => {
  const row = '<div class="u-shell-base u-topbar-row"></div>';
  const topbar = `<header class="u-topbar">${row}</header>`;

  it("does not flag two separate topbars with one row each", () => {
    expect(rules(markup(topbar + topbar))).not.toContain("topbar-single-row");
  });
  it("still flags a single topbar that stacks its rows", () => {
    expect(rules(markup(`<header class="u-topbar">${row}${row}</header>`))).toContain(
      "topbar-single-row",
    );
  });
});

describe("skipped directories apply to explicit paths", () => {
  it("never lints a dependency, even when handed the file directly", async () => {
    const { collectFiles } = await import("../src/lint/index");
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-skip-"));
    mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
    mkdirSync(join(dir, "src"), { recursive: true });
    const dep = join(dir, "node_modules", "pkg", "index.html");
    const own = join(dir, "src", "page.html");
    writeFileSync(dep, "<p>x</p>");
    writeFileSync(own, "<p>y</p>");
    // A `git ls-files` result in a repo with a broken .gitignore looks like this.
    const files = collectFiles([dep, own]);
    expect(files).toEqual([own]);
  });
});

describe("changedFiles", () => {
  // Builds its own repo: depending on this checkout's refs made the test pass
  // vacuously when it returned nothing, and fail in CI where origin/main is
  // absent from a shallow clone.
  const repo = async () => {
    const { execFileSync } = await import("node:child_process");
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "design-changed-"));
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", dir, ...args], { stdio: "ignore" });
    git("init", "-q");
    git("checkout", "-q", "-b", "feature");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "t");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "page.html"), "<p>x</p>");
    writeFileSync(join(dir, "README.md"), "not lintable");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    return { dir, git, join };
  };

  it("finds untracked, uncommitted, and committed changes", async () => {
    const { changedFiles } = await import("../src/lint/index");
    const { writeFileSync } = await import("node:fs");
    const { dir, git, join } = await repo();
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      expect(changedFiles()).toEqual([]);

      // committed after the base: only the `base...HEAD` diff sees this one.
      writeFileSync(join(dir, "src", "committed.css"), ".a{color:red}");
      git("add", "-A");
      git("commit", "-q", "-m", "second");
      expect(changedFiles().map((f) => f.split("/").pop())).toEqual(["committed.css"]);

      writeFileSync(join(dir, "src", "new.tsx"), "<p>y</p>");
      writeFileSync(join(dir, "src", "page.html"), "<p>edited</p>");
      expect(
        changedFiles()
          .map((f) => f.split("/").pop())
          .sort(),
      ).toEqual(["committed.css", "new.tsx", "page.html"]);
    } finally {
      process.chdir(cwd);
    }
  });

  it("returns absolute paths when run from a subdirectory", async () => {
    const { changedFiles } = await import("../src/lint/index");
    const { writeFileSync, realpathSync } = await import("node:fs");
    const { dir, join } = await repo();
    const cwd = process.cwd();
    // Git reports paths relative to cwd; resolving those against the repo root
    // from a subdirectory silently dropped every one of them.
    process.chdir(join(dir, "src"));
    try {
      writeFileSync(join(dir, "src", "new.tsx"), "<p>y</p>");
      expect(changedFiles()).toEqual([join(realpathSync(dir), "src", "new.tsx")]);
    } finally {
      process.chdir(cwd);
    }
  });

  it("ignores files the linter cannot check", async () => {
    const { changedFiles } = await import("../src/lint/index");
    const { writeFileSync } = await import("node:fs");
    const { dir, join } = await repo();
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      writeFileSync(join(dir, "notes.md"), "prose");
      expect(changedFiles()).toEqual([]);
    } finally {
      process.chdir(cwd);
    }
  });
});

describe("--changed fails closed", () => {
  it("refuses an unresolvable base rather than reporting a clean tree", async () => {
    const { changedFiles } = await import("../src/lint/index");
    // Silently dropping committed changes here would report clean and exit 0,
    // which is the one thing a gate must never do.
    expect(() => changedFiles("definitely-not-a-ref")).toThrow(/cannot resolve base ref/);
  });
});

describe("skip names are judged inside the project only", () => {
  it("does not suppress a repo that happens to live under a skipped name", async () => {
    const { collectFiles } = await import("../src/lint/index");
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    // /…/dist/myrepo/src/page.html — `dist` is an ancestor, not the project's.
    const base = mkdtempSync(join(tmpdir(), "design-anc-"));
    const repo = join(base, "dist", "myrepo");
    mkdirSync(join(repo, "src"), { recursive: true });
    mkdirSync(join(repo, "node_modules", "pkg"), { recursive: true });
    const own = join(repo, "src", "page.html");
    const dep = join(repo, "node_modules", "pkg", "index.html");
    writeFileSync(own, "<p>x</p>");
    writeFileSync(dep, "<p>y</p>");
    // Judged against the repo root: `dist` above it is irrelevant, but
    // node_modules inside it is still skipped.
    expect(collectFiles([own, dep], [], repo)).toEqual([own]);
  });
});

describe("--except waives named rules without excluding the file", () => {
  const artboard = async (except?: Array<{ path: string; rules: string[] }>): Promise<string[]> => {
    const { check } = await import("../src/lint/index");
    const { tmpdir } = await import("node:os");
    const dir = path.join(fs.mkdtempSync(path.join(tmpdir(), "design-except-")), "templates");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "export-probe.html"),
      [
        '<div class="uinaf" style="width:1200px;height:630px">',
        '<span style="font-size:64px">off the type scale</span>',
        '<span style="padding:13px">off the spacing grid</span>',
        '<span style="color:#ff0000">raw hex</span>',
        "</div>",
      ].join("\n"),
    );
    return check({ paths: [dir], ...(except ? { except } : {}) }).map((v) => v.rule);
  };

  const CANVAS = [{ path: "templates/export-", rules: ["type-scale-only", "spacing-grid"] }];

  it("drops only the rules it names", async () => {
    const rules = await artboard(CANVAS);
    expect(rules).not.toContain("type-scale-only");
    expect(rules).not.toContain("spacing-grid");
  });

  it("leaves every other rule in force — the whole point over --ignore", async () => {
    expect(await artboard(CANVAS)).toContain("no-raw-color");
  });

  it("waives nothing without it", async () => {
    expect(await artboard()).toContain("type-scale-only");
  });

  it("waives nothing on a path it does not match", async () => {
    const rules = await artboard([{ path: "pages/", rules: ["type-scale-only"] }]);
    expect(rules).toContain("type-scale-only");
  });

  it("fails closed on a misspelled rule name, keeping the rule live", async () => {
    const rules = await artboard([{ path: "templates/export-", rules: ["type-scale-onlyy"] }]);
    expect(rules).toContain("type-scale-only");
  });
});

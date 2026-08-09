import { describe, expect, it } from "vite-plus/test";
import { checkCss, checkMarkup, compareRatchet, countByRule } from "../src/lint/index";

const rules = (violations: Array<{ rule: string }>): string[] => violations.map((v) => v.rule);
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
});

describe("no-uppercase", () => {
  it("passes in label context", () => {
    expect(rules(css(".u-label{text-transform:uppercase}"))).not.toContain("no-uppercase");
  });
  it("warns elsewhere", () => {
    expect(rules(css(".hero h1{text-transform:uppercase}"))).toContain("no-uppercase");
  });
});

describe("one-accent-per-view", () => {
  it("passes with one", () => {
    expect(rules(markup('<a class="u-btn u-btn-accent">go</a>'))).not.toContain(
      "one-accent-per-view",
    );
  });
  it("fails with two", () => {
    expect(
      rules(markup('<a class="u-btn u-btn-accent">go</a><a class="u-btn u-btn-accent">also</a>')),
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

describe("lowercase-copy", () => {
  it("passes on lowercase copy", () => {
    expect(rules(markup('<button class="u-btn">save changes</button>'))).not.toContain(
      "lowercase-copy",
    );
  });
  it("passes on abbreviations", () => {
    expect(rules(markup('<button class="u-btn">PR checks</button>'))).not.toContain(
      "lowercase-copy",
    );
    expect(rules(markup('<span class="u-label">macOS build</span>'))).not.toContain(
      "lowercase-copy",
    );
  });
  it("warns on sentence-initial caps", () => {
    expect(rules(markup('<button class="u-btn">Save Changes</button>'))).toContain(
      "lowercase-copy",
    );
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
  it("catches a raw fallback inside var()", () => {
    expect(rules(css("a{color:var(--fg, #f00)}"))).toContain("no-raw-color");
  });
  it("catches a raw stop in a gradient beside a token", () => {
    expect(rules(css("a{background:linear-gradient(var(--accent), #ff0000)}"))).toContain(
      "no-raw-color",
    );
  });
  it("still passes when every colour is a token", () => {
    expect(rules(css("a{background:linear-gradient(var(--accent), var(--bg))}"))).not.toContain(
      "no-raw-color",
    );
    expect(rules(css("a{color:var(--fg, var(--fg-muted))}"))).not.toContain("no-raw-color");
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

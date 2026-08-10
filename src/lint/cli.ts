#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  changedFiles,
  check,
  gitRoot,
  compareRatchet,
  countByRule,
  formatViolation,
  hasErrors,
  summarise,
} from "./index.ts";
import type { RuleException } from "./index.ts";

/**
 * `design-check` — the deterministic half of the uinaf design system.
 *
 * Exit codes: 0 clean, 1 violations. The Stop-hook in a product repo keys off
 * this, so a non-zero exit must always mean "not done".
 */

const RATCHET_FILE = ".design-ratchet.json";

const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(`--${name}`);
const value = (name: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
};

if (flag("help")) {
  console.log(`design-check — uinaf design adherence

  design-check [paths...]        check files or directories (default: cwd)
  design-check --ratchet         compare against ${RATCHET_FILE}, fail if any count rises
  design-check --update-ratchet  write the current counts as the new baseline
  design-check --json            machine-readable output
  design-check --changed         only files this branch touched (vs origin/main)
  design-check --base <ref>      base for --changed (default origin/main)
  design-check --ignore <part>   skip paths containing this substring (repeatable)
  design-check --except <part>:<rule>[,<rule>]
                                waive named rules for paths containing <part>,
                                leaving every other rule in force (repeatable)

Exit code is 0 when clean, 1 when there are errors (or, with --ratchet, when a
count rises). Warnings alone do not fail.`);
  process.exit(0);
}

// An unknown flag is a mistake, not a no-op: silently ignoring `--write` would
// run the check without doing what the caller asked.
const KNOWN_FLAGS = new Set([
  "--help",
  "--ratchet",
  "--update-ratchet",
  "--json",
  "--ignore",
  "--except",
  "--changed",
  "--base",
]);
const unknown = argv.filter((arg) => arg.startsWith("--") && !KNOWN_FLAGS.has(arg));
if (unknown.length > 0) {
  console.error(
    `design:check — unknown flag${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}\nRun \`design-check --help\` for the supported options.`,
  );
  process.exit(1);
}

const ignore = argv.reduce<string[]>((acc, arg, index) => {
  if (arg === "--ignore" && argv[index + 1]) acc.push(argv[index + 1]);
  return acc;
}, []);

// `<part>:<rule>,<rule>`. A missing rule list is a usage mistake, not a blanket
// waiver: silently dropping every rule on the path is exactly what --except
// exists to avoid.
const except = argv.reduce<RuleException[]>((acc, arg, index) => {
  const spec = arg === "--except" ? argv[index + 1] : undefined;
  if (!spec) return acc;
  const split = spec.lastIndexOf(":");
  const rules =
    split === -1
      ? []
      : spec
          .slice(split + 1)
          .split(",")
          .map((rule) => rule.trim())
          .filter(Boolean);
  if (split < 1 || rules.length === 0) {
    console.error(
      `design:check — --except needs <path>:<rule>[,<rule>], got \`${spec}\`.\nA path with no rule list would waive every rule, which is what --ignore already does.`,
    );
    process.exit(1);
  }
  acc.push({ path: spec.slice(0, split), rules });
  return acc;
}, []);

const paths = argv.filter((arg, index) => {
  if (arg.startsWith("--")) return false;
  const previous = argv[index - 1];
  return previous !== "--ignore" && previous !== "--except" && previous !== "--base";
});

let changedRoot: string | undefined;
if (flag("changed")) {
  let touched: string[];
  try {
    touched = changedFiles(value("base") ?? "origin/main");
  } catch (error) {
    // Never fall through to a full scan or a clean report: the caller asked for
    // changed files and we could not determine them.
    console.error(`design:check — ${(error as Error).message}`);
    process.exit(1);
  }
  if (touched.length === 0) {
    console.log("design:check clean — no changed files to check");
    process.exit(0);
  }
  paths.length = 0;
  paths.push(...touched);
  changedRoot = gitRoot();
}

let violations;
try {
  violations = check({
    paths,
    ignore,
    except,
    relativeTo: changedRoot,
  });
} catch (error) {
  // A usage mistake deserves a message, not a stack trace.
  console.error(`design:check — ${(error as Error).message}`);
  process.exit(1);
}
const counts = countByRule(violations);
const ratchetPath = path.resolve(RATCHET_FILE);

if (flag("update-ratchet")) {
  fs.writeFileSync(ratchetPath, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`wrote ${RATCHET_FILE} — ${summarise(violations)}`);
  process.exit(0);
}

// Evaluated before --json so the two compose: a machine-readable run must not
// silently drop the gate it was asked to enforce.
if (flag("ratchet")) {
  if (!fs.existsSync(ratchetPath)) {
    console.error(
      `no ${RATCHET_FILE} found. Record the current state first:\n  design-check --update-ratchet`,
    );
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(ratchetPath, "utf8")) as Record<string, number>;
  const result = compareRatchet(baseline, counts);
  // An error already in the baseline would otherwise pass forever: the ratchet
  // only fails on a rise. Errors are never an acceptable steady state, so they
  // fail here too — which is what --help has always promised.
  const errored = hasErrors(violations);
  const passed = result.passed && !errored;
  if (flag("json")) {
    console.log(JSON.stringify({ violations, counts, ratchet: result, errors: errored }, null, 2));
    process.exit(passed ? 0 : 1);
  }
  for (const { rule, was, now } of result.risen) {
    console.error(`${rule}: ${was} → ${now}`);
    for (const violation of violations.filter((v) => v.rule === rule)) {
      console.error(formatViolation(violation));
    }
  }
  if (result.improved.length > 0) {
    console.log(
      `improved: ${result.improved.map(({ rule, was, now }) => `${rule} ${was}→${now}`).join(", ")}`,
    );
    console.log(`run \`design-check --update-ratchet\` to lock the improvement in`);
  }
  if (errored) {
    for (const violation of violations.filter((v) => v.severity === "error")) {
      console.error(formatViolation(violation));
    }
  }
  if (!passed) {
    const why = [
      result.risen.length > 0 ? `${result.risen.length} rule(s) got worse` : "",
      errored ? "errors are never allowed, baseline or not" : "",
    ].filter(Boolean);
    console.error(`\ndesign:check ratchet failed — ${why.join("; ")}`);
    process.exit(1);
  }
  console.log(`design:check ratchet ok — ${summarise(violations)}, none worse than baseline`);
  process.exit(0);
}

if (flag("json")) {
  console.log(JSON.stringify({ violations, counts }, null, 2));
  process.exit(hasErrors(violations) ? 1 : 0);
}

for (const violation of violations) console.log(formatViolation(violation));

if (violations.length === 0) {
  console.log("design:check clean");
  process.exit(0);
}

console.log(`\ndesign:check — ${summarise(violations)}`);
process.exit(hasErrors(violations) ? 1 : 0);

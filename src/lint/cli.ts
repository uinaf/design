#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  check,
  compareRatchet,
  countByRule,
  formatViolation,
  hasErrors,
  summarise,
} from "./index.ts";

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
  design-check --ignore <part>   skip paths containing this substring (repeatable)

Exit code is 0 when clean, 1 when there are errors (or, with --ratchet, when a
count rises). Warnings alone do not fail.`);
  process.exit(0);
}

const ignore = argv.reduce<string[]>((acc, arg, index) => {
  if (arg === "--ignore" && argv[index + 1]) acc.push(argv[index + 1]);
  return acc;
}, []);

const abbreviationsArg = value("abbreviations");
const paths = argv.filter((arg, index) => {
  if (arg.startsWith("--")) return false;
  const previous = argv[index - 1];
  return previous !== "--ignore" && previous !== "--abbreviations";
});

let violations;
try {
  violations = check({
    paths,
    ignore,
    abbreviations: abbreviationsArg ? abbreviationsArg.split(",") : undefined,
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
  if (flag("json")) {
    console.log(JSON.stringify({ violations, counts, ratchet: result }, null, 2));
    process.exit(result.passed ? 0 : 1);
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
  if (!result.passed) {
    console.error(`\ndesign:check ratchet failed — ${result.risen.length} rule(s) got worse`);
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

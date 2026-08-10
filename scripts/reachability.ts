/**
 * Which scripts a command actually runs.
 *
 * A script no gate runs is a check that cannot fail: `scripts/smoke-mcp.ts` sat
 * behind a package script for two releases asserting something false, and
 * nothing noticed because nothing ran it. The guard against that has to answer
 * "does anything run this file", and two earlier attempts answered a weaker
 * question — "does anything mention this path" — which `echo scripts/x.ts` and
 * `# node scripts/x.ts` both satisfy while running nothing.
 *
 * So this reads command position rather than matching a path anywhere in the
 * text. A command's head is its first word; only a head that is the script
 * itself, or an interpreter whose argument is the script, counts.
 */

const INTERPRETERS = new Set(["node", "bash", "sh", "zsh", "tsx"]);
const SCRIPT = /^(?:\.\/)?scripts\/([\w.-]+\.(?:ts|sh|mjs|js))$/;

/**
 * Block comments and template literals span lines, so `\/*` + a newline +
 * `node scripts/x.ts` tokenizes as a command with a real interpreter at its
 * head. Line comments need no special case: `#` or `//` becomes the head, and
 * neither is an interpreter. Shell backticks are command substitution rather
 * than a string, so dropping them can only hide an invocation, never invent
 * one — the safe direction for this guard.
 */
const withoutSpans = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/`[^`]*`/g, " ");

/**
 * Line comments have to go before the split, not after. `echo ok # x; node
 * scripts/orphan.ts` is one command and a comment, but splitting on `;` first
 * turns the commented tail into a command with a real interpreter at its head.
 *
 * A comment marker only starts one at a token boundary, which is what keeps
 * `http://host` and a `#fragment` inside a URL intact.
 */
const withoutLineComments = (source: string): string =>
  source
    .split("\n")
    .map((line) => line.replace(/(^|\s)(#|\/\/).*$/, "$1"))
    .join("\n");

/**
 * Split on the operators that end one command and begin another. Over-splitting
 * is safe here and under-splitting is not: an extra fragment only produces one
 * more head to reject, while a missed separator can hide a real invocation.
 * A quoted `echo "a; node scripts/x.ts"` splits too, but the trailing quote
 * makes the argument fail SCRIPT's anchors, so it still does not count.
 */
const commands = (source: string): string[][] =>
  withoutLineComments(withoutSpans(source))
    .split(/[\n;&|()]+/)
    .map((command) => command.trim().split(/\s+/).filter(Boolean))
    .filter((words) => words.length > 0)
    // Leading `FOO=bar` is environment, not the command.
    .map((words) => {
      let head = 0;
      while (head < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[head])) head += 1;
      return words.slice(head);
    })
    .filter((words) => words.length > 0);

/** Script files this source actually invokes, by basename. */
export const invokedScripts = (source: string): string[] =>
  commands(source).flatMap((words) => {
    const [head, ...rest] = words;
    const direct = SCRIPT.exec(head);
    if (direct) return [direct[1]];
    if (!INTERPRETERS.has(head)) return [];
    // `node --flag scripts/x.ts` — the script is the first non-flag argument.
    const argument = rest.find((word) => !word.startsWith("-"));
    const run = argument === undefined ? null : SCRIPT.exec(argument);
    return run ? [run[1]] : [];
  });

/**
 * Sibling modules this source imports, by basename. A helper is read by
 * whatever imports it, so `check.ts` importing this file is what keeps this
 * file from reading as an orphan — and a helper nothing imports still does.
 */
export const importedScripts = (source: string): string[] =>
  [
    ...source.matchAll(
      // `(?!\s*\()` keeps this off `await import("./x.ts")`, which the dynamic
      // form below already reads — otherwise one import counts twice.
      /(?:^|[\s;])(?:import|export)\b(?!\s*\()[^;\n]*?["']\.\/([\w.-]+\.(?:ts|mjs|js))["']/gm,
    ),
  ]
    .map((match) => match[1])
    .concat(
      [...source.matchAll(/(?:^|[\s;=(])import\(\s*["']\.\/([\w.-]+\.(?:ts|mjs|js))["']/g)].map(
        (match) => match[1],
      ),
    );

/** Package scripts this source runs through `pnpm run`. */
export const invokedPackageScripts = (source: string): string[] =>
  commands(source).flatMap((words) =>
    words[0] === "pnpm" && words[1] === "run" && words[2] !== undefined ? [words[2]] : [],
  );

/**
 * Every script file reachable from `entry`, following package scripts into each
 * other and into the shell and node files they run. `read` returns a script
 * file's source, or null when it does not exist.
 */
export const reachableFrom = (
  entry: string,
  packageScripts: Record<string, string>,
  read: (file: string) => string | null,
): Set<string> => {
  const reached = new Set<string>();
  const walk = (name: string, seen: Set<string>): void => {
    if (seen.has(name)) return;
    seen.add(name);
    const body = packageScripts[name];
    if (body === undefined) return;
    const follow = (file: string): void => {
      if (reached.has(file)) return;
      reached.add(file);
      // A shell entrypoint hides its real work from package.json: smoke.sh is
      // what runs smoke-mcp.ts.
      const source = read(file);
      if (source !== null) {
        for (const nested of invokedScripts(source)) follow(nested);
        for (const nested of importedScripts(source)) follow(nested);
        for (const nested of invokedPackageScripts(source)) walk(nested, seen);
      }
    };
    for (const file of invokedScripts(body)) follow(file);
    for (const referenced of invokedPackageScripts(body)) walk(referenced, seen);
  };
  walk(entry, new Set());
  return reached;
};

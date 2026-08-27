/**
 * Split on commas that are not inside parentheses or quotes. A lookahead cannot
 * do this correctly once values nest. `linear-gradient(var(--fg), var(--bg))`
 * is one value, not two.
 */
export const splitTopLevel = (value: string, separator = ","): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = "";
  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = undefined;
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

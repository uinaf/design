/**
 * HTML attribute values, for the gates that read pattern markup.
 *
 * Three things a naive `/name="([^"]*)"/` gets wrong, each of which lets a real
 * violation through a gate that exists to catch it:
 *
 *   - single-quoted and unquoted values are equally valid HTML
 *   - attribute names are case-insensitive, so `STYLE=` is the same attribute
 *   - `\bclass` also matches inside `data-class=`, which is a different one
 *
 * The leading lookbehind handles that last case, and it requires whitespace
 * rather than blacklisting separators: an attribute inside a tag is always
 * preceded by whitespace, so `data-class=`, `:class=`, `x:class=` and `.class=`
 * are all excluded by construction. A framework binding is not a class a
 * consumer can copy, and counting one as a demonstration would let the
 * coverage gates pass on markup that shows nothing.
 */
export const attributeValues = (markup: string, name: string): string[] => {
  // Commented-out markup is not a demonstration. This is the realistic case,
  // not an exotic one: pattern markup carries explanatory `<!-- … -->` lines,
  // so an author commenting out an example block would otherwise keep the
  // coverage gates green while the example is gone.
  // `(?:-->|$)`: an unterminated comment runs to the end, which is what a
  // browser does with it too. Forgetting the terminator is an ordinary slip.
  const live = markup.replace(/<!--[\s\S]*?(?:-->|$)/g, " ");
  const pattern = new RegExp(
    `(?<=\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'\`=<>]+))`,
    "gi",
  );
  return [...live.matchAll(pattern)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
};

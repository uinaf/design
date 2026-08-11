/**
 * A group of urls, nested to any depth. Every leaf must be a url string — a
 * number or a null leaf is a compile error here rather than an entry `cdnUrls`
 * drops on the floor.
 */
type UrlTree = { readonly [key: string]: string | UrlTree };

/** Licensed fonts and shared brand media on cdn.uinaf.dev (not shipped in the npm tarball). */
export const CDN = {
  origin: "https://cdn.uinaf.dev",
  berkeleyMonoVariableCss: "https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css",
  berkeleyMonoStaticRegularWoff:
    "https://cdn.uinaf.dev/fonts/berkeley-mono/static/berkeley-mono-regular.woff",
  images: {
    computer240: "https://cdn.uinaf.dev/images/webp/uinaf-computer-240w.webp",
    computer: "https://cdn.uinaf.dev/images/uinaf-computer.png",
    computerOg: "https://cdn.uinaf.dev/images/uinaf-computer-og-image.png",
    computerOgWebp: "https://cdn.uinaf.dev/images/webp/uinaf-computer-og-image-1024w.webp",
    team: "https://cdn.uinaf.dev/images/uinaf-team.png",
  },
  /** Rendered output of the `templates/export-*.html` artboards. */
  exports: {
    ogCard: "https://cdn.uinaf.dev/images/exports/og-card.png",
    ogCardPost: "https://cdn.uinaf.dev/images/exports/og-card-post.png",
    repoOgSample: "https://cdn.uinaf.dev/images/exports/repo-og-healthd.png",
    readmeBannerSample: "https://cdn.uinaf.dev/images/exports/readme-banner-healthd.png",
  },
  favicons: {
    png16: "https://cdn.uinaf.dev/images/exports/favicons/favicon-16.png",
    png32: "https://cdn.uinaf.dev/images/exports/favicons/favicon-32.png",
    png48: "https://cdn.uinaf.dev/images/exports/favicons/favicon-48.png",
    png192: "https://cdn.uinaf.dev/images/exports/favicons/favicon-192.png",
    png512: "https://cdn.uinaf.dev/images/exports/favicons/favicon-512.png",
    appleTouch: "https://cdn.uinaf.dev/images/exports/favicons/apple-touch-icon.png",
  },
} as const satisfies UrlTree;

/**
 * Every asset url in `CDN`, flattened — the origin itself excluded, because it
 * is the prefix the others are checked against, not an asset.
 *
 * Lives next to the declaration so `cdn:check` and the inline-url gate read the
 * same list. Two copies of this walk would let a nested group be reachable to
 * one and invisible to the other.
 *
 * Repo-internal: `dist/cdn.js` is emitted as a serialized `CDN` literal, so the
 * published `./cdn` export carries the object and nothing else.
 */
export const cdnUrls = (): string[] => walk(CDN);

const walk = (value: string | UrlTree): string[] =>
  typeof value === "string"
    ? value === CDN.origin
      ? []
      : [value]
    : Object.values(value).flatMap(walk);

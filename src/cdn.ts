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
} as const;

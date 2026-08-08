import { describe, expect, it } from "vite-plus/test";
import { CDN } from "../src/cdn.ts";

describe("CDN", () => {
  it("points berkeley mono at cdn.uinaf.dev", () => {
    expect(CDN.origin).toBe("https://cdn.uinaf.dev");
    expect(CDN.berkeleyMonoVariableCss).toContain(
      "cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css",
    );
  });
});

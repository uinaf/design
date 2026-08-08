import { describe, expect, it } from "vite-plus/test";
import { CDN } from "../src/cdn";

describe("CDN", () => {
  it("points fonts at cdn.uinaf.dev", () => {
    expect(CDN.berkeleyMonoVariableCss).toContain("cdn.uinaf.dev/fonts/berkeley-mono");
  });
});

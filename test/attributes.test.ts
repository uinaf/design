import { describe, expect, it } from "vite-plus/test";
import { attributeValues } from "./attributes.ts";

// Three gates read markup through this helper, so a hole here is a hole in all
// three at once. Each case below is a form a naive /name="([^"]*)"/ gets wrong.
describe("attributeValues", () => {
  it("reads all three quoting forms", () => {
    expect(attributeValues('<i style="a:1">', "style")).toEqual(["a:1"]);
    expect(attributeValues("<i style='a:1'>", "style")).toEqual(["a:1"]);
    expect(attributeValues("<i style=a:1>", "style")).toEqual(["a:1"]);
  });

  it("ignores the case of the attribute name", () => {
    expect(attributeValues('<i STYLE="a:1">', "style")).toEqual(["a:1"]);
  });

  it("does not match an attribute that merely ends with the name", () => {
    expect(attributeValues('<i data-style="a:1">', "style")).toEqual([]);
    expect(attributeValues('<i myclass="u-btn">', "class")).toEqual([]);
  });

  it("does not count a framework binding as a copyable attribute", () => {
    // `:class` and friends are a different attribute. Treating one as a
    // demonstration would satisfy a coverage gate with markup that shows the
    // consumer nothing.
    expect(attributeValues('<i :class="u-btn">', "class")).toEqual([]);
    expect(attributeValues('<i x:class="u-btn">', "class")).toEqual([]);
    expect(attributeValues('<i .class="u-btn">', "class")).toEqual([]);
  });

  it("does not count commented-out markup as a demonstration", () => {
    expect(attributeValues('<!-- <i class="u-btn"></i> -->', "class")).toEqual([]);
    expect(attributeValues('<i class="u-tag"></i><!-- <b class="u-btn"> -->', "class")).toEqual([
      "u-tag",
    ]);
  });

  it("treats an unterminated comment as running to the end", () => {
    // A browser does the same with a missing `-->`, and forgetting it while
    // commenting out an example is an ordinary slip.
    expect(attributeValues('<i class="u-tag"></i><!-- <b class="u-btn">', "class")).toEqual([
      "u-tag",
    ]);
  });

  it("reads every occurrence, not only the first", () => {
    expect(attributeValues('<a class="u-btn"><b class="u-tag">', "class")).toEqual([
      "u-btn",
      "u-tag",
    ]);
  });

  it("keeps an empty value rather than dropping the attribute", () => {
    expect(attributeValues('<i class="">', "class")).toEqual([""]);
  });

  it("stops an unquoted value at the tag boundary", () => {
    expect(attributeValues("<i class=u-btn>text</i>", "class")).toEqual(["u-btn"]);
  });
});

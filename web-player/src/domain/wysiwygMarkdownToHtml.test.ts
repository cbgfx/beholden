import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@beholden/shared/ui/markdownHtml";

// markdownToHtml is pure string processing (no DOM APIs), unlike its counterpart htmlToMarkdown --
// this is exactly the value the WysiwygNoteEditor split was meant to unlock: this direction is
// testable in a plain Node environment without a DOM, where before it was bundled into a React
// component file.
describe("markdownToHtml", () => {
  it("renders a blank line as an empty paragraph", () => {
    expect(markdownToHtml("")).toBe("<p><br></p>");
  });

  it("renders headings at every level", () => {
    expect(markdownToHtml("# Title")).toBe("<h1>Title</h1>");
    expect(markdownToHtml("###### Deep")).toBe("<h6>Deep</h6>");
  });

  it("does not treat 7+ leading #'s as a heading -- falls through to a plain paragraph", () => {
    // The heading regex requires whitespace immediately after 1-6 #'s; a 7th # before any
    // whitespace never satisfies that for any backtracked prefix length, so this renders as text.
    expect(markdownToHtml("####### Too deep")).toBe("<p>####### Too deep</p>");
  });

  it("renders a horizontal rule", () => {
    expect(markdownToHtml("---")).toBe("<hr>");
  });

  it("renders bold, underline, and italic inline markup", () => {
    expect(markdownToHtml("**bold** __underline__ *italic*"))
      .toBe("<p><strong>bold</strong> <u>underline</u> <em>italic</em></p>");
  });

  it("escapes HTML-significant characters before applying inline markup", () => {
    expect(markdownToHtml("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("renders a bullet list", () => {
    expect(markdownToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders links, tagging a /binder/ mention link with its own style", () => {
    expect(markdownToHtml("[Elmsworth](https://example.com/lore)"))
      .toBe('<p><a href="https://example.com/lore" rel="noreferrer">Elmsworth</a></p>');
    expect(markdownToHtml("[Elmsworth](/binder/b1/mortals/m1)")).toContain(
      '<a href="/binder/b1/mortals/m1" rel="noreferrer" style=',
    );
  });

  it("strips a javascript: link target down to plain text", () => {
    // The href capture group stops at the first unescaped ")", so a nested paren in the target
    // (as in this alert(1)) leaves one literal ")" behind after the label -- pre-existing behavior,
    // unrelated to this split, documented here rather than "fixed" as part of a pure extraction.
    expect(markdownToHtml("[click me](javascript:alert(1))")).toBe("<p>click me)</p>");
  });

  it("renders a toggle block as a details/summary, recursing into its body", () => {
    expect(markdownToHtml(":::toggle Secret\nInside\n:::")).toBe(
      "<details open><summary>Secret</summary><p>Inside</p></details>",
    );
  });
});

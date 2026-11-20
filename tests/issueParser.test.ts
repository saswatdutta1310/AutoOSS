import { describe, expect, it } from "vitest";
import { InvalidIssueUrlError, parseIssueUrl } from "../src/github/issueParser.js";

describe("issueParser", () => {
  it("1. parses standard valid issue URL", () => {
    const res = parseIssueUrl("https://github.com/facebook/react/issues/12345");
    expect(res).toEqual({
      owner: "facebook",
      repo: "react",
      number: 12345,
    });
  });

  it("2. accepts trailing slash", () => {
    const res = parseIssueUrl("https://github.com/facebook/react/issues/12345/");
    expect(res).toEqual({
      owner: "facebook",
      repo: "react",
      number: 12345,
    });
  });

  it("3. accepts query string parameters", () => {
    const res = parseIssueUrl("https://github.com/facebook/react/issues/12345?notification_referrer_id=MDE4#comment-1");
    expect(res).toEqual({
      owner: "facebook",
      repo: "react",
      number: 12345,
    });
  });

  it("4. accepts hash fragment", () => {
    const res = parseIssueUrl("https://github.com/facebook/react/issues/12345#issuecomment-987654321");
    expect(res).toEqual({
      owner: "facebook",
      repo: "react",
      number: 12345,
    });
  });

  it("5. rejects pull request URLs", () => {
    expect(() => parseIssueUrl("https://github.com/facebook/react/pull/12345")).toThrow(InvalidIssueUrlError);
    expect(() => parseIssueUrl("https://github.com/facebook/react/pull/12345")).toThrow(/pull request/i);
  });

  it("6. rejects wrong host (e.g., gitlab.com)", () => {
    expect(() => parseIssueUrl("https://gitlab.com/facebook/react/issues/12345")).toThrow(InvalidIssueUrlError);
    expect(() => parseIssueUrl("https://gitlab.com/facebook/react/issues/12345")).toThrow(/github\.com/);
  });

  it("7. rejects lookalike host (e.g., github.com.evil.com)", () => {
    expect(() => parseIssueUrl("https://github.com.evil.com/facebook/react/issues/12345")).toThrow(InvalidIssueUrlError);
    expect(() => parseIssueUrl("https://github.com.evil.com/facebook/react/issues/12345")).toThrow(/github\.com/);
  });

  it("8. rejects non-numeric issue number", () => {
    expect(() => parseIssueUrl("https://github.com/facebook/react/issues/abc")).toThrow(InvalidIssueUrlError);
    expect(() => parseIssueUrl("https://github.com/facebook/react/issues/abc")).toThrow(/positive integer/i);
  });

  it("9. rejects zero issue number", () => {
    expect(() => parseIssueUrl("https://github.com/facebook/react/issues/0")).toThrow(InvalidIssueUrlError);
    expect(() => parseIssueUrl("https://github.com/facebook/react/issues/0")).toThrow(/greater than zero/i);
  });

  it("10. rejects empty string", () => {
    expect(() => parseIssueUrl("")).toThrow(InvalidIssueUrlError);
    expect(() => parseIssueUrl("")).toThrow(/non-empty string/i);
  });

  it("11. rejects missing parts (e.g. missing issue number)", () => {
    expect(() => parseIssueUrl("https://github.com/facebook/react/issues")).toThrow(InvalidIssueUrlError);
    expect(() => parseIssueUrl("https://github.com/facebook")).toThrow(InvalidIssueUrlError);
  });

  it("12. accepts http scheme as well as https", () => {
    const res = parseIssueUrl("http://github.com/facebook/react/issues/42");
    expect(res).toEqual({
      owner: "facebook",
      repo: "react",
      number: 42,
    });
  });

  it("13. rejects javascript: scheme and non-http(s) schemes", () => {
    expect(() => parseIssueUrl("javascript:alert(1)")).toThrow(InvalidIssueUrlError);
    expect(() => parseIssueUrl("ftp://github.com/facebook/react/issues/123")).toThrow(InvalidIssueUrlError);
  });
});

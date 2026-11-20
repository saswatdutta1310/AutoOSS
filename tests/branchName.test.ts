import { describe, expect, it } from "vitest";
import { makeBranchName } from "../src/github/branchName.js";

describe("makeBranchName", () => {
  it("converts regular title into slug", () => {
    expect(makeBranchName(42, "Fix login page crash on submit")).toBe(
      "autooss/issue-42-fix-login-page-crash-on-submit"
    );
  });

  it("handles empty title with fallback", () => {
    expect(makeBranchName(10, "")).toBe("autooss/issue-10-fix");
    expect(makeBranchName(10, "    ")).toBe("autooss/issue-10-fix");
  });

  it("handles titles with emoji and special unicode characters", () => {
    expect(makeBranchName(5, "Fix 🚀 rocket speed & latency issues")).toBe(
      "autooss/issue-5-fix-rocket-speed-latency-issues"
    );
  });

  it("handles symbols and punctuation", () => {
    expect(makeBranchName(99, "Error: [auth/failed] @user.login() => broken!")).toBe(
      "autooss/issue-99-error-auth-failed-user-login-broken"
    );
  });

  it("truncates very long titles to maximum 40 slug characters without trailing hyphens", () => {
    const longTitle = "This is an extremely long issue title that goes on and on and contains too many characters to fit in branch slug";
    const branch = makeBranchName(101, longTitle);
    const prefix = "autooss/issue-101-";
    expect(branch.startsWith(prefix)).toBe(true);
    const slug = branch.replace(prefix, "");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("this-is-an-extremely-long-issue-title-th");
  });

  it("handles non-Latin unicode titles (e.g. Chinese, Cyrillic) safely with fallback", () => {
    expect(makeBranchName(7, "修复登录错误")).toBe("autooss/issue-7-fix");
    expect(makeBranchName(8, "Ошибка авторизации")).toBe("autooss/issue-8-fix");
  });
});

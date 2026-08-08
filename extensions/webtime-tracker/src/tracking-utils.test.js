import { describe, expect, it } from "vitest";

import {
  getNextTrackedUrl,
  inferAppName,
  sanitizeTrackedUrl,
} from "./tracking-utils.js";

describe("sanitizeTrackedUrl", () => {
  it.each([
    [
      "https://docs.google.com/document/d/example?usp=sharing#heading=h.1",
      "https://docs.google.com/",
    ],
    ["http://example.com/path?query=value#section", "http://example.com/"],
  ])("sanitizes a trackable URL", (rawUrl, expected) => {
    expect(sanitizeTrackedUrl(rawUrl)).toBe(expected);
  });

  it.each([
    "chrome://extensions/",
    "chrome-extension://example/popup.html",
    "file:///C:/secret.txt",
    "ftp://example.com/file",
    "not a url",
  ])("rejects a non-HTTP URL: %s", (rawUrl) => {
    expect(sanitizeTrackedUrl(rawUrl)).toBeNull();
  });
});

describe("getNextTrackedUrl", () => {
  it("returns a sanitized URL when the domain changed", () => {
    expect(
      getNextTrackedUrl(
        "https://github.com/Reossann/time-is-money",
        "https://github.com/Reossann/time-is-money/issues?state=open",
      ),
    ).toBe("https://github.com/");
  });

  it("suppresses a page change within the same domain", () => {
    expect(
      getNextTrackedUrl(
        "https://github.com/",
        "https://github.com/Reossann/time-is-money/issues?state=open#issue-46",
      ),
    ).toBeNull();
  });
});

describe("inferAppName", () => {
  it.each([
    ["https://docs.google.com/document/d/example", "Google Workspace"],
    ["https://docs.google.com/spreadsheets/d/example", "Google Workspace"],
    ["https://docs.google.com/presentation/d/example", "Google Workspace"],
  ])("groups Google workspace URLs by domain", (url, expected) => {
    expect(inferAppName(url)).toBe(expected);
  });

  it("accepts a real subdomain", () => {
    expect(inferAppName("https://www.github.com/openai")).toBe("GitHub");
  });

  it("does not match a lookalike domain", () => {
    expect(inferAppName("https://evilgithub.com/")).toBe("evilgithub.com");
  });
});

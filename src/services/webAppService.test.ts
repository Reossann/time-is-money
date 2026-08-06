import { describe, expect, it } from "vitest";

import { detectWebApp, formatSessionDuration } from "./webAppService";

describe("detectWebApp", () => {
  it.each([
    ["https://docs.google.com/document/d/example", "google-docs"],
    ["https://docs.google.com/spreadsheets/d/example", "google-sheets"],
    ["https://docs.google.com/presentation/d/example", "google-slides"],
  ])("detects a Google workspace URL", (url, expectedId) => {
    expect(detectWebApp(url)?.id).toBe(expectedId);
  });

  it("accepts an actual subdomain", () => {
    expect(detectWebApp("https://www.github.com/Reossann")?.id).toBe("github");
  });

  it.each([
    "https://evilgithub.com/",
    "https://example.com/redirect/github.com",
    "https://example.com/?next=https://github.com",
  ])("does not detect a lookalike URL: %s", (url) => {
    expect(detectWebApp(url)).toBeNull();
  });

  it("returns null for an invalid URL", () => {
    expect(detectWebApp("not a url")).toBeNull();
  });
});

describe("formatSessionDuration", () => {
  it.each([
    [0, "00:00:00"],
    [61, "00:01:01"],
    [3661, "01:01:01"],
    [1.9, "00:00:01"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatSessionDuration(seconds)).toBe(expected);
  });
});

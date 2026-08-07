import { afterEach, describe, expect, it, vi } from "vitest";

import { detectWebApp, formatSessionDuration } from "./webAppService";

describe("detectWebApp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it.each([
    "https://docs.google.com/document/d/example",
    "https://docs.google.com/spreadsheets/d/example",
    "https://docs.google.com/presentation/d/example",
  ])("groups Google workspace pages by domain: %s", (url) => {
    expect(detectWebApp(url)).toMatchObject({
      id: "web-domain:docs.google.com",
      name: "Google Workspace",
      domain: "docs.google.com",
      url: "https://docs.google.com/",
    });
  });

  it("accepts an actual subdomain", () => {
    expect(detectWebApp("https://www.github.com/Reossann")?.id).toBe(
      "web-domain:github.com",
    );
  });

  it.each([
    "https://evilgithub.com/",
    "https://example.com/redirect/github.com",
    "https://example.com/?next=https://github.com",
  ])("tracks an unknown site by its domain only: %s", (url) => {
    const app = detectWebApp(url);
    expect(app?.domain).toBe(new URL(url).hostname);
    expect(app?.url).toBe(`https://${new URL(url).hostname}/`);
  });

  it("returns null for an invalid URL", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const privateUrl = "not a url https://example.com/private?token=secret";

    expect(detectWebApp(privateUrl)).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "detectWebApp: URLの解析に失敗しました",
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(privateUrl);
  });

  it("does not retain a path or query in a tracked site", () => {
    expect(
      detectWebApp("https://example.com/private/document?token=secret#section"),
    ).toMatchObject({
      id: "web-domain:example.com",
      name: "example.com",
      url: "https://example.com/",
      domain: "example.com",
    });
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

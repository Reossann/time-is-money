const WEB_APP_MATCHERS = [
  {
    name: "Google Sheets",
    domains: ["docs.google.com"],
    pathPrefixes: ["/spreadsheets"],
  },
  {
    name: "Google Slides",
    domains: ["docs.google.com"],
    pathPrefixes: ["/presentation"],
  },
  {
    name: "Google Docs",
    domains: ["docs.google.com"],
    pathPrefixes: ["/document"],
  },
  { name: "Gmail", domains: ["mail.google.com"] },
  { name: "Google Drive", domains: ["drive.google.com"] },
  { name: "Slack", domains: ["slack.com"] },
  { name: "Notion", domains: ["notion.so"] },
  { name: "GitHub", domains: ["github.com"] },
  { name: "YouTube", domains: ["youtube.com", "youtu.be"] },
  { name: "X (Twitter)", domains: ["x.com", "twitter.com"] },
  { name: "ChatGPT", domains: ["chatgpt.com", "chat.openai.com"] },
  { name: "Claude", domains: ["claude.ai"] },
];

function matchesDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * 計測対象として扱えるURLだけを返し、機密情報になり得る部分を除去する。
 * @param {string} rawUrl
 * @returns {string | null}
 */
export function sanitizeTrackedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * 前回と異なる有効なURLだけを通知対象として返す。
 * @param {string | null} previousUrl
 * @param {string} candidateUrl
 * @returns {string | null}
 */
export function getNextTrackedUrl(previousUrl, candidateUrl) {
  const sanitizedUrl = sanitizeTrackedUrl(candidateUrl);

  if (!sanitizedUrl || sanitizedUrl === previousUrl) {
    return null;
  }

  return sanitizedUrl;
}

/**
 * URLから表示用のウェブアプリ名を判定する。
 * @param {string} rawUrl
 * @returns {string}
 */
export function inferAppName(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();

    for (const matcher of WEB_APP_MATCHERS) {
      const domainMatches = matcher.domains.some((domain) =>
        matchesDomain(hostname, domain),
      );

      if (!domainMatches) {
        continue;
      }

      if (
        matcher.pathPrefixes &&
        !matcher.pathPrefixes.some((prefix) => url.pathname.startsWith(prefix))
      ) {
        continue;
      }

      return matcher.name;
    }

    return hostname;
  } catch {
    return "不明なアプリ";
  }
}

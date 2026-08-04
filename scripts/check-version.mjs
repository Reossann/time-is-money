/* global console, process */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readText(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readCargoTomlVersion() {
  const lines = readText("src-tauri/Cargo.toml").split(/\r?\n/);
  const packageStart = lines.findIndex((line) => /^\[package\]\s*$/.test(line));

  if (packageStart === -1) {
    throw new Error("src-tauri/Cargo.toml の [package] セクションを取得できません");
  }

  const sectionEnd = lines
    .slice(packageStart + 1)
    .findIndex((line) => /^\[[^\]]+\]\s*$/.test(line));
  const sectionLines = lines.slice(
    packageStart + 1,
    sectionEnd === -1 ? undefined : packageStart + 1 + sectionEnd,
  );
  const version = sectionLines
    .find((line) => /^version\s*=/.test(line))
    ?.match(/^version\s*=\s*"([^"]+)"\s*$/)?.[1];

  if (!version) {
    throw new Error("src-tauri/Cargo.toml の [package].version を取得できません");
  }

  return version;
}

function readCargoLockVersion() {
  const packageBlocks = readText("src-tauri/Cargo.lock").split(
    /\r?\n(?=\[\[package\]\]\r?$)/m,
  );
  const matchingBlocks = packageBlocks.filter((block) =>
    /^name\s*=\s*"time-is-money"\s*$/m.test(block),
  );

  if (matchingBlocks.length !== 1) {
    throw new Error(
      `src-tauri/Cargo.lock の time-is-money packageは1件必要です（検出: ${matchingBlocks.length}件）`,
    );
  }

  const version = matchingBlocks[0].match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];

  if (!version) {
    throw new Error("src-tauri/Cargo.lock の time-is-money versionを取得できません");
  }

  return version;
}

function readTagArgument() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return undefined;
  }

  if (args.length === 2 && args[0] === "--tag" && args[1]) {
    return args[1];
  }

  throw new Error("引数は省略するか、--tag vX.Y.Z の形式で指定してください");
}

function main() {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const tauriConfig = readJson("src-tauri/tauri.conf.json");
  const tag = readTagArgument();
  const versions = [
    ["package.json#version", packageJson.version],
    ["package-lock.json#version", packageLock.version],
    ["package-lock.json#packages[\"\"]#version", packageLock.packages?.[""]?.version],
    ["src-tauri/Cargo.toml#[package].version", readCargoTomlVersion()],
    ["src-tauri/Cargo.lock#time-is-money.version", readCargoLockVersion()],
    ["src-tauri/tauri.conf.json#version", tauriConfig.version],
  ];
  const expectedVersion = packageJson.version;

  if (typeof expectedVersion !== "string" || expectedVersion.length === 0) {
    throw new Error("package.json#version が空、または文字列ではありません");
  }

  const mismatches = versions.filter(([, version]) => version !== expectedVersion);
  const expectedTag = `v${expectedVersion}`;

  if (mismatches.length > 0 || (tag !== undefined && tag !== expectedTag)) {
    console.error("バージョンが一致していません:");
    for (const [location, version] of versions) {
      console.error(`- ${location}: ${String(version)}`);
    }

    if (tag !== undefined) {
      console.error(`- Git tag: ${tag}（期待値: ${expectedTag}）`);
    }

    process.exitCode = 1;
    return;
  }

  const tagMessage = tag === undefined ? "" : ` / Git tag ${tag}`;
  console.log(`バージョン整合性チェック成功: ${expectedVersion}${tagMessage}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`バージョン整合性チェック失敗: ${message}`);
  process.exitCode = 1;
}

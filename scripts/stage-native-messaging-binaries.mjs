import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = dirname(scriptDirectory);
const releaseDirectory = join(repositoryRoot, "src-tauri", "target", "release");
const binariesDirectory = join(repositoryRoot, "src-tauri", "binaries");
const binaries = ["native-messaging-host", "native-messaging-setup"];

execFileSync(
  "cargo",
  [
    "build",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--release",
    "--bin",
    "native-messaging-host",
    "--bin",
    "native-messaging-setup",
  ],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      TAURI_CONFIG: JSON.stringify({ bundle: { externalBin: [] } }),
    },
    stdio: "inherit",
  },
);

const rustcVersion = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
const targetTriple = rustcVersion.match(/^host: (.+)$/m)?.[1];

if (!targetTriple) {
  throw new Error("Could not determine the Rust target triple.");
}

if (!targetTriple.endsWith("-windows-msvc")) {
  throw new Error(`Native Messaging binaries require a Windows MSVC target: ${targetTriple}`);
}

mkdirSync(binariesDirectory, { recursive: true });

for (const binary of binaries) {
  const source = join(releaseDirectory, `${binary}.exe`);
  const destination = join(binariesDirectory, `${binary}-${targetTriple}.exe`);

  cpSync(source, destination);
  console.log(`Staged ${binary} for ${targetTriple}.`);
}

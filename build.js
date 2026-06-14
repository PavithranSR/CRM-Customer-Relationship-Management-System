#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const isWindows = process.platform === "win32";

let cmd;
if (isWindows) {
  cmd = "powershell -NoProfile -Command \"subst X: '%CD%'; Set-Location X:\\; npx next build --webpack\"";
} else {
  cmd = "npx next build --webpack";
}

const result = spawnSync(cmd, {
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);


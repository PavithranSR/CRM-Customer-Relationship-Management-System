/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("child_process");
const path = require("path");
const projectPath = process.cwd();

function setupWindowsDrive() {
  if (process.platform !== "win32") {
    return;
  }

  const drive = "X:";

  spawnSync("subst", [drive, "/D"], { stdio: "ignore" });
  const mapped = spawnSync("subst", [drive, projectPath], { stdio: "ignore" });

  if (mapped.status === 0) {
    process.chdir(`${drive}\\`);
  }
}

setupWindowsDrive();
require(path.join(projectPath, "scripts", "next-build.cjs"));

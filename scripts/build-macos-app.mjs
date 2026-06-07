#!/usr/bin/env node
import { packager } from "@electron/packager";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function normalizeDarwinArch(arch = process.arch) {
  if (arch === "arm64" || arch === "x64") {
    return arch;
  }

  throw new Error(`Unsupported macOS architecture: ${arch}`);
}

export function getBuildPaths(projectRoot, arch = normalizeDarwinArch()) {
  const appName = "Local Music Player";
  const releaseDir = path.join(projectRoot, "release");

  return {
    appName,
    releaseDir,
    packagedAppPath: path.join(releaseDir, `${appName}-darwin-${arch}`, `${appName}.app`),
    applicationsPath: path.join("/Applications", `${appName}.app`)
  };
}

export function getInstallCommand(packagedAppPath, applicationsPath) {
  return {
    command: "ditto",
    args: [packagedAppPath, applicationsPath]
  };
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("This script only builds and installs the macOS app on macOS.");
  }

  const projectRoot = path.resolve(__dirname, "..");
  const arch = normalizeDarwinArch(os.arch());
  const paths = getBuildPaths(projectRoot, arch);

  await run("npm", ["run", "build"], projectRoot);

  await rm(paths.releaseDir, { recursive: true, force: true });
  await packager({
    dir: projectRoot,
    name: paths.appName,
    platform: "darwin",
    arch,
    out: paths.releaseDir,
    overwrite: true,
    asar: true,
    prune: true,
    appBundleId: "local.musicplayer.app",
    appCategoryType: "public.app-category.music",
    ignore: [
      /^\/\.git($|\/)/,
      /^\/\.worktrees($|\/)/,
      /^\/\.superpowers($|\/)/,
      /^\/docs($|\/)/,
      /^\/src($|\/)/,
      /^\/scripts\/.*\.test\.ts$/,
      /^\/dist-electron\/.*\.test\.js$/,
      /^\/release($|\/)/
    ]
  });

  await rm(paths.applicationsPath, { recursive: true, force: true });
  const install = getInstallCommand(paths.packagedAppPath, paths.applicationsPath);
  await run(install.command, install.args, projectRoot);

  console.log(`Built ${paths.packagedAppPath}`);
  console.log(`Installed ${paths.applicationsPath}`);
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

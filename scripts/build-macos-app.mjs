#!/usr/bin/env node
import { packager } from "@electron/packager";
import { mkdtemp, rm } from "node:fs/promises";
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

export function getBuildPaths(projectRoot, arch = normalizeDarwinArch(), stagingDir = path.join(os.tmpdir(), "local-music-player-build")) {
  const appName = "本地音乐播放器";
  const projectReleaseDir = path.join(projectRoot, "release");

  return {
    appName,
    iconPath: path.join(projectRoot, "build", "app-icon.icns"),
    projectReleaseDir,
    stagingDir,
    packagedAppPath: path.join(stagingDir, `${appName}-darwin-${arch}`, `${appName}.app`),
    applicationsPath: path.join("/Applications", `${appName}.app`)
  };
}

export function getInstallCommand(packagedAppPath, applicationsPath) {
  return {
    command: "ditto",
    args: [packagedAppPath, applicationsPath]
  };
}

export function getPackagerOptions(projectRoot, paths, arch) {
  return {
    dir: projectRoot,
    name: paths.appName,
    platform: "darwin",
    arch,
    out: paths.stagingDir,
    overwrite: true,
    asar: true,
    prune: true,
    icon: paths.iconPath,
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
  };
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("此脚本仅支持在 macOS 上构建并安装应用。");
  }

  const projectRoot = path.resolve(__dirname, "..");
  const arch = normalizeDarwinArch(os.arch());
  const stagingDir = await mkdtemp(path.join(os.tmpdir(), "local-music-player-"));
  const paths = getBuildPaths(projectRoot, arch, stagingDir);

  try {
    await run("npm", ["run", "build"], projectRoot);
    await rm(paths.projectReleaseDir, { recursive: true, force: true });

    await packager(getPackagerOptions(projectRoot, paths, arch));

    await rm(paths.applicationsPath, { recursive: true, force: true });
    const install = getInstallCommand(paths.packagedAppPath, paths.applicationsPath);
    await run(install.command, install.args, projectRoot);

    console.log(`已安装 ${paths.applicationsPath}`);
  } finally {
    await rm(paths.stagingDir, { recursive: true, force: true });
  }
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

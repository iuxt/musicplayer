#!/usr/bin/env node
import { packager } from "@electron/packager";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/";

export function normalizeDarwinArch(arch = process.arch) {
  if (arch === "arm64" || arch === "x64") {
    return arch;
  }

  throw new Error(`Unsupported macOS architecture: ${arch}`);
}

export function getBuildPaths(projectRoot, arch = normalizeDarwinArch(), stagingDir = path.join(os.tmpdir(), "musicplayer-build")) {
  const appName = "音乐播放器";
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
    quiet: true,
    icon: paths.iconPath,
    appBundleId: "musicplayer.app",
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

function getElectronMirror() {
  return process.env.ELECTRON_MIRROR || process.env.npm_config_electron_mirror || DEFAULT_ELECTRON_MIRROR;
}

export function isFetchFailedError(error) {
  const messages = [];
  let current = error;

  while (current) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
      continue;
    }

    if (typeof current === "object" && current !== null && "message" in current) {
      messages.push(String(current.message));
      current = current.cause;
      continue;
    }

    messages.push(String(current));
    break;
  }

  return messages.some((message) => /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(message));
}

export function getElectronMirrorPackagerOptions(options, mirror = getElectronMirror()) {
  return {
    ...options,
    download: {
      ...options.download,
      mirrorOptions: {
        ...options.download?.mirrorOptions,
        mirror
      }
    }
  };
}

export async function runPackagerWithElectronMirrorRetry(options, packagerFn = packager, mirror = getElectronMirror()) {
  try {
    return await packagerFn(options);
  } catch (error) {
    if (!isFetchFailedError(error)) {
      throw error;
    }

    console.warn(`Electron 下载失败，正在通过镜像重试：${mirror}`);
    return packagerFn(getElectronMirrorPackagerOptions(options, mirror));
  }
}

export function formatBuildError(error) {
  const details = error instanceof Error ? error.stack || error.message : String(error);

  if (!isFetchFailedError(error)) {
    return details;
  }

  return `${details}

Electron 下载失败。可重试，或设置镜像后再执行：
  ELECTRON_MIRROR=${DEFAULT_ELECTRON_MIRROR} npm run build:mac
也可以清理 Electron 下载缓存后重试：
  rm -rf ~/Library/Caches/electron`;
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("此脚本仅支持在 macOS 上构建并安装应用。");
  }

  const projectRoot = path.resolve(__dirname, "..");
  const arch = normalizeDarwinArch(os.arch());
  const stagingDir = await mkdtemp(path.join(os.tmpdir(), "musicplayer-"));
  const paths = getBuildPaths(projectRoot, arch, stagingDir);

  try {
    await run("npm", ["run", "build"], projectRoot);
    await rm(paths.projectReleaseDir, { recursive: true, force: true });

    await runPackagerWithElectronMirrorRetry(getPackagerOptions(projectRoot, paths, arch));

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
    console.error(formatBuildError(error));
    process.exit(1);
  });
}

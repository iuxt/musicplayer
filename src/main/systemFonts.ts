import { execFile as defaultExecFile } from "node:child_process";

export const FALLBACK_SYSTEM_FONTS = [
  "",
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans CJK SC",
  "LXGW WenKai",
  "Arial",
  "Helvetica"
];

type ExecFile = (
  command: string,
  args: string[],
  options: { maxBuffer: number },
  callback: (error: Error | null, stdout: string | Buffer) => void
) => void;

interface ListSystemFontsOptions {
  platform?: NodeJS.Platform;
  execFile?: ExecFile;
}

export async function listSystemFonts({
  platform = process.platform,
  execFile = defaultExecFile
}: ListSystemFontsOptions = {}) {
  try {
    if (platform === "darwin") {
      return withFallback(parseMacFontOutput(await execFileText(execFile, "system_profiler", ["SPFontsDataType", "-json"])));
    }
    if (platform === "linux") {
      return withFallback(parseFcListOutput(await execFileText(execFile, "fc-list", [":", "family"])));
    }
    if (platform === "win32") {
      return withFallback(
        parsePowerShellFontOutput(
          await execFileText(execFile, "powershell.exe", [
            "-NoProfile",
            "-Command",
            "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Drawing'); (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }"
          ])
        )
      );
    }
    return FALLBACK_SYSTEM_FONTS;
  } catch {
    return FALLBACK_SYSTEM_FONTS;
  }
}

export function parseMacFontOutput(output: string) {
  const parsed = JSON.parse(output) as unknown;
  const names: string[] = [];
  collectFontFamilies(parsed, names);
  return normalizeFontNames(names);
}

export function parseFcListOutput(output: string) {
  return normalizeFontNames(
    output
      .split(/\r?\n/)
      .flatMap((line) => line.split(","))
      .map((name) => name.trim())
  );
}

export function parsePowerShellFontOutput(output: string) {
  return normalizeFontNames(output.split(/\r?\n/));
}

export function normalizeFontNames(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

function withFallback(names: string[]) {
  return names.length > 0 ? ["", ...names] : FALLBACK_SYSTEM_FONTS;
}

function collectFontFamilies(value: unknown, names: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectFontFamilies(item, names));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (typeof value.family === "string") {
    names.push(value.family);
  }

  Object.values(value).forEach((item) => collectFontFamilies(item, names));
}

function execFileText(execFile: ExecFile, command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024 * 8 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.toString());
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

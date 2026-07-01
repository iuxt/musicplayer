import path from "node:path";

const allowedDevServerHosts = new Set(["127.0.0.1", "localhost"]);

export function getTrustedDevServerUrl(value: string | undefined, isDev: boolean): string | null {
  if (!isDev || !value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" || !allowedDevServerHosts.has(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function assertPathInsideRoot(filePath: string | null | undefined, rootPath: string | null): string {
  return assertPathInsideAnyRoot(filePath, rootPath ? [rootPath] : []);
}

export function assertPathInsideAnyRoot(filePath: string | null | undefined, rootPaths: string[]): string {
  if (!filePath || rootPaths.length === 0) {
    throw new Error("文件不在当前音乐库中。");
  }

  const resolvedPath = path.resolve(filePath);
  for (const rootPath of rootPaths) {
    const resolvedRoot = path.resolve(rootPath);
    const relativePath = path.relative(resolvedRoot, resolvedPath);
    if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
      return resolvedPath;
    }
  }

  throw new Error("文件不在当前音乐库中。");
}

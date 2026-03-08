import path from "node:path";

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatRelativeTimestamp(iso: string) {
  const value = new Date(iso).getTime();
  const diffMs = Date.now() - value;
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function resolveStateDirectory(rootDir: string, explicitDir?: string) {
  if (explicitDir) return explicitDir;
  return path.join(rootDir, ".hyprcode", "state");
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return fallback;
  try {
    return (await file.json()) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await Bun.write(filePath, JSON.stringify(value, null, 2));
}

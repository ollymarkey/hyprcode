export const splitJsonl = (buffer: string, chunk: string): { lines: string[]; buffer: string } => {
  const combined = buffer + chunk;
  const parts = combined.split(/\r?\n/);
  const nextBuffer = parts.pop() ?? "";
  const lines = parts.map((line) => line.trim()).filter(Boolean);

  return { lines, buffer: nextBuffer };
};

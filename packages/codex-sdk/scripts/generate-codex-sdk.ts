import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const generatedOutputPath = fileURLToPath(new URL("../src/generated", import.meta.url));

await rm(generatedOutputPath, { recursive: true, force: true });
await Bun.$`codex app-server generate-ts --out ${generatedOutputPath}`;

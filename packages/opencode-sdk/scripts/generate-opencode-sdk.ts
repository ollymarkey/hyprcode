import { fileURLToPath } from "node:url";

const generatedSourcePath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const generatedOutputPath = fileURLToPath(new URL("../tmp-generated.ts", import.meta.url));
const templatePath = fileURLToPath(new URL("./opencode-source-template.ts", import.meta.url));

await Bun.$`bunx cli-to-js opencode --subcommands -o ${generatedOutputPath}`;

const generatedOutput = await Bun.file(generatedOutputPath).text();

if (!generatedOutput.includes('const BINARY = "opencode";')) {
  throw new Error("Unexpected cli-to-js output for opencode.");
}

const template = await Bun.file(templatePath).text();

await Bun.write(generatedSourcePath, template);
await Bun.file(generatedOutputPath).delete();

import { fileURLToPath } from "node:url";

const generatedSourceUrl = new URL("../src/index.ts", import.meta.url);
const generatedSourcePath = fileURLToPath(generatedSourceUrl);

const reservedWordReplacement = {
  from: "export const switch = (options: SwitchOptions = {}): Promise<CommandResult> =>",
  to: "export const switchBranch = (options: SwitchOptions = {}): Promise<CommandResult> =>",
};

await Bun.$`bunx cli-to-js git --subcommands -o ${generatedSourcePath}`;

const generatedSource = await Bun.file(generatedSourcePath).text();

if (!generatedSource.includes(reservedWordReplacement.from)) {
  throw new Error("Failed to find the generated git switch export to patch.");
}

const patchedSource = generatedSource.replace(
  reservedWordReplacement.from,
  reservedWordReplacement.to,
);

await Bun.write(generatedSourcePath, patchedSource);

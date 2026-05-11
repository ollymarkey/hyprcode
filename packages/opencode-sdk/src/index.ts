import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandOptions {
  _?: string | string[];
  [key: string]: unknown;
}

export interface OpencodeOptions extends CommandOptions {
  printLogs?: boolean;
  logLevel?: string;
  port?: number;
  hostname?: string;
  mdns?: boolean;
  cors?: string[];
  model?: string;
  continue?: boolean;
  session?: string;
  prompt?: string;
  agent?: string;
}

const BINARY = "opencode";

const toArgs = (options: CommandOptions): string[] => {
  const flagArgs: string[] = [];
  const positionalArgs: string[] = [];

  for (const [key, value] of Object.entries(options)) {
    if (key === "_") {
      if (value == null) continue;
      const positionalValues = Array.isArray(value) ? value : [value];
      positionalArgs.push(...positionalValues.map(String));
      continue;
    }

    const flag = key.startsWith("-")
      ? key
      : key.length <= 1
        ? `-${key}`
        : `--${key
            .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
            .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
            .toLowerCase()}`;

    if (typeof value === "boolean") {
      if (value) flagArgs.push(flag);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        flagArgs.push(flag, String(item));
      }
      continue;
    }

    if (value != null) {
      flagArgs.push(flag, String(value));
    }
  }

  return [...flagArgs, ...positionalArgs];
};

const execute = (subcommand: string[], options: CommandOptions = {}): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let spawnError: Error | null = null;
    const { cwd, ...cliOptions } = options;

    const child = spawn(BINARY, [...subcommand, ...toArgs(cliOptions)], {
      cwd: typeof cwd === "string" ? cwd : undefined,
      windowsHide: true,
    });

    child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (exitCode) => {
      if (spawnError) {
        reject(spawnError);
        return;
      }

      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        exitCode: exitCode ?? 1,
      });
    });
  });

/** Run the default opencode command. */
export const opencode = (options: OpencodeOptions = {}): Promise<CommandResult> =>
  execute([], options);

/** generate shell completion script */
export const completion = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["completion"], options);

/** start ACP (Agent Client Protocol) server */
export const acp = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["acp"], options);

/** manage MCP (Model Context Protocol) servers */
export const mcp = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["mcp"], options);

/** attach to a running opencode server */
export const attach = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["attach"], options);

/** run opencode with a message */
export const run = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["run"], options);

/** debugging and troubleshooting tools */
export const debug = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["debug"], options);

/** manage credentials */
export const auth = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["auth"], options);

/** manage agents */
export const agent = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["agent"], options);

/** upgrade opencode */
export const upgrade = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["upgrade"], options);

/** uninstall opencode */
export const uninstall = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["uninstall"], options);

/** start a headless opencode server */
export const serve = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["serve"], options);

/** start opencode server and open web interface */
export const web = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["web"], options);

/** list available models */
export const models = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["models"], options);

/** show usage statistics */
export const stats = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["stats"], options);

/** export session data as JSON */
export const exportSession = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["export"], options);

/** import session data from JSON */
export const importSession = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["import"], options);

/** manage GitHub agent */
export const github = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["github"], options);

/** fetch and checkout a GitHub PR branch, then run opencode */
export const pr = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["pr"], options);

/** manage sessions */
export const session = (options: CommandOptions = {}): Promise<CommandResult> =>
  execute(["session"], options);

export default opencode;

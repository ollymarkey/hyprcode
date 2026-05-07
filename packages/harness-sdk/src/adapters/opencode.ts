import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { agent as opencodeAgent, models as opencodeModels, run as opencodeRun } from "opencode-sdk";
import type {
  HarnessAdapter,
  HarnessAgentInfo,
  HarnessModelInfo,
  HarnessRunRequest,
} from "../types";

export interface OpencodeAdapterOptions {
  serverUrl?: string;
  serverPort?: number;
  hostname?: string;
}

const parseListOutput = (output: string): string[] =>
  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.endsWith(":"))
    .filter((line) => !line.toLowerCase().startsWith("commands"))
    .filter((line) => !line.toLowerCase().startsWith("options"))
    .filter((line) => !line.toLowerCase().startsWith("positionals"));

const parseModelLines = (output: string): HarnessModelInfo[] =>
  parseListOutput(output).map((line) => {
    const firstToken = line.split(/\s+/)[0] ?? line;
    const [provider, ...rest] = firstToken.split("/");

    return {
      id: firstToken,
      provider: rest.length > 0 ? provider : undefined,
      name: rest.length > 0 ? rest.join("/") : firstToken,
    };
  });

const parseAgentLines = (output: string): HarnessAgentInfo[] =>
  parseListOutput(output).map((line) => {
    const firstToken = line.split(/\s+/)[0] ?? line;

    return {
      id: firstToken,
      name: firstToken,
      description: line === firstToken ? undefined : line,
    };
  });

const buildRunOptions = (request: HarnessRunRequest) => ({
  _: [request.prompt],
  file: request.files,
  model: request.model,
  agent: request.agent,
  session: request.sessionId,
  continue: request.continueLastSession,
});

const toServerUrl = (hostname: string, port: number): string => `http://${hostname}:${port}`;

export const createOpencodeAdapter = (options: OpencodeAdapterOptions = {}): HarnessAdapter => {
  const hostname = options.hostname ?? "127.0.0.1";
  const serverPort = options.serverPort ?? 4096;
  const serverUrl = options.serverUrl ?? toServerUrl(hostname, serverPort);

  return {
    name: "opencode",
    capabilities: {
      canRunPrompt: true,
      canContinueSession: true,
      canStartServer: true,
      canAttachToServer: false,
      canListAgents: true,
      canListModels: true,
      canStreamEvents: false,
      canExportSessions: false,
    },
    run: async (request) => {
      const result = await opencodeRun(buildRunOptions(request));

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        sessionId: request.sessionId,
      };
    },
    startServer: async () => {
      const child: ChildProcessWithoutNullStreams = spawn(
        "opencode",
        ["serve", "--hostname", hostname, "--port", String(serverPort)],
        {
          windowsHide: true,
        },
      );

      child.stdout.resume();
      child.stderr.resume();

      return {
        target: { url: serverUrl },
        stop: async () => {
          if (child.killed || child.exitCode !== null) {
            return;
          }

          child.kill();

          await new Promise<void>((resolve) => {
            child.once("close", () => resolve());
          });
        },
      };
    },
    listAgents: async () => {
      const result = await opencodeAgent({ _: ["list"] });

      return parseAgentLines(result.stdout);
    },
    listModels: async (provider) => {
      const result = await opencodeModels(provider ? { _: [provider] } : {});

      return parseModelLines(result.stdout);
    },
  };
};

import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

const isDev = !app.isPackaged;
const serverPort = Number.parseInt(process.env.HYPRCODE_SERVER_PORT ?? "4318", 10);
const serverUrl = process.env.HYPRCODE_SERVER_URL ?? `http://127.0.0.1:${serverPort}`;
const rendererUrl = process.env.HYPRCODE_DESKTOP_URL ?? "http://127.0.0.1:5174";
const bunBinary = process.env.BUN_EXECUTABLE ?? "bun";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcessWithoutNullStreams | null = null;

function rootDir() {
  return path.resolve(import.meta.dirname, "../../..");
}

function startServer() {
  if (serverProcess) return;
  const workspaceRoot = rootDir();
  const serverCwd = path.join(workspaceRoot, "apps", "server");
  serverProcess = spawn(bunBinary, ["run", "src/index.ts"], {
    cwd: serverCwd,
    env: {
      ...process.env,
      HYPRCODE_SERVER_PORT: String(serverPort),
      HYPRCODE_STATE_DIR: process.env.HYPRCODE_STATE_DIR ?? path.join(workspaceRoot, ".hyprcode", "state"),
    },
    stdio: "pipe",
    shell: process.platform === "win32",
  });

  serverProcess.stdout.on("data", (chunk) => {
    console.log(String(chunk));
  });
  serverProcess.stderr.on("data", (chunk) => {
    console.error(String(chunk));
  });
  serverProcess.once("exit", () => {
    serverProcess = null;
  });
}

async function waitForServer(retries = 40) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${serverUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // ignore retries while the server boots
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`HyprCode server failed to start at ${serverUrl}`);
}

async function createWindow() {
  startServer();
  await waitForServer();

  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#111417",
    title: "HyprCode",
    webPreferences: {
      preload: path.join(import.meta.dirname, "../dist-electron/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await mainWindow.loadURL(rendererUrl);
  } else {
    await mainWindow.loadFile(path.join(rootDir(), "apps", "web", "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  ipcMain.handle("hyprcode:runtime-info", async () => ({
    serverUrl,
    platform: process.platform,
  }));
  ipcMain.handle("hyprcode:open-external", async (_event, url: string) => {
    await shell.openExternal(url);
  });

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

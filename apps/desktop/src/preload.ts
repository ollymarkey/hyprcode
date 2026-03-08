import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("hyprcodeDesktop", {
  runtimeInfo: () => ipcRenderer.invoke("hyprcode:runtime-info"),
  openExternal: (url: string) => ipcRenderer.invoke("hyprcode:open-external", url),
});

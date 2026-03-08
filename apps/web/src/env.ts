export interface ApiConfig {
  serverUrl: string;
}

declare global {
  interface Window {
    hyprcodeDesktop?: {
      runtimeInfo: () => Promise<{ serverUrl: string; platform: string }>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}

export async function resolveApiConfig(): Promise<ApiConfig> {
  if (window.hyprcodeDesktop) {
    const runtime = await window.hyprcodeDesktop.runtimeInfo();
    return { serverUrl: runtime.serverUrl };
  }

  return {
    serverUrl: (import.meta.env.VITE_HYPRCODE_SERVER_URL as string | undefined) ?? "http://127.0.0.1:4318",
  };
}

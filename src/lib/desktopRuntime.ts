import type { AppSettings } from "./settingsStorage";

export type MaintenanceResult = {
  detail: string;
  path?: string;
};

export const desktopRuntime = {
  async clearCache(): Promise<MaintenanceResult> {
    const clearedKeys = clearBrowserCacheKeys();
    const tauri = await tryGetTauriCore();
    if (tauri) {
      return tauri.invoke<MaintenanceResult>("clear_app_cache", { clearedBrowserKeys: clearedKeys });
    }

    return {
      detail: clearedKeys
        ? `Browser preview cache cleared (${clearedKeys} local keys).`
        : "Browser preview cache was already clean.",
    };
  },

  async exportLocalLogs(settings: AppSettings): Promise<MaintenanceResult> {
    const tauri = await tryGetTauriCore();
    if (tauri) {
      return tauri.invoke<MaintenanceResult>("export_local_logs", {
        settingsJson: JSON.stringify(settings, null, 2),
      });
    }

    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            runtime: "browser-preview",
            userAgent: navigator.userAgent,
            localStorageKeys: Object.keys(window.localStorage).filter((key) => key.startsWith("47service.")),
            settings,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `47service-local-logs-${Date.now()}.json`);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { detail: "Browser preview logs exported.", path: "downloads" };
  },

  async setLaunchOnStartup(enabled: boolean): Promise<MaintenanceResult> {
    const tauri = await tryGetTauriCore();
    if (tauri) {
      return tauri.invoke<MaintenanceResult>("set_launch_on_startup", { enabled });
    }

    return {
      detail: enabled
        ? "Startup launch is saved for desktop builds. Browser preview cannot edit Windows startup."
        : "Startup launch preference saved for browser preview.",
    };
  },

  async getLaunchOnStartup(): Promise<boolean | null> {
    const tauri = await tryGetTauriCore();
    if (!tauri) {
      return null;
    }

    return tauri.invoke<boolean>("get_launch_on_startup");
  },

  exportSettings(settings: AppSettings) {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `47service-settings-${Date.now()}.json`);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export function parseImportedSettings(text: string) {
  const parsed = JSON.parse(text) as { settings?: unknown };
  return parsed && typeof parsed === "object" && "settings" in parsed ? parsed.settings : parsed;
}

function clearBrowserCacheKeys() {
  const keys = Object.keys(window.localStorage).filter(
    (key) =>
      key.startsWith("47service.cache") ||
      key.startsWith("47service.preview") ||
      key.startsWith("47service.temp"),
  );
  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
  return keys.length;
}

function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function tryGetTauriCore() {
  if (!("__TAURI_INTERNALS__" in window)) {
    return null;
  }

  try {
    return await import("@tauri-apps/api/core");
  } catch {
    return null;
  }
}

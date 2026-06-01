import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dashboard from "./components/Dashboard";
import LicenseGate from "./components/LicenseGate";
import { getDeviceHwid, licenseStorage, validateLicense, type LicenseType } from "./lib/licenseApi";
import {
  defaultSettings,
  resolveThemePreference,
  sanitizeSettings,
  settingsStorage,
  type AppSettings,
} from "./lib/settingsStorage";

export type AccessMode = "licensed" | "lite";

export type AccessState = {
  mode: AccessMode;
  licenseType?: LicenseType;
  premium?: boolean;
  devFallback?: boolean;
};

export type ToastKind = "success" | "warning" | "error" | "info";

export type AppToast = {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
  phase?: "entering" | "leaving";
};

export default function App() {
  const [accessState, setAccessState] = useState<AccessState | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => settingsStorage.read());
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const toastTimersRef = useRef<number[]>([]);
  const soundContextRef = useRef<AudioContext | null>(null);

  const resolvedTheme = useMemo(() => resolveThemePreference(settings.theme), [settings.theme]);

  const showToast = useCallback((toast: Omit<AppToast, "id">) => {
    const id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const nextToast = { ...toast, id, phase: "entering" as const };
    const displayDuration = toast.kind === "error"
      ? Math.max(settings.notificationDurationMs, 5200)
      : settings.notificationDurationMs;

    setToasts((current) => [...current.slice(-4), nextToast]);
    if (settings.soundEffects) {
      playToastSound(toast.kind, soundContextRef);
    }

    const leaveTimer = window.setTimeout(() => {
      setToasts((current) =>
        current.map((item) => (item.id === id ? { ...item, phase: "leaving" } : item)),
      );
      const removeTimer = window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 260);
      toastTimersRef.current.push(removeTimer);
    }, displayDuration);
    toastTimersRef.current.push(leaveTimer);
  }, [settings.notificationDurationMs, settings.soundEffects]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, phase: "leaving" } : toast)));
    const removeTimer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 240);
    toastTimersRef.current.push(removeTimer);
  }, []);

  const updateSettings = useCallback(
    (
      updater: AppSettings | ((current: AppSettings) => AppSettings),
      successMessage = "Settings saved.",
      options?: { silent?: boolean },
    ) => {
      try {
        const nextSettings =
          typeof updater === "function" ? (updater as (current: AppSettings) => AppSettings)(settings) : updater;
        const sanitizedSettings = sanitizeSettings(nextSettings);
        settingsStorage.write(sanitizedSettings);
        setSettings(sanitizedSettings);
        if (!options?.silent) {
          showToast({ kind: "success", title: successMessage });
        }
      } catch {
        showToast({
          kind: "error",
          title: "Settings were not saved.",
          detail: "Local app storage rejected the update.",
        });
      }
    },
    [settings, showToast],
  );

  const resetSettings = useCallback(() => {
    updateSettings(defaultSettings, "Settings reset to defaults.");
  }, [updateSettings]);

  useEffect(() => {
    let isMounted = true;

    async function restoreLicense() {
      if (!settings.autoLogin) {
        setIsRestoring(false);
        return;
      }

      const storedLicense = licenseStorage.read();

      if (!storedLicense) {
        setIsRestoring(false);
        return;
      }

      try {
        const hwid = await getDeviceHwid();
        const result = await validateLicense(storedLicense.key, hwid);

        if (isMounted && result.valid) {
          licenseStorage.write({ key: storedLicense.key, type: result.type, premium: result.premium });
          setAccessState({ mode: "licensed", licenseType: result.type, premium: result.premium });
          return;
        }

        licenseStorage.clear();
      } catch {
        licenseStorage.clear();
      } finally {
        if (isMounted) {
          setIsRestoring(false);
        }
      }
    }

    void restoreLicense();

    return () => {
      isMounted = false;
    };
  }, [settings.autoLogin]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = settings.theme;
    document.documentElement.dataset.compact = String(settings.compactMode);
    document.documentElement.dataset.animation = settings.animationIntensity;
    document.documentElement.style.setProperty("--surface-blur", `${settings.backgroundBlur}px`);
    document.documentElement.style.setProperty(
      "--motion-scale",
      settings.animationIntensity === "reduced"
        ? "0.55"
        : settings.animationIntensity === "expressive"
          ? "1.35"
          : "1",
    );
  }, [resolvedTheme, settings.theme, settings.compactMode, settings.animationIntensity, settings.backgroundBlur]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      soundContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) {
      return;
    }

    let unlisten: (() => void) | undefined;

    async function bindCloseRequest() {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (!settings.autoMinimizeToTray) {
            return;
          }

          event.preventDefault();
          await appWindow.hide();
        });
      } catch {
        // Closing remains native if the desktop window API is unavailable.
      }
    }

    void bindCloseRequest();
    return () => {
      unlisten?.();
    };
  }, [settings.autoMinimizeToTray]);

  useEffect(() => {
    if (!accessState || settings.sessionTimeoutMinutes <= 0) {
      return;
    }

    let timeoutId: number | undefined;
    const resetTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(
        () => {
          licenseStorage.clear();
          setAccessState(null);
          showToast({
            kind: "warning",
            title: "Session timed out.",
            detail: "Local license session was cleared after inactivity.",
          });
        },
        settings.sessionTimeoutMinutes * 60 * 1000,
      );
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "wheel", "focus"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [accessState, settings.sessionTimeoutMinutes, showToast]);

  useEffect(() => {
    if (settings.theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => {
      document.documentElement.dataset.theme = resolveThemePreference("system");
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [settings.theme]);

  useEffect(() => {
    if (!settings.autoRefreshLicenseSession || accessState?.mode !== "licensed" || accessState.devFallback) {
      return;
    }

    let isMounted = true;

    async function refreshLicenseSession(isInitialCheck = false) {
      const storedLicense = licenseStorage.read();
      if (!storedLicense) {
        return;
      }

      try {
        const hwid = await getDeviceHwid();
        const result = await validateLicense(storedLicense.key, hwid);

        if (!isMounted) {
          return;
        }

        if (result.valid) {
          licenseStorage.write({ key: storedLicense.key, type: result.type, premium: result.premium });
          setAccessState((current) => {
            if (current?.mode === "licensed" && current.licenseType === result.type && current.premium === result.premium && !current.devFallback) {
              return current;
            }

            return { mode: "licensed", licenseType: result.type, premium: result.premium };
          });
          if (!isInitialCheck) {
            showToast({ kind: "success", title: "License session refreshed." });
          }
          return;
        }

        licenseStorage.clear();
        setAccessState(null);
        showToast({
          kind: "error",
          title: "License session ended.",
          detail: "The saved license is no longer valid.",
        });
      } catch {
        if (!isInitialCheck) {
          showToast({
            kind: "error",
            title: "License refresh failed.",
            detail: "The license server could not be reached.",
          });
        }
      }
    }

    void refreshLicenseSession(true);
    const intervalId = window.setInterval(() => void refreshLicenseSession(), 10 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [accessState, settings.autoRefreshLicenseSession, showToast]);

  function handleSignOut() {
    licenseStorage.clear();
    setAccessState(null);
  }

  function handleClearSession() {
    licenseStorage.clear();
    setAccessState(null);
    showToast({ kind: "success", title: "Local session cleared." });
  }

  return (
    <main className="app-shell">
      {isRestoring ? (
        <section className="license-screen" aria-label="Restoring license session">
          <div className="ambient-grid" aria-hidden="true" />
          <div className="restore-panel">Checking license status...</div>
        </section>
      ) : accessState ? (
        <Dashboard
          accessState={accessState}
          settings={settings}
          onClearSession={handleClearSession}
          onResetSettings={resetSettings}
          onSettingsChange={updateSettings}
          onShowToast={showToast}
          onSignOut={handleSignOut}
        />
      ) : (
        <LicenseGate onEnter={setAccessState} />
      )}
      <ToastViewport
        notificationStyle={settings.notificationStyle}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </main>
  );
}

function ToastViewport({
  notificationStyle,
  toasts,
  onDismiss,
}: {
  notificationStyle: AppSettings["notificationStyle"];
  toasts: AppToast[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className={`toast-viewport ${notificationStyle}`} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          className={`app-toast ${toast.kind} ${toast.phase ?? "entering"}`}
          key={toast.id}
          type="button"
          onClick={() => onDismiss(toast.id)}
        >
          <span className="toast-signal" aria-hidden="true" />
          <span>
            <strong>{toast.title}</strong>
            {notificationStyle === "expanded" && toast.detail ? <small>{toast.detail}</small> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

function playToastSound(kind: ToastKind, soundContextRef: React.MutableRefObject<AudioContext | null>) {
  try {
    const AudioContextCtor =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = soundContextRef.current ?? new AudioContextCtor();
    soundContextRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "error" ? 190 : kind === "warning" ? 260 : kind === "success" ? 520 : 420;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
  } catch {
    // Sound effects are best-effort and should never block a setting update.
  }
}

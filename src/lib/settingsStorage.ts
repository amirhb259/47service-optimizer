export type ThemePreference = "dark" | "light" | "system";
export type NotificationStyle = "quiet" | "expanded";
export type AnimationIntensity = "reduced" | "balanced" | "expressive";
export type DashboardSectionId = "overview" | "modules" | "settings" | "help" | "premium";

export type AppSettings = {
  autoLogin: boolean;
  theme: ThemePreference;
  notificationStyle: NotificationStyle;
  compactMode: boolean;
  animationIntensity: AnimationIntensity;
  notificationDurationMs: number;
  autoMinimizeToTray: boolean;
  launchOnWindowsStartup: boolean;
  sessionTimeoutMinutes: number;
  soundEffects: boolean;
  backgroundBlur: number;
  safetyConfirmations: boolean;
  autoRefreshLicenseSession: boolean;
};

const SETTINGS_STORAGE_KEY = "47service.settings";

export const defaultSettings: AppSettings = {
  autoLogin: true,
  theme: "dark",
  notificationStyle: "expanded",
  compactMode: false,
  animationIntensity: "balanced",
  notificationDurationMs: 4200,
  autoMinimizeToTray: false,
  launchOnWindowsStartup: false,
  sessionTimeoutMinutes: 0,
  soundEffects: true,
  backgroundBlur: 18,
  safetyConfirmations: true,
  autoRefreshLicenseSession: true,
};

const themes: ThemePreference[] = ["dark", "light", "system"];
const notificationStyles: NotificationStyle[] = ["quiet", "expanded"];
const animationIntensities: AnimationIntensity[] = ["reduced", "balanced", "expressive"];

export function resolveThemePreference(theme: ThemePreference) {
  if (theme !== "system") {
    return theme;
  }

  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export const settingsStorage = {
  key: SETTINGS_STORAGE_KEY,
  read(): AppSettings {
    if (typeof window === "undefined") {
      return defaultSettings;
    }

    const rawValue = window.localStorage.getItem(this.key);
    if (!rawValue) {
      return defaultSettings;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<AppSettings>;
      return sanitizeSettings(parsed);
    } catch {
      return defaultSettings;
    }
  },
  write(settings: AppSettings) {
    window.localStorage.setItem(this.key, JSON.stringify(sanitizeSettings(settings)));
  },
  reset() {
    this.write(defaultSettings);
    return defaultSettings;
  },
};

export function sanitizeSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    autoLogin: readBoolean(settings.autoLogin, defaultSettings.autoLogin),
    theme: themes.includes(settings.theme as ThemePreference)
      ? (settings.theme as ThemePreference)
      : defaultSettings.theme,
    notificationStyle: notificationStyles.includes(settings.notificationStyle as NotificationStyle)
      ? (settings.notificationStyle as NotificationStyle)
      : defaultSettings.notificationStyle,
    compactMode: readBoolean(settings.compactMode, defaultSettings.compactMode),
    animationIntensity: animationIntensities.includes(settings.animationIntensity as AnimationIntensity)
      ? (settings.animationIntensity as AnimationIntensity)
      : defaultSettings.animationIntensity,
    notificationDurationMs: readNumber(
      settings.notificationDurationMs,
      defaultSettings.notificationDurationMs,
      1500,
      12000,
    ),
    autoMinimizeToTray: readBoolean(settings.autoMinimizeToTray, defaultSettings.autoMinimizeToTray),
    launchOnWindowsStartup: readBoolean(settings.launchOnWindowsStartup, defaultSettings.launchOnWindowsStartup),
    sessionTimeoutMinutes: readNumber(
      settings.sessionTimeoutMinutes,
      defaultSettings.sessionTimeoutMinutes,
      0,
      240,
    ),
    soundEffects: readBoolean(settings.soundEffects, defaultSettings.soundEffects),
    backgroundBlur: readNumber(settings.backgroundBlur, defaultSettings.backgroundBlur, 0, 36),
    safetyConfirmations: readBoolean(settings.safetyConfirmations, defaultSettings.safetyConfirmations),
    autoRefreshLicenseSession: readBoolean(
      settings.autoRefreshLicenseSession,
      defaultSettings.autoRefreshLicenseSession,
    ),
  };
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

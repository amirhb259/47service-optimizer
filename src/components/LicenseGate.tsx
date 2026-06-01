import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  KeyRound,
  LifeBuoy,
  LoaderCircle,
  UserRound,
  X,
} from "lucide-react";
import type { AccessState } from "../App";
import BrandLogo from "./BrandLogo";
import SupportTicketForm from "./SupportTicketForm";
import {
  activateLicense,
  createLiteAccount,
  getDeviceHwid,
  getLicenseErrorMessage,
  loginWithCredentials,
  startLicenseLogin,
  type LicenseType,
} from "../lib/licenseApi";

const DEV_LICENSE_KEY = "477777";

type LicenseGateProps = {
  onEnter: (accessState: AccessState) => void;
};

type LoginMode = "license" | "credentials";

type PendingActivation = {
  key: string;
  type: LicenseType;
  hwid: string;
};

type ActivationCredentials = {
  key: string;
  type: LicenseType;
  hwid: string;
  username: string;
  password: string;
  premium: boolean;
  expiresAt?: string;
};

export default function LicenseGate({ onEnter }: LicenseGateProps) {
  const [loginMode, setLoginMode] = useState<LoginMode>("license");
  const [licenseKey, setLicenseKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(null);
  const [pendingLiteHwid, setPendingLiteHwid] = useState<string | null>(null);
  const [activationCredentials, setActivationCredentials] = useState<ActivationCredentials | null>(null);
  const [activationCountdown, setActivationCountdown] = useState(15);
  const [liteCountdown, setLiteCountdown] = useState(15);
  const [credentialCountdown, setCredentialCountdown] = useState(15);
  const [showHelp, setShowHelp] = useState(false);
  const [switchPulse, setSwitchPulse] = useState(0);

  const normalizedKey = useMemo(() => licenseKey.trim().toUpperCase(), [licenseKey]);

  function changeLoginMode(mode: LoginMode) {
    if (mode !== loginMode) {
      setLoginMode(mode);
      setSwitchPulse((current) => current + 1);
    }

    setError("");
  }

  useEffect(() => {
    if (!pendingActivation) {
      return;
    }

    setActivationCountdown(15);
    const timer = window.setInterval(() => {
      setActivationCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pendingActivation]);

  useEffect(() => {
    if (!pendingLiteHwid) {
      return;
    }

    setLiteCountdown(15);
    const timer = window.setInterval(() => {
      setLiteCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pendingLiteHwid]);

  useEffect(() => {
    if (!activationCredentials) {
      return;
    }

    setCredentialCountdown(15);
    const timer = window.setInterval(() => {
      setCredentialCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activationCredentials]);

  async function handleLicenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedKey) {
      setError("Enter a license key to continue.");
      return;
    }

    if (import.meta.env.DEV && normalizedKey === DEV_LICENSE_KEY) {
      onEnter({ mode: "licensed", licenseType: "PRO", premium: true, devFallback: true });
      return;
    }

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const hwid = await getDeviceHwid();
      const result = await startLicenseLogin(normalizedKey, hwid);

      if (result.valid && result.requiresActivation) {
        setPendingActivation({ key: result.key, type: result.type, hwid });
        return;
      }

      if (result.valid) {
        onEnter({ mode: "licensed", licenseType: result.type, premium: result.premium });
        return;
      }

      setError(getLicenseErrorMessage(result.reason));
    } catch {
      setError("Cannot reach the license server. Check that the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCredentialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Enter your username and password to continue.");
      return;
    }

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const hwid = await getDeviceHwid();
      const result = await loginWithCredentials(username, password, hwid);

      if (result.valid) {
        onEnter({ mode: "licensed", licenseType: result.type, premium: result.premium });
        return;
      }

      setError(getLicenseErrorMessage(result.reason));
    } catch {
      setError("Cannot reach the license server. Check that the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function continueActivation() {
    if (!pendingActivation || activationCountdown > 0) {
      return;
    }

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await activateLicense(pendingActivation.key, pendingActivation.hwid);

      if (!result.valid) {
        setPendingActivation(null);
        setError(getLicenseErrorMessage(result.reason));
        return;
      }

      if (result.firstActivation && result.username && result.password) {
        setActivationCredentials({
          key: result.key,
          type: result.type,
          hwid: result.hwid ?? pendingActivation.hwid,
          username: result.username,
          password: result.password,
          premium: result.premium,
        });
        setPendingActivation(null);
        return;
      }

      onEnter({ mode: "licensed", licenseType: result.type, premium: result.premium });
    } catch {
      setError("Cannot reach the license server. Check that the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function beginLiteTrial() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const hwid = await getDeviceHwid();
      setPendingLiteHwid(hwid);
    } catch {
      setError("Unable to read the device HWID. Lite accounts require a real device HWID.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function continueLiteTrial() {
    if (!pendingLiteHwid || liteCountdown > 0) {
      return;
    }

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const result = await createLiteAccount(pendingLiteHwid);

      if (!result.valid) {
        setPendingLiteHwid(null);
        setError(getLicenseErrorMessage(result.reason));
        return;
      }

      setActivationCredentials({
        key: result.key,
        type: result.type,
        hwid: result.hwid,
        username: result.username,
        password: result.password,
        premium: result.premium,
        expiresAt: result.expiresAt,
      });
      setPendingLiteHwid(null);
    } catch {
      setError("Cannot reach the license server. Check that the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copied.`);
  }

  function enterAfterCredentialSave() {
    if (!activationCredentials || credentialCountdown > 0) {
      return;
    }

    const licenseType = activationCredentials.type;
    const premium = activationCredentials.premium;
    setActivationCredentials(null);
    onEnter({ mode: "licensed", licenseType, premium });
  }

  return (
    <section className="license-screen" aria-labelledby="license-title">
      <div className="ambient-grid" aria-hidden="true" />
      <div className="license-frame">
        <div className="brand-lockup" aria-label="47Service">
          <div className="logo-stage">
            <BrandLogo className="brand-logo-hero" />
          </div>
          <p className="brand-kicker">Desktop optimizer foundation</p>
          <h1 id="license-title">47Service</h1>
        </div>

        <div className="license-panel">
          <div className="panel-sheen" aria-hidden="true" />
          <div className="license-logo-strip" aria-hidden="true">
            <BrandLogo className="brand-logo-mini" label="" />
            <span>Secure preview entry</span>
          </div>

          <div
            className={`login-tabs ${loginMode === "license" ? "license-active" : "credentials-active"}`}
            role="tablist"
            aria-label="Login method"
          >
            {switchPulse > 0 ? (
              <div className="login-switch-fx" key={switchPulse} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : null}
            <button
              type="button"
              className={loginMode === "license" ? "login-tab active" : "login-tab"}
              role="tab"
              aria-selected={loginMode === "license"}
              aria-label="License login"
              onClick={() => changeLoginMode("license")}
            >
              <KeyRound size={16} aria-hidden="true" />
              <span>License</span>
            </button>
            <button
              type="button"
              className={loginMode === "credentials" ? "login-tab active" : "login-tab"}
              role="tab"
              aria-selected={loginMode === "credentials"}
              aria-label="Username login"
              onClick={() => changeLoginMode("credentials")}
            >
              <UserRound size={16} aria-hidden="true" />
              <span>Username</span>
            </button>
          </div>

          <div className={`login-form-stage ${loginMode === "license" ? "stage-license" : "stage-credentials"}`}>
            {loginMode === "license" ? (
              <form className="login-form" key="license-form" onSubmit={handleLicenseSubmit} noValidate>
                <label htmlFor="license-key">License key</label>
                <div className="input-wrap">
                  <KeyRound size={19} aria-hidden="true" />
                  <input
                    id="license-key"
                    type="text"
                    value={licenseKey}
                    onChange={(event) => {
                      setLicenseKey(event.target.value.toUpperCase());
                      setError("");
                    }}
                    inputMode="text"
                    autoComplete="off"
                    placeholder="47S-PRO-XXXX-XXXX-XXXX"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "license-error" : undefined}
                    disabled={isSubmitting}
                  />
                  <button
                    className="license-submit"
                    type="submit"
                    aria-label="Unlock with license key"
                    title="Unlock with license key"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <LoaderCircle className="spin-icon" size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
                  </button>
                </div>
              </form>
            ) : (
              <form className="login-form" key="credentials-form" onSubmit={handleCredentialSubmit} noValidate>
                <label htmlFor="license-username">Username</label>
                <div className="input-wrap">
                  <UserRound size={19} aria-hidden="true" />
                  <input
                    id="license-username"
                    type="text"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setError("");
                    }}
                    autoComplete="username"
                    placeholder="user-00000000"
                    aria-invalid={Boolean(error)}
                    disabled={isSubmitting}
                  />
                </div>
                <label htmlFor="license-password">Password</label>
                <div className="input-wrap">
                  <KeyRound size={19} aria-hidden="true" />
                  <input
                    id="license-password"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    autoComplete="current-password"
                    placeholder="Generated password"
                    aria-invalid={Boolean(error)}
                    disabled={isSubmitting}
                  />
                  <button
                    className="license-submit"
                    type="submit"
                    aria-label="Unlock with username and password"
                    title="Unlock with username and password"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <LoaderCircle className="spin-icon" size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
                  </button>
                </div>
              </form>
            )}
          </div>

          {error ? (
            <p className="license-error" id="license-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="license-hint" role={message ? "status" : undefined}>
              {message}
            </p>
          )}

          <div className="license-secondary-actions">
            <button className="lite-action" type="button" onClick={beginLiteTrial} disabled={isSubmitting}>
              Use Lite 47Service
            </button>
            <button className="help-action" type="button" onClick={() => setShowHelp(true)} aria-label="Help" title="Help">
              <LifeBuoy size={17} aria-hidden="true" />
              <span>Help</span>
            </button>
          </div>
        </div>
      </div>

      {pendingActivation ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="activation-title">
          <div className="activation-modal">
            <div className="modal-icon warning">
              <AlertTriangle size={26} aria-hidden="true" />
            </div>
            <div>
              <p className="module-eyebrow">First activation</p>
              <h2 id="activation-title">This key will be locked to this PC.</h2>
              <p>
                Continuing binds this license to the current HWID. Save the generated username and password after
                activation. If a Windows reset or PC change alters the HWID, open Help and create a support ticket
                with proof of purchase.
              </p>
              <div className="activation-hwid">
                <span>Current HWID</span>
                <code>{pendingActivation.hwid}</code>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setPendingActivation(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="license-submit wide modal-primary"
                type="button"
                onClick={continueActivation}
                disabled={activationCountdown > 0 || isSubmitting}
              >
                {isSubmitting ? <LoaderCircle className="spin-icon" size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                <span>{activationCountdown > 0 ? `Continue in ${activationCountdown}s` : "Continue"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLiteHwid ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="lite-title">
          <div className="activation-modal">
            <div className="modal-icon warning">
              <AlertTriangle size={26} aria-hidden="true" />
            </div>
            <div>
              <p className="module-eyebrow">Lite trial</p>
              <h2 id="lite-title">This Lite account will be locked to this PC.</h2>
              <p>
                Continuing creates a real Lite account on the license server, binds it to this HWID, and starts a
                4-day trial. You must save the generated username and password. They will not be shown again.
              </p>
              <div className="activation-hwid">
                <span>Current HWID</span>
                <code>{pendingLiteHwid}</code>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setPendingLiteHwid(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="license-submit wide modal-primary"
                type="button"
                onClick={continueLiteTrial}
                disabled={liteCountdown > 0 || isSubmitting}
              >
                {isSubmitting ? <LoaderCircle className="spin-icon" size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                <span>{liteCountdown > 0 ? `Create in ${liteCountdown}s` : "Create Lite account"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activationCredentials ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="credentials-title">
          <div className="activation-modal">
            <div className="modal-icon success">
              <CheckCircle2 size={26} aria-hidden="true" />
            </div>
            <div>
              <p className="module-eyebrow">Activation complete</p>
              <h2 id="credentials-title">Save these credentials.</h2>
              <p>
                Save these credentials safely. They are needed to log in again after you log out. This password is
                only shown on this screen and will not be shown again.
              </p>
              <div className="activation-hwid">
                <span>Activated HWID</span>
                <code>{activationCredentials.hwid}</code>
              </div>
              {activationCredentials.expiresAt ? (
                <div className="activation-hwid">
                  <span>Expires</span>
                  <code>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(activationCredentials.expiresAt))}</code>
                </div>
              ) : null}
            </div>
            <div className="credential-grid">
              <CredentialValue label="Username" value={activationCredentials.username} onCopy={copyText} />
              <CredentialValue label="Password" value={activationCredentials.password} onCopy={copyText} />
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => copyText(`${activationCredentials.username}\n${activationCredentials.password}`, "Credentials")}>
                <Copy size={17} aria-hidden="true" />
                <span>Copy both</span>
              </button>
              <button
                className="license-submit wide modal-primary"
                type="button"
                onClick={enterAfterCredentialSave}
                disabled={credentialCountdown > 0}
              >
                <ArrowRight size={18} aria-hidden="true" />
                <span>{credentialCountdown > 0 ? `Continue in ${credentialCountdown}s` : "Continue"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showHelp ? <SupportTicketModal onClose={() => setShowHelp(false)} /> : null}
    </section>
  );
}

function CredentialValue({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (value: string, label: string) => Promise<void>;
}) {
  return (
    <div className="credential-value">
      <span>{label}</span>
      <code>{value}</code>
      <button type="button" onClick={() => void onCopy(value, label)} aria-label={`Copy ${label.toLowerCase()}`}>
        <Copy size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function SupportTicketModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <div className="activation-modal support-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close support">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="modal-icon">
          <LifeBuoy size={26} aria-hidden="true" />
        </div>
        <div>
          <p className="module-eyebrow">Support ticket</p>
          <h2 id="support-title">HWID reset request</h2>
        </div>
        <SupportTicketForm mode="modal" licenseType="LITE" />
      </div>
    </div>
  );
}

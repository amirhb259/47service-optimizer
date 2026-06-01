"use client";

import { FormEvent, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPanel() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError("Admin credentials were rejected.");
        return;
      }

      router.refresh();
    } catch {
      setError("Admin login failed. Check the website server configuration.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-shell grid min-h-screen place-items-center px-4 py-8">
      <section className="glass-panel grid w-full max-w-[480px] gap-6 rounded-[26px] p-6 sm:p-8">
        <div className="grid justify-items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-lg border border-reactor-cyan/20 bg-reactor-cyan/10 text-reactor-cyan">
            <ShieldCheck size={28} aria-hidden="true" />
          </div>
          <div>
            <p className="m-0 text-xs font-black uppercase text-reactor-cyan">47Service secure operator</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-white">License Admin</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">
              Manage keys, activations, HWID resets, and support proof review from a separate secured dashboard.
            </p>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-white/70">Username</span>
            <input
              className="field min-h-12 px-4"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError("");
              }}
              autoComplete="username"
              disabled={isSubmitting}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-white/70">Password</span>
            <input
              className="field min-h-12 px-4"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </label>

          {error ? (
            <p className="m-0 rounded-lg border border-reactor-red/30 bg-reactor-red/10 px-3 py-2 text-sm text-red-100" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-reactor-cyan via-reactor-gold to-reactor-red px-4 font-black text-[#03110e] shadow-[0_12px_30px_rgba(41,255,188,0.18)]"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
            <span>{isSubmitting ? "Checking" : "Enter dashboard"}</span>
          </button>
        </form>
      </section>
    </main>
  );
}

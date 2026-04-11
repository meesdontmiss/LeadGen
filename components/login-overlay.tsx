"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";

export function LoginOverlay() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Reload page to show authenticated state
      window.location.reload();
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
            <Lock className="h-8 w-8 text-stone-700" />
          </div>
          
          <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
            Authentication Required
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Enter the operator password to access the Lead Engine dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Enter operator password"
                className="w-full rounded-lg border border-stone-300 px-4 py-3 text-sm focus:border-stone-950 focus:outline-none focus:ring-2 focus:ring-stone-950/20"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-lg bg-stone-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-stone-500">
          Default password: <code className="rounded bg-stone-100 px-2 py-1">openclaw-operator-2026</code>
        </p>
      </div>
    </div>
  );
}

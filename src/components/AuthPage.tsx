"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function AuthPage({ onSkip }: { onSkip: () => void }) {
  const { login, signup, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    const fn = mode === "login" ? login : signup;
    const { error: authError } = await fn(email, password);

    if (authError) {
      setError(authError.message);
    } else if (mode === "register") {
      setSuccess("Account created! Check your email to confirm, then sign in.");
      setMode("login");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError("");
    const { error: authError } = await loginWithGoogle();
    if (authError) setError(authError.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#121214" }}>
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-wide" style={{ color: "#D4A843" }}>
            GUITARFORGE
          </h1>
          <p className="text-sm mt-1" style={{ color: "#888" }}>
            Practice Management Platform
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6" style={{ background: "#121214", border: "1px solid #2a2a2e" }}>
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden mb-6" style={{ background: "#1a1a1e" }}>
            <button
              onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              className="flex-1 py-2.5 text-sm font-medium transition-colors"
              style={{
                background: mode === "login" ? "rgba(212,168,67,0.15)" : "transparent",
                color: mode === "login" ? "#D4A843" : "#888",
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              className="flex-1 py-2.5 text-sm font-medium transition-colors"
              style={{
                background: mode === "register" ? "rgba(212,168,67,0.15)" : "transparent",
                color: mode === "register" ? "#D4A843" : "#888",
              }}
            >
              Register
            </button>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-4"
            style={{ background: "#1a1a1e", border: "1px solid #2a2a2e", color: "#ccc" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: "#2a2a2e" }} />
            <span className="text-xs" style={{ color: "#666" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "#2a2a2e" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ background: "#1a1a1e", border: "1px solid #2a2a2e", color: "#eee" }}
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ background: "#1a1a1e", border: "1px solid #2a2a2e", color: "#eee" }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                {error}
              </div>
            )}

            {success && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: loading ? "#3a3520" : "#D4A843",
                color: loading ? "#888" : "#121214",
              }}
            >
              {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        {/* Skip link */}
        <div className="text-center mt-4">
          <button
            onClick={onSkip}
            className="text-sm transition-colors hover:underline"
            style={{ color: "#666" }}
          >
            Continue without signing in
          </button>
        </div>
      </div>
    </div>
  );
}

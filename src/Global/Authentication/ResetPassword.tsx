import { useState } from "react";

import {
  confirmPasswordReset,
  describeAuthError,
  requestPasswordReset,
} from "../../Services/cognitoAuth";

type Step = "email" | "code" | "done";

export default function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [step, setStep] = useState<Step>(params.get("step") === "code" && params.get("email") ? "code" : "email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setMessage("Please enter your email."); return; }
    setLoading(true);
    setMessage("");
    try {
      await requestPasswordReset(trimmed);
      setEmail(trimmed);
      setStep("code");
    } catch (err) {
      setMessage(describeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setMessage("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setLoading(true);
    setMessage("");
    try {
      await confirmPasswordReset(email, code, password);
      setStep("done");
    } catch (err) {
      setMessage(describeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-[#5E0009] px-8 py-6 text-center">
          <img src="/assets/msu.png" alt="Missouri State Lacrosse" className="h-12 mx-auto mb-3 object-contain" />
          <h1 className="text-white font-bold text-lg tracking-wide">Missouri State Lacrosse</h1>
        </div>

        <div className="px-8 py-8">
          {step === "done" ? (
            <div className="text-center">
              <div className="text-green-600 text-4xl mb-4">&#10003;</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated</h2>
              <p className="text-gray-600 text-sm mb-6">You can now sign in with your new password.</p>
              <a
                href="/"
                className="inline-block bg-[#5E0009] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#7a0012] transition"
              >
                Back to site
              </a>
            </div>
          ) : step === "code" ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists for {email}, we sent a 6-digit code. Enter it below with your new password. Check your spam folder too.
              </p>
              <form onSubmit={handleConfirm} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="123456" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repeat password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30" />
                </div>
                {message && <p className="text-red-600 text-sm">{message}</p>}
                <button type="submit" disabled={loading} className="w-full bg-[#5E0009] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#7a0012] transition disabled:opacity-60">
                  {loading ? "Saving..." : "Set New Password"}
                </button>
              </form>
              <p className="mt-4 text-center text-sm text-gray-500">
                <button type="button" className="text-[#5E0009] hover:underline" onClick={() => { setStep("email"); setMessage(""); }}>
                  Send a new code
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Reset your password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we will send you a code to set a new password.
              </p>
              <form onSubmit={handleRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30" />
                </div>
                {message && <p className="text-red-600 text-sm">{message}</p>}
                <button type="submit" disabled={loading} className="w-full bg-[#5E0009] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#7a0012] transition disabled:opacity-60">
                  {loading ? "Sending..." : "Send Reset Code"}
                </button>
              </form>
              <p className="mt-4 text-center text-sm text-gray-500">
                <a href="/" className="text-[#5E0009] hover:underline">Back to site</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

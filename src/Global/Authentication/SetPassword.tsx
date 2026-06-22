import { useState } from "react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "../../Services/firebaseConfig";

export default function SetPassword() {
  const params = new URLSearchParams(window.location.search);
  const oobCode = params.get("oobCode") ?? "";
  const mode = params.get("mode") ?? "";

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!oobCode || mode !== "resetPassword") {
      setMessage("Invalid or expired link. Please request a new one.");
      setStatus("error");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((e) => setEmail(e))
      .catch(() => {
        setMessage("This link has expired or already been used. Please request a new one.");
        setStatus("error");
      });
  }, [oobCode, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setMessage("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setStatus("loading");
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("success");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Failed to set password. The link may have expired.");
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
          {status === "success" ? (
            <div className="text-center">
              <div className="text-green-600 text-4xl mb-4">&#10003;</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password set!</h2>
              <p className="text-gray-600 text-sm mb-6">You can now sign in with your new password.</p>
              <a
                href="/"
                className="inline-block bg-[#5E0009] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#7a0012] transition"
              >
                Go to the site
              </a>
            </div>
          ) : status === "error" && !email ? (
            <div className="text-center">
              <p className="text-red-600 text-sm font-medium mb-4">{message}</p>
              <a
                href="/reset-password"
                className="inline-block bg-[#5E0009] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#7a0012] transition"
              >
                Get a new link
              </a>
              <p className="mt-3">
                <a href="/" className="text-[#5E0009] text-sm underline">Return to site</a>
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set your password</h2>
              {email && <p className="text-sm text-gray-500 mb-6">{email}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Repeat password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
                  />
                </div>
                {message && <p className="text-red-600 text-sm">{message}</p>}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-[#5E0009] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#7a0012] transition disabled:opacity-60"
                >
                  {status === "loading" ? "Setting password..." : "Set Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

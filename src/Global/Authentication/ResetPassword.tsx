import { useState } from "react";
import { apiRequest } from "../../Services/API";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setMessage("Please enter your email."); return; }
    setStatus("loading");
    try {
      await apiRequest("/api/onboard/forgot-password", {
        method: "POST",
        json: { email: trimmed },
      });
      setStatus("sent");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
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
          {status === "sent" ? (
            <div className="text-center">
              <div className="text-green-600 text-4xl mb-4">&#10003;</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-600 text-sm mb-6">
                If an account exists for that address, we sent a password reset link. Check your inbox (and spam folder).
              </p>
              <a
                href="/"
                className="inline-block bg-[#5E0009] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#7a0012] transition"
              >
                Back to site
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Reset your password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we'll send you a link to set a new password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
                  />
                </div>
                {message && <p className="text-red-600 text-sm">{message}</p>}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-[#5E0009] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#7a0012] transition disabled:opacity-60"
                >
                  {status === "loading" ? "Sending..." : "Send Reset Link"}
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

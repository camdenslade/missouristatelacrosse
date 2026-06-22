import { useState } from "react";
import { apiRequest } from "../../Services/API";

type Status = "idle" | "loading" | "success" | "error";

export default function AlumniJoin() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const program = window.location.search.includes("program=women") ? "women" : "men";
  const programLabel = program === "women" ? "Women's" : "Men's";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) { setError("Please fill in both fields."); return; }
    setStatus("loading");
    setError("");
    try {
      await apiRequest("/api/onboard/alumni", {
        method: "POST",
        json: { displayName: trimmedName, email: trimmedEmail, program },
      });
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("409") || msg.toLowerCase().includes("already")) {
        setError("An account with that email already exists. Check your inbox or contact an admin.");
      } else {
        setError("Something went wrong. Please try again or contact your program admin.");
      }
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-[#5E0009] px-8 py-6 text-center">
          <img src="/assets/msu.png" alt="Missouri State Lacrosse" className="h-14 mx-auto mb-3 object-contain" />
          <h1 className="text-white font-bold text-lg tracking-wide">Missouri State Lacrosse</h1>
          <p className="text-white/70 text-sm mt-1">{programLabel} Alumni</p>
        </div>

        <div className="px-8 py-8">
          {status === "success" ? (
            <div className="text-center">
              <div className="text-green-600 text-5xl mb-4">&#10003;</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You're in!</h2>
              <p className="text-gray-600 text-sm">
                Check your email for a link to set your password and access the alumni budget page. Go Bears!
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Alumni Sign-Up</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your info to get access to the {programLabel} Lacrosse alumni portal.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Jane Smith"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
                  />
                </div>
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
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-[#5E0009] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#7a0012] transition disabled:opacity-60"
                >
                  {status === "loading" ? "Creating account…" : "Join Alumni Portal"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

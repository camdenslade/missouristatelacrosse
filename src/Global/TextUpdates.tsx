import { useState } from "react";
import { Link } from "react-router-dom";

import { apiRequest } from "../Services/API";

// Keep identical to SmsSubscriberService.CONSENT_TEXT on the backend, which is what gets stored.
const CONSENT_TEXT =
  "By checking this box, you agree to receive recurring text messages from Missouri State Men's Lacrosse with team updates, event reminders, and fundraiser news. Consent is not a condition of any purchase or donation. Message frequency varies. Message and data rates may apply. Reply HELP for help or STOP to opt out at any time.";

// Public opt-in for text updates. This page is the opt-in the 10DLC campaign registration points to.
export default function TextUpdates() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  const digits = phone.replace(/\D/g, "");
  const phoneValid = digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phoneValid) return setError("Enter a valid US mobile number.");
    if (!smsConsent) return setError("Check the box to agree to receive texts.");
    if (!termsAccepted) return setError("Accept the Terms of Service and Privacy Policy.");
    setStatus("saving");
    try {
      await apiRequest("/api/sms/subscribe", {
        method: "POST",
        json: { name, phone, smsConsent, termsAccepted, source: window.location.pathname },
      });
      setStatus("done");
    } catch {
      setStatus("idle");
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
          <span className="h-px w-6 bg-white/40" />
          Stay Connected
          <span className="h-px w-6 bg-white/40" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold uppercase">Text Updates</h1>
        <p className="text-white/80 mt-2">Team news, game and event reminders, and fundraiser updates from Missouri State Men's Lacrosse.</p>
      </div>

      <div className="max-w-md mx-auto px-4 py-12">
        {status === "done" ? (
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-extrabold uppercase text-gray-900">You're Signed Up</h2>
            <p className="text-gray-600">
              Thanks for supporting Missouri State Lacrosse. Texts come from (207) 367-3104. Reply STOP to any message
              to opt out, or HELP for help.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Name (optional)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoComplete="name"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009]"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Mobile number</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(417) 555-0123"
                autoComplete="tel-national"
                inputMode="tel"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009]"
              />
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[#5E0009]"
              />
              <span className="text-xs text-gray-600 leading-relaxed">{CONSENT_TEXT}</span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[#5E0009]"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I agree to the{" "}
                <Link to="/terms-of-service" target="_blank" className="text-[#5E0009] font-semibold hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy-policy" target="_blank" className="text-[#5E0009] font-semibold hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full px-5 py-3 rounded-full text-sm font-semibold bg-[#5E0009] text-white hover:bg-[#7a0012] shadow-sm disabled:opacity-50"
            >
              {status === "saving" ? "Signing up..." : "Sign Up for Texts"}
            </button>

            <p className="text-[11px] text-gray-400 text-center">
              Texts come from (207) 367-3104. You don't need to sign up to donate, buy, or use any part of this site. We
              never sell or share your number.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

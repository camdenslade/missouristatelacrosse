import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import API_BASE from "../../../../Services/API";

// PayPal returns payer.name as { given_name, surname }; Stripe returns a single
// display-name string. Accept either shape.
function resolveDonorName(payer: { name?: unknown }): string {
  const raw = payer?.name;
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    const n = raw as { given_name?: string; surname?: string };
    return `${n.given_name || ""} ${n.surname || ""}`.trim();
  }
  return "";
}

export default function DonateSuccess() {
  const location = useLocation();
  const navigate = useNavigate();

  const order = location.state?.order;
  const amount = location.state?.amount;

  useEffect(() => {
    if (!order) {
      navigate("/women/donate");
      return;
    }

    const payer = order.payer || {};
    const name = resolveDonorName(payer);
    const email = payer.email_address || "";

    const sendThankYou = async () => {
      if (!email || !Number.isFinite(amount)) return;
      try {
        await fetch(`${API_BASE}/api/email/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: "Thank You for Supporting Missouri State Women's Lacrosse",
            body: `Hi ${name || "Supporter"},\n\nThank you for your generous donation of $${amount?.toFixed(
              2
            )} to Missouri State Women's Lacrosse.\n\nYour support helps our athletes, staff, and program grow stronger every day.\n\nWe truly appreciate your contribution!\n\nGo Bears,\nMissouri State Women's Lacrosse`,
          }),
        });
      } catch (err) {
        console.error("Failed to send thank-you email:", err);
      }
    };

    sendThankYou();
  }, [order, navigate, amount]);

  if (!order) return null;

  const payer = order.payer || {};
  const name = resolveDonorName(payer);
  const email = payer.email_address || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 sm:p-6">
      <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-6 sm:p-8 text-center">
        <h1 className="text-3xl font-bold text-[#5E0009] mb-4">Thank You!</h1>
        <p className="text-gray-700 mb-4">
          Your generous donation of{" "}
          <span className="font-semibold">${amount?.toFixed(2)}</span> has been received.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 text-sm space-y-1 wrap-break-word">
          <p><strong>Donor Name:</strong> {name || "—"}</p>
          <p><strong>Email:</strong> {email || "—"}</p>
          <p className="min-w-0">
            <strong>Transaction ID:</strong>{" "}
            <span className="font-mono text-xs break-all">{order.id}</span>
          </p>
        </div>
        <button
          onClick={() => navigate("/women")}
          className="px-6 py-2.5 bg-[#5E0009] text-white rounded-full font-semibold hover:bg-[#7a0012] transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

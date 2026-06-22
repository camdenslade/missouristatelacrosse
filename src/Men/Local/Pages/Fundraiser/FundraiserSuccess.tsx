import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API_BASE from "../../../../Services/API";

export default function FundraiserSuccess() {
  const location = useLocation();
  const navigate = useNavigate();

  const order = location.state?.order;
  const amount = location.state?.amount;

  useEffect(() => {
    if (!order) {
      navigate("/fundraiser");
      return;
    }

    const payer = order.payer || {};
    const name = `${payer.name?.given_name || ""} ${payer.name?.surname || ""}`.trim();
    const email = payer.email_address || "";

    const sendThankYou = async () => {
      if (!email) return;
      try {
        await fetch(`${API_BASE}/api/email/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: "Thank You for Supporting Missouri State Lacrosse – Dallas Trip Fundraiser",
            body: `Hi ${name || "Supporter"},\n\nThank you for your generous donation of $${amount?.toFixed(2)} to help Missouri State Men's Lacrosse travel to the Lone Star Alliance Conference Championship in Dallas!\n\nYour support makes a real difference for our athletes. We are a non-scholarship organization entirely supported by player dues and fundraising, and contributions like yours allow us to compete at the highest level.\n\nAll donations are tax deductible — Missouri State Lacrosse is a registered 501(c)(3) organization.\n\nGo Bears!\nMissouri State Men's Lacrosse`,
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
  const name = `${payer.name?.given_name || ""} ${payer.name?.surname || ""}`.trim();
  const email = payer.email_address || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8 text-center">

        <h1 className="text-3xl font-bold text-[#5E0009] mb-2">Thank You!</h1>
        <p className="text-gray-700 mb-4">
          Your donation of{" "}
          <span className="font-semibold text-[#5E0009]">${amount?.toFixed(2)}</span> helps the team
          get to Dallas. We couldn't do it without supporters like you.
        </p>
        <div className="bg-gray-100 rounded-lg p-4 text-left mb-6 text-sm">
          <p><strong>Donor:</strong> {name}</p>
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Transaction ID:</strong> {order.id}</p>
        </div>
        <p className="text-xs text-gray-400 mb-6">
          A confirmation email has been sent to {email || "your inbox"}.
          Missouri State Lacrosse is a 501(c)(3) — your donation is tax deductible.
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import API_BASE from "../../../../Services/API";
import { getProgramInfo } from "../../../../Services/programHelper";

export default function FundraiserSuccess() {
  const { slug } = useParams<{ slug: string }>();
  const { base } = getProgramInfo();
  const location = useLocation();
  const navigate = useNavigate();

  const order = location.state?.order;
  const amount = location.state?.amount;
  const campaignTitle: string = location.state?.title || "Missouri State Lacrosse";

  useEffect(() => {
    if (!order) {
      navigate(slug ? `${base}/fundraiser/${slug}` : base || "/");
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
            subject: `Thank You for Supporting Missouri State Lacrosse - ${campaignTitle}`,
            body: `Hi ${name || "Supporter"},\n\nThank you for your generous donation of $${amount?.toFixed(2)} to "${campaignTitle}"!\n\nYour support makes a real difference for our athletes. We are a non-scholarship organization entirely supported by player dues and fundraising, and contributions like yours allow us to compete at the highest level.\n\nAll donations are tax deductible - Missouri State Lacrosse is a registered 501(c)(3) organization.\n\nGo Bears!\nMissouri State Lacrosse`,
          }),
        });
      } catch (err) {
        console.error("Failed to send thank-you email:", err);
      }
    };

    sendThankYou();
  }, [order, navigate, amount, campaignTitle, slug, base]);

  if (!order) return null;

  const payer = order.payer || {};
  const name = `${payer.name?.given_name || ""} ${payer.name?.surname || ""}`.trim();
  const email = payer.email_address || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl overflow-hidden text-center">
        <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-8 pt-10 pb-8">
          <CheckCircle2 size={48} className="mx-auto mb-3 text-white/90" />
          <h1 className="text-3xl font-bold mb-2">Thank You!</h1>
          <p className="text-white/85">
            Your donation of{" "}
            <span className="font-bold text-white">${amount?.toFixed(2)}</span> helps support{" "}
            <span className="font-semibold text-white">{campaignTitle}</span>. We couldn't do it
            without supporters like you.
          </p>
        </div>

        <div className="px-8 py-8">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left mb-6 text-sm space-y-1">
            <p><strong>Donor:</strong> {name}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Transaction ID:</strong> {order.id}</p>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            A confirmation email has been sent to {email || "your inbox"}.
            Missouri State Lacrosse is a 501(c)(3) - your donation is tax deductible.
          </p>
          <button
            onClick={() => navigate(base || "/")}
            className="px-8 py-2.5 bg-[#5E0009] text-white rounded-full font-semibold hover:bg-[#7a0012] transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

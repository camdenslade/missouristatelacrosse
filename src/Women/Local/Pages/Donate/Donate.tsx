import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import usePaymentButtons from "../../../../Global/Common/hooks/usePaymentButtons";
import { resolvePaymentProvider } from "../../../../Global/Common/hooks/usePaymentProvider";
import { useSponsors } from "../../../../Global/Common/hooks/useSponsors";
import SponsorLogos from "../../../../Global/Common/SponsorLogos";
import UnavailableOverlay from "../../../../Global/Common/UnavailableOverlay";

export default function WDonate() {
  const [donationAmount, setDonationAmount] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
  const navigate = useNavigate();

  const { sponsors } = useSponsors();
  const isEnabled = import.meta.env.VITE_DONATE_ENABLED_WOMEN === "true";
  const provider = resolvePaymentProvider();
  const providerLabel = provider === "stripe" ? "Stripe" : "PayPal";

  const handleConfirm = () => {
    const val = parseFloat(donationAmount);
    if (!isNaN(val) && val > 0) setConfirmedAmount(val);
    else toast.error("Please enter a valid donation amount.");
  };

  const handleSuccess = (captureData: unknown, amount: number) => {
    setDonationAmount("");
    setConfirmedAmount(null);
    navigate("/women/donate/success", {
      state: {
        order: captureData,
        amount,
      },
    });
  };

  usePaymentButtons(confirmedAmount, "paypal-donate-buttons", handleSuccess);

  return (
    <div className="relative min-h-screen bg-gray-50">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
          <span className="h-px w-6 bg-white/40" />
          Give Back
          <span className="h-px w-6 bg-white/40" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">
          Support Missouri State Women's Lacrosse
        </h1>
        <p className="text-white/80 mt-3 max-w-lg mx-auto">
          Your donation helps cover equipment, travel, and essential team expenses.
        </p>
      </div>

      <div className="flex flex-col items-center px-4 sm:px-6 -mt-8 pb-16">
        <div
          className={`w-full bg-white shadow-lg rounded-2xl flex flex-col items-center gap-6 text-center ${
            provider === "stripe" ? "max-w-xl p-6 sm:p-8" : "max-w-md p-6 sm:p-8"
          }`}
        >
          {isEnabled ? (
            <>
              <div className="relative w-48">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter Amount"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  className="border border-gray-300 px-7 py-2 w-full text-center rounded-full focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
                />
              </div>

              <button
                onClick={handleConfirm}
                className="mt-2 px-8 py-2.5 bg-[#5E0009] text-white rounded-full font-semibold hover:bg-[#7a0012] transition"
              >
                {confirmedAmount ? "Update Donation" : "Confirm Donation"}
              </button>

              {confirmedAmount && (
                <div id="paypal-donate-buttons" className="mt-4 w-full" />
              )}

              <p className="text-sm text-gray-500 mt-4">
                Donations are securely processed via {providerLabel}.
              </p>
            </>
          ) : (
            <UnavailableOverlay message="Donations are currently unavailable" />
          )}

          {/* Sponsor Button */}
          <div className="mt-6 pt-4 border-t border-gray-200 w-full">
            <p className="text-gray-700 mb-3">
              Interested in partnering with us?
            </p>
            <button
              onClick={() => navigate("/sponsorships")}
              className="bg-[#5E0009] text-white px-6 py-2.5 rounded-full font-semibold hover:bg-[#7a0012] transition"
            >
              Become a Sponsor
            </button>
          </div>
        </div>

        {sponsors.length > 0 && (
          <div className="max-w-lg w-full mt-8 text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wide mb-3">
              Proudly Supported By
            </p>
            <SponsorLogos sponsors={sponsors} layout="row" maxHeight={80} />
          </div>
        )}
      </div>
    </div>
  );
}


import { useState } from "react";
import { useNavigate } from "react-router-dom";

import usePayPalButtons from "../../../../Global/Common/hooks/usePayPalButtons.js";
import UnavailableOverlay from "../../../../Global/Common/UnavailableOverlay.jsx";

export default function Donate() {
  const [donationAmount, setDonationAmount] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState(null);
  const navigate = useNavigate();

  const isEnabled = import.meta.env.VITE_DONATE_ENABLED === "true";

  const handleConfirm = () => {
    const val = parseFloat(donationAmount);
    if (!isNaN(val) && val > 0) setConfirmedAmount(val);
    else alert("Please enter a valid donation amount.");
  };

  const handleSuccess = (captureData, amount) => {
    setDonationAmount("");
    setConfirmedAmount(null);
    navigate("/donate/success", {
      state: {
        order: captureData,
        amount,
      },
    });
  };

  usePayPalButtons(confirmedAmount, "paypal-donate-buttons", handleSuccess);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8 flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold text-[#5E0009]">
          Support Missouri State Lacrosse
        </h1>
        <p className="text-gray-700">
          Your donation helps cover equipment, travel, and essential team expenses.
        </p>

        {isEnabled ? (
          <>
            <div className="relative w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                min="1"
                placeholder="Enter Amount"
                value={donationAmount}
                onChange={(e) => setDonationAmount(e.target.value)}
                className="border px-7 py-2 w-full text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
              />
            </div>

            <button
              onClick={handleConfirm}
              className="mt-2 px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] transition"
            >
              {confirmedAmount ? "Update Donation" : "Confirm Donation"}
            </button>

            {confirmedAmount && (
              <div id="paypal-donate-buttons" className="mt-4 w-full flex justify-center" />
            )}

            <p className="text-sm text-gray-500 mt-4">
              Donations are securely processed via PayPal.
            </p>
          </>
        ) : (
          <UnavailableOverlay message="Donations are currently unavailable" />
        )}

        {/* Sponsor Button */}
        <div className="mt-6 pt-4 border-t w-full">
          <p className="text-gray-700 mb-3">
            Interested in partnering with us?
          </p>
          <button
            onClick={() => navigate("/sponsorships")}
            className="bg-[#5E0009] text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-800 transition"
          >
            Become a Sponsor
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import usePayPalButtons from "../../../../Global/Common/hooks/usePayPalButtons";
import { apiRequest } from "../../../../Services/API";

const GOAL = 3000;
const SOURCE = "fundraiser";

const expenses = [
  { label: "Air BnB (16 players + Coach, 3 nights)", amount: 1350, detail: "$450 × 3 nights" },
  { label: "Van Rental (4 days)", amount: 600, detail: "$150 × 4 days" },
  { label: "Gas (van + gear vehicle)", amount: 500, detail: "~1,000 mi, 2 vehicles" },
  { label: "Team Meals", amount: 550, detail: "" },
];

const SUGGESTED = [25, 50, 100, 250];

export default function Fundraiser() {
  const [donationAmount, setDonationAmount] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
  const [raised, setRaised] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiRequest<{ total: number }>(`/api/paypal/total?source=${SOURCE}`)
      .then((data) => setRaised(Number(data.total)))
      .catch(() => setRaised(0));
  }, []);

  const progressPct = raised != null ? Math.min((raised / GOAL) * 100, 100) : 0;
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSelect = (val: number) => {
    setDonationAmount(String(val));
    setConfirmedAmount(null);
  };

  const handleConfirm = () => {
    const val = parseFloat(donationAmount);
    if (!isNaN(val) && val > 0) setConfirmedAmount(val);
    else toast.error("Please enter a valid donation amount.");
  };

  const handleSuccess = (captureData: unknown, amount: number) => {
    setDonationAmount("");
    setConfirmedAmount(null);
    setRaised((prev) => (prev ?? 0) + amount);
    navigate("/fundraiser/success", { state: { order: captureData, amount } });
  };

  usePayPalButtons(confirmedAmount, "paypal-fundraiser-buttons", handleSuccess, "donate", SOURCE);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="max-w-2xl w-full text-center mb-8">
        <p className="text-sm uppercase tracking-widest text-[#5E0009] font-semibold mb-1">
          Men's Lacrosse · April 17–20
        </p>
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-3">
          Help Us Get to Dallas
        </h1>
        <p className="text-gray-600 text-base leading-relaxed">
          Due to expenses carried over from last season, a smaller than usual roster, and a litany
          of injuries, the team needs your help to fundraise{" "}
          <span className="font-semibold text-[#5E0009]">$3,000</span> for travel to the{" "}
          <span className="font-semibold">Lone Star Alliance Conference Championship</span> in
          Dallas this weekend.
        </p>
      </div>

      <div className="max-w-2xl w-full flex flex-col gap-6">
        {/* Progress */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Donations raised</span>
            <span className="font-semibold text-gray-800">
              {raised != null ? (
                <>
                  <span className="text-[#5E0009]">${raised.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  {" "}of ${GOAL.toLocaleString()} goal
                </>
              ) : (
                "Loading..."
              )}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-[#5E0009] h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <p className="text-xs text-gray-400 mb-5">
            Any amount over the ${GOAL.toLocaleString()} goal goes toward league and referee fees.
          </p>

          {/* Expense breakdown */}
          <p className="text-sm font-semibold text-gray-700 mb-1">Travel Expense Breakdown</p>
          <div className="divide-y">
            {expenses.map((e) => (
              <div key={e.label} className="flex justify-between items-center py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{e.label}</p>
                  {e.detail && <p className="text-xs text-gray-400">{e.detail}</p>}
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  ${e.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 mt-2 border-t">
            <span className="font-bold text-gray-900">Total Needed</span>
            <span className="font-bold text-[#5E0009] text-lg">${expenseTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Donate */}
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center gap-5">
          <h2 className="text-xl font-bold text-gray-900">Make a Donation</h2>

          <div className="flex gap-3 flex-wrap justify-center">
            {SUGGESTED.map((val) => (
              <button
                key={val}
                onClick={() => handleSelect(val)}
                className={`px-4 py-2 rounded-lg border font-semibold text-sm transition ${
                  donationAmount === String(val)
                    ? "bg-[#5E0009] text-white border-[#5E0009]"
                    : "border-gray-300 text-gray-700 hover:border-[#5E0009] hover:text-[#5E0009]"
                }`}
              >
                ${val}
              </button>
            ))}
          </div>

          <div className="relative w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              min="1"
              placeholder="Other amount"
              value={donationAmount}
              onChange={(e) => {
                setDonationAmount(e.target.value);
                setConfirmedAmount(null);
              }}
              className="border px-7 py-2 w-full text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
            />
          </div>

          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-[#5E0009] text-white rounded-lg font-semibold hover:bg-[#7a0012] transition"
          >
            {confirmedAmount ? "Update Amount" : "Donate Now"}
          </button>

          {confirmedAmount && (
            <div id="paypal-fundraiser-buttons" className="w-full flex justify-center mt-2" />
          )}

          <p className="text-xs text-gray-400 text-center">
            Donations are securely processed via PayPal.{" "}
            <span className="text-gray-500">
              Missouri State Lacrosse is a registered 501(c)(3) — all donations are tax deductible.
            </span>
          </p>
        </div>

        {/* About */}
        <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-600 leading-relaxed">
          <h3 className="font-bold text-gray-900 mb-2">About the Team</h3>
          <p>
            Missouri State Men's Lacrosse is a non-scholarship organization entirely supported by
            player dues and fundraising. The team has qualified for the{" "}
            <strong>Lone Star Alliance Conference Championship</strong> in Dallas, April 17–20, and
            needs your support to make the trip.
          </p>
          <p className="mt-2">We can't thank you enough. Go Bears!</p>
        </div>
      </div>
    </div>
  );
}

import { Heart, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { fetchFundraiserBySlug } from "../../../../Global/Common/hooks/useFundraisers";
import usePaymentButtons from "../../../../Global/Common/hooks/usePaymentButtons";
import { resolvePaymentProvider } from "../../../../Global/Common/hooks/usePaymentProvider";
import { apiRequest } from "../../../../Services/API";
import { getProgramInfo } from "../../../../Services/programHelper";
import type { ApiFundraiser } from "../../../../types/api";

const SUGGESTED = [25, 50, 100, 250];

export default function Fundraiser() {
  const { slug } = useParams<{ slug: string }>();
  const { base } = getProgramInfo();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"loading" | "ready" | "not_found">("loading");
  const [fundraiser, setFundraiser] = useState<ApiFundraiser | null>(null);
  const [donationAmount, setDonationAmount] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
  const [raised, setRaised] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) {
      setStatus("not_found");
      return;
    }
    fetchFundraiserBySlug(slug)
      .then((f) => {
        setFundraiser(f);
        setStatus("ready");
      })
      .catch(() => setStatus("not_found"));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    apiRequest<{ total: number }>(`/api/paypal/total?source=fundraiser-${slug}`)
      .then((data) => setRaised(Number(data.total)))
      .catch(() => setRaised(0));
  }, [slug]);

  const goal = fundraiser?.goalAmount ?? null;
  const progressPct = raised != null && goal ? Math.min((raised / goal) * 100, 100) : 0;
  const expenses = fundraiser?.expenses ?? [];
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
    // Never show a success page without a real captured order id - otherwise a backend
    // hiccup that returns an empty/incomplete capture response would silently look like a
    // successful donation with no actual charge behind it.
    const orderId = (captureData as { id?: string } | null)?.id;
    if (!orderId) {
      console.error("PayPal onApprove returned no order id - not confirming donation:", captureData);
      toast.error("Something went wrong confirming your donation. Please contact us before trying again.");
      return;
    }
    setDonationAmount("");
    setConfirmedAmount(null);
    setRaised((prev) => (prev ?? 0) + amount);
    navigate(`${base}/fundraiser/${slug}/success`, {
      state: { order: captureData, amount, title: fundraiser?.title },
    });
  };

  usePaymentButtons(confirmedAmount, "paypal-fundraiser-buttons", handleSuccess, "donate", `fundraiser-${slug}`);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-pulse text-gray-500">Loading campaign...</div>
      </div>
    );
  }

  if (status === "not_found" || !fundraiser) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <p className="text-gray-500 text-lg mb-4">Campaign not found.</p>
        <button onClick={() => navigate(base || "/")} className="text-[#5E0009] underline">
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="relative bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white overflow-hidden">
        <div className="max-w-2xl mx-auto text-center px-4 py-14">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 mb-3">
            <span className="h-px w-6 bg-white/50" />
            Missouri State Lacrosse
            <span className="h-px w-6 bg-white/50" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
            {fundraiser.title}
          </h1>
          {fundraiser.description && (
            <p className="text-white/85 text-base leading-relaxed">{fundraiser.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex flex-col gap-6 px-4 -mt-8 pb-12">
        {fundraiser.image && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <img src={fundraiser.image} alt="" className="w-full max-h-72 object-cover" />
          </div>
        )}

        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-7">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Donations raised</span>
            <span className="font-semibold text-gray-800">
              {raised != null ? (
                <>
                  <span className="text-[#5E0009]">
                    ${raised.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                  {goal ? ` of $${goal.toLocaleString()} goal` : ""}
                </>
              ) : (
                "Loading..."
              )}
            </span>
          </div>
          {goal ? (
            <>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
                <div
                  className="bg-linear-to-r from-[#5E0009] to-[#8a1420] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mb-5">
                Any amount over the ${goal.toLocaleString()} goal directly supports the team.
              </p>
            </>
          ) : null}

          {/* Expense breakdown */}
          {expenses.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={14} className="text-[#5E0009]" />
                <p className="text-sm font-semibold text-gray-700">Expense Breakdown</p>
              </div>
              <div className="divide-y">
                {expenses.map((e, i) => (
                  <div key={`${e.label}-${i}`} className="flex justify-between items-center py-3">
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
            </>
          )}
        </div>

        {/* Donate */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-7 flex flex-col items-center gap-5">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Heart size={20} className="text-[#5E0009]" />
            Make a Donation
          </h2>

          <div className="flex gap-3 flex-wrap justify-center">
            {SUGGESTED.map((val) => (
              <button
                key={val}
                onClick={() => handleSelect(val)}
                className={`px-4 py-2 rounded-full border font-semibold text-sm transition ${
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
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              min="1"
              placeholder="Other amount"
              value={donationAmount}
              onChange={(e) => {
                setDonationAmount(e.target.value);
                setConfirmedAmount(null);
              }}
              className="border border-gray-300 px-7 py-2 w-full text-center rounded-full focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
            />
          </div>

          <button
            onClick={handleConfirm}
            className="px-8 py-2.5 bg-[#5E0009] text-white rounded-full font-semibold hover:bg-[#7a0012] transition"
          >
            {confirmedAmount ? "Update Amount" : "Donate Now"}
          </button>

          {confirmedAmount && (
            <div id="paypal-fundraiser-buttons" className="w-full mt-2" />
          )}

          <p className="text-xs text-gray-400 text-center">
            Donations are securely processed via {resolvePaymentProvider() === "stripe" ? "Stripe" : "PayPal"}.{" "}
            <span className="text-gray-500">
              Missouri State Lacrosse is a registered 501(c)(3) - all donations are tax deductible.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

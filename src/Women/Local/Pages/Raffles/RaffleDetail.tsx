import { useCallback, useEffect, useReducer } from "react";
import { useNavigate, useParams } from "react-router-dom";
import usePayPalButtons from "../../../../Global/Common/hooks/usePayPalButtons";
import { enterRaffle, fetchRaffleBySlug } from "../../../../Global/Common/hooks/useRaffles";
import { getProgramInfo } from "../../../../Services/programHelper";
import type { ApiRaffle } from "../../../../types/api";

// ── State ─────────────────────────────────────────────────────────────────────

type Status = "loading" | "ready" | "not_found" | "success" | "error";

type State = {
  status: Status;
  raffle: ApiRaffle | null;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  ticketCount: string;
  bidAmount: string;
  submitting: boolean;
  errorMsg: string;
};

type Action =
  | { type: "SET_RAFFLE"; raffle: ApiRaffle }
  | { type: "NOT_FOUND" }
  | { type: "SET"; key: "payerName" | "payerEmail" | "payerPhone" | "ticketCount" | "bidAmount"; value: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; msg: string }
  | { type: "SUCCESS" };

function init(): State {
  return {
    status: "loading",
    raffle: null,
    payerName: "",
    payerEmail: "",
    payerPhone: "",
    ticketCount: "1",
    bidAmount: "",
    submitting: false,
    errorMsg: "",
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_RAFFLE":
      return { ...state, status: "ready", raffle: action.raffle };
    case "NOT_FOUND":
      return { ...state, status: "not_found" };
    case "SET":
      return { ...state, [action.key]: action.value };
    case "SUBMIT_START":
      return { ...state, submitting: true, errorMsg: "" };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, errorMsg: action.msg };
    case "SUCCESS":
      return { ...state, status: "success", submitting: false };
    default:
      return state;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function calcAmount(raffle: ApiRaffle, ticketCount: string, bidAmount: string): number | null {
  const base = Number(raffle.ticketPrice) || 0;
  if (raffle.allowBids) {
    const bid = parseFloat(bidAmount);
    if (!bid || bid <= 0) return null;
    if (base > 0 && bid < base) return null;
    return bid;
  } else {
    const count = parseInt(ticketCount, 10) || 1;
    if (base <= 0) return null; // free
    return base * count;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RaffleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { base } = getProgramInfo();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    if (!slug) { dispatch({ type: "NOT_FOUND" }); return; }
    fetchRaffleBySlug(slug)
      .then((r) => dispatch({ type: "SET_RAFFLE", raffle: r }))
      .catch(() => dispatch({ type: "NOT_FOUND" }));
  }, [slug]);

  const isFormComplete = state.raffle
    ? state.payerName.trim() !== "" && state.payerEmail.trim() !== ""
    : false;

  const isFree = !state.raffle?.ticketPrice || Number(state.raffle.ticketPrice) <= 0;
  const amount = state.raffle && !isFree ? calcAmount(state.raffle, state.ticketCount, state.bidAmount) : null;
  const canPay = isFormComplete && (isFree || amount !== null);

  const handleSuccess = useCallback(
    async (captureData: { id: string }) => {
      if (!state.raffle) return;
      dispatch({ type: "SUBMIT_START" });
      const payload = {
        payerName: state.payerName.trim(),
        payerEmail: state.payerEmail.trim(),
        payerPhone: state.payerPhone.trim() || undefined,
        paypalOrderId: captureData.id,
        ticketCount: state.raffle.allowBids ? 1 : parseInt(state.ticketCount, 10) || 1,
        bidAmount: state.raffle.allowBids ? parseFloat(state.bidAmount) : undefined,
      };
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await enterRaffle(state.raffle.id, payload);
          dispatch({ type: "SUCCESS" });
          return;
        } catch {
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      dispatch({
        type: "SUBMIT_ERROR",
        msg: `Your payment was received but your entry couldn't be recorded. Please contact us and provide your PayPal order ID: ${captureData.id}`,
      });
    },
    [state]
  );

  const { paypalLoaded } = usePayPalButtons(
    canPay && !isFree ? amount : null,
    "raffle-paypal-buttons",
    handleSuccess as Parameters<typeof usePayPalButtons>[2]
  );

  const handleFreeSubmit = async () => {
    if (!state.raffle) return;
    dispatch({ type: "SUBMIT_START" });
    try {
      await enterRaffle(state.raffle.id, {
        payerName: state.payerName.trim(),
        payerEmail: state.payerEmail.trim(),
        payerPhone: state.payerPhone.trim() || undefined,
        ticketCount: parseInt(state.ticketCount, 10) || 1,
      });
      dispatch({ type: "SUCCESS" });
    } catch {
      dispatch({ type: "SUBMIT_ERROR", msg: "Entry failed. Please try again." });
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-pulse text-gray-500">Loading raffle...</div>
      </div>
    );
  }

  if (state.status === "not_found" || !state.raffle) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <p className="text-gray-500 text-lg mb-4">Raffle not found.</p>
        <button onClick={() => navigate(`${base}/raffles`)} className="text-[#5E0009] underline">
          Back to raffles
        </button>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">You're entered!</h2>
        <p className="text-gray-500 mb-1">
          Good luck in <strong>{state.raffle.name}</strong>!
        </p>
        <button
          onClick={() => navigate(`${base}/raffles`)}
          className="mt-6 px-6 py-2 bg-[#5E0009] text-white rounded-lg font-semibold hover:bg-[#7a0010] transition-colors"
        >
          Back to Raffles
        </button>
      </div>
    );
  }

  const raffle = state.raffle;
  const isClosed = raffle.status !== "active";
  const inputCls = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]";
  const maxPer = raffle.maxTicketsPerPerson;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate(`${base}/raffles`)}
        className="text-sm text-[#5E0009] hover:underline mb-6 flex items-center gap-1"
      >
        Back to raffles
      </button>

      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        {raffle.image && (
          <img src={raffle.image} alt={raffle.name} className="w-full max-h-80 object-contain bg-gray-50 rounded-lg mb-4" />
        )}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{raffle.name}</h1>
          {raffle.allowBids && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Bid</span>
          )}
          {isClosed && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              raffle.status === "drawn" ? "bg-purple-100 text-purple-700" : "bg-yellow-100 text-yellow-700"
            }`}>
              {raffle.status === "drawn" ? "Winner Drawn" : "Closed"}
            </span>
          )}
        </div>
        {raffle.description && <p className="text-gray-500 text-sm mb-2">{raffle.description}</p>}
        {raffle.winnerName && (
          <p className="text-sm text-purple-700 font-medium">🏆 Winner: {raffle.winnerName}</p>
        )}
        <div className="text-sm text-gray-600 space-y-0.5 mt-2">
          {raffle.endTime && (
            <div><span className="font-medium">{isClosed ? "Ended:" : "Ends:"}</span> {fmtDate(raffle.endTime)}</div>
          )}
          <div>
            <span className="font-medium">Entry:</span>{" "}
            {isFree ? "Free" : raffle.allowBids
              ? `Bid — minimum $${Number(raffle.ticketPrice).toFixed(2)}`
              : `$${Number(raffle.ticketPrice).toFixed(2)} per ticket${maxPer ? ` (max ${maxPer})` : ""}`
            }
          </div>
        </div>
      </div>

      {isClosed ? (
        <p className="text-gray-500 text-center py-8">This raffle is no longer accepting entries.</p>
      ) : (
        <div className="space-y-5">
          {/* Your info */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Your Info</legend>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={state.payerName}
                onChange={(e) => dispatch({ type: "SET", key: "payerName", value: e.target.value })}
                className={inputCls}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                type="email"
                value={state.payerEmail}
                onChange={(e) => dispatch({ type: "SET", key: "payerEmail", value: e.target.value })}
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="tel"
                value={state.payerPhone}
                onChange={(e) => dispatch({ type: "SET", key: "payerPhone", value: e.target.value })}
                className={inputCls}
                placeholder="(555) 000-0000"
              />
            </div>
          </fieldset>

          {/* Ticket / Bid selection */}
          {!isFree && (
            <div>
              {raffle.allowBids ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Bid ($){Number(raffle.ticketPrice) > 0 ? ` — minimum $${Number(raffle.ticketPrice).toFixed(2)}` : ""}
                  </label>
                  <input
                    type="number"
                    min={Number(raffle.ticketPrice) || 0.01}
                    step="0.01"
                    value={state.bidAmount}
                    onChange={(e) => dispatch({ type: "SET", key: "bidAmount", value: e.target.value })}
                    className={inputCls}
                    placeholder="Enter your bid"
                  />
                  {amount !== null && (
                    <p className="text-sm text-gray-600 mt-1">
                      Your bid: <strong>${amount.toFixed(2)}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Tickets{maxPer ? ` (max ${maxPer})` : ""}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxPer ?? undefined}
                    value={state.ticketCount}
                    onChange={(e) => dispatch({ type: "SET", key: "ticketCount", value: e.target.value })}
                    className={inputCls}
                  />
                  {amount !== null && (
                    <p className="text-sm text-gray-600 mt-1">
                      Total: <strong>${amount.toFixed(2)}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {state.errorMsg && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.errorMsg}
            </div>
          )}

          {/* Payment / Submit */}
          <div className="pt-2">
            {isFree ? (
              <button
                onClick={handleFreeSubmit}
                disabled={!canPay || state.submitting}
                className="w-full py-3 bg-[#5E0009] text-white rounded-lg font-semibold text-sm hover:bg-[#7a0010] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {state.submitting ? "Submitting..." : "Enter Raffle (Free)"}
              </button>
            ) : (
              <>
                {!canPay && (
                  <p className="text-xs text-gray-400 text-center mb-2">
                    Fill in your info and {raffle.allowBids ? "a bid amount" : "ticket count"} to enable payment.
                  </p>
                )}
                <div id="raffle-paypal-buttons" className={canPay ? "" : "opacity-30 pointer-events-none"} />
                {canPay && !paypalLoaded && (
                  <p className="text-xs text-gray-400 text-center mt-2">Loading payment options...</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

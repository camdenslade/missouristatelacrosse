import { useEffect, useReducer } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import API_BASE from "../../../Services/API";

interface KeyGateProps {
  gameId: string;
  gameLabel: string;
  program: string;
  isPaywalled: boolean;
  priceOneScreen: number;
  priceTwoScreen: number;
  paypalClientId: string;
  onAccessGranted: (sessionToken: string, signedUrl: string, displayName: string) => void;
  onFreeAccess: (signedUrl: string) => void;
}

type View = "key" | "purchase" | "purchasing";

interface State {
  view: View;
  keyInput: string;
  error: string;
  loading: boolean;
  conflict: boolean; // true when server returned 409 (key in use)
  // purchase form
  displayName: string;
  email: string;
  tier: "ONE_SCREEN" | "TWO_SCREEN";
  purchasedKey: string;
}

type Action =
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_KEY_INPUT"; value: string }
  | { type: "SET_ERROR"; msg: string; conflict?: boolean }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_FIELD"; field: keyof State; value: string }
  | { type: "SET_PURCHASED_KEY"; key: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_VIEW":      return { ...state, view: action.view, error: "", conflict: false };
    case "SET_KEY_INPUT": return { ...state, keyInput: action.value, error: "", conflict: false };
    case "SET_ERROR":     return { ...state, error: action.msg, loading: false, conflict: !!action.conflict };
    case "SET_LOADING":   return { ...state, loading: action.value };
    case "SET_FIELD":     return { ...state, [action.field]: action.value };
    case "SET_PURCHASED_KEY": return { ...state, purchasedKey: action.key, view: "key", keyInput: action.key };
    default: return state;
  }
}

const BASE_URL = `${(API_BASE || "").replace(/\/+$/, "")}/api/stream`;

export default function KeyGate({
  gameId,
  gameLabel,
  program,
  isPaywalled,
  priceOneScreen,
  priceTwoScreen,
  paypalClientId,
  onAccessGranted,
  onFreeAccess,
}: KeyGateProps) {
  const [state, dispatch] = useReducer(reducer, {
    view: "key",
    keyInput: "",
    error: "",
    loading: false,
    conflict: false,
    displayName: "",
    email: "",
    tier: "ONE_SCREEN",
    purchasedKey: "",
  });

  const { view, keyInput, error, loading, conflict, displayName, email, tier } = state;
  const programHeader = { "X-Program": program, "Content-Type": "application/json" };

  const validateKey = async (force = false) => {
    const code = keyInput.trim().toUpperCase();
    if (!code) return;
    dispatch({ type: "SET_LOADING", value: true });
    try {
      const res = await fetch(`${BASE_URL}/validate`, {
        method: "POST",
        headers: programHeader,
        body: JSON.stringify({ keyCode: code, gameId, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({
          type: "SET_ERROR",
          msg: data.error || data.message || "Invalid key",
          conflict: res.status === 409,
        });
        return;
      }
      onAccessGranted(data.sessionToken, data.signedUrl, data.displayName);
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Network error. Please try again." });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  const getFreeAccess = async () => {
    dispatch({ type: "SET_LOADING", value: true });
    try {
      const res = await fetch(`${BASE_URL}/access/${gameId}`, {
        method: "POST",
        headers: programHeader,
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", msg: data.error || "Could not load stream" });
        return;
      }
      onFreeAccess(data.signedUrl);
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Network error. Please try again." });
    } finally {
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  const tierPrice = tier === "TWO_SCREEN" ? priceTwoScreen : priceOneScreen;

  // Auto-load free streams without requiring a button click
  useEffect(() => {
    if (!isPaywalled) {
      getFreeAccess();
    }
  }, []);

  if (!isPaywalled) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        {loading ? (
          <div className="w-8 h-8 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
        ) : error ? (
          <>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={getFreeAccess}
              className="bg-[#5E0009] text-white px-6 py-2 rounded font-semibold"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-md mx-auto">
      {/* Tab bar */}
      <div className="flex gap-2 mb-5">
        {(["key", "purchase"] as const).map((v) => (
          <button
            key={v}
            onClick={() => dispatch({ type: "SET_VIEW", view: v })}
            className={`flex-1 py-2 rounded text-sm font-semibold transition-all ${
              view === v
                ? "bg-[#5E0009] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v === "key" ? "Enter Key" : "Buy Access"}
          </button>
        ))}
      </div>

      {/* Key entry */}
      {view === "key" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Enter your stream key to watch. Check your email if you purchased access.
          </p>
          <input
            type="text"
            value={keyInput}
            onChange={(e) =>
              dispatch({ type: "SET_KEY_INPUT", value: e.target.value.toUpperCase() })
            }
            onKeyDown={(e) => e.key === "Enter" && validateKey()}
            placeholder="MSU-XXXXXX-XXXXXX"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono tracking-widest uppercase"
          />
          {error && (
            <p className={`text-sm ${conflict ? "text-amber-600" : "text-red-600"}`}>
              {error}
            </p>
          )}
          {conflict ? (
            <button
              onClick={() => validateKey(true)}
              disabled={loading}
              className="w-full bg-amber-600 text-white py-2 rounded font-semibold disabled:opacity-50"
            >
              {loading ? "Reconnecting…" : "Reconnect (disconnect other device)"}
            </button>
          ) : (
            <button
              onClick={() => validateKey()}
              disabled={loading || !keyInput.trim()}
              className="w-full bg-[#5E0009] text-white py-2 rounded font-semibold disabled:opacity-50"
            >
              {loading ? "Checking…" : "Watch Now"}
            </button>
          )}
        </div>
      )}

      {/* Purchase */}
      {(view === "purchase" || view === "purchasing") && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["ONE_SCREEN", "TWO_SCREEN"] as const).map((t) => (
              <button
                key={t}
                onClick={() => dispatch({ type: "SET_FIELD", field: "tier", value: t })}
                className={`flex-1 border rounded p-2 text-sm ${
                  tier === t
                    ? "border-[#5E0009] bg-red-50 font-semibold"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div>{t === "ONE_SCREEN" ? "1 Screen" : "2 Screens"}</div>
                <div className="font-bold text-[#5E0009]">
                  ${t === "ONE_SCREEN" ? priceOneScreen.toFixed(2) : priceTwoScreen.toFixed(2)}
                </div>
              </button>
            ))}
          </div>

          <input
            type="text"
            value={displayName}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "displayName", value: e.target.value })
            }
            placeholder="Your name (shown in chat)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })
            }
            placeholder="Email (your key will be sent here)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {displayName.trim() && email.trim() && (
            <PayPalScriptProvider options={{ clientId: paypalClientId }}>
              <PayPalButtons
                style={{ layout: "vertical", shape: "rect", label: "pay" }}
                createOrder={async (_data, actions) => {
                  return actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [
                      {
                        amount: {
                          currency_code: "USD",
                          value: tierPrice.toFixed(2),
                        },
                        description: `Stream access (${tier === "ONE_SCREEN" ? "1-Screen" : "2-Screen"}) — ${gameLabel}`,
                      },
                    ],
                  });
                }}
                onApprove={async (_data, actions) => {
                  dispatch({ type: "SET_VIEW", view: "purchasing" });
                  try {
                    const capture = await actions.order!.capture();
                    const orderId = capture.id!;

                    const res = await fetch(`${BASE_URL}/purchase`, {
                      method: "POST",
                      headers: programHeader,
                      body: JSON.stringify({
                        gameId,
                        gameLabel,
                        tier,
                        displayName: displayName.trim(),
                        email: email.trim(),
                        paypalOrderId: orderId,
                      }),
                    });
                    const purchaseData = await res.json();
                    if (!res.ok) {
                      dispatch({ type: "SET_ERROR", msg: purchaseData.error || "Purchase failed" });
                      return;
                    }

                    dispatch({ type: "SET_PURCHASED_KEY", key: purchaseData.keyCode });
                  } catch {
                    dispatch({ type: "SET_ERROR", msg: "Something went wrong. Check your email for your key." });
                    dispatch({ type: "SET_VIEW", view: "key" });
                  }
                }}
                onError={() =>
                  dispatch({ type: "SET_ERROR", msg: "PayPal error. Please try again." })
                }
              />
            </PayPalScriptProvider>
          )}

          {view === "purchasing" && !error && (
            <p className="text-sm text-center text-gray-500">Processing your order…</p>
          )}
        </div>
      )}
    </div>
  );
}

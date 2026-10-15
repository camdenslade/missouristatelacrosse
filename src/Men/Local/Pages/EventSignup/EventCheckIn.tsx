import { useCallback, useEffect, useReducer, useRef } from "react";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";

import {
  fetchEvents,
  payExistingRegistration,
  registerForEvent,
  searchRegistrants,
} from "../../../../Global/Common/hooks/useEvents";
import usePaymentButtons from "../../../../Global/Common/hooks/usePaymentButtons";
import { apiRequest } from "../../../../Services/API";
import type { ApiEvent } from "../../../../types/api";

/**
 * Self-serve QR check-in: scan the event's code, type your name, pay right there - no
 * navigating the full event page or filling out its custom fields. If the name matches
 * someone who already registered but hasn't paid, this pays off THEIR existing
 * registration (via payExistingRegistration) instead of creating a duplicate one.
 */

type Suggestion = { registrationId: string; payerName: string; amountDue: number };
type Status = "loading" | "ready" | "not_found" | "success" | "error";

type State = {
  status: Status;
  event: ApiEvent | null;
  name: string;
  email: string;
  suggestions: Suggestion[];
  selected: Suggestion | null;
  submitting: boolean;
  errorMsg: string;
  paidOrderId: string | null;
  sendingReceipt: boolean;
  receiptSent: boolean;
};

type Action =
  | { type: "SET_EVENT"; event: ApiEvent }
  | { type: "NOT_FOUND" }
  | { type: "SET_NAME"; value: string }
  | { type: "SET_EMAIL"; value: string }
  | { type: "SET_SUGGESTIONS"; suggestions: Suggestion[] }
  | { type: "SELECT"; suggestion: Suggestion }
  | { type: "CLEAR_SELECTION" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; msg: string }
  | { type: "SUCCESS"; orderId: string }
  | { type: "SENDING_RECEIPT" }
  | { type: "RECEIPT_SENT" }
  | { type: "RECEIPT_FAILED" };

const initialState: State = {
  status: "loading",
  event: null,
  name: "",
  email: "",
  suggestions: [],
  selected: null,
  submitting: false,
  errorMsg: "",
  paidOrderId: null,
  sendingReceipt: false,
  receiptSent: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_EVENT":
      return { ...state, status: "ready", event: action.event };
    case "NOT_FOUND":
      return { ...state, status: "not_found" };
    case "SET_NAME":
      return { ...state, name: action.value, selected: null };
    case "SET_EMAIL":
      return { ...state, email: action.value };
    case "SET_SUGGESTIONS":
      return { ...state, suggestions: action.suggestions };
    case "SELECT":
      return { ...state, selected: action.suggestion, name: action.suggestion.payerName, suggestions: [] };
    case "CLEAR_SELECTION":
      return { ...state, selected: null, name: "", suggestions: [] };
    case "SUBMIT_START":
      return { ...state, submitting: true, errorMsg: "" };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, errorMsg: action.msg };
    case "SUCCESS":
      return { ...state, status: "success", submitting: false, paidOrderId: action.orderId };
    case "SENDING_RECEIPT":
      return { ...state, sendingReceipt: true };
    case "RECEIPT_SENT":
      return { ...state, sendingReceipt: false, receiptSent: true };
    case "RECEIPT_FAILED":
      return { ...state, sendingReceipt: false };
    default:
      return state;
  }
}

export default function EventCheckIn() {
  const { eventId } = useParams<{ eventId: string }>();
  const [state, dispatch] = useReducer(reducer, initialState);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!eventId) return;
    fetchEvents()
      .then((events) => {
        const match = events.find((e) => e.id === eventId);
        if (match) dispatch({ type: "SET_EVENT", event: match });
        else dispatch({ type: "NOT_FOUND" });
      })
      .catch(() => dispatch({ type: "NOT_FOUND" }));
  }, [eventId]);

  const handleNameChange = (value: string) => {
    dispatch({ type: "SET_NAME", value });
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!eventId || value.trim().length < 2) {
      dispatch({ type: "SET_SUGGESTIONS", suggestions: [] });
      return;
    }
    searchTimer.current = setTimeout(() => {
      searchRegistrants(eventId, value.trim())
        .then((suggestions) => dispatch({ type: "SET_SUGGESTIONS", suggestions }))
        .catch(() => dispatch({ type: "SET_SUGGESTIONS", suggestions: [] }));
    }, 300);
  };

  const price = state.event?.price != null ? Number(state.event.price) : 0;
  const amountDue = state.selected ? state.selected.amountDue : price;
  const isFree = amountDue <= 0;
  const canPay = state.selected
    ? true
    : state.name.trim().length > 0 && state.email.trim().length > 0;

  const handlePaymentSuccess = useCallback(
    async (captureData: { id: string }) => {
      if (!eventId) return;
      dispatch({ type: "SUBMIT_START" });
      try {
        if (state.selected) {
          await payExistingRegistration(eventId, state.selected.registrationId, captureData.id);
        } else {
          await registerForEvent(eventId, {
            paypalOrderId: captureData.id,
            payerName: state.name.trim(),
            payerEmail: state.email.trim(),
            formData: {},
          });
        }
        dispatch({ type: "SUCCESS", orderId: captureData.id });
      } catch {
        dispatch({ type: "SUBMIT_ERROR", msg: "Payment went through, but we couldn't record it. Please see someone at the table." });
      }
    },
    [eventId, state.selected, state.name, state.email]
  );

  const { ready: paymentReady } = usePaymentButtons(
    canPay && !isFree ? amountDue : null,
    "checkin-payment-buttons",
    handlePaymentSuccess as Parameters<typeof usePaymentButtons>[2],
    "pay"
  );

  const handleFreeCheckIn = async () => {
    if (!eventId || !canPay) return;
    dispatch({ type: "SUBMIT_START" });
    try {
      if (state.selected) {
        dispatch({ type: "SUCCESS", orderId: "" });
        return;
      }
      await registerForEvent(eventId, {
        payerName: state.name.trim(),
        payerEmail: state.email.trim(),
        formData: {},
      });
      dispatch({ type: "SUCCESS", orderId: "" });
    } catch {
      dispatch({ type: "SUBMIT_ERROR", msg: "Something went wrong. Please see someone at the table." });
    }
  };

  const handleSendReceipt = async () => {
    if (!state.paidOrderId) return;
    dispatch({ type: "SENDING_RECEIPT" });
    try {
      await apiRequest("/api/email/payment-confirmation", {
        method: "POST",
        json: { orderId: state.paidOrderId, kind: "event" },
      });
      dispatch({ type: "RECEIPT_SENT" });
      toast.success("Receipt sent!");
    } catch {
      dispatch({ type: "RECEIPT_FAILED" });
      toast.error("Couldn't send the receipt. Please try again.");
    }
  };

  if (state.status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (state.status === "not_found" || !state.event) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center px-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Event Not Found</h2>
        <p className="text-gray-500 text-sm">This check-in link isn't valid.</p>
      </div>
    );
  }

  const event = state.event;

  if (state.status === "success") {
    return (
      <div className="max-w-md mx-auto mt-16 px-4 text-center">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-2">You're all set!</h2>
          <p className="text-sm text-gray-500 mb-6">
            {state.selected ? state.selected.payerName : state.name} is checked in for {event.name}.
          </p>
          {state.paidOrderId && (
            <button
              onClick={handleSendReceipt}
              disabled={state.sendingReceipt || state.receiptSent}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-200 transition disabled:opacity-60"
            >
              {state.receiptSent ? "Receipt Sent" : state.sendingReceipt ? "Sending..." : "Email Me a Receipt"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-800">{event.name}</h2>
        <p className="text-sm text-gray-500 mb-5">
          {isFree && !state.selected ? "Free" : `$${amountDue.toFixed(2)}`}
          {state.selected ? " owed" : " per person"}
        </p>

        <div className="space-y-3">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Start typing your name..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
            />
            {state.suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {state.suggestions.map((s) => (
                  <button
                    key={s.registrationId}
                    onClick={() => dispatch({ type: "SELECT", suggestion: s })}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition flex justify-between items-center"
                  >
                    <span>{s.payerName}</span>
                    <span className="text-xs text-gray-400">${s.amountDue.toFixed(2)} owed</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {state.selected && (
            <div className="flex items-center justify-between bg-[#5E0009]/5 border border-[#5E0009]/15 rounded-xl px-3 py-2 text-sm">
              <span className="text-gray-700">
                Paying for <strong>{state.selected.payerName}</strong>'s existing registration
              </span>
              <button
                onClick={() => dispatch({ type: "CLEAR_SELECTION" })}
                className="text-xs text-gray-400 hover:text-gray-600 shrink-0 ml-2"
              >
                Not you?
              </button>
            </div>
          )}

          {!state.selected && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={state.email}
                onChange={(e) => dispatch({ type: "SET_EMAIL", value: e.target.value })}
                placeholder="you@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
              />
            </div>
          )}
        </div>

        {state.errorMsg && <p className="text-xs text-red-600 mt-3">{state.errorMsg}</p>}

        <div className="pt-4">
          {isFree ? (
            <button
              onClick={handleFreeCheckIn}
              disabled={!canPay || state.submitting}
              className="w-full py-3 bg-[#5E0009] text-white rounded-full font-semibold text-sm hover:bg-[#7a0012] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {state.submitting ? "Checking in..." : "Check In"}
            </button>
          ) : (
            <>
              {!canPay && (
                <p className="text-xs text-gray-400 text-center mb-2">
                  {state.selected ? "" : "Enter your name and email to pay."}
                </p>
              )}
              <div
                id="checkin-payment-buttons"
                className={canPay ? "" : "opacity-30 pointer-events-none"}
              />
              {canPay && !paymentReady && (
                <p className="text-xs text-gray-400 text-center mt-2">Loading payment options...</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

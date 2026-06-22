import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  checkTeammate,
  fetchEventBySlug,
  registerForEvent,
} from "../../../../Global/Common/hooks/useEvents";
import usePayPalButtons from "../../../../Global/Common/hooks/usePayPalButtons";
import { getProgramInfo } from "../../../../Services/programHelper";
import type { ApiEvent, ApiEventField, ApiEventTeamCheck } from "../../../../types/api";

// State

type Status = "loading" | "ready" | "not_found" | "success" | "error";

type State = {
  status: Status;
  event: ApiEvent | null;
  formValues: Record<string, string | boolean>;
  payerName: string;
  payerEmail: string;
  teammateEmails: string[];
  teamChecks: (ApiEventTeamCheck | null)[];
  teamCheckLoading: boolean[];
  submitting: boolean;
  errorMsg: string;
};

type Action =
  | { type: "SET_EVENT"; event: ApiEvent }
  | { type: "NOT_FOUND" }
  | { type: "SET_FIELD"; key: string; value: string | boolean }
  | { type: "SET_PAYER_NAME"; value: string }
  | { type: "SET_PAYER_EMAIL"; value: string }
  | { type: "SET_TEAMMATE_EMAIL_AT"; index: number; value: string }
  | { type: "SET_TEAM_CHECK_LOADING_AT"; index: number }
  | { type: "SET_TEAM_CHECK_AT"; index: number; result: ApiEventTeamCheck }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; msg: string }
  | { type: "SUCCESS" };

function init(): State {
  return {
    status: "loading",
    event: null,
    formValues: {},
    payerName: "",
    payerEmail: "",
    teammateEmails: [],
    teamChecks: [],
    teamCheckLoading: [],
    submitting: false,
    errorMsg: "",
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_EVENT": {
      const slotCount = Math.max(action.event.teamSize - 1, 0);
      return {
        ...state,
        status: "ready",
        event: action.event,
        teammateEmails: Array.from({ length: slotCount }, () => ""),
        teamChecks: Array.from({ length: slotCount }, () => null),
        teamCheckLoading: Array.from({ length: slotCount }, () => false),
      };
    }
    case "NOT_FOUND":
      return { ...state, status: "not_found" };
    case "SET_FIELD":
      return { ...state, formValues: { ...state.formValues, [action.key]: action.value } };
    case "SET_PAYER_NAME":
      return { ...state, payerName: action.value };
    case "SET_PAYER_EMAIL":
      return { ...state, payerEmail: action.value };
    case "SET_TEAMMATE_EMAIL_AT": {
      const emails = [...state.teammateEmails];
      emails[action.index] = action.value;
      const teamChecks = [...state.teamChecks];
      const teamCheckLoading = [...state.teamCheckLoading];
      teamChecks[action.index] = null;
      teamCheckLoading[action.index] = false;
      return { ...state, teammateEmails: emails, teamChecks, teamCheckLoading };
    }
    case "SET_TEAM_CHECK_LOADING_AT": {
      const loading = [...state.teamCheckLoading];
      const teamChecks = [...state.teamChecks];
      loading[action.index] = true;
      teamChecks[action.index] = null;
      return { ...state, teamCheckLoading: loading, teamChecks };
    }
    case "SET_TEAM_CHECK_AT": {
      const teamChecks = [...state.teamChecks];
      const loading = [...state.teamCheckLoading];
      teamChecks[action.index] = action.result;
      loading[action.index] = false;
      return { ...state, teamChecks, teamCheckLoading: loading };
    }
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

// Helpers

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isFormComplete(
  event: ApiEvent,
  state: State
): boolean {
  if (!state.payerName.trim() || !state.payerEmail.trim()) return false;
  for (const field of event.fields) {
    if (!field.required) continue;
    const val = state.formValues[field.id];
    if (field.type === "checkbox") {
      if (!val) return false;
    } else {
      if (!val || String(val).trim() === "") return false;
    }
  }
  return true;
}

// Main component

export default function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { base } = getProgramInfo();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Load event
  useEffect(() => {
    if (!slug) { dispatch({ type: "NOT_FOUND" }); return; }
    fetchEventBySlug(slug)
      .then((e) => dispatch({ type: "SET_EVENT", event: e }))
      .catch(() => dispatch({ type: "NOT_FOUND" }));
  }, [slug]);

  // Team-check debounce refs
  const teamCheckTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const prefillApplied = useRef(false);

  useEffect(() => {
    return () => {
      Object.values(teamCheckTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleTeammateEmailChange = (index: number, email: string) => {
    dispatch({ type: "SET_TEAMMATE_EMAIL_AT", index, value: email });
    if (!state.event || state.event.teamSize <= 1) return;
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    if (teamCheckTimers.current[index]) {
      clearTimeout(teamCheckTimers.current[index]);
    }
    teamCheckTimers.current[index] = setTimeout(async () => {
      dispatch({ type: "SET_TEAM_CHECK_LOADING_AT", index });
      try {
        const result = await checkTeammate(state.event!.id, trimmed);
        dispatch({ type: "SET_TEAM_CHECK_AT", index, result });
      } catch {
        dispatch({ type: "SET_TEAM_CHECK_AT", index, result: { found: false } });
      }
    }, 600);
  };

  useEffect(() => {
    if (!state.event || prefillApplied.current) return;
    const params = new URLSearchParams(location.search);
    const inviteEmail = params.get("teammateEmail");
    const prefillParam = params.get("prefill");
    if (prefillParam) {
      try {
        const parsed = JSON.parse(prefillParam);
        if (parsed && typeof parsed === "object") {
          for (const [key, value] of Object.entries(parsed)) {
            if (value === null || value === undefined) continue;
            if (typeof value === "object") continue;
            const safeValue =
              typeof value === "boolean" ? value : String(value);
            dispatch({ type: "SET_FIELD", key, value: safeValue });
          }
        }
      } catch {
        // ignore malformed prefill data
      }
    }
    if (inviteEmail && state.event.teamSize > 1) {
      handleTeammateEmailChange(0, inviteEmail);
    }
    prefillApplied.current = true;
  }, [handleTeammateEmailChange, location.search, state.event]);

  // PayPal integration
  const isFree = !state.event?.price || Number(state.event.price) <= 0;
  const canPay = state.event && isFormComplete(state.event, state);

  const collectTeammateEmails = () =>
    Array.from(
      new Set(
        state.teammateEmails
          .map((email) => email.trim())
          .filter((email) => email !== "")
      )
    );

  const handleSuccess = useCallback(
    async (captureData: { id: string; payer?: { email_address?: string } }) => {
      if (!state.event) return;
      dispatch({ type: "SUBMIT_START" });
      try {
        await registerForEvent(state.event.id, {
          paypalOrderId: captureData.id,
          payerName: state.payerName.trim(),
          payerEmail: state.payerEmail.trim(),
          formData: state.formValues,
          teammateEmails: collectTeammateEmails(),
          teamId: state.teamChecks.find((check) => check?.found)?.teamId ?? undefined,
        });
        dispatch({ type: "SUCCESS" });
      } catch {
        dispatch({ type: "SUBMIT_ERROR", msg: "Registration failed after payment. Please contact us." });
      }
    },
    [state]
  );

  const { paypalLoaded } = usePayPalButtons(
    canPay && !isFree ? Number(state.event?.price) : null,
    "event-paypal-buttons",
    handleSuccess as Parameters<typeof usePayPalButtons>[2],
    "pay"
  );

  const handleFreeSubmit = async () => {
    if (!state.event) return;
    dispatch({ type: "SUBMIT_START" });
    try {
      await registerForEvent(state.event.id, {
        payerName: state.payerName.trim(),
        payerEmail: state.payerEmail.trim(),
        formData: state.formValues,
        teammateEmails: collectTeammateEmails(),
        teamId: state.teamChecks.find((check) => check?.found)?.teamId ?? undefined,
      });
      dispatch({ type: "SUCCESS" });
    } catch {
      dispatch({ type: "SUBMIT_ERROR", msg: "Registration failed. Please try again." });
    }
  };

  // Render states

  if (state.status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-pulse text-gray-500">Loading event...</div>
      </div>
    );
  }

  if (state.status === "not_found" || !state.event) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <p className="text-gray-500 text-lg mb-4">Event not found.</p>
        <button
          onClick={() => navigate(`${base}/event-signup`)}
          className="text-[#5E0009] underline"
        >
          Back to events
        </button>
      </div>
    );
  }

  if (state.status === "success") {
    return <SuccessScreen event={state.event} onBack={() => navigate(`${base}/event-signup`)} />;
  }

  const event = state.event;
  const isTeam = event.teamSize > 1;
  const matchingTeamCheck = state.teamChecks.find((check) => check?.found);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Back link */}
      <button
        onClick={() => navigate(`${base}/event-signup`)}
        className="text-sm text-[#5E0009] hover:underline mb-6 flex items-center gap-1"
      >
        Back to events
      </button>

      {/* Event header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          {isTeam && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {event.teamSize}-Person Team Event
            </span>
          )}
        </div>
        {event.description && (
          <p className="text-gray-500 text-sm mb-2">{event.description}</p>
        )}
        <div className="text-sm text-gray-600 space-y-0.5">
          <div><span className="font-medium">Start:</span> {formatDate(event.startTime)}</div>
          {event.endTime && <div><span className="font-medium">End:</span> {formatDate(event.endTime)}</div>}
          {event.address && (
            <div>
              <span className="font-medium">Location:</span>{" "}
              {event.address}
            </div>
          )}
          <div>
            <span className="font-medium">Entry:</span>{" "}
            {isFree ? "Free" : `$${Number(event.price).toFixed(2)} per person`}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Team pre-fill banner */}
        {isTeam && matchingTeamCheck?.found && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
            <strong>{matchingTeamCheck?.registrantName}</strong> ({matchingTeamCheck?.registrantEmail}) has
            already registered and listed you as a teammate. You will be added to their team upon
            completing registration.
          </div>
        )}

        {/* Your info */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Your Info
          </legend>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={state.payerName}
              onChange={(e) => dispatch({ type: "SET_PAYER_NAME", value: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              value={state.payerEmail}
              onChange={(e) => dispatch({ type: "SET_PAYER_EMAIL", value: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
              placeholder="you@example.com"
            />
          </div>
        </fieldset>

        {/* Teammate emails (team events only) */}
        {isTeam && !matchingTeamCheck?.found && (
          <div className="space-y-3">
            {Array.from({ length: event.teamSize - 1 }, (_, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {event.teamSize > 2 ? `Teammate ${i + 1} Email` : "Teammate Email"}
                  <span className="ml-1 text-xs text-gray-400 font-normal">— optional</span>
                </label>
                <input
                  type="email"
                  value={state.teammateEmails[i] ?? ""}
                  onChange={(e) => handleTeammateEmailChange(i, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
                  placeholder="teammate@example.com"
                />
                {state.teamCheckLoading[i] && (
                  <p className="text-xs text-gray-400 mt-1">Checking for existing registration...</p>
                )}
                {!state.teamCheckLoading[i] && state.teamChecks[i] && !state.teamChecks[i]?.found && state.teammateEmails[i] && (
                  <p className="text-xs text-gray-400 mt-1">
                    No existing registration found — your teammate will be notified when they sign up.
                  </p>
                )}
                {state.teamChecks[i]?.found && (
                  <p className="text-xs text-blue-700 mt-1">
                    <strong>{state.teamChecks[i]?.registrantName}</strong> ({state.teamChecks[i]?.registrantEmail}) has
                    already registered and listed you as a teammate. You will be added to their team once you finish
                    registering.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Dynamic form fields */}
        {event.fields.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Additional Info
            </legend>
            {event.fields.map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={state.formValues[field.id]}
                onChange={(val) => dispatch({ type: "SET_FIELD", key: field.id, value: val })}
              />
            ))}
          </fieldset>
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
              {state.submitting ? "Submitting..." : "Complete Registration (Free)"}
            </button>
          ) : (
            <>
              {!canPay && (
                <p className="text-xs text-gray-400 text-center mb-2">
                  Fill in all required fields to enable payment.
                </p>
              )}
              <div
                id="event-paypal-buttons"
                className={canPay ? "" : "opacity-30 pointer-events-none"}
              />
              {canPay && !paypalLoaded && (
                <p className="text-xs text-gray-400 text-center mt-2">Loading payment options...</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Dynamic field renderer

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: ApiEventField;
  value: string | boolean | undefined;
  onChange: (val: string | boolean) => void;
}) {
  const labelText = `${field.label}${field.required ? " *" : ""}`;
  const baseInput = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]";

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-[#5E0009]"
        />
        {labelText}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{labelText}</label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
        >
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{labelText}</label>
      <input
        type={field.type === "number" ? "number" : "text"}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={baseInput}
      />
    </div>
  );
}

// Success screen

function SuccessScreen({ event, onBack }: { event: ApiEvent; onBack: () => void }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">

      <h2 className="text-2xl font-bold text-gray-900 mb-2">You're registered!</h2>
      <p className="text-gray-500 mb-1">
        You have successfully registered for <strong>{event.name}</strong>.
      </p>
      {event.teamSize > 1 && (
        <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-2 mt-3">
          Your {event.teamSize > 2 ? "teammates" : "teammate"} will be notified to complete their
          registration. The team will show as complete once everyone has paid.
        </p>
      )}
      <button
        onClick={onBack}
        className="mt-6 px-6 py-2 bg-[#5E0009] text-white rounded-lg font-semibold hover:bg-[#7a0010] transition-colors"
      >
        Back to Events
      </button>
    </div>
  );
}

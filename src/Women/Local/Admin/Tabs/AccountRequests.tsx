import { QRCodeSVG } from "qrcode.react";
import { useEffect, useReducer, useState } from "react";
import toast from "react-hot-toast";

import { apiRequest } from "../../../../Services/API";
import type { ApiUser, Role } from "../../../../types/api";

type Request = { id: string; displayName: string; email: string; program: string };
type PlayerCandidate = { id: string; name: string; season: string };

type State = {
  requests: Request[];
  loading: boolean;
  users: ApiUser[];
  usersLoading: boolean;
};

type Action =
  | { type: "SET_REQUESTS"; requests: Request[] }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "REMOVE_REQUEST"; id: string }
  | { type: "SET_USERS"; users: ApiUser[] }
  | { type: "SET_USERS_LOADING"; value: boolean };

const initialState: State = {
  requests: [],
  loading: true,
  users: [],
  usersLoading: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_REQUESTS": return { ...state, requests: action.requests, loading: false };
    case "SET_LOADING": return { ...state, loading: action.value };
    case "REMOVE_REQUEST": return { ...state, requests: state.requests.filter((r) => r.id !== action.id) };
    case "SET_USERS": return { ...state, users: action.users, usersLoading: false };
    case "SET_USERS_LOADING": return { ...state, usersLoading: action.value };
    default: return state;
  }
}

const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
const program = isWomenSite ? "women" : "men";
const programLabel = isWomenSite ? "Women's" : "Men's";

const ROLES: Array<Role | "all"> = ["all", "admin", "player", "parent", "alumni", "coach", "user"];
const ASSIGNABLE_ROLES: Role[] = ["user", "player", "parent", "alumni", "coach", "admin"];

export default function ManageAccountRequests() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { requests, loading, users, usersLoading } = state;

  // Player onboarding form
  const [onboardName, setOnboardName] = useState("");
  const [onboardEmail, setOnboardEmail] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [checkingOnboard, setCheckingOnboard] = useState(false);
  const [onboardCandidates, setOnboardCandidates] = useState<PlayerCandidate[]>([]);

  // Role picked for each pending request, keyed by request id
  const [approveRoles, setApproveRoles] = useState<Record<string, Role>>({});

  // Alumni onboarding form
  const [alumniName, setAlumniName] = useState("");
  const [alumniEmail, setAlumniEmail] = useState("");
  const [onboardingAlumni, setOnboardingAlumni] = useState(false);

  // User list filter
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

  const fetchRequests = async () => {
    dispatch({ type: "SET_LOADING", value: true });
    try {
      const data = await apiRequest<Request[]>(`/api/account-requests?program=${program}`);
      dispatch({ type: "SET_REQUESTS", requests: data });
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to load requests");
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  const fetchUsers = async () => {
    dispatch({ type: "SET_USERS_LOADING", value: true });
    try {
      const data = await apiRequest<ApiUser[]>(`/api/users?program=${program}`);
      dispatch({ type: "SET_USERS", users: data });
    } catch {
      dispatch({ type: "SET_USERS_LOADING", value: false });
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchUsers();
  }, []);

  const approveRequest = async (id: string) => {
    const role = approveRoles[id] || "user";
    dispatch({ type: "REMOVE_REQUEST", id });
    try {
      await apiRequest(`/api/account-requests/${id}/approve?program=${program}&role=${role}`, { method: "POST", parseAs: "text" });
      toast.success(`Request approved as ${role}. Invite sent.`);
      fetchUsers();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to approve");
      fetchRequests();
    }
  };

  const rejectRequest = async (id: string) => {
    dispatch({ type: "REMOVE_REQUEST", id });
    try {
      await apiRequest(`/api/account-requests/${id}?program=${program}`, { method: "DELETE", parseAs: "text" });
      toast.success("Request deleted.");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete");
      fetchRequests();
    }
  };

  const submitOnboard = async (linkPlayerId?: string) => {
    const email = onboardEmail.trim().toLowerCase();
    const name = onboardName.trim();
    setOnboarding(true);
    try {
      await apiRequest("/api/onboard/player", { method: "POST", json: { email, displayName: name, program, linkPlayerId } });
      toast.success(`Invite sent to ${email}!`);
      setOnboardName("");
      setOnboardEmail("");
      setOnboardCandidates([]);
      fetchUsers();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to send invite.");
    } finally {
      setOnboarding(false);
    }
  };

  const handleOnboard = async () => {
    const email = onboardEmail.trim().toLowerCase();
    const name = onboardName.trim();
    if (!email || !name) { toast.error("Enter a name and email."); return; }
    setCheckingOnboard(true);
    try {
      const candidates = await apiRequest<PlayerCandidate[]>(
        `/api/players/search-candidates?name=${encodeURIComponent(name)}`
      );
      if (candidates.length > 0) {
        setOnboardCandidates(candidates);
      } else {
        await submitOnboard();
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to check roster.");
    } finally {
      setCheckingOnboard(false);
    }
  };

  const handleOnboardAlumni = async () => {
    const email = alumniEmail.trim().toLowerCase();
    const name = alumniName.trim();
    if (!email || !name) { toast.error("Enter a name and email."); return; }
    setOnboardingAlumni(true);
    try {
      await apiRequest("/api/onboard/alumni", { method: "POST", json: { email, displayName: name, program } });
      toast.success(`Alumni invite sent to ${email}!`);
      setAlumniName("");
      setAlumniEmail("");
      fetchUsers();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to send alumni invite.");
    } finally {
      setOnboardingAlumni(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === "all") return true;
    const r = u.roles?.[program as "men" | "women"];
    return r === roleFilter;
  });

  return (
    <div className="max-w-6xl mx-auto mt-4 animate-fadeIn grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 items-start">

      {/* Left column: admin action cards, stacked */}
      <div className="space-y-6 lg:sticky lg:top-4">

        {/* Onboard New Player */}
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-1">Onboard New Player</h2>
          <p className="text-xs text-gray-500 mb-4">
            Creates an account and sends a "Set your password" invite email directly. No approval step needed.
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Full name"
              value={onboardName}
              onChange={(e) => setOnboardName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
            />
            <input
              type="email"
              placeholder="Email address"
              value={onboardEmail}
              onChange={(e) => setOnboardEmail(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
            />
            <button
              onClick={handleOnboard}
              disabled={onboarding || checkingOnboard}
              className="px-5 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-medium hover:bg-[#7a0012] transition disabled:opacity-60"
            >
              {checkingOnboard ? "Checking roster…" : onboarding ? "Sending…" : "Send Invite"}
            </button>

            {onboardCandidates.length > 0 && (
              <div className="mt-1 border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-800 font-medium">
                  Found possible roster match{onboardCandidates.length > 1 ? "es" : ""} for "{onboardName.trim()}":
                </p>
                {onboardCandidates.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded px-2 py-1.5">
                    <span className="text-xs text-gray-700">
                      {c.name} <span className="text-gray-400">({c.season})</span>
                    </span>
                    <button
                      onClick={() => submitOnboard(c.id)}
                      disabled={onboarding}
                      className="px-2 py-1 text-xs bg-[#5E0009] text-white rounded hover:bg-[#7a0012] transition disabled:opacity-60"
                    >
                      Link to this player
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => submitOnboard()}
                  disabled={onboarding}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 transition disabled:opacity-60"
                >
                  None of these - create new player
                </button>
                <button
                  onClick={() => setOnboardCandidates([])}
                  className="w-full px-2 py-1 text-xs text-gray-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Onboard Alumni */}
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-1">Onboard Alumni</h2>
          <p className="text-xs text-gray-500 mb-4">
            Creates an alumni account and sends a thank-you invite with instructions to view the program budget.
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Full name"
              value={alumniName}
              onChange={(e) => setAlumniName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
            />
            <input
              type="email"
              placeholder="Email address"
              value={alumniEmail}
              onChange={(e) => setAlumniEmail(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
            />
            <button
              onClick={handleOnboardAlumni}
              disabled={onboardingAlumni}
              className="px-5 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition disabled:opacity-60"
            >
              {onboardingAlumni ? "Sending…" : "Send Alumni Invite"}
            </button>
          </div>
        </section>

        {/* Alumni Self-Signup QR Code */}
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-1">Alumni Self-Signup Link</h2>
          <p className="text-xs text-gray-500 mb-4">
            Share this QR code or link. Alumni fill out their own name and email and get an invite automatically.
          </p>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
              <QRCodeSVG
                value={`https://missouristatelacrosse.com/alumni-join?program=${program}`}
                size={140}
                fgColor="#5E0009"
              />
            </div>
            <div className="w-full min-w-0">
              <p className="text-xs text-gray-500 mb-2">Direct link:</p>
              <code className="block text-xs bg-white border border-gray-200 rounded px-3 py-2 break-all text-gray-700">
                {`https://missouristatelacrosse.com/alumni-join?program=${program}`}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://missouristatelacrosse.com/alumni-join?program=${program}`);
                  toast.success("Link copied!");
                }}
                className="mt-3 w-full px-4 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              >
                Copy Link
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Right column: pending requests + team members */}
      <div className="space-y-10 min-w-0">

        {/* Pending Account Requests */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Pending Requests <span className="text-[#5E0009]">{programLabel}</span>
          </h2>

          {loading && <p className="text-gray-500 animate-pulse">Loading requests…</p>}

          {!loading && requests.length === 0 && (
            <p className="text-gray-400 text-sm">No pending requests.</p>
          )}

          <ul className="divide-y divide-gray-100">
            {requests.map((req) => (
              <li key={req.id} className="py-4 flex items-center justify-between hover:bg-gray-50 rounded-lg px-2 transition">
                <div>
                  <p className="font-semibold text-gray-900">{req.displayName}</p>
                  <p className="text-gray-500 text-sm">{req.email}</p>
                  {req.program && (
                    <p className="text-xs text-gray-400">Program: {req.program.toUpperCase()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={approveRoles[req.id] || "user"}
                    onChange={(e) =>
                      setApproveRoles((prev) => ({ ...prev, [req.id]: e.target.value as Role }))
                    }
                    className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                  <button onClick={() => approveRequest(req.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition">
                    Approve
                  </button>
                  <button onClick={() => rejectRequest(req.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Team Members */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Team Members <span className="text-[#5E0009]">{programLabel}</span>
            </h2>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | "all")}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r === "all" ? "All Roles" : r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>

          {usersLoading && <p className="text-gray-500 animate-pulse text-sm">Loading users…</p>}

          {!usersLoading && filteredUsers.length === 0 && (
            <p className="text-gray-400 text-sm">No users found.</p>
          )}

          <ul className="divide-y divide-gray-100">
            {filteredUsers.map((u) => {
              const role = u.roles?.[program as "men" | "women"];
              return (
                <li key={u.uid} className="py-3 flex items-center justify-between hover:bg-gray-50 rounded-lg px-2 transition">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{u.displayName || " - "}</p>
                    <p className="text-gray-500 text-xs">{u.email || " - "}</p>
                  </div>
                  {role && (
                    <span className="text-xs text-gray-500 capitalize">{role}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

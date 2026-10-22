import { useEffect, useMemo, useReducer, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";

import OrderForms from "./components/OrderForms";
import ParentPlayerSelect from "./components/ParentPlayerSelect";
import PlayerPaymentDetails from "./components/PlayerPaymentDetails";
import TodoList from "./components/TodoList";
import usePlayers from "./hooks/findPlayers";
import usePaymentButtons from "../../../../Global/Common/hooks/usePaymentButtons";
import { resolvePaymentProvider } from "../../../../Global/Common/hooks/usePaymentProvider";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import type { ApiParentRecord, ApiPlayer, ApiUser, DuesPayment, ParentLink, Program, Role } from "../../../../types/api";
import { fetchActiveSeasonCode, getSeasonValue, displaySeasonLabel } from "../Roster/hooks/seasonUtils";

type PortalTab = "pay" | "todos" | "orders" | "family" | "history";

type PortalState = {
  selectedPlayerId: string;
  selectedPlayer: ApiPlayer | null;
  customAmount: string;
  confirmedAmount: number | null;
  addParentEmail: string;
  addParentName: string;
  message: string;
};

type PortalAction =
  | { type: "SET_FIELD"; field: keyof PortalState; value: PortalState[keyof PortalState] }
  | { type: "SET_SELECTED_PLAYER"; player: ApiPlayer | null };

const initialState: PortalState = {
  selectedPlayerId: "",
  selectedPlayer: null,
  customAmount: "",
  confirmedAmount: null,
  addParentEmail: "",
  addParentName: "",
  message: "",
};

function portalReducer(state: PortalState, action: PortalAction): PortalState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_SELECTED_PLAYER":
      return {
        ...state,
        selectedPlayerId: action.player?.id || "",
        selectedPlayer: action.player || null,
      };
    default:
      return state;
  }
}

export default function Portal() {
  const { user, roles, loading } = useAuth();
  const [state, dispatch] = useReducer(portalReducer, initialState);
  // A shared order form link (/portal?form=<id>, copied from Manage Order Forms) jumps to that form.
  const [searchParams] = useSearchParams();
  const linkedFormId = searchParams.get("form");
  const [activeTab, setActiveTab] = useState<PortalTab>(linkedFormId ? "orders" : "pay");
  const [linkedPlayerId, setLinkedPlayerId] = useState<string>("");
  const [linkedPlayer, setLinkedPlayer] = useState<ApiPlayer | null>(null);
  const [ledger, setLedger] = useState<DuesPayment[]>([]);

  const [currentSeason, setCurrentSeason] = useState(getSeasonValue());
  useEffect(() => {
    fetchActiveSeasonCode().then(setCurrentSeason);
  }, []);

  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program: Program = isWomenSite ? "women" : "men";

  const programRole = (roles?.[program] || "") as Role | "";
  const canAccess = ["admin", "player", "parent"].includes(programRole);

  const paymentProvider = resolvePaymentProvider();

  const { players, loading: loadingPlayers } = usePlayers();

  const seasonPlayers = useMemo(() => {
    if (!players?.length) return [];
    const filtered = players.filter((p) => p.season === currentSeason);
    return filtered.length ? filtered : players;
  }, [players, currentSeason]);

  const parentLinkedPlayers = useMemo(() => {
    if (programRole !== "parent" || !user) return seasonPlayers;
    return seasonPlayers.filter((p) =>
      (p.parents || []).some(
        (link) =>
          (link.uid && link.uid === user.uid) ||
          (link.email && user.email && link.email.toLowerCase() === user.email.toLowerCase())
      )
    );
  }, [seasonPlayers, programRole, user]);

  const fetchLedger = async (playerId: string) => {
    const entries = await apiRequest<DuesPayment[]>(`/api/dues-payments?playerId=${playerId}`).catch(() => []);
    setLedger(entries ?? []);
  };

  const handlePaymentSuccess = async (captureData: { id: string }, amount: number) => {
    const player = state.selectedPlayer;
    if (!player) return;
    await apiRequest("/api/dues-payments", {
      method: "POST",
      json: {
        playerId: player.id,
        amount,
        type: "PAYMENT",
        note: paymentProvider === "stripe" ? "Stripe payment" : "PayPal payment",
        paidByUid: user?.uid ?? null,
        payPalOrderId: captureData.id,
      },
    });
    const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
    if (refreshed?.id) {
      dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
    }
    await fetchLedger(player.id);
    dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: null });
    dispatch({ type: "SET_FIELD", field: "customAmount", value: "" });
    toast.success(`Payment of $${amount.toFixed(2)} recorded!`);
  };

  usePaymentButtons(state.confirmedAmount, "paypal-payment-buttons", handlePaymentSuccess, "pay", "dues");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const userRecord = await apiRequest<ApiUser>(`/api/users/${user.uid}`).catch(() => null);
      if (userRecord?.playerId) setLinkedPlayerId(userRecord.playerId || "");
    })();
  }, [user]);

  useEffect(() => {
    if (!linkedPlayerId) return;
    (async () => {
      const player = await apiRequest<ApiPlayer>(`/api/players/${linkedPlayerId}`).catch(() => null);
      if (player?.id) {
        setLinkedPlayer(player);
        dispatch({ type: "SET_SELECTED_PLAYER", player });
      }
    })();
  }, [linkedPlayerId]);

  useEffect(() => {
    if (state.selectedPlayer || !seasonPlayers.length) return;

    let match: ApiPlayer | null = null;
    if (linkedPlayer) match = linkedPlayer;
    if (!match && programRole === "parent" && parentLinkedPlayers.length > 0) match = parentLinkedPlayers[0];

    if (match) dispatch({ type: "SET_SELECTED_PLAYER", player: match });
  }, [seasonPlayers, parentLinkedPlayers, state.selectedPlayer, programRole, linkedPlayer]);

  useEffect(() => {
    if (!state.selectedPlayerId) return;
    const p = seasonPlayers.find((x) => x.id === state.selectedPlayerId) || null;
    if (p && p !== state.selectedPlayer) {
      dispatch({ type: "SET_SELECTED_PLAYER", player: p });
    }
  }, [state.selectedPlayerId, seasonPlayers, state.selectedPlayer]);

  useEffect(() => {
    if (state.selectedPlayer?.id) fetchLedger(state.selectedPlayer.id);
  }, [state.selectedPlayer?.id]);

  const handleAddParent = async () => {
    dispatch({ type: "SET_FIELD", field: "message", value: "" });
    const email = (state.addParentEmail || "").toLowerCase().trim();
    const parentName = (state.addParentName || "").trim();
    const player = state.selectedPlayer;
    if (!email || !parentName || !player) {
      dispatch({ type: "SET_FIELD", field: "message", value: "Please enter the parent's name and email." });
      return;
    }

    const existingParents: ParentLink[] = Array.isArray(player.parents) ? player.parents : [];
    if (existingParents.some((p) => (p.email || "").toLowerCase() === email)) {
      dispatch({ type: "SET_FIELD", field: "message", value: "Parent already linked." });
      return;
    }

    try {
      await apiRequest(`/api/onboard/parent`, {
        method: "POST",
        json: { email, parentName, program, playerId: player.id },
      });

      const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
      if (refreshed?.id) {
        dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
      }
      dispatch({ type: "SET_FIELD", field: "addParentEmail", value: "" });
      dispatch({ type: "SET_FIELD", field: "addParentName", value: "" });
      dispatch({ type: "SET_FIELD", field: "message", value: "Parent linked and invite sent!" });
    } catch {
      dispatch({ type: "SET_FIELD", field: "message", value: "Failed to link parent." });
    }
  };

  const handleLinkExistingParent = async () => {
    dispatch({ type: "SET_FIELD", field: "message", value: "" });
    const email = (state.addParentEmail || "").toLowerCase().trim();
    const player = state.selectedPlayer;
    if (!email || !player) {
      dispatch({ type: "SET_FIELD", field: "message", value: "Please enter a parent email." });
      return;
    }

    const existingParents: ParentLink[] = Array.isArray(player.parents) ? player.parents : [];
    if (existingParents.some((p) => (p.email || "").toLowerCase() === email)) {
      dispatch({ type: "SET_FIELD", field: "message", value: "Parent already linked." });
      return;
    }

    try {
      await apiRequest(`/api/onboard/link-existing-parent`, {
        method: "POST",
        json: { parentEmail: email, program, playerId: player.id },
      });

      const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
      if (refreshed?.id) {
        dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
      }
      dispatch({ type: "SET_FIELD", field: "addParentEmail", value: "" });
      dispatch({ type: "SET_FIELD", field: "message", value: "Parent linked." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to link parent.";
      dispatch({
        type: "SET_FIELD",
        field: "message",
        value: msg.includes("No existing account found") ? msg : "Failed to link parent.",
      });
    }
  };

  const handleRemoveParent = async (emailToRemove: string) => {
    const player = state.selectedPlayer;
    if (!player) return;

    try {
      const existingParents: ParentLink[] = Array.isArray(player.parents) ? player.parents : [];
      const parentToRemove = existingParents.find((p) => p.email === emailToRemove);
      if (!parentToRemove) {
        dispatch({ type: "SET_FIELD", field: "message", value: "Parent not found on this player." });
        return;
      }

      const updatedParents = existingParents.filter((p) => p.email !== emailToRemove);
      await apiRequest(`/api/players/${player.id}`, {
        method: "PUT",
        json: { parents: updatedParents },
      });

      if (parentToRemove.uid) {
        const parentRecord = await apiRequest<ApiParentRecord>(`/api/parents/${parentToRemove.uid}`).catch(() => null);
        const updated = (parentRecord?.linkedPlayers || []).filter(
          (id) => id !== player.id && id !== player.profileId
        );
        await apiRequest(`/api/parents/${parentToRemove.uid}`, {
          method: "PUT",
          json: { email: parentRecord?.email || parentToRemove.email, linkedPlayers: updated },
        });
      }

      const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
      if (refreshed?.id) {
        dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
      }
      dispatch({ type: "SET_FIELD", field: "message", value: `Removed ${emailToRemove} successfully.` });
    } catch {
      dispatch({ type: "SET_FIELD", field: "message", value: "Failed to remove parent." });
    }
  };

  const handleConfirm = () => {
    const val = parseFloat(state.customAmount);
    if (isNaN(val) || val <= 0) { toast.error("Please enter a valid amount."); return; }
    const balance = Number(state.selectedPlayer?.balance ?? 0);
    if (balance > 0 && val > balance) {
      toast.error(`Amount cannot exceed your balance of $${balance.toFixed(2)}.`);
      return;
    }
    dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: val });
  };

  if (loading) return <p className="text-gray-600 animate-pulse px-4 py-8">Checking permissions...</p>;

  if (!user || !canAccess)
    return (
      <div className="max-w-3xl mx-auto text-center py-20 px-4">
        <h2 className="text-3xl font-bold text-[#5E0009] mb-4">Access Restricted</h2>
        <p className="text-gray-700">The Portal is available to team players and parents only.</p>
      </div>
    );

  const player = state.selectedPlayer;
  const balance = Number(player?.balance ?? 0);
  const isPlayerView = programRole === "player" || (programRole === "admin" && !!linkedPlayer);
  const tabs: Array<{ id: PortalTab; label: string }> = [
    { id: "pay", label: "Pay Dues" },
    ...(isPlayerView ? [{ id: "todos" as PortalTab, label: "To-Dos" }, { id: "orders" as PortalTab, label: "Order Forms" }] : []),
    { id: "family", label: "Family" },
    { id: "history", label: "History" },
  ];
  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : "pay";
  const quickAmounts = [
    ...(balance > 0 ? [{ label: `Full balance ($${balance.toFixed(2)})`, value: balance }] : []),
    ...[50, 100].filter((v) => balance <= 0 || v < balance).map((v) => ({ label: `$${v}`, value: v })),
  ];

  // The Portal is always the player's own view; balance adjustments, payment references, and
  // parent removal stay on Payments > Manage even when the viewer is an admin.
  const detailsProps = {
    userRole: programRole === "admin" ? "player" : programRole,
    selectedPlayer: player,
    addParentEmail: state.addParentEmail,
    setAddParentEmail: (val: string) => dispatch({ type: "SET_FIELD", field: "addParentEmail", value: val }),
    addParentName: state.addParentName,
    setAddParentName: (val: string) => dispatch({ type: "SET_FIELD", field: "addParentName", value: val }),
    handleAddParent,
    handleLinkExistingParent,
    handleRemoveParent,
    message: state.message,
    customAmount: state.customAmount,
    setCustomAmount: (val: string) => dispatch({ type: "SET_FIELD", field: "customAmount", value: val }),
    ledger,
    onAdminAdjust: async () => {},
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-left">
      {loadingPlayers ? (
        <p className="text-gray-600 animate-pulse text-center py-16">Loading payment data...</p>
      ) : !player ? (
        <div className="text-center bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
          {programRole === "parent" && parentLinkedPlayers.length > 1 && (
            <div className="flex justify-center">
              <ParentPlayerSelect
                players={parentLinkedPlayers}
                selectedPlayerId={state.selectedPlayerId}
                setSelectedPlayerId={(id) => dispatch({ type: "SET_FIELD", field: "selectedPlayerId", value: id })}
              />
            </div>
          )}
          <h3 className="text-xl font-extrabold uppercase text-gray-900 mb-2">No Player Linked</h3>
          <p className="text-gray-600 mb-4">
            We couldn't find any player data connected to your account for the{" "}
            <span className="font-semibold">{displaySeasonLabel(currentSeason)}</span> season.
          </p>
          <p className="text-gray-700 mb-6">
            {programRole === "parent"
              ? "If you're a parent, please contact your coach to confirm that your email is linked to your player's account."
              : "If you're a player, verify that your account is linked to a valid roster entry."}
          </p>
          <a
            href="/"
            className="inline-block bg-[#5E0009] text-white px-6 py-2.5 rounded-full font-semibold hover:bg-[#7a0012] transition shadow-sm"
          >
            Return Home
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl overflow-hidden shadow-lg bg-gradient-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white">
            <div className="px-6 py-6 md:px-8 md:py-7 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <img src="/missouri-state-white.png" alt="Mo State" className="h-14 w-14 md:h-16 md:w-16 object-contain shrink-0 drop-shadow" />
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                    Player Portal · {displaySeasonLabel(currentSeason)}
                  </p>
                  <h1 className="text-2xl md:text-3xl font-extrabold uppercase leading-tight break-words">
                    {player.name || "Player"}
                  </h1>
                </div>
              </div>
              <div className="md:text-right">
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Balance</p>
                <p className="text-3xl md:text-4xl font-extrabold tabular-nums">${balance.toFixed(2)}</p>
                <span
                  className={`mt-1 inline-block text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${
                    balance > 0 ? "bg-white text-[#5E0009]" : "bg-green-500/20 text-green-100"
                  }`}
                >
                  {balance > 0 ? "Balance due" : "Paid up"}
                </span>
              </div>
            </div>
            {programRole === "parent" && parentLinkedPlayers.length > 1 && (
              <div className="px-6 md:px-8 pb-5 [&_label]:text-white/80">
                <ParentPlayerSelect
                  players={parentLinkedPlayers}
                  selectedPlayerId={state.selectedPlayerId}
                  setSelectedPlayerId={(id) => dispatch({ type: "SET_FIELD", field: "selectedPlayerId", value: id })}
                />
              </div>
            )}
          </section>

          <nav className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 md:mx-0 md:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id !== "pay") dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: null });
                  setActiveTab(tab.id);
                }}
                className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  currentTab === tab.id
                    ? "bg-[#5E0009] text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-[#5E0009]/40 hover:text-[#5E0009]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="animate-fadeIn">
            {currentTab === "pay" && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-extrabold uppercase text-gray-900">Make a Payment</h2>
                  <p className="text-sm text-gray-500">
                    {balance > 0
                      ? "Pay all or part of your balance. Payments post to your account right away."
                      : "You're all paid up. You can still make a payment toward future dues."}
                  </p>
                </div>
                {quickAmounts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {quickAmounts.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => {
                          dispatch({ type: "SET_FIELD", field: "customAmount", value: q.value.toFixed(2) });
                          dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: null });
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                          Number(state.customAmount) === q.value
                            ? "bg-[#5E0009] border-[#5E0009] text-white"
                            : "bg-white border-gray-200 text-gray-700 hover:border-[#5E0009]/40 hover:text-[#5E0009]"
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter amount"
                      value={state.customAmount}
                      onChange={(e) => {
                        dispatch({ type: "SET_FIELD", field: "customAmount", value: e.target.value });
                        dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: null });
                      }}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl pl-8 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
                    />
                  </div>
                  <button
                    onClick={handleConfirm}
                    className="inline-flex items-center justify-center bg-[#5E0009] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm"
                  >
                    {state.confirmedAmount ? "Update Amount" : "Continue to Payment"}
                  </button>
                </div>
                {state.confirmedAmount && <div id="paypal-payment-buttons" className="w-full pt-2" />}
              </div>
            )}

            {currentTab === "todos" && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6">
                <TodoList playerId={player.id} season={currentSeason} hideHeading emptyMessage="Nothing on your list right now." />
              </div>
            )}

            {currentTab === "orders" && (
              <OrderForms playerId={player.id} focusFormId={linkedFormId} hideHeading emptyMessage="No order forms are open right now." />
            )}

            {currentTab === "family" && (
              <div className="space-y-4">
                <PlayerPaymentDetails {...detailsProps} sections={["family"]} />
                {programRole === "parent" && (player.parents || []).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No parents linked yet.</p>
                )}
              </div>
            )}

            {currentTab === "history" && (
              <PlayerPaymentDetails {...detailsProps} sections={["history"]} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

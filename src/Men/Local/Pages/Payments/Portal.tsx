import { useEffect, useMemo, useReducer, useState } from "react";
import toast from "react-hot-toast";

import ParentPlayerSelect from "./components/ParentPlayerSelect";
import PaymentCards from "./components/PaymentCards";
import PlayerPaymentDetails from "./components/PlayerPaymentDetails";
import usePlayers from "./hooks/findPlayers";
import usePaymentButtons from "../../../../Global/Common/hooks/usePaymentButtons";
import { resolvePaymentProvider } from "../../../../Global/Common/hooks/usePaymentProvider";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import type { ApiParentRecord, ApiPlayer, ApiUser, DuesPayment, ParentLink, Program, Role } from "../../../../types/api";
import { fetchActiveSeasonCode, getSeasonValue, displaySeasonLabel } from "../Roster/hooks/seasonUtils";

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-left">
      <div className="mb-8">
        <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
          <span className="h-px w-6 bg-[#5E0009]/40" />
          Team Dues
          <span className="h-px w-6 bg-[#5E0009]/40" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Portal <span className="text-[#5E0009]">{displaySeasonLabel(currentSeason)}</span>
        </h1>
      </div>

      {loadingPlayers ? (
        <p className="text-gray-600 animate-pulse">Loading payment data...</p>
      ) : (
        <div className="space-y-8">
          {programRole === "parent" && (
            <ParentPlayerSelect
              players={parentLinkedPlayers}
              selectedPlayerId={state.selectedPlayerId}
              setSelectedPlayerId={(id) =>
                dispatch({ type: "SET_FIELD", field: "selectedPlayerId", value: id })
              }
            />
          )}

          {state.selectedPlayer ? (
            <div className={paymentProvider === "stripe" ? "max-w-xl" : "max-w-lg"}>
              <PlayerPaymentDetails
                userRole={programRole}
                selectedPlayer={state.selectedPlayer}
                addParentEmail={state.addParentEmail}
                setAddParentEmail={(val) => dispatch({ type: "SET_FIELD", field: "addParentEmail", value: val })}
                addParentName={state.addParentName}
                setAddParentName={(val) => dispatch({ type: "SET_FIELD", field: "addParentName", value: val })}
                handleAddParent={handleAddParent}
                handleLinkExistingParent={handleLinkExistingParent}
                handleRemoveParent={handleRemoveParent}
                message={state.message}
                customAmount={state.customAmount}
                setCustomAmount={(val) => dispatch({ type: "SET_FIELD", field: "customAmount", value: val })}
                ledger={ledger}
                onAdminAdjust={async () => {}}
              />

              <div className="mt-6 flex flex-col items-center">
                <button
                  onClick={handleConfirm}
                  className="inline-flex items-center justify-center bg-[#5E0009] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm"
                >
                  {state.confirmedAmount ? "Update Amount" : "Confirm Amount"}
                </button>

                {state.confirmedAmount && (
                  <div id="paypal-payment-buttons" className="mt-4 w-full" />
                )}
              </div>

              {programRole === "player" && (
                <div className="mt-8">
                  <PaymentCards playerId={state.selectedPlayer.id} season={currentSeason} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Player Linked</h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any player data connected to your account for the{" "}
                <span className="font-semibold">{displaySeasonLabel(currentSeason)}</span> season.
              </p>
              {programRole === "parent" ? (
                <p className="text-gray-700 mb-4">
                  If you're a parent, please contact your coach to confirm that your email is linked to your player's account.
                </p>
              ) : (
                <p className="text-gray-700 mb-4">
                  If you're a player, verify that your account is linked to a valid roster entry.
                </p>
              )}
              <a
                href="/"
                className="inline-block bg-[#5E0009] text-white px-6 py-2.5 rounded-full font-semibold hover:bg-[#7a0012] transition"
              >
                Return Home
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

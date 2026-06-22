// src/Women/Local/Pages/Payments/Payments.jsx
import { useEffect, useMemo, useReducer, useState } from "react";
import toast from "react-hot-toast";

import usePayPalButtons from "../../../../Global/Common/hooks/usePayPalButtons";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import ParentPlayerSelect from "./components/ParentPlayerSelect";
import PlayerPaymentDetails from "./components/PlayerPaymentDetails";
import PlayerTable from "./components/PlayerTable";
import usePlayers from "./hooks/findPlayers";
import { generateSeasonValues } from "../Roster/hooks/seasonUtils";
import type { ApiParentRecord, ApiPlayer, ApiUser, DuesPayment, ParentLink, Program, Role } from "../../../../types/api";

const getSeasonValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

type PaymentsState = {
  selectedPlayerId: string;
  selectedPlayer: ApiPlayer | null;
  customAmount: string;
  confirmedAmount: number | null;
  addParentEmail: string;
  message: string;
  userEmails: Record<string, string>;
};

type PaymentsAction =
  | { type: "SET_FIELD"; field: keyof PaymentsState; value: PaymentsState[keyof PaymentsState] }
  | { type: "SET_SELECTED_PLAYER"; player: ApiPlayer | null };

const initialState: PaymentsState = {
  selectedPlayerId: "",
  selectedPlayer: null,
  customAmount: "",
  confirmedAmount: null,
  addParentEmail: "",
  message: "",
  userEmails: {},
};

function paymentsReducer(state: PaymentsState, action: PaymentsAction): PaymentsState {
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

export default function Payments() {
  const { user, roles, loading } = useAuth();
  const [state, dispatch] = useReducer(paymentsReducer, initialState);
  const [linkedPlayerId, setLinkedPlayerId] = useState<string>("");
  const [linkedPlayer, setLinkedPlayer] = useState<ApiPlayer | null>(null);
  const [ledger, setLedger] = useState<DuesPayment[]>([]);

  const currentSeason = getSeasonValue();
  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program: Program = isWomenSite ? "women" : "men";

  const programRole = (roles?.[program] || "") as Role | "";
  const canAccess = ["admin", "player", "parent", "alumni"].includes(programRole);

  const { players, setPlayers, loading: loadingPlayers } = usePlayers();
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);

  const seasonPlayers = useMemo(() => {
    if (!players?.length) return [];
    const season = programRole === "admin" ? selectedSeason : currentSeason;
    const filtered = players.filter((p) => p.season === season);
    return filtered.length ? filtered : players;
  }, [players, selectedSeason, currentSeason, programRole]);

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

  const handlePaymentSuccess = async (_captureData: unknown, amount: number) => {
    const player = state.selectedPlayer;
    if (!player) return;
    await apiRequest("/api/dues-payments", {
      method: "POST",
      json: {
        playerId: player.id,
        amount,
        type: "PAYMENT",
        note: "PayPal payment",
        paidByUid: user?.uid ?? null,
      },
    });
    const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
    if (refreshed?.id) dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
    await fetchLedger(player.id);
    dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: null });
    dispatch({ type: "SET_FIELD", field: "customAmount", value: "" });
    toast.success(`Payment of $${amount.toFixed(2)} recorded!`);
  };

  const handleAdminAdjust = async (amount: number, type: "CHARGE" | "CREDIT", note: string) => {
    const player = state.selectedPlayer;
    if (!player) return;
    await apiRequest("/api/dues-payments", {
      method: "POST",
      json: { playerId: player.id, amount, type, note: note || null, paidByUid: user?.uid ?? null },
    });
    const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
    if (refreshed?.id) dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
    await fetchLedger(player.id);
    toast.success("Balance updated.");
  };

  usePayPalButtons(state.confirmedAmount, "paypal-payment-buttons", handlePaymentSuccess, "pay");

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
    if (p && p.id !== state.selectedPlayer?.id) {
      dispatch({ type: "SET_SELECTED_PLAYER", player: p });
    }
  }, [state.selectedPlayerId, seasonPlayers, state.selectedPlayer]);

  useEffect(() => {
    if (state.selectedPlayer?.id) fetchLedger(state.selectedPlayer.id);
  }, [state.selectedPlayer?.id]);

  useEffect(() => {
    if (programRole !== "admin" || !seasonPlayers.length) return;
    const fetchEmails = async () => {
      const newEmails: Record<string, string> = {};
      for (const p of seasonPlayers) {
        try {
          const userRecord = await apiRequest<ApiUser>(`/api/users/by-player/${p.id}`).catch(() => null);
          if (userRecord?.email) newEmails[p.id] = userRecord.email;
        } catch (err){
          console.log(err);
        }
      }
      dispatch({ type: "SET_FIELD", field: "userEmails", value: newEmails });
    };
    fetchEmails();
  }, [seasonPlayers, programRole]);

  const handleAddParent = async () => {
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
      await apiRequest(`/api/onboard/parent`, {
        method: "POST",
        json: { email, program, playerId: player.id },
      });

      const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
      if (refreshed?.id) {
        dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
      }
      dispatch({ type: "SET_FIELD", field: "addParentEmail", value: "" });
      dispatch({ type: "SET_FIELD", field: "message", value: "Parent linked and invite sent!" });
    } catch {
      dispatch({ type: "SET_FIELD", field: "message", value: "Failed to link parent." });
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
        const updated = (parentRecord?.linkedPlayers || []).filter((id) => id !== player.id);
        await apiRequest(`/api/parents/${parentToRemove.uid}`, {
          method: "PUT",
          json: {
            email: parentRecord?.email || parentToRemove.email,
            linkedPlayers: updated,
          },
        });
      }

      const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
      if (refreshed?.id) {
        dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
      }
      dispatch({
        type: "SET_FIELD",
        field: "message",
        value: `Removed ${emailToRemove} successfully.`,
      });
    } catch {
      dispatch({ type: "SET_FIELD", field: "message", value: "Failed to remove parent." });
    }
  };

  const handleConfirm = () => {
    const val = parseFloat(state.customAmount);
    if (isNaN(val) || val <= 0) { toast.error("Please enter a valid amount."); return; }
    const balance = Number(state.selectedPlayer?.balance ?? 0);
    if (programRole !== "admin" && balance > 0 && val > balance) {
      toast.error(`Amount cannot exceed your balance of $${balance.toFixed(2)}.`);
      return;
    }
    dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: val });
  };

  if (loading) return <p className="text-gray-600 animate-pulse">Checking permissions...</p>;

  if (!user || !canAccess)
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <h2 className="text-3xl font-bold text-[#5E0009] mb-4">Access Restricted</h2>
        <p className="text-gray-700">Payments are available to team players and administrators only.</p>
      </div>
    );

  const availableSeasons = useMemo(() => {
    const base = generateSeasonValues();
    const fromPlayers = players.map((p) => p.season).filter(Boolean) as string[];
    return Array.from(new Set([...base, ...fromPlayers])).sort((a, b) => b.localeCompare(a));
  }, [players]);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow rounded animate-fadeIn text-left">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">
          Payments - <span className="text-[#5E0009]">{programRole === "admin" ? selectedSeason : currentSeason}</span> Season
        </h1>
        {programRole === "admin" && (
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="border border-gray-400 px-3 py-1 rounded text-sm font-medium bg-white shadow-sm hover:border-gray-600 transition-colors"
          >
            {availableSeasons.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {loadingPlayers ? (
        <p className="text-gray-600 animate-pulse">Loading payment data...</p>
      ) : (
        <>
          {programRole === "admin" && seasonPlayers.length > 0 && (
            <PlayerTable
              players={seasonPlayers}
              setPlayers={setPlayers}
              userEmails={state.userEmails}
              onSelectedPlayer={(p) => dispatch({ type: "SET_SELECTED_PLAYER", player: p })}
            />
          )}

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
            <div className="max-w-lg">
              <PlayerPaymentDetails
                userRole={programRole}
                selectedPlayer={state.selectedPlayer}
                addParentEmail={state.addParentEmail}
                setAddParentEmail={(val) => dispatch({ type: "SET_FIELD", field: "addParentEmail", value: val })}
                handleAddParent={handleAddParent}
                handleRemoveParent={handleRemoveParent}
                message={state.message}
                customAmount={state.customAmount}
                setCustomAmount={(val) => dispatch({ type: "SET_FIELD", field: "customAmount", value: val })}
                ledger={ledger}
                onAdminAdjust={handleAdminAdjust}
              />

              <div className="mt-4 flex flex-col items-center">
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] transition"
                >
                  {state.confirmedAmount ? "Update Amount" : "Confirm Amount"}
                </button>

                {state.confirmedAmount && (
                  <div id="paypal-payment-buttons" className="mt-4 w-full max-w-xs flex justify-start" />
                )}
              </div>
            </div>
          ) : (
            <div className="text-center mt-10 bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Player Linked</h3>
              <p className="text-gray-600 mb-4">
                We couldn't find any player data connected to your account for the{" "}
                <span className="font-semibold">{currentSeason}</span> season.
              </p>
              {programRole === "parent" ? (
                <p className="text-gray-700 mb-4">
                  If you're a parent, please contact your coach to confirm that your email is linked to your player's account.
                </p>
              ) : (
                <p className="text-gray-700 mb-4">
                  If you're a player or admin, verify that your account is linked to a valid roster entry.
                </p>
              )}
              <a
                href="/"
                className="inline-block bg-[#5E0009] text-white px-6 py-2 rounded-md font-semibold hover:bg-red-800 transition"
              >
                Return Home
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}


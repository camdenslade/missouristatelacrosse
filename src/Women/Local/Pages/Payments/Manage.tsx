import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import toast from "react-hot-toast";

import ManagePaymentCards from "./components/ManagePaymentCards";
import PlayerPaymentDetails from "./components/PlayerPaymentDetails";
import PlayerTable from "./components/PlayerTable";
import usePlayers from "./hooks/findPlayers";
import usePaymentButtons from "../../../../Global/Common/hooks/usePaymentButtons";
import { resolvePaymentProvider } from "../../../../Global/Common/hooks/usePaymentProvider";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import type { ApiParentRecord, ApiPlayer, ApiUser, DuesPayment, ParentLink, Program } from "../../../../types/api";
import { fetchSeasonCodes, fetchActiveSeasonCode, getSeasonValue, displaySeasonLabel } from "../Roster/hooks/seasonUtils";

type ManageState = {
  selectedPlayerId: string;
  selectedPlayer: ApiPlayer | null;
  customAmount: string;
  confirmedAmount: number | null;
  addParentEmail: string;
  addParentName: string;
  message: string;
  userEmails: Record<string, string>;
};

type ManageAction =
  | { type: "SET_FIELD"; field: keyof ManageState; value: ManageState[keyof ManageState] }
  | { type: "SET_SELECTED_PLAYER"; player: ApiPlayer | null };

const initialState: ManageState = {
  selectedPlayerId: "",
  selectedPlayer: null,
  customAmount: "",
  confirmedAmount: null,
  addParentEmail: "",
  addParentName: "",
  message: "",
  userEmails: {},
};

function manageReducer(state: ManageState, action: ManageAction): ManageState {
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

export default function Manage() {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(manageReducer, initialState);
  const [ledger, setLedger] = useState<DuesPayment[]>([]);

  const [currentSeason, setCurrentSeason] = useState(getSeasonValue());
  const [managedSeasons, setManagedSeasons] = useState<string[]>([]);
  useEffect(() => {
    fetchActiveSeasonCode().then(setCurrentSeason);
    fetchSeasonCodes().then(setManagedSeasons);
  }, []);

  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program: Program = isWomenSite ? "women" : "men";

  const paymentProvider = resolvePaymentProvider();

  const { players, setPlayers, loading: loadingPlayers } = usePlayers();
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  useEffect(() => {
    setSelectedSeason(currentSeason);
  }, [currentSeason]);

  const seasonPlayers = useMemo(() => {
    if (!players?.length) return [];
    const filtered = players.filter((p) => p.season === selectedSeason);
    return filtered.length ? filtered : players;
  }, [players, selectedSeason]);

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
      setPlayers((prev) => prev.map((pl) => (pl.id === refreshed.id ? refreshed : pl)));
    }
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
    if (refreshed?.id) {
      dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
      setPlayers((prev) => prev.map((pl) => (pl.id === refreshed.id ? refreshed : pl)));
    }
    await fetchLedger(player.id);
    toast.success("Balance updated.");
  };

  usePaymentButtons(state.confirmedAmount, "paypal-payment-buttons", handlePaymentSuccess, "pay", "dues");

  useEffect(() => {
    if (state.selectedPlayer?.id) fetchLedger(state.selectedPlayer.id);
  }, [state.selectedPlayer?.id]);

  const seasonPlayerIds = useMemo(() => seasonPlayers.map((p) => p.id).join(","), [seasonPlayers]);

  useEffect(() => {
    if (!seasonPlayers.length) return;
    const pending = seasonPlayers.filter((p) => !(p.id in state.userEmails));
    if (!pending.length) return;
    const fetchEmails = async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(
        pending.map(async (p) => {
          const userRecord = await apiRequest<ApiUser>(`/api/users/by-player/${p.id}`).catch(() => null);
          resolved[p.id] = userRecord?.email || "";
        })
      );
      dispatch({ type: "SET_FIELD", field: "userEmails", value: { ...state.userEmails, ...resolved } });
    };
    fetchEmails();
  }, [seasonPlayerIds]);

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
    dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: val });
  };

  const availableSeasons = useMemo(() => {
    const fromPlayers = players.map((p) => p.season).filter(Boolean) as string[];
    return Array.from(new Set([...managedSeasons, ...fromPlayers])).sort((a, b) => b.localeCompare(a));
  }, [players, managedSeasons]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-left">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
            <span className="h-px w-6 bg-[#5E0009]/40" />
            Team Dues
            <span className="h-px w-6 bg-[#5E0009]/40" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Manage <span className="text-[#5E0009]">{displaySeasonLabel(selectedSeason)}</span>
          </h1>
        </div>
        <div className="relative">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-semibold pl-4 pr-10 py-2.5 rounded-full shadow-sm hover:border-[#5E0009]/40 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 transition cursor-pointer"
          >
            {availableSeasons.map((s) => (
              <option key={s} value={s}>{displaySeasonLabel(s)}</option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {loadingPlayers ? (
        <p className="text-gray-600 animate-pulse">Loading roster...</p>
      ) : (
        <div className="space-y-8">
          {seasonPlayers.length > 0 && (
            <PlayerTable
              players={seasonPlayers}
              setPlayers={setPlayers}
              userEmails={state.userEmails}
              onSelectedPlayer={(p) => dispatch({ type: "SET_SELECTED_PLAYER", player: p })}
              selectedPlayerId={state.selectedPlayerId}
            />
          )}

          {state.selectedPlayer && (
            <div className={paymentProvider === "stripe" ? "max-w-xl" : "max-w-lg"}>
              <PlayerPaymentDetails
                userRole="admin"
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
                onAdminAdjust={handleAdminAdjust}
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
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <ManagePaymentCards season={selectedSeason} availableSeasons={availableSeasons} />
          </div>
        </div>
      )}
    </div>
  );
}

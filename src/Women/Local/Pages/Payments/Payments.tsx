// src/Women/Local/Pages/Payments/Payments.jsx
import { useEffect, useMemo, useReducer, useState } from "react";

import usePayPalButtons from "../../../../Global/Common/hooks/usePayPalButtons";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import ParentPlayerSelect from "./components/ParentPlayerSelect";
import PlayerPaymentDetails from "./components/PlayerPaymentDetails";
import PlayerTable from "./components/PlayerTable";
import usePlayers from "./hooks/findPlayers";
import type { ApiParentRecord, ApiPlayer, ApiUser, ParentLink, Program, Role } from "../../../../types/api";

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

  const currentSeason = getSeasonValue();
  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program: Program = isWomenSite ? "women" : "men";

  const programRole = (roles?.[program] || "") as Role | "";
  const canAccess = ["admin", "player", "parent"].includes(programRole);

  const { players, setPlayers, loading: loadingPlayers } = usePlayers();
  const seasonPlayers = useMemo(() => {
    if (!players?.length) return [];
    const filtered = players.filter((p) => p.season === currentSeason);
    return filtered.length ? filtered : players;
  }, [players, currentSeason]);

  usePayPalButtons(state.confirmedAmount, "paypal-payment-buttons");

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
    if (!match && programRole === "parent" && seasonPlayers.length > 0) match = seasonPlayers[0];
    if (!match && programRole === "admin" && seasonPlayers.length > 0) match = seasonPlayers[0];
    if (!match && seasonPlayers.length > 0) match = seasonPlayers[0];

    if (match) dispatch({ type: "SET_SELECTED_PLAYER", player: match });
  }, [seasonPlayers, state.selectedPlayer, programRole, linkedPlayer]);

  useEffect(() => {
    if (!state.selectedPlayerId) return;
    const p = seasonPlayers.find((x) => x.id === state.selectedPlayerId) || null;
    if (p && p.id !== state.selectedPlayer?.id) {
      dispatch({ type: "SET_SELECTED_PLAYER", player: p });
    }
  }, [state.selectedPlayerId, seasonPlayers, state.selectedPlayer]);

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
      const parentUser = await apiRequest<ApiUser>(`/api/users/by-email?email=${encodeURIComponent(email)}`).catch(() => null);
      const parentEntry: ParentLink = parentUser?.uid ? { uid: parentUser.uid, email } : { email };
      const updatedParents = [...existingParents, parentEntry];

      await apiRequest(`/api/players/${player.id}`, {
        method: "PUT",
        json: { parents: updatedParents },
      });

      if (parentUser?.uid) {
        const parentRecord = await apiRequest<ApiParentRecord>(`/api/parents/${parentUser.uid}`).catch(() => null);
        const linkedPlayers = new Set(parentRecord?.linkedPlayers || []);
        linkedPlayers.add(player.id);
        await apiRequest(`/api/parents/${parentUser.uid}`, {
          method: "PUT",
          json: {
            email,
            linkedPlayers: Array.from(linkedPlayers),
          },
        });
      }

      const refreshed = await apiRequest<ApiPlayer>(`/api/players/${player.id}`).catch(() => null);
      if (refreshed?.id) {
        dispatch({ type: "SET_SELECTED_PLAYER", player: refreshed });
      }
      dispatch({ type: "SET_FIELD", field: "addParentEmail", value: "" });
      dispatch({ type: "SET_FIELD", field: "message", value: "Parent linked successfully." });
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
    if (!isNaN(val) && val > 0)
      dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: val });
    else alert("Please enter a valid amount.");
  };

  if (loading) return <p className="text-gray-600 animate-pulse">Checking permissions...</p>;

  if (!user || !canAccess)
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <h2 className="text-3xl font-bold text-[#5E0009] mb-4">Access Restricted</h2>
        <p className="text-gray-700">Payments are available to team players and administrators only.</p>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow rounded animate-fadeIn text-left">
      <h1 className="text-2xl font-bold mb-4">
        Payments - <span className="text-[#5E0009]">{currentSeason}</span> Season
      </h1>

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
              players={seasonPlayers}
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


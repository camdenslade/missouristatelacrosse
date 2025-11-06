// src/Men/Local/Pages/Payments/Payments.jsx
import {
  doc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { useEffect, useMemo, useReducer } from "react";

import { useAuth } from "../../../../Global/Context/AuthContext.jsx";
import { db } from "../../../../Services/firebaseConfig.js";
import ParentPlayerSelect from "./components/ParentPlayerSelect.jsx";
import PlayerPaymentDetails from "./components/PlayerPaymentDetails.jsx";
import PlayerTable from "./components/PlayerTable.jsx";
import usePayPalButtons from "../../../../Global/Common/hooks/usePayPalButtons.js";
import findPlayers from "./hooks/findPlayers.js";

const getSeasonValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const initialState = {
  selectedPlayerId: "",
  selectedPlayer: null,
  customAmount: "",
  confirmedAmount: null,
  addParentEmail: "",
  message: "",
  userEmails: {},
};

function paymentsReducer(state, action) {
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
  const currentSeason = getSeasonValue();
  const programRole = roles?.men || "";
  const canAccess = ["admin", "player", "parent"].includes(programRole);
  const { players, setPlayers, loading: loadingPlayers } = findPlayers(user, programRole);

  const seasonPlayers = useMemo(
    () => (players || []).filter((p) => p.season === currentSeason),
    [players, currentSeason]
  );

  usePayPalButtons(state.selectedPlayer, [], state.confirmedAmount, "paypal-payment-buttons");

  useEffect(() => {
    if (!seasonPlayers.length || !user || state.selectedPlayer) return;
    let match = null;
    if (programRole === "player" || programRole === "admin")
      match = seasonPlayers.find((p) => p.id === user.playerId);
    if (!match && programRole === "parent" && seasonPlayers.length > 0)
      match = seasonPlayers[0];
    if (!match && seasonPlayers.length > 0) match = seasonPlayers[0];
    if (match) dispatch({ type: "SET_SELECTED_PLAYER", player: match });
  }, [seasonPlayers, user, programRole, state.selectedPlayer]);

  useEffect(() => {
    const player = seasonPlayers.find((p) => p.id === state.selectedPlayerId);
    dispatch({ type: "SET_SELECTED_PLAYER", player });
  }, [state.selectedPlayerId, seasonPlayers]);

  useEffect(() => {
    if (programRole !== "admin" || !seasonPlayers.length) return;
    const fetchEmails = async () => {
      const newEmails = {};
      for (const p of seasonPlayers){
        try {
          const q = query(collection(db, "users"), where("playerId", "==", p.id));
          const snap = await getDocs(q);
          if (!snap.empty) newEmails[p.id] = snap.docs[0].data().email;
        } catch {}
      }
      dispatch({ type: "SET_FIELD", field: "userEmails", value: newEmails });
    };
    fetchEmails();
  }, [seasonPlayers, programRole]);

  const handleAddParent = async () => {
    dispatch({ type: "SET_FIELD", field: "message", value: "" });
    const email = state.addParentEmail.toLowerCase();
    const player = state.selectedPlayer;
    if (!email || !player){
      dispatch({ type: "SET_FIELD", field: "message", value: "Please enter a parent email." });
      return;
    }
    const playerRef = doc(db, "players", player.id);
    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty){
        const parentUid = snap.docs[0].id;
        await updateDoc(playerRef, { parents: arrayUnion({ uid: parentUid, email }) });
        await setDoc(
          doc(db, "parents", parentUid),
          { linkedPlayers: arrayUnion(player.id), email },
          { merge: true }
        );
        dispatch({ type: "SET_FIELD", field: "message", value: "Parent linked successfully." });
      } else{
        await updateDoc(playerRef, { parents: arrayUnion({ email }) });
        await fetch("/admin/send-email/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: [email],
            subject: "Missouri State Lacrosse – Parent Account Setup",
            body: `Hello,\n\nYou’ve been added as a parent for ${player.name}. Please register your account to access payment and player details.\n\nVisit https://missouristatelacrosse.com to get started.`,
          }),
        });
        dispatch({
          type: "SET_FIELD",
          field: "message",
          value: "Parent email saved and password setup email sent.",
        });
      }
      const refreshedSnap = await getDoc(playerRef);
      if (refreshedSnap.exists())
        dispatch({ type: "SET_SELECTED_PLAYER", player: { id: player.id, ...refreshedSnap.data() } });
      dispatch({ type: "SET_FIELD", field: "addParentEmail", value: "" });
    } catch {
      dispatch({ type: "SET_FIELD", field: "message", value: "Failed to link parent." });
    }
  };

  const handleRemoveParent = async (emailToRemove) => {
    const player = state.selectedPlayer;
    if (!player) return;
    const playerRef = doc(db, "players", player.id);
    try{
      const parentToRemove = (player.parents || []).find((p) => p.email === emailToRemove);
      if (!parentToRemove){
        dispatch({
          type: "SET_FIELD",
          field: "message",
          value: "Parent not found on this player.",
        });
        return;
      }
      await updateDoc(playerRef, { parents: arrayRemove(parentToRemove) });
      if (parentToRemove.uid){
        const parentRef = doc(db, "parents", parentToRemove.uid);
        const parentSnap = await getDoc(parentRef);
        if (parentSnap.exists()) {
          const data = parentSnap.data();
          const updated = (data.linkedPlayers || []).filter((id) => id !== player.id);
          await updateDoc(parentRef, { linkedPlayers: updated });
        }
      }
      const refreshedSnap = await getDoc(playerRef);
      if (refreshedSnap.exists())
        dispatch({ type: "SET_SELECTED_PLAYER", player: { id: player.id, ...refreshedSnap.data() } });
      dispatch({
        type: "SET_FIELD",
        field: "message",
        value: `Removed ${emailToRemove} successfully.`,
      });
    } catch{
      dispatch({ type: "SET_FIELD", field: "message", value: "Failed to remove parent." });
    }
  };

  const handleConfirm = () => {
    const val = parseFloat(state.customAmount);
    if (!isNaN(val) && val > 0)
      dispatch({ type: "SET_FIELD", field: "confirmedAmount", value: val });
    else alert("Please enter a valid amount.");
  };

  if (loading)
    return <p className="text-gray-600 animate-pulse">Checking permissions...</p>;

  if (!user || !canAccess)
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <h2 className="text-3xl font-bold text-[#5E0009] mb-4">Access Restricted</h2>
        <p className="text-gray-700">
          Payments are available to team players and administrators only.
        </p>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow rounded animate-fadeIn text-left">
      <h1 className="text-2xl font-bold mb-4">
        Payments — <span className="text-[#5E0009]">{currentSeason}</span> Season
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
              onSelectedPlayer={(p) =>
                dispatch({ type: "SET_SELECTED_PLAYER", player: p })
              }
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
                setAddParentEmail={(val) =>
                  dispatch({ type: "SET_FIELD", field: "addParentEmail", value: val })
                }
                handleAddParent={handleAddParent}
                handleRemoveParent={handleRemoveParent}
                message={state.message}
                customAmount={state.customAmount}
                setCustomAmount={(val) =>
                  dispatch({ type: "SET_FIELD", field: "customAmount", value: val })
                }
              />

              <div className="mt-4 flex flex-col items-center">
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] transition"
                >
                  {state.confirmedAmount ? "Update Amount" : "Confirm Amount"}
                </button>

                {state.confirmedAmount && (
                  <div
                    id="paypal-payment-buttons"
                    className="mt-4 w-full max-w-xs flex justify-start"
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-600 italic mt-6">
              No player data found for your account.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// src/Men/Local/Pages/Roster/Roster.jsx
import { deleteDoc, doc } from "firebase/firestore";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { db } from "../../../../Services/firebaseConfig.js";
import { getCurrentYear, setCurrentYear } from "../../../../Services/yearHelper.js";
import CoachRow from "./components/CoachRow.jsx";
import PlayerRow from "./components/PlayerRow.jsx";
import RosterFormModal from "./components/RosterForm.jsx";
import useCoaches from "./contenthooks/useCoaches.js";
import usePlayers from "./contenthooks/usePlayers.js";
import { rosterPrintStyle } from "./hooks/printStyles.js";
import { displaySeasonLabel, generateSeasonValues, normalizeSeasonParam } from "./hooks/seasonUtils.js";
import useRosterState from "./hooks/useRosterState.js";

function Spinner(){
  return (
    <div className="flex justify-center items-center py-10">
      <div className="w-10 h-10 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function Roster({ userRole }){
  const { season } = useParams();
  const cachedYear = getCurrentYear();
  const navigate = useNavigate();
  const normalizedSeason = normalizeSeasonParam(season || cachedYear);

  const [state, dispatch] = useRosterState(normalizedSeason);
  const { selectedSeason, showModal, isCoach, editingItem, loading } = state;

  const {
    players,
    loading: playersLoading,
    error: playersError,
    fetchPlayers,
  } = usePlayers();

  const {
    coaches,
    loading: coachesLoading,
    error: coachesError,
    fetchCoaches,
  } = useCoaches();

  const availableSeasons = useMemo(() => {
    const base = generateSeasonValues();
    const found = [
      ...players.map((p) => p.season),
      ...coaches.map((c) => c.season),
    ].filter(Boolean);
    return Array.from(new Set([...base, ...found])).sort((a, b) => a.localeCompare(b));
  }, [players, coaches]);

  const filteredPlayers = useMemo(
    () => players.filter((p) => p.season === selectedSeason),
    [players, selectedSeason]
  );

  const filteredCoaches = useMemo(
    () => coaches.filter((c) => c.season === selectedSeason),
    [coaches, selectedSeason]
  );

  useEffect(() => {
    (async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      await Promise.all([fetchPlayers(), fetchCoaches()]);
      dispatch({ type: "SET_LOADING", payload: false });
    })();
  }, [selectedSeason]);

  const handleSeasonChange = (val) => {
    dispatch({ type: "SET_SEASON", payload: val });
    setCurrentYear(val);
    localStorage.setItem("selectedSeason", val);
    navigate(`/roster/${displaySeasonLabel(val)}`);
  };

  const handleDelete = async (item, coach) => {
    if (!confirm(`Delete ${item.name}?`)) return;
    try{
      await deleteDoc(doc(db, coach ? "coaches" : "players", item.id));
      await Promise.all([fetchPlayers(), fetchCoaches()]);
    } catch (err){
      console.error("Error deleting:", err);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="max-w-full px-4 py-8">
      <style>{rosterPrintStyle}</style>

      <div className="no-print flex flex-col sm:flex-row justify-between items-center mb-6">
        <select
          value={selectedSeason}
          onChange={(e) => handleSeasonChange(e.target.value)}
          className="border border-gray-400 px-3 py-1 rounded text-sm font-medium bg-white shadow-sm hover:border-gray-600 transition-colors"
        >
          {availableSeasons.map((s) => (
            <option key={s} value={s}>{displaySeasonLabel(s)} Season</option>
          ))}
        </select>
        <button
          onClick={handlePrint}
          className="print-button mt-4 sm:mt-0 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded-md px-4 py-2 text-sm font-medium"
        >
          Print Roster
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {userRole === "admin" && (
            <div className="flex justify-center gap-4 mb-8 print:hidden no-print">
              <button
                onClick={() => dispatch({ type: "OPEN_MODAL", isCoach: false })}
                className="px-6 py-3 bg-[#5E0009] text-white hover:bg-red-800 text-lg"
              >
                Add Player
              </button>
              <button
                onClick={() => dispatch({ type: "OPEN_MODAL", isCoach: true })}
                className="px-6 py-3 bg-[#5E0009] text-white hover:bg-red-800 text-lg"
              >
                Add Coach
              </button>
            </div>
          )}

          <div className="flex flex-col gap-0 print:hidden no-print">
            {filteredPlayers.length ? (
              filteredPlayers.map((p, i) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  index={i}
                  isAdmin={userRole === "admin"}
                  onEdit={(item) => dispatch({ type: "OPEN_MODAL", item })}
                  onDelete={() => handleDelete(p, false)}
                />
              ))
            ) : (
              <div className="text-center text-gray-500 py-10">
                No players found for {displaySeasonLabel(selectedSeason)}.
              </div>
            )}
          </div>

          <h2 className="text-4xl font-bold my-6 text-center text-[#5E0009] print:hidden no-print">
            Coaches
          </h2>
          <div className="flex flex-col gap-0 print:hidden no-print">
            {filteredCoaches.length ? (
              filteredCoaches.map((c, i) => (
                <CoachRow
                  key={c.id}
                  coach={c}
                  index={i}
                  isAdmin={userRole === "admin"}
                  onEdit={(item) => dispatch({ type: "OPEN_MODAL", item, isCoach: true })}
                  onDelete={() => handleDelete(c, true)}
                />
              ))
            ) : (
              <div className="text-center text-gray-500 py-10">
                No coaches found for {displaySeasonLabel(selectedSeason)}.
              </div>
            )}
          </div>

          <div className="hidden print:block roster-printable">
            <div className="print-header">Missouri State University Lacrosse</div>
            <h1>{displaySeasonLabel(selectedSeason)} Men's Lacrosse Roster</h1>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Full Name</th><th>Pos.</th><th>Ht.</th><th>Wt.</th>
                  <th>Yr.</th><th>Hometown / High School</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p, i) => (
                  <tr key={p.id || i}>
                    <td>{p.number}</td><td>{p.name}</td><td>{p.position}</td>
                    <td>{p.height}</td><td>{p.weight}</td>
                    <td>{p.classYear || p.year || ""}</td><td>{p.hometown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <RosterFormModal
          isCoach={isCoach}
          editingItem={editingItem}
          selectedSeason={selectedSeason}
          onClose={() => dispatch({ type: "CLOSE_MODAL" })}
          onSaved={() => Promise.all([fetchPlayers(), fetchCoaches()])}
        />
      )}
    </div>
  );
}

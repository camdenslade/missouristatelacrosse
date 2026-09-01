import { ChevronDown, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import CoachRow from "./components/CoachRow";
import PlayerRow from "./components/PlayerRow";
import RosterFormModal from "./components/RosterForm";
import useCoaches from "./contenthooks/useCoaches";
import usePlayers from "./contenthooks/usePlayers";
import { rosterPrintStyle } from "./hooks/printStyles";
import { displaySeasonLabel, fetchSeasonCodes, normalizeSeasonParam } from "./hooks/seasonUtils";
import useRosterState from "./hooks/useRosterState";
import type { Coach, Player } from "./types";
import { getCurrentYear, setCurrentYear } from "../../../../Services/yearHelper";

function Spinner(){
  return (
    <div className="flex justify-center items-center py-10">
      <div className="w-10 h-10 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

type RosterProps = {
  userRole?: string | null;
};

export default function Roster({ userRole }: RosterProps){
  const { season } = useParams<{ season?: string }>();
  const cachedYear = getCurrentYear();
  const navigate = useNavigate();
  const normalizedSeason = normalizeSeasonParam(season || cachedYear);

  const [state, dispatch] = useRosterState(normalizedSeason);
  const { selectedSeason, showModal, isCoach, editingItem, loading } = state;
  const [searchQuery, setSearchQuery] = useState("");

  const {
    players,
    fetchPlayers,
    removePlayer,
  } = usePlayers();

  const {
    coaches,
    fetchCoaches,
    removeCoach,
  } = useCoaches();

  const [managedSeasons, setManagedSeasons] = useState<string[]>([]);
  useEffect(() => {
    fetchSeasonCodes().then(setManagedSeasons);
  }, []);

  const availableSeasons = useMemo(() => {
    const found = [
      ...players.map((p) => p.season),
      ...coaches.map((c) => c.season),
    ].filter((season): season is string => Boolean(season));
    return Array.from(new Set([...managedSeasons, ...found])).sort((a, b) => a.localeCompare(b));
  }, [players, coaches, managedSeasons]);

  const filteredPlayers = useMemo(
    () => players.filter((p) => p.season === selectedSeason),
    [players, selectedSeason]
  );

  const displayedPlayers = useMemo(
    () => searchQuery.trim()
      ? filteredPlayers.filter((p) => p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : filteredPlayers,
    [filteredPlayers, searchQuery]
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
  }, [dispatch, fetchPlayers, fetchCoaches, selectedSeason]);

  const handleSeasonChange = (val: string) => {
    setSearchQuery("");
    dispatch({ type: "SET_SEASON", payload: val });
    setCurrentYear(val);
    localStorage.setItem("selectedSeason", val);
    navigate(`/roster/${displaySeasonLabel(val)}`);
  };

  const handleDelete = async (item: Player | Coach, coach: boolean) => {
    if (!confirm(`Delete ${item.name}?`)) return;
    if (!item.id) return;
    try{
      if (coach) await removeCoach(item.id);
      else await removePlayer(item.id);
    } catch (err){
      console.error("Error deleting:", err);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="max-w-full px-4 py-8">
      <style>{rosterPrintStyle}</style>

      <div className="no-print flex flex-col sm:flex-row justify-between items-center gap-3 mb-6">
        <div className="relative">
          <select
            value={selectedSeason}
            onChange={(e) => handleSeasonChange(e.target.value)}
            className="appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-semibold pl-4 pr-10 py-2.5 rounded-full shadow-sm hover:border-[#5E0009]/40 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 transition cursor-pointer"
          >
            {availableSeasons.map((s) => (
              <option key={s} value={s}>{displaySeasonLabel(s)} Season</option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="relative flex-1 sm:flex-none sm:w-56">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-200 rounded-full pl-10 pr-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
          />
        </div>
        <button
          onClick={handlePrint}
          className="print-button inline-flex items-center justify-center gap-2 bg-[#5E0009] text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm whitespace-nowrap"
        >
          <Printer size={16} />
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
                className="px-6 py-3 bg-[#5E0009] text-white hover:bg-[#7a0012] text-lg"
              >
                Add Player
              </button>
              <button
                onClick={() => dispatch({ type: "OPEN_MODAL", isCoach: true })}
                className="px-6 py-3 bg-[#5E0009] text-white hover:bg-[#7a0012] text-lg"
              >
                Add Coach
              </button>
            </div>
          )}

          <div className="flex flex-col gap-0 print:hidden no-print">
            {displayedPlayers.length ? (
              displayedPlayers.map((p, i) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  index={i}
                  season={selectedSeason}
                  isAdmin={userRole === "admin"}
                  onEdit={(item) => dispatch({ type: "OPEN_MODAL", item })}
                  onDelete={() => handleDelete(p, false)}
                />
              ))
            ) : (
              <div className="text-center text-gray-500 py-10">
                {searchQuery ? `No players matching "${searchQuery}".` : `No players found for ${displaySeasonLabel(selectedSeason)}.`}
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
          onSaved={async () => {
            await Promise.all([fetchPlayers(), fetchCoaches()]);
          }}
        />
      )}
    </div>
  );
}


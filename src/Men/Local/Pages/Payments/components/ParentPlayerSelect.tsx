// src/Men/Local/Pages/Payments/components/ParentPlayerSelect.jsx
import type { ApiPlayer } from "../../../../../types/api";

type ParentPlayerSelectProps = {
  players: ApiPlayer[];
  selectedPlayerId: string;
  setSelectedPlayerId: (id: string) => void;
};

export default function ParentPlayerSelect({
  players,
  selectedPlayerId,
  setSelectedPlayerId,
}: ParentPlayerSelectProps) {
  return (
    <div className="mb-4">
      <label className="font-medium mr-2">Select player</label>
      <select
        value={selectedPlayerId}
        onChange={(e) => setSelectedPlayerId(e.target.value)}
        className="border px-2 py-1 rounded"
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || `Player ${p.id}`}
          </option>
        ))}
      </select>
    </div>
  );
}

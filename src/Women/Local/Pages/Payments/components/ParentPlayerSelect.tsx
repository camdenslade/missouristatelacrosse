import { ChevronDown } from "lucide-react";

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
    <div className="mb-4 flex items-center gap-3">
      <label className="text-sm font-semibold text-gray-700">Select player</label>
      <div className="relative">
        <select
          value={selectedPlayerId}
          onChange={(e) => setSelectedPlayerId(e.target.value)}
          className="appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-semibold pl-4 pr-10 py-2 rounded-full shadow-sm hover:border-[#5E0009]/40 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 transition cursor-pointer"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || `Player ${p.id}`}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
}

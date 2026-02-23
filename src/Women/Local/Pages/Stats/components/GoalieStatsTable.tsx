import type { AggregatedGoalieStat } from "../hooks/useSeasonStats";

export default function GoalieStatsTable({ stats }: { stats: AggregatedGoalieStat[] }) {
  if (!stats.length) {
    return <p className="text-center text-gray-500 py-4">No goalie stats available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#5E0009] text-white">
            <th className="p-2 text-center w-12">#</th>
            <th className="p-2 text-left">Player</th>
            <th className="p-2 text-center">GP</th>
            <th className="p-2 text-center">S</th>
            <th className="p-2 text-center">GA</th>
            <th className="p-2 text-center">SV%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-100"}>
              <td className="p-2 text-center text-gray-500">{s.number ?? "-"}</td>
              <td className="p-2 font-medium">{s.name}</td>
              <td className="p-2 text-center">{s.gamesPlayed}</td>
              <td className="p-2 text-center">{s.saves}</td>
              <td className="p-2 text-center">{s.goalsAllowed}</td>
              <td className="p-2 text-center font-bold">
                {s.saves + s.goalsAllowed > 0
                  ? (s.savePercentage * 100).toFixed(1) + "%"
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { AggregatedFieldStat } from "../hooks/useSeasonStats";

export default function FieldStatsTable({ stats }: { stats: AggregatedFieldStat[] }) {
  if (!stats.length) {
    return <p className="text-center text-gray-500 py-4">No field player stats available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[700px]">
        <thead>
          <tr className="bg-[#5E0009] text-white">
            <th className="p-2 text-center w-12">#</th>
            <th className="p-2 text-left">Player</th>
            <th className="p-2 text-center">GP</th>
            <th className="p-2 text-center">G</th>
            <th className="p-2 text-center">A</th>
            <th className="p-2 text-center">PTS</th>
            <th className="p-2 text-center">SH</th>
            <th className="p-2 text-center">GB</th>
            <th className="p-2 text-center">CT</th>
            <th className="p-2 text-center">DC</th>
            <th className="p-2 text-center">DL</th>
            <th className="p-2 text-center">DC%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.name} className={i % 2 === 0 ? "bg-white" : "bg-gray-100"}>
              <td className="p-2 text-center text-gray-500">{s.number ?? "-"}</td>
              <td className="p-2 font-medium">{s.name}</td>
              <td className="p-2 text-center">{s.gamesPlayed}</td>
              <td className="p-2 text-center">{s.goals}</td>
              <td className="p-2 text-center">{s.assists}</td>
              <td className="p-2 text-center font-bold">{s.points}</td>
              <td className="p-2 text-center">{s.shotsOnGoal}</td>
              <td className="p-2 text-center">{s.groundBalls}</td>
              <td className="p-2 text-center">{s.causedTurnovers}</td>
              <td className="p-2 text-center">{s.faceoffWins}</td>
              <td className="p-2 text-center">{s.faceoffLosses}</td>
              <td className="p-2 text-center">
                {s.faceoffWins + s.faceoffLosses > 0
                  ? (s.faceoffPct * 100).toFixed(1) + "%"
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useMemo } from "react";
import type { ScheduleGame, PlayerStat } from "../../../../../types/schedule";

export type AggregatedFieldStat = {
  name: string;
  number?: string | number | null;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  shotsOnGoal: number;
  groundBalls: number;
  causedTurnovers: number;
  turnovers: number;
  faceoffWins: number;
  faceoffLosses: number;
  faceoffPct: number;
};

export type AggregatedGoalieStat = {
  name: string;
  number?: string | number | null;
  gamesPlayed: number;
  saves: number;
  goalsAllowed: number;
  savePercentage: number;
};

export default function useSeasonStats(games: ScheduleGame[]) {
  return useMemo(() => {
    const fieldMap = new Map<string, AggregatedFieldStat>();
    const goalieMap = new Map<string, AggregatedGoalieStat>();

    for (const game of games) {
      const stats: PlayerStat[] = game.stats || [];
      for (const stat of stats) {
        const name = stat.name?.trim();
        if (!name) continue;

        if (stat.isGoalie) {
          const existing = goalieMap.get(name) || {
            name,
            number: stat.number,
            gamesPlayed: 0,
            saves: 0,
            goalsAllowed: 0,
            savePercentage: 0,
          };
          if (stat.number != null) existing.number = stat.number;
          existing.saves += stat.saves ?? 0;
          existing.goalsAllowed += stat.goalsAllowed ?? 0;
          existing.gamesPlayed += 1;
          const total = existing.saves + existing.goalsAllowed;
          existing.savePercentage = total > 0 ? existing.saves / total : 0;
          goalieMap.set(name, existing);
        } else {
          const existing = fieldMap.get(name) || {
            name,
            number: stat.number,
            gamesPlayed: 0,
            goals: 0,
            assists: 0,
            points: 0,
            shotsOnGoal: 0,
            groundBalls: 0,
            causedTurnovers: 0,
            turnovers: 0,
            faceoffWins: 0,
            faceoffLosses: 0,
            faceoffPct: 0,
          };
          if (stat.number != null) existing.number = stat.number;
          existing.goals += stat.goals ?? 0;
          existing.assists += stat.assists ?? 0;
          existing.shotsOnGoal += stat.shotsOnGoal ?? 0;
          existing.groundBalls += stat.groundBalls ?? 0;
          existing.causedTurnovers += stat.causedTurnovers ?? 0;
          existing.turnovers += stat.turnovers ?? 0;
          existing.faceoffWins += stat.faceoffWins ?? 0;
          existing.faceoffLosses += stat.faceoffLosses ?? 0;
          existing.gamesPlayed += 1;
          existing.points = existing.goals + existing.assists;
          const foTotal = existing.faceoffWins + existing.faceoffLosses;
          existing.faceoffPct = foTotal > 0 ? existing.faceoffWins / foTotal : 0;
          fieldMap.set(name, existing);
        }
      }
    }

    const fieldStats = Array.from(fieldMap.values()).sort((a, b) => b.points - a.points);
    const goalieStats = Array.from(goalieMap.values()).sort(
      (a, b) => b.savePercentage - a.savePercentage
    );

    return { fieldStats, goalieStats };
  }, [games]);
}

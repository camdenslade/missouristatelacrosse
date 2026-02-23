import type { JsonValue } from "./api";

export type GameType = "home" | "away" | "neutral" | string;

export type BoxScoreEntry = {
  home?: number;
  away?: number;
};

export type BoxScore = Record<string, BoxScoreEntry>;

export type PlayerStat = {
  name?: string;
  number?: string | number | null;
  gamesPlayed?: number;
  gamesStarted?: number;
  goals?: number;
  assists?: number;
  shotsOnGoal?: number;
  groundBalls?: number;
  causedTurnovers?: number;
  turnovers?: number;
  faceoffWins?: number;
  faceoffLosses?: number;
  saves?: number;
  goalsAllowed?: number;
  isGoalie?: boolean;
};

export type ScheduleGame = {
  id: string;
  opponent?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  awayLogo?: string | null;
  awayLink?: string | null;
  season?: string | null;
  type?: GameType;
  isConference?: boolean;
  isDivision?: boolean;
  tournamentType?: string | null;
  msuScore?: number | null;
  oppScore?: number | null;
  result?: string | null;
  notes?: string | null;
  status?: string | null;
  currentQuarter?: string | null;
  timeInQuarter?: string | null;
  boxScore?: BoxScore | null;
  playerStats?: PlayerStat[] | null;
  stats?: PlayerStat[] | null;
  liveLink?: string | null;
  data?: Record<string, JsonValue> | string | null;
  dateObj?: Date | null;
  displayDate?: string | null;
};

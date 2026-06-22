import { useEffect, useReducer, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import KeyGate from "../../../../../Global/Common/components/KeyGate";
import StreamPlayer from "../../../../../Global/Common/components/StreamPlayer";
import LiveChat from "../../../../../Global/Common/components/LiveChat";
import API_BASE from "../../../../../Services/API";

const PROGRAM = "women";
const MSU_LOGO = "/assets/bears.png";
const PLACEHOLDER_LOGO = "/assets/placeholder.png";
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const formatFoPct = (wins?: number, losses?: number) => {
  const w = wins ?? 0;
  const l = losses ?? 0;
  const total = w + l;
  if (total === 0) return "-";
  return `${((w / total) * 100).toFixed(1)}%`;
};

type BoxScoreMap = Record<string, { home: number; away: number }>;

type GameState = {
  opponent: string;
  status: string;
  currentQuarter: string;
  timeInQuarter: string;
  msuScore: number;
  oppScore: number;
  boxScore: BoxScoreMap;
  stats: any[];
  awayLogo: string;
  liveLink: string;
  isLive: boolean;
  isPaywalled: boolean;
  priceOneScreen: number;
  priceTwoScreen: number;
  streamKey: string;
  gameId: string;
};

const parseBoxScore = (bs: any): BoxScoreMap => {
  if (!bs || typeof bs !== "object" || Array.isArray(bs)) return {};
  if (Object.keys(bs).some((k) => /^Q\d|^OT/.test(k))) return bs as BoxScoreMap;
  return {};
};

const buildInitialState = (g: any): GameState => ({
  opponent: g?.opponent || "Opponent",
  status: g?.status || "live",
  currentQuarter: g?.currentQuarter ? String(g.currentQuarter) : "Q1",
  timeInQuarter: g?.timeInQuarter || "15:00",
  msuScore: g?.msuScore ?? 0,
  oppScore: g?.oppScore ?? 0,
  boxScore: parseBoxScore(g?.boxScore),
  stats: Array.isArray(g?.stats) ? g.stats : Array.isArray(g?.playerStats) ? g.playerStats : [],
  awayLogo: g?.awayLogo || "",
  liveLink: g?.liveLink || "",
  isLive: !!g?.isLive,
  isPaywalled: !!g?.isPaywalled,
  priceOneScreen: g?.priceOneScreen ?? 5,
  priceTwoScreen: g?.priceTwoScreen ?? 10,
  streamKey: g?.streamKey || "",
  gameId: g?.id || "",
});

function reducer(state: GameState, action: any): GameState {
  if (action.type === "REFRESH_GAME") {
    const p = action.payload;
    return {
      ...state,
      ...p,
      currentQuarter: p.currentQuarter ? String(p.currentQuarter) : state.currentQuarter,
      msuScore: p.msuScore ?? state.msuScore,
      oppScore: p.oppScore ?? state.oppScore,
      boxScore: p.boxScore ? parseBoxScore(p.boxScore) : state.boxScore,
      stats:
        Array.isArray(p.stats) && p.stats.length > 0
          ? p.stats
          : Array.isArray(p.playerStats)
          ? p.playerStats
          : state.stats,
    };
  }
  return state;
}

export default function LiveGameViewer({ game }: { game: any }) {
  const [state, dispatch] = useReducer(reducer, game, buildInitialState);
  const {
    opponent, status, currentQuarter, timeInQuarter,
    msuScore, oppScore, boxScore,
    stats, awayLogo, liveLink,
    isLive, isPaywalled, priceOneScreen, priceTwoScreen,
    streamKey, gameId,
  } = state;

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [paypalClientId, setPaypalClientId] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);
  const wsRef = useRef<Client | null>(null);

  useEffect(() => {
    if (game) dispatch({ type: "REFRESH_GAME", payload: game });
  }, [game]);

  useEffect(() => {
    if (!gameId) return;
    const base = (API_BASE || "").replace(/\/+$/, "");
    const client = new Client({
      webSocketFactory: () => new SockJS(`${base}/ws`),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/game/${PROGRAM}/${gameId}`, (frame) => {
          try {
            const resp = JSON.parse(frame.body);
            let dataObj: Record<string, unknown> = {};
            if (resp.data && typeof resp.data === "string") {
              dataObj = JSON.parse(resp.data);
            } else if (resp.data && typeof resp.data === "object") {
              dataObj = resp.data;
            }
            dispatch({
              type: "REFRESH_GAME",
              payload: { opponent: resp.opponent, awayLogo: resp.awayLogo, ...dataObj },
            });
          } catch { /* ignore */ }
        });
      },
    });
    client.activate();
    wsRef.current = client;
    return () => { client.deactivate(); };
  }, [gameId]);

  useEffect(() => {
    if (!isPaywalled || !streamKey) return;
    fetch(`${(API_BASE || "").replace(/\/+$/, "")}/api/paypal/client-id`, {
      headers: { "X-Program": PROGRAM },
    })
      .then((r) => r.json())
      .then((d) => setPaypalClientId(d.clientId || d.id || ""))
      .catch(() => {});
  }, [isPaywalled, streamKey]);

  if (!game) return null;

  const gameLabel = `Missouri State vs ${opponent}`;
  const hasStream = !!streamKey;
  const resolvedAwayLogo = awayLogo || PLACEHOLDER_LOGO;
  const isFinal = status === "final";
  const donateUrl = "/women/donate";
  const fieldStats = (stats || []).filter((s: any) => !s.isGoalie && s.name);
  const goalieStats = (stats || []).filter((s: any) => s.isGoalie && s.name);
  const quarterKeys = [...QUARTERS, "OT"].filter((q) => q in boxScore);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg mt-4 max-w-5xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-[#5E0009] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white tracking-tight">
            MSU vs {opponent}
          </h2>
          {isFinal ? (
            <span className="bg-white/15 border border-white/25 rounded px-2.5 py-0.5 text-white text-xs font-bold tracking-widest">
              FINAL
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-white/15 border border-white/25 rounded px-2.5 py-0.5">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              <span className="text-white text-xs font-bold tracking-widest">LIVE</span>
            </span>
          )}
        </div>
        <span className="text-white/70 text-sm font-medium tabular-nums">
          {currentQuarter} &middot; {timeInQuarter}
        </span>
      </div>

      <div className="p-5">
        {/* Score + Box Score */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Score */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
              Score
            </h3>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <img src={MSU_LOGO} alt="Missouri State" className="w-10 h-10 mx-auto object-contain mb-1" />
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">MSU</div>
                <div className="text-5xl font-black text-[#5E0009] tabular-nums leading-none">{msuScore}</div>
              </div>
              <div className="text-2xl font-light text-gray-300 mb-1">–</div>
              <div className="text-center">
                <img src={resolvedAwayLogo} alt={opponent} className="w-10 h-10 mx-auto object-contain mb-1" />
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 truncate max-w-[100px]">
                  {opponent}
                </div>
                <div className="text-5xl font-black text-gray-700 tabular-nums leading-none">{oppScore}</div>
              </div>
            </div>
          </div>

          {/* Box Score */}
          {quarterKeys.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">
                Box Score
              </h3>
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr>
                    <th style={{ width: "4rem" }} />
                    {quarterKeys.map((q) => (
                      <th key={q} className="px-1 py-0.5 text-center text-gray-400 font-bold uppercase tracking-wide">
                        {q}
                      </th>
                    ))}
                    <th className="px-1 py-0.5 text-center text-gray-600 font-black uppercase tracking-wide">T</th>
                  </tr>
                </thead>
                <tbody>
                  {(["home", "away"] as const).map((side, idx) => (
                    <tr key={side}>
                      <td
                        className={`py-1 pr-2 font-bold text-xs ${idx === 0 ? "text-[#5E0009]" : "text-gray-700"}`}
                        style={{ width: "4rem" }}
                      >
                        {idx === 0 ? "MSU" : opponent?.slice(0, 3).toUpperCase() || "OPP"}
                      </td>
                      {quarterKeys.map((q) => (
                        <td key={q} className="px-1 py-1 text-center text-sm font-semibold text-gray-700">
                          {boxScore[q]?.[side] ?? "-"}
                        </td>
                      ))}
                      <td className={`px-1 py-1 text-center text-sm font-black ${idx === 0 ? "text-[#5E0009]" : "text-gray-700"}`}>
                        {idx === 0 ? msuScore : oppScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Donate */}
        <div className="flex items-center justify-between bg-[#5E0009]/5 border border-[#5E0009]/15 rounded-lg px-4 py-3 mb-6">
          <div>
            <p className="text-sm font-semibold text-gray-800">Support Missouri State Lacrosse</p>
            <p className="text-xs text-gray-500">Your donation helps fund equipment, travel, and more.</p>
          </div>
          <a
            href={donateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 ml-4 px-4 py-2 bg-[#5E0009] text-white text-sm font-semibold rounded hover:bg-red-900 transition-colors"
          >
            Donate
          </a>
        </div>

        {/* Stream */}
        {hasStream && isLive ? (
          !accessGranted ? (
            <div className="mb-6">
              <KeyGate
                gameId={gameId}
                gameLabel={gameLabel}
                program={PROGRAM}
                isPaywalled={isPaywalled}
                priceOneScreen={priceOneScreen}
                priceTwoScreen={priceTwoScreen}
                paypalClientId={paypalClientId}
                onAccessGranted={(token, url, name) => {
                  setSessionToken(token);
                  setSignedUrl(url);
                  setDisplayName(name);
                  setAccessGranted(true);
                }}
                onFreeAccess={(url) => {
                  setSignedUrl(url);
                  setSessionToken(null);
                  setDisplayName("Viewer");
                  setAccessGranted(true);
                }}
              />
            </div>
          ) : (
            <div className="mb-6 flex flex-col lg:flex-row gap-4" style={{ minHeight: "360px" }}>
              <div className="flex-1">
                <StreamPlayer
                  signedUrl={signedUrl}
                  sessionToken={sessionToken}
                  gameId={gameId}
                  program={PROGRAM}
                  onSessionExpired={() => setAccessGranted(false)}
                />
              </div>
              <div className="w-full lg:w-72" style={{ minHeight: "360px" }}>
                <LiveChat
                  gameId={gameId}
                  program={PROGRAM}
                  sessionToken={sessionToken}
                  displayName={displayName}
                />
              </div>
            </div>
          )
        ) : hasStream && !isLive ? (
          <div className="text-center text-gray-500 italic mb-6 py-4 border border-dashed border-gray-200 rounded-lg">
            Stream will begin when the game starts.
          </div>
        ) : liveLink ? (
          <div className="mb-6">
            <iframe
              src={liveLink}
              title="Live Stream"
              allow="fullscreen"
              className="w-full h-64 rounded-lg border"
            />
          </div>
        ) : null}

        {/* Field Stats */}
        {fieldStats.length > 0 && (
          <div className="mt-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">
              Field Players
            </h3>
            <div className="overflow-x-auto rounded border border-gray-100">
              <table className="w-full text-xs border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-[#5E0009] text-white">
                    <th className="p-2 text-left font-semibold w-28">Player</th>
                    <th className="p-2 text-center font-semibold">G</th>
                    <th className="p-2 text-center font-semibold">A</th>
                    <th className="p-2 text-center font-semibold">SH</th>
                    <th className="p-2 text-center font-semibold">GB</th>
                    <th className="p-2 text-center font-semibold">CT</th>
                    <th className="p-2 text-center font-semibold">TO</th>
                    <th className="p-2 text-center font-semibold">FOW</th>
                    <th className="p-2 text-center font-semibold">FOL</th>
                    <th className="p-2 text-center font-semibold">FO%</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldStats.map((stat: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                      <td className="p-2 font-semibold text-gray-800">{stat.name}</td>
                      <td className="p-2 text-center text-gray-700">{stat.goals ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{stat.assists ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{stat.shotsOnGoal ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{stat.groundBalls ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{stat.causedTurnovers ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{stat.turnovers ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{stat.faceoffWins ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{stat.faceoffLosses ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{formatFoPct(stat.faceoffWins, stat.faceoffLosses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Goalie Stats */}
        {goalieStats.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-3">
              Goalies
            </h3>
            <div className="overflow-x-auto rounded border border-gray-100">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#5E0009] text-white">
                    <th className="p-2 text-left font-semibold w-28">Player</th>
                    <th className="p-2 text-center font-semibold">S</th>
                    <th className="p-2 text-center font-semibold">GA</th>
                  </tr>
                </thead>
                <tbody>
                  {goalieStats.map((stat: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                      <td className="p-2 font-semibold text-gray-800">{stat.name}</td>
                      <td className="p-2 text-center text-gray-700">{stat.saves ?? "-"}</td>
                      <td className="p-2 text-center text-gray-700">{stat.goalsAllowed ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

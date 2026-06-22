import { useEffect, useReducer } from "react";
import { apiRequest } from "../../../../Services/API";
import type { ApiGame, ApiStreamConfig, ApiStreamKey } from "../../../../types/api";

interface GenEntry {
  name: string;
  email: string;
  tier: "ONE_SCREEN" | "TWO_SCREEN";
}

interface State {
  games: ApiGame[];
  selectedGameId: string;
  streamConfig: ApiStreamConfig | null;
  keys: ApiStreamKey[];
  // setup form
  isPaywalled: boolean;
  saveAsVideo: boolean;
  priceOneScreen: string;
  priceTwoScreen: string;
  // key generation form — list of entries
  genEntries: GenEntry[];
  // status
  loading: boolean;
  saving: boolean;
  error: string;
  success: string;
  copyMsg: string;
  isLive: boolean;
}

const BLANK_ENTRY: GenEntry = { name: "", email: "", tier: "ONE_SCREEN" };

type Action =
  | { type: "SET_GAMES"; games: ApiGame[] }
  | { type: "SET_GAME"; gameId: string }
  | { type: "SET_ADMIN_INFO"; config: ApiStreamConfig; keys: ApiStreamKey[]; isLive: boolean }
  | { type: "SET_FIELD"; field: keyof State; value: string | boolean }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_ERROR"; msg: string }
  | { type: "SET_SUCCESS"; msg: string }
  | { type: "SET_COPY"; msg: string }
  | { type: "ADD_ENTRY" }
  | { type: "REMOVE_ENTRY"; index: number }
  | { type: "UPDATE_ENTRY"; index: number; field: keyof GenEntry; value: string }
  | { type: "ADD_KEYS"; newKeys: ApiStreamKey[]; count: number }
  | { type: "REMOVE_KEY"; id: string }
  | { type: "SET_LIVE"; value: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_GAMES":      return { ...state, games: action.games, loading: false };
    case "SET_GAME":       return { ...state, selectedGameId: action.gameId, streamConfig: null, keys: [], error: "", success: "" };
    case "SET_ADMIN_INFO": return {
      ...state,
      streamConfig: action.config,
      keys: action.keys,
      isLive: action.isLive,
      isPaywalled: !!action.config.isPaywalled,
      saveAsVideo: !!(action.config as any).saveAsVideo,
      priceOneScreen: action.config.priceOneScreen?.toString() ?? "5.00",
      priceTwoScreen: action.config.priceTwoScreen?.toString() ?? "10.00",
      loading: false,
    };
    case "SET_FIELD":      return { ...state, [action.field]: action.value };
    case "SET_LOADING":    return { ...state, loading: action.value };
    case "SET_SAVING":     return { ...state, saving: action.value };
    case "SET_ERROR":      return { ...state, error: action.msg, saving: false, success: "" };
    case "SET_SUCCESS":    return { ...state, success: action.msg, saving: false, error: "" };
    case "SET_COPY":       return { ...state, copyMsg: action.msg };
    case "ADD_ENTRY":      return { ...state, genEntries: [...state.genEntries, { ...BLANK_ENTRY }] };
    case "REMOVE_ENTRY":   return { ...state, genEntries: state.genEntries.filter((_, i) => i !== action.index) };
    case "UPDATE_ENTRY": {
      const updated = state.genEntries.map((e, i) =>
        i === action.index ? { ...e, [action.field]: action.value } : e
      );
      return { ...state, genEntries: updated };
    }
    case "ADD_KEYS":       return {
      ...state,
      keys: [...action.newKeys, ...state.keys],
      saving: false,
      error: "",
      success: `${action.count} key${action.count !== 1 ? "s" : ""} generated!`,
      genEntries: [{ ...BLANK_ENTRY }],
    };
    case "REMOVE_KEY":     return { ...state, keys: state.keys.filter((k) => k.id !== action.id) };
    case "SET_LIVE":       return { ...state, isLive: action.value };
    default:               return state;
  }
}

const BASE_URL = "/api/stream";

export default function StreamSetup() {
  const [state, dispatch] = useReducer(reducer, {
    games: [],
    selectedGameId: "",
    streamConfig: null,
    keys: [],
    isPaywalled: false,
    saveAsVideo: false,
    priceOneScreen: "5.00",
    priceTwoScreen: "10.00",
    genEntries: [{ ...BLANK_ENTRY }],
    loading: true,
    saving: false,
    error: "",
    success: "",
    copyMsg: "",
    isLive: false,
  });

  const { games, selectedGameId, streamConfig, keys, isPaywalled, saveAsVideo, priceOneScreen, priceTwoScreen,
    genEntries, loading, saving, error, success, copyMsg, isLive } = state;

  // Load games on mount — filter to today and future only (string compare avoids timezone drift)
  useEffect(() => {
    apiRequest<ApiGame[]>("/api/games")
      .then((list) => {
        const today = new Date().toISOString().substring(0, 10);
        const upcoming = list.filter((g) => !g.date || g.date.substring(0, 10) >= today);
        dispatch({ type: "SET_GAMES", games: upcoming });
      })
      .catch(() => dispatch({ type: "SET_GAMES", games: [] }));
  }, []);

  // Load stream admin info when game selected
  useEffect(() => {
    if (!selectedGameId) return;
    dispatch({ type: "SET_LOADING", value: true });
    apiRequest<{ streamConfig: ApiStreamConfig; keys: ApiStreamKey[] }>(`${BASE_URL}/admin/${selectedGameId}`)
      .then((data) => {
        const cfg = data.streamConfig ?? {};
        dispatch({ type: "SET_ADMIN_INFO", config: cfg, keys: data.keys ?? [], isLive: !!cfg.isLive });
      })
      .catch(() => dispatch({ type: "SET_LOADING", value: false }));
  }, [selectedGameId]);

  const handleSetup = async () => {
    dispatch({ type: "SET_SAVING", value: true });
    try {
      const data = await apiRequest<ApiStreamConfig>(`${BASE_URL}/setup`, {
        method: "POST",
        json: { gameId: selectedGameId, isPaywalled, saveAsVideo, priceOneScreen: parseFloat(priceOneScreen), priceTwoScreen: parseFloat(priceTwoScreen) },
      });
      dispatch({ type: "SET_ADMIN_INFO", config: data, keys, isLive });
      dispatch({ type: "SET_SUCCESS", msg: "Stream configured!" });
    } catch (e) {
      dispatch({ type: "SET_ERROR", msg: e instanceof Error ? e.message : "Setup failed" });
    }
  };

  const handleUpdatePaywall = async () => {
    dispatch({ type: "SET_SAVING", value: true });
    try {
      await apiRequest(`${BASE_URL}/config/${selectedGameId}`, {
        method: "PUT",
        json: { isPaywalled, priceOneScreen: parseFloat(priceOneScreen), priceTwoScreen: parseFloat(priceTwoScreen) },
      });
      dispatch({ type: "SET_SUCCESS", msg: "Paywall updated!" });
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Failed to update paywall" });
    }
  };

  const handleToggleLive = async () => {
    const next = !isLive;
    try {
      await apiRequest(`${BASE_URL}/go-live/${selectedGameId}`, { method: "POST", json: { isLive: next } });
      dispatch({ type: "SET_LIVE", value: next });
    } catch { /* ignore */ }
  };

  const handleGenerateKeys = async () => {
    const valid = genEntries.filter((e) => e.name.trim() && e.email.trim());
    if (valid.length === 0) {
      dispatch({ type: "SET_ERROR", msg: "At least one entry with name and email is required" });
      return;
    }
    dispatch({ type: "SET_SAVING", value: true });
    const newKeys: ApiStreamKey[] = [];
    try {
      for (const entry of valid) {
        const data = await apiRequest<{ id: string; keyCode: string }>(`${BASE_URL}/keys`, {
          method: "POST",
          json: { gameId: selectedGameId, tier: entry.tier, displayName: entry.name.trim(), email: entry.email.trim() },
        });
        newKeys.push({ id: data.id, keyCode: data.keyCode, tier: entry.tier, displayName: entry.name.trim(), email: entry.email.trim(), activeSessions: 0 });
      }
      dispatch({ type: "ADD_KEYS", newKeys, count: newKeys.length });
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Failed to generate one or more keys" });
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm("Revoke this key?")) return;
    await apiRequest(`${BASE_URL}/keys/${id}`, { method: "DELETE" });
    dispatch({ type: "REMOVE_KEY", id });
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    dispatch({ type: "SET_COPY", msg: text });
    setTimeout(() => dispatch({ type: "SET_COPY", msg: "" }), 2000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Stream Setup</h2>

      {/* Game selector */}
      <div>
        <label className="block text-sm font-semibold mb-1">Select Game</label>
        <select
          value={selectedGameId}
          onChange={(e) => dispatch({ type: "SET_GAME", gameId: e.target.value })}
          className="border border-gray-300 rounded px-3 py-2 w-full max-w-sm text-sm"
        >
          <option value="">— Choose a game —</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              vs {g.opponent} — {g.date ? new Date(g.date).toLocaleDateString() : "TBD"}
            </option>
          ))}
        </select>
      </div>

      {loading && selectedGameId && <p className="text-sm text-gray-500">Loading…</p>}

      {selectedGameId && !loading && (
        <>
          {/* Stream credentials */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">OBS Credentials</h3>
            {streamConfig?.rtmpsUrl ? (
              <>
                <CredRow label="RTMPS URL" value={streamConfig.rtmpsUrl!} onCopy={copy} copied={copyMsg === streamConfig.rtmpsUrl} />
                <CredRow label="Stream Key" value={streamConfig.rtmpsKey!} onCopy={copy} copied={copyMsg === streamConfig.rtmpsKey} secret />
              </>
            ) : (
              <p className="text-sm text-gray-500">Not configured yet — click Setup below.</p>
            )}
          </div>

          {/* Paywall config */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Paywall Settings</h3>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isPaywalled}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "isPaywalled", value: e.target.checked })
                }
              />
              Require paid access
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsVideo}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "saveAsVideo", value: e.target.checked })
                }
              />
              Save stream as recording
            </label>
            {isPaywalled && (
              <div className="flex gap-4">
                <div>
                  <label className="text-xs text-gray-600">1-Screen price ($)</label>
                  <input
                    type="number"
                    value={priceOneScreen}
                    onChange={(e) =>
                      dispatch({ type: "SET_FIELD", field: "priceOneScreen", value: e.target.value })
                    }
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24 block mt-1"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">2-Screen price ($)</label>
                  <input
                    type="number"
                    value={priceTwoScreen}
                    onChange={(e) =>
                      dispatch({ type: "SET_FIELD", field: "priceTwoScreen", value: e.target.value })
                    }
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-24 block mt-1"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {!streamConfig?.rtmpsUrl ? (
              <button
                onClick={handleSetup}
                disabled={saving}
                className="bg-[#5E0009] text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Setting up…" : "Setup Stream"}
              </button>
            ) : (
              <button
                onClick={handleUpdatePaywall}
                disabled={saving}
                className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Update Paywall"}
              </button>
            )}

            {streamConfig?.rtmpsUrl && (
              <button
                onClick={handleToggleLive}
                className={`px-4 py-2 rounded text-sm font-semibold text-white ${
                  isLive ? "bg-red-700 hover:bg-red-800" : "bg-green-700 hover:bg-green-800"
                }`}
              >
                {isLive ? "⏹ End Stream" : "▶ Go Live"}
              </button>
            )}
          </div>

          {/* Recordings */}
          {streamConfig?.rtmpsUrl && (streamConfig as any).saveAsVideo && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Recording</h3>
              <p className="text-xs text-gray-500">
                Recording is enabled for this stream. After the stream ends, the file will be available at:
              </p>
              <code className="block bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono break-all">
                {"https://api.missouristatelacrosse.com/recordings/live/" + (streamConfig as any).streamKey + ".mp4"}
              </code>
              <a
                href={"https://api.missouristatelacrosse.com/recordings/live/" + (streamConfig as any).streamKey + ".mp4"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-[#5E0009] hover:underline"
              >
                Open Recording ↗
              </a>
            </div>
          )}

          {/* Key management */}
          {streamConfig?.rtmpsUrl && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-sm">Access Keys</h3>

              {/* Multi-row generate form */}
              <div className="space-y-2">
                {/* Column headers */}
                <div className="flex gap-2 text-xs text-gray-500 font-medium pl-1">
                  <span className="w-36">Name</span>
                  <span className="w-44">Email</span>
                  <span className="w-28">Tier</span>
                </div>

                {genEntries.map((entry, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => dispatch({ type: "UPDATE_ENTRY", index: i, field: "name", value: e.target.value })}
                      placeholder="Display name"
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-36"
                    />
                    <input
                      type="email"
                      value={entry.email}
                      onChange={(e) => dispatch({ type: "UPDATE_ENTRY", index: i, field: "email", value: e.target.value })}
                      placeholder="email@example.com"
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-44"
                    />
                    <select
                      value={entry.tier}
                      onChange={(e) => dispatch({ type: "UPDATE_ENTRY", index: i, field: "tier", value: e.target.value })}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-28"
                    >
                      <option value="ONE_SCREEN">1-Screen</option>
                      <option value="TWO_SCREEN">2-Screen</option>
                    </select>
                    {genEntries.length > 1 && (
                      <button
                        onClick={() => dispatch({ type: "REMOVE_ENTRY", index: i })}
                        className="text-gray-400 hover:text-red-600 text-lg leading-none px-1"
                        title="Remove row"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => dispatch({ type: "ADD_ENTRY" })}
                    className="text-sm text-[#5E0009] hover:underline"
                  >
                    + Add row
                  </button>
                  <button
                    onClick={handleGenerateKeys}
                    disabled={saving}
                    className="bg-[#5E0009] text-white px-3 py-1 rounded text-sm font-semibold disabled:opacity-50"
                  >
                    {saving ? "Generating…" : `Generate Key${genEntries.length > 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>

              {/* Keys table */}
              {keys.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="p-2 text-left">Key Code</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-center">Tier</th>
                        <th className="p-2 text-center">Active</th>
                        <th className="p-2 text-center">Activated</th>
                        <th className="p-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => (
                        <tr key={k.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-mono">
                            <button
                              onClick={() => copy(k.keyCode)}
                              className="hover:text-[#5E0009] transition-colors"
                              title="Copy key"
                            >
                              {copyMsg === k.keyCode ? "✓ Copied" : k.keyCode}
                            </button>
                          </td>
                          <td className="p-2">{k.displayName}</td>
                          <td className="p-2">{k.email}</td>
                          <td className="p-2 text-center">
                            {k.tier === "TWO_SCREEN" ? "2-SCR" : "1-SCR"}
                          </td>
                          <td className="p-2 text-center">
                            <span className={k.activeSessions > 0 ? "text-green-700 font-semibold" : "text-gray-400"}>
                              {k.activeSessions}/{k.tier === "TWO_SCREEN" ? 2 : 1}
                            </span>
                          </td>
                          <td className="p-2 text-center text-gray-500">
                            {k.activatedAt ? new Date(k.activatedAt).toLocaleTimeString() : "—"}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="text-red-600 hover:underline text-xs"
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {keys.length === 0 && (
                <p className="text-xs text-gray-400">No keys generated yet.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CredRow({
  label, value, onCopy, copied, secret = false,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  copied: boolean;
  secret?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 text-gray-500 shrink-0">{label}:</span>
      <span className="font-mono text-xs break-all flex-1">
        {secret ? "••••••••••••" : value}
      </span>
      <button
        onClick={() => onCopy(value)}
        className="text-xs text-[#5E0009] hover:underline shrink-0"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

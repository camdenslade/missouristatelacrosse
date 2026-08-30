import { useEffect, useState } from "react";

import { apiRequest } from "../../../../../Services/API";

type Candidate = { uid: string; displayName: string | null; email: string | null };

function lastNameOf(fullName?: string | null): string {
  const parts = (fullName || "").trim().split(/\s+/);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

export default function AddParentForm({
  addParentEmail,
  setAddParentEmail,
  addParentName,
  setAddParentName,
  handleAddParent,
  handleLinkExistingParent,
  isAdmin,
  playerName,
  excludeUid,
  message,
}) {
  const [mode, setMode] = useState<"invite" | "link">("invite");
  const [suggestions, setSuggestions] = useState<Candidate[]>([]);

  useEffect(() => {
    const lastName = lastNameOf(playerName);
    if (lastName.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const excludeParam = excludeUid ? `&excludeUid=${encodeURIComponent(excludeUid)}` : "";
    apiRequest<Candidate[]>(`/api/users/search-candidates?lastName=${encodeURIComponent(lastName)}${excludeParam}`)
      .then((data) => {
        if (!cancelled) setSuggestions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [playerName, excludeUid]);

  const pickSuggestion = (candidate: Candidate) => {
    if (candidate.email) setAddParentEmail(candidate.email);
    if (candidate.displayName) setAddParentName(candidate.displayName);
    if (isAdmin) setMode("link");
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mt-3">
        <h3 className="font-medium">
          {mode === "invite" ? "Add Parent" : "Link Existing Account"}
        </h3>
        {isAdmin && (
          <div className="flex text-xs rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("invite")}
              className={`px-2.5 py-1 font-medium transition ${
                mode === "invite" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Invite New
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`px-2.5 py-1 font-medium transition ${
                mode === "link" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Link Existing
            </button>
          </div>
        )}
      </div>

      {mode === "link" && (
        <p className="text-xs text-gray-500 mt-1">
          For a parent who already has an account (e.g. approved from an account request). No
          new account or invite email - just links them to this player.
        </p>
      )}

      <div className="flex gap-2 mt-2">
        {mode === "invite" && (
          <input
            type="text"
            placeholder="Parent name"
            value={addParentName}
            onChange={(e) => setAddParentName(e.target.value)}
            className="border px-3 py-2 rounded w-full"
          />
        )}
        <input
          type="email"
          placeholder="Parent email"
          value={addParentEmail}
          onChange={(e) => setAddParentEmail(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />
        <button
          type="button"
          onClick={mode === "invite" ? handleAddParent : handleLinkExistingParent}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
        >
          {mode === "invite" ? "Add" : "Link"}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">
            Possible existing account{suggestions.length > 1 ? "s" : ""} (same last name) - click to fill in:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((c) => (
              <button
                key={c.uid}
                type="button"
                onClick={() => pickSuggestion(c)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700"
                title={c.email || ""}
              >
                {c.displayName || c.email}
              </button>
            ))}
          </div>
        </div>
      )}

      {message && <p className="mt-2 text-sm text-gray-700">{message}</p>}
    </div>
  );
}

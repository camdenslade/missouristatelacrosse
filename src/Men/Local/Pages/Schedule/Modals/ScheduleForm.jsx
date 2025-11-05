// src/Men/Local/Pages/Schedule/Modals/ScheduleForm.jsx
import React, { useReducer, useEffect, useRef } from "react";
import Modal from "../../../Common/Modal.jsx";
import { db } from "../../../Services/firebaseConfig.js";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { uploadCompressedImage } from "../../../Global/Common/hooks/uploadHelper.js";

const getCurrentSeasonShort = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

const generateSeasonOptions = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentStart = m >= 8 ? y : y - 1;
  return Array.from({ length: 4 }, (_, i) => {
    const start = currentStart - i;
    return {
      value: `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`,
      label: `${start}-${start + 1}`,
    };
  });
};

const initialForm = (editingGame, selectedSeason) => ({
  season: editingGame?.season || selectedSeason || getCurrentSeasonShort(),
  type: editingGame?.type || "home",
  opponent: editingGame?.opponent || "",
  date: editingGame?.date
    ? (editingGame.date.toDate?.()
        ? new Date(editingGame.date.toDate().getTime() - editingGame.date.toDate().getTimezoneOffset() * 60000)
            .toISOString()
            .split("T")[0]
        : editingGame.date.split("T")[0])
    : "",
  time: editingGame?.time === "TBD" ? "" : editingGame?.time || "",
  location: editingGame?.location || "",
  awayLogo: editingGame?.awayLogo || null,
  awayLink: editingGame?.awayLink || "",
  isConference: !!editingGame?.isConference,
  isDivision: !!editingGame?.isDivision,
  tournamentType: editingGame?.tournamentType || "none",
});

function reducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };
    case "BULK":
      return { ...state, ...action.data };
    case "RESET":
      return initialForm(action.editingGame, action.selectedSeason);
    default:
      return state;
  }
}

export default function ScheduleFormModal({ editingGame, onClose, onSave, selectedSeason }) {
  const [formData, dispatch] = useReducer(reducer, initialForm(editingGame, selectedSeason));
  const [previewPhoto, setPreviewPhoto] = React.useState(editingGame?.awayLogo || null);
  const [lookupMsg, setLookupMsg] = React.useState("");
  const [uploadProgress, setUploadProgress] = React.useState(null);
  const [loadingLookup, setLoadingLookup] = React.useState(false);
  const opponentInputRef = useRef(null);

  useEffect(() => {
    if (!editingGame && selectedSeason) {
      dispatch({ type: "SET", field: "season", value: selectedSeason });
    }
  }, [selectedSeason, editingGame]);

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (files && files[0]) {
      dispatch({ type: "SET", field: name, value: files[0] });
      setPreviewPhoto(URL.createObjectURL(files[0]));
    } else {
      dispatch({ type: "SET", field: name, value });
    }
  };

  const handleRemoveImage = () => {
    dispatch({ type: "SET", field: "awayLogo", value: null });
    setPreviewPhoto(null);
  };

  const performTeamLookup = async () => {
    const raw = (formData.opponent || "").trim();
    if (raw.length < 2) return setLookupMsg("Type at least 2 characters to search.");

    setLoadingLookup(true);
    setLookupMsg("");
    try{
      const teamsSnap = await getDocs(collection(db, "teams"));
      const teams = teamsSnap.docs.map((d) => d.data());
      const lower = raw.toLowerCase();
      const match = teams.find((t) => t.nameLower === lower || t.nameLower?.startsWith(lower));

      if (!match){
        setLookupMsg("No saved team found — will create new on save.");
        return;
      }

      dispatch({
        type: "BULK",
        data: {
          opponent: match.name || raw,
          awayLogo: match.logo || null,
          awayLink: match.link || "",
        },
      });
      if (match.logo) setPreviewPhoto(match.logo);
      setLookupMsg(`Auto-filled team: ${match.name}`);
    } catch (err){
      console.error("Lookup failed:", err);
      setLookupMsg("Lookup failed. Try again later.");
    } finally{
      setLoadingLookup(false);
    }
  };

  const handleOpponentKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await performTeamLookup();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const teamName = (formData.opponent || "").trim();
    if (!teamName) return alert("Opponent name required.");

    const teamRef = doc(db, "teams", teamName);
    const existing = await getDoc(teamRef);
    let logoURL = existing.exists() ? existing.data()?.logo || "" : "";

    if (formData.awayLogo instanceof File){
      logoURL = await uploadCompressedImage(formData.awayLogo, "teams", setUploadProgress);
    } else if(typeof formData.awayLogo === "string") {
      logoURL = formData.awayLogo;
    }

    const teamData = {
      name: teamName,
      nameLower: teamName.toLowerCase(),
      logo: logoURL,
      link: formData.awayLink || existing.data()?.link || "",
    };

    await setDoc(teamRef, teamData, { merge: true });

    const gameData = {
      ...formData,
      awayLogo: logoURL,
      isConference: !!formData.isConference || !!formData.isDivision,
      isDivision: !!formData.isDivision,
      tournamentType: formData.tournamentType || "none",
    };

    await onSave(gameData, editingGame?.id || null);
    onClose();
  };

  const seasonOptions = generateSeasonOptions();

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off">
        {/* Season */}
        <div>
          <label className="block text-gray-700 font-semibold mb-1">Season</label>
          <select
            name="season"
            value={formData.season}
            onChange={handleInputChange}
            className="p-2 border text-lg w-full"
          >
            {seasonOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} Season
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="block text-gray-700 font-semibold mb-1">Game Type</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            className="p-2 border text-lg w-full"
          >
            <option value="home">Home</option>
            <option value="away">Away</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        {/* Classification */}
        <div className="border-t pt-3 mt-2">
          <label className="block text-gray-700 font-semibold mb-1">Game Classification</label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData.isConference}
                onChange={(e) =>
                  dispatch({
                    type: "BULK",
                    data: {
                      isConference: e.target.checked,
                      isDivision: e.target.checked ? formData.isDivision : false,
                    },
                  })
                }
              />
              <span>Conference Game</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!formData.isDivision}
                onChange={(e) =>
                  dispatch({
                    type: "BULK",
                    data: {
                      isDivision: e.target.checked,
                      isConference: e.target.checked ? true : formData.isConference,
                    },
                  })
                }
              />
              <span>Divisional Game</span>
            </label>

            <div>
              <label className="font-semibold text-gray-700 mb-1 block">Tournament Type</label>
              <select
                name="tournamentType"
                value={formData.tournamentType}
                onChange={handleInputChange}
                className="p-2 border rounded w-full"
              >
                <option value="none">None</option>
                <option value="conference">Conference Tournament</option>
                <option value="national">National Tournament</option>
              </select>
            </div>
          </div>
        </div>

        {/* Opponent */}
        <div className="relative">
          <label className="block text-gray-700 font-semibold mb-1">Opponent</label>
          <input
            ref={opponentInputRef}
            type="text"
            name="opponent"
            required
            value={formData.opponent}
            onChange={handleInputChange}
            onKeyDown={handleOpponentKeyDown}
            onBlur={performTeamLookup}
            placeholder="Opponent name"
            className="p-2 border text-lg w-full pr-10"
          />
          <button
            type="button"
            onClick={performTeamLookup}
            className="absolute right-2 top-[38px] text-gray-600 hover:text-black"
            title="Search teams"
          >
            🔍︎
          </button>
        </div>

        {loadingLookup && <p className="text-sm text-gray-500">Searching…</p>}
        {lookupMsg && <p className="text-sm text-gray-600">{lookupMsg}</p>}

        {/* Date + Time */}
        <div className="flex gap-2">
          <input
            type="date"
            name="date"
            required
            value={formData.date || ""}
            onChange={handleInputChange}
            className="p-2 border text-lg flex-1"
          />
          <input
            type="time"
            name="time"
            value={formData.time || ""}
            onChange={handleInputChange}
            className="p-2 border text-lg flex-1"
          />
        </div>

        {/* Location */}
        <input
          type="text"
          name="location"
          placeholder="Location"
          value={formData.location}
          onChange={handleInputChange}
          className="p-2 border text-lg"
        />

        {/* Opponent Link */}
        <input
          type="text"
          name="awayLink"
          placeholder="Opponent Link"
          value={formData.awayLink}
          onChange={handleInputChange}
          className="p-2 border text-lg"
        />

        {/* Logo Upload */}
        <input
          type="file"
          name="awayLogo"
          accept="image/*"
          onChange={handleInputChange}
          className="p-2 border text-lg"
        />

        {previewPhoto && (
          <div className="flex flex-col items-center">
            <img src={previewPhoto} alt="Preview" className="w-32 h-32 object-contain mt-2" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="px-3 py-1 bg-gray-500 text-white mt-1 text-lg rounded hover:bg-gray-600"
            >
              Remove
            </button>
            {uploadProgress && <p className="text-sm text-gray-600 mt-1">Uploading: {uploadProgress}%</p>}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-between mt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-[#5E0009] text-white text-lg rounded hover:bg-red-800"
          >
            {editingGame ? "Save Changes" : "Add Game"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-400 text-white text-lg rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

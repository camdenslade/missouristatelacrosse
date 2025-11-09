// src/Men/Local/Pages/Gallery/Modals/GalleryUpload.jsx
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import { useEffect, useReducer } from "react";

import useGames from "../../Schedule/hooks/useGames.js";
import { uploadGallery } from "../hooks/galleryService.js";

const initialState = {
  files: [],
  selectedGameId: "",
  customFolder: "",
  uploading: false,
  progress: 0,
  error: "",
};

function reducer(state, action) {
  switch (action.type){
    case "SET_FILES":
      return { ...state, files: action.files, error: "" };
    case "SET_GAME":
      return { ...state, selectedGameId: action.id, customFolder: "" };
    case "SET_CUSTOM_FOLDER":
      return { ...state, customFolder: action.value };
    case "UPLOAD_START":
      return { ...state, uploading: true, progress: 0, error: "" };
    case "PROGRESS":
      return { ...state, progress: action.value };
    case "UPLOAD_SUCCESS":
      return { ...initialState };
    case "ERROR":
      return { ...state, uploading: false, error: action.error };
    default:
      return state;
  }
}

export default function GalleryUploadModal({ onClose, onUpload }){
  const { games, fetchGames } = useGames();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { files, selectedGameId, customFolder, uploading, progress, error } = state;

  useEffect(() => {
    fetchGames();
  }, []);

  const handleFileSelect = (e) => { dispatch({ type: "SET_FILES", files: Array.from(e.target.files) }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length) return dispatch({ type: "ERROR", error: "Please select at least one photo." });
    const folder =
      selectedGameId && games.length
        ? (() => {
            const game = games.find((g) => g.id === selectedGameId);
            if (!game) return customFolder || "Misc";
            const season = game.season || new Date().getFullYear().toString();
            const opponent = game.opponent?.replace(/\s+/g, "-") || "Unknown";
            return `${opponent}-${season}`;
          })()
        : customFolder || "Misc";

    dispatch({ type: "UPLOAD_START" });

    try{
      await uploadGallery(folder, files);
      alert("Photos uploaded successfully!");
      onUpload?.();
      onClose();
      dispatch({ type: "UPLOAD_SUCCESS" });
    } catch (err){
      console.error("Upload failed:", err);
      dispatch({ type: "ERROR", error: "Upload failed. Please try again or contact your admin if this issue persists." });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center p-4"
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative p-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-[#5E0009] mb-4">Upload Photos</h2>

        {error && <p className="text-red-600 text-sm mb-3 text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors ${
              uploading ? "opacity-50" : "hover:border-[#5E0009]"
            }`}
          >
            <ImageIcon className="text-gray-400 mb-2" size={40} />
            <p className="text-gray-600 text-sm">
              Drag & drop or click below to select images
            </p>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="mt-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Link to Game (optional)</label>
            <select
              value={selectedGameId}
              onChange={(e) => dispatch({ type: "SET_GAME", id: e.target.value })}
              disabled={uploading}
              className="w-full border border-gray-300 rounded-lg p-2"
            >
              <option value="">— None / Custom Folder —</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.opponent} —{" "}
                  {game.dateObj?.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
          </div>

          {!selectedGameId && (
            <div>
              <label className="block text-sm font-medium mb-1">Custom Folder Name</label>
              <input
                type="text"
                placeholder="e.g. TeamBanquet-2025"
                value={customFolder}
                onChange={(e) =>
                  dispatch({ type: "SET_CUSTOM_FOLDER", value: e.target.value })
                }
                disabled={uploading}
                className="w-full border border-gray-300 rounded-lg p-2"
              />
            </div>
          )}

          {uploading && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#5E0009] h-3 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin text-[#5E0009]" size={18} />
                <p className="text-sm text-gray-600">{progress}%</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className={`px-4 py-2 rounded text-white font-medium ${
                uploading ? "bg-gray-400" : "bg-[#5E0009] hover:bg-red-800"
              }`}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

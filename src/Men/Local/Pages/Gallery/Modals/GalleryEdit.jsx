// src/Men/Local/Pages/Gallery/Modals/GalleryEdit.jsx
import { X, Trash2, Upload, Edit3, Check, Folder } from "lucide-react";
import { useReducer, useEffect } from "react";

import { uploadGallery, deleteGallery, getGallery } from "../../../../../Global/Gallery/galleryService.js";

const initialState = {
  selectedFolder: "",
  currentName: "",
  editingName: false,
  uploading: false,
  progress: 0,
  localImages: [],
  loadingImages: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FOLDER":
      return { ...state, selectedFolder: action.folder, localImages: [], currentName: "", editingName: false };
    case "SET_CURRENT_NAME":
      return { ...state, currentName: action.name };
    case "TOGGLE_EDIT":
      return { ...state, editingName: !state.editingName };
    case "SET_UPLOAD":
      return { ...state, uploading: action.value, progress: 0 };
    case "SET_PROGRESS":
      return { ...state, progress: action.value };
    case "SET_IMAGES":
      return { ...state, localImages: action.images, loadingImages: false };
    case "LOADING_IMAGES":
      return { ...state, loadingImages: true };
    default:
      return state;
  }
}

export default function GalleryEditModal({ galleries = {}, onClose, onRefresh }){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { selectedFolder, currentName, editingName, uploading, progress, localImages, loadingImages } = state;

  useEffect(() => {
    const loadImages = async () => {
      if (!selectedFolder) return;
      dispatch({ type: "LOADING_IMAGES" });
      try{
        const data = await getGallery(selectedFolder);
        if (data){
          dispatch({ type: "SET_IMAGES", images: data.urls || [] });
          dispatch({ type: "SET_CURRENT_NAME", name: selectedFolder });
        } else{
          dispatch({ type: "SET_IMAGES", images: [] });
        }
      } catch (err){
        console.error("Error loading images:", err);
        dispatch({ type: "SET_IMAGES", images: [] });
      }
    };
    loadImages();
  }, [selectedFolder]);

  const handleRename = async () => {
    if (!selectedFolder || !currentName.trim()) return;
    if (currentName.trim() === selectedFolder){
      dispatch({ type: "TOGGLE_EDIT" });
      return;
    }
    try{
      const data = await getGallery(selectedFolder);
      if (!data) return alert("Folder not found.");

      await uploadGallery(currentName, []);
      await deleteGallery(selectedFolder);
      alert("Folder renamed!");
      dispatch({ type: "SET_FOLDER", folder: currentName });
      onRefresh?.();
    } catch (err){
      console.error("Rename failed:", err);
      alert("Rename failed.");
    } finally{
      dispatch({ type: "TOGGLE_EDIT" });
    }
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!selectedFolder || files.length === 0) return;

    dispatch({ type: "SET_UPLOAD", value: true });
    try{
      await uploadGallery(selectedFolder, files);
      const updated = await getGallery(selectedFolder);
      dispatch({ type: "SET_IMAGES", images: updated?.urls || [] });
      alert("Photos added successfully!");
      onRefresh?.();
    } catch (err){
      console.error("Failed to add photos:", err);
      alert("Upload failed.");
    } finally{
      dispatch({ type: "SET_UPLOAD", value: false });
    }
  };

  const handleDeleteImage = async (url) => {
    if (!selectedFolder) return;
    if (!window.confirm("Delete this photo?")) return;
    const fileName = decodeURIComponent(url.split("/").pop().split("?")[0]);

    try{
      await deleteGallery(selectedFolder, fileName);
      const updated = await getGallery(selectedFolder);
      dispatch({ type: "SET_IMAGES", images: updated?.urls || [] });
      alert("Photo deleted!");
      onRefresh?.();
    } catch (err){
      console.error("Failed to delete photo:", err);
      alert("Delete failed.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl relative p-6 overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-[#5E0009] mb-4 flex items-center gap-2">
          <Folder size={22} /> Edit Gallery
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
          <select
            value={selectedFolder}
            onChange={(e) =>
              dispatch({ type: "SET_FOLDER", folder: e.target.value })
            }
            className="border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-1/2"
          >
            <option value="">— Select a folder —</option>
            {Object.keys(galleries).map((folderName) => (
              <option key={folderName} value={folderName}>
                {folderName}
              </option>
            ))}
          </select>

          {selectedFolder && (
            <div className="flex items-center gap-2">
              {editingName ? (
                <>
                  <input
                    className="border border-gray-300 rounded px-2 py-1"
                    value={currentName}
                    onChange={(e) =>
                      dispatch({ type: "SET_CURRENT_NAME", name: e.target.value })
                    }
                  />
                  <button
                    onClick={handleRename}
                    className="bg-[#5E0009] text-white px-3 py-1 rounded hover:bg-red-800 text-sm flex items-center gap-1"
                  >
                    <Check size={14} /> Save
                  </button>
                </>
              ) : (
                <button
                  onClick={() => dispatch({ type: "TOGGLE_EDIT" })}
                  className="bg-gray-200 px-3 py-1 rounded flex items-center gap-1 hover:bg-gray-300"
                >
                  <Edit3 size={14} /> Rename
                </button>
              )}

              <label className="flex items-center gap-2 bg-[#5E0009] text-white px-3 py-2 rounded hover:bg-red-800 cursor-pointer">
                <Upload size={16} />
                Add Photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddPhotos}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          )}
        </div>

        {uploading && (
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
            <div
              className="bg-[#5E0009] h-3 transition-all duration-200"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {selectedFolder ? (
          loadingImages ? (
            <div className="flex justify-center py-10 text-gray-500 italic">
              Loading images...
            </div>
          ) : localImages.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {localImages.map((url, i) => (
                <div key={i} className="relative group">
                  <img
                    src={url}
                    alt={`Photo ${i}`}
                    className="rounded-lg shadow-md w-full h-40 object-cover"
                  />
                  <button
                    onClick={() => handleDeleteImage(url)}
                    className="absolute top-1 right-1 bg-black bg-opacity-60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic text-center">No photos yet.</p>
          )
        ) : (
          <p className="text-gray-500 italic text-center">
            Select a folder to view or edit its photos.
          </p>
        )}
      </div>
    </div>
  );
}

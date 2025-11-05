// src/Men/Local/Pages/Roster/components/RosterForm.jsx
import { useReducer, useRef, useState } from "react";
import Modal from "../../../Common/Modal.jsx";
import { formatSeason, generateSeasonOptions } from "../../../hooks/seasonUtils.js";
import { uploadCompressedImage } from "../../../Global/Common/hooks/uploadHelper.js";
import usePlayers from "../hooks/usePlayers.js";
import useCoaches from "../hooks/useCoaches.js";

const CLASS_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

const initialForm = (editingItem, season) => ({
  name: editingItem?.name || "",
  number: editingItem?.number || "",
  position: editingItem?.position || "",
  height: editingItem?.height || "",
  weight: editingItem?.weight || "",
  classYear: editingItem?.classYear || "",
  hometown: editingItem?.hometown || "",
  state: editingItem?.state || "",
  highSchool: editingItem?.highSchool || "",
  previousSchool: editingItem?.previousSchool || "",
  bio: editingItem?.bio || "",
  photo: editingItem?.photo || null,
  userID: editingItem?.userID || "",
  season: formatSeason(editingItem?.season || season),
});

function formReducer(state, action){
  switch (action.type){
    case "SET":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return initialForm(action.editingItem, action.isCoach, action.season);
    default:
      return state;
  }
}

export default function RosterFormModal({
  isCoach,
  editingItem,
  onClose,
  onSaved,
  selectedSeason,
}) {
  const [formData, dispatch] = useReducer(
    formReducer,
    initialForm(editingItem, isCoach, selectedSeason)
  );
  const [previewPhoto, setPreviewPhoto] = useState(editingItem?.photo || null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [lookupStatus, setLookupStatus] = useState("");

  const nameLookupTimer = useRef(null);
  const [, , savePlayer, , , findPlayerByName] = usePlayers();
  const [, saveCoach] = useCoaches();

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (files && files[0]) {
      dispatch({ type: "SET", field: name, value: files[0] });
      setPreviewPhoto(URL.createObjectURL(files[0]));
      return;
    }

    dispatch({ type: "SET", field: name, value });

    if (name === "name") {
      if (nameLookupTimer.current) clearTimeout(nameLookupTimer.current);
      nameLookupTimer.current = setTimeout(() => lookupExistingPlayer(value), 600);
    }
  };


  const lookupExistingPlayer = async (nameValue) => {
    if (!nameValue?.trim() || nameValue.trim().length < 2) return;
    try {
      setLookupStatus("Searching...");
      const existing = await findPlayerByName(nameValue);
      if (existing){
        dispatch({ type: "SET", field: "hometown", value: existing.hometown || "" });
        dispatch({ type: "SET", field: "state", value: existing.state || "" });
        dispatch({ type: "SET", field: "highSchool", value: existing.highSchool || "" });
        dispatch({ type: "SET", field: "previousSchool", value: existing.previousSchool || "" });
        dispatch({ type: "SET", field: "classYear", value: existing.classYear || "" });
        if (existing.photo){
          dispatch({ type: "SET", field: "photo", value: existing.photo });
          setPreviewPhoto(existing.photo);
        }
        setLookupStatus(`Imported ${existing.name}'s info`);
      } else{
        setLookupStatus("No existing player found");
      }
    } catch (err){
      console.error("Lookup error:", err);
      setLookupStatus("Error searching player");
    }
  };

  const handleRemoveImage = () => {
    dispatch({ type: "SET", field: "photo", value: null });
    setPreviewPhoto(null);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    try{
      let photoURL = "";

      if (formData.photo instanceof File) {
        photoURL = await uploadCompressedImage(
          formData.photo,
          isCoach ? "coaches" : "players",
          setUploadProgress
        );
      }

      const finalData = {
        ...formData,
        season: formatSeason(formData.season),
        photo: photoURL || (typeof formData.photo === "string" ? formData.photo : ""),
      };

      if (isCoach) await saveCoach(finalData, editingItem?.id);
      else await savePlayer(finalData, editingItem?.id);

      onSaved();
      onClose();
    } catch (err){
      console.error("Error saving roster entry:", err);
      alert("Failed to save. Please try again.");
    }
  };

  const seasonOptions = generateSeasonOptions();

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div>
          <input
            type="text"
            name="name"
            placeholder="Name"
            required
            value={formData.name}
            onChange={handleInputChange}
            className="p-2 border text-lg w-full"
          />
          {lookupStatus && <p className="text-sm text-gray-600 mt-1 italic">{lookupStatus}</p>}
        </div>

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

        {/* Player Fields */}
        {!isCoach && (
          <>
            {[
              ["number", "Number", "number"],
              ["position", "Position"],
              ["height", "Height"],
              ["weight", "Weight"],
              ["hometown", "Hometown"],
              ["state", "State"],
              ["highSchool", "High School"],
              ["previousSchool", "Previous School (optional)"],
            ].map(([name, placeholder, type = "text"]) => (
              <input
                key={name}
                type={type}
                name={name}
                placeholder={placeholder}
                value={formData[name]}
                onChange={handleInputChange}
                className="p-2 border text-lg"
              />
            ))}

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Class Year</label>
              <select
                name="classYear"
                value={formData.classYear}
                onChange={handleInputChange}
                className="p-2 border text-lg w-full"
              >
                <option value="">Select Class</option>
                {CLASS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Coach Fields */}
        {isCoach && (
          <>
            <input
              type="text"
              name="position"
              placeholder="Position"
              value={formData.position}
              onChange={handleInputChange}
              className="p-2 border text-lg"
            />
            <textarea
              name="bio"
              placeholder="Bio (optional)"
              value={formData.bio}
              onChange={handleInputChange}
              className="p-2 border text-lg"
            />
          </>
        )}

        {/* Photo */}
        <input
          type="file"
          name="photo"
          accept="image/*"
          onChange={handleInputChange}
          className="p-2 border"
        />
        {previewPhoto && (
          <div className="flex flex-col items-center">
            <img src={previewPhoto} alt="Preview" className="w-32 h-48 object-cover mt-2" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="px-3 py-1 bg-gray-400 text-white mt-1 text-lg"
            >
              Remove
            </button>
            {uploadProgress && (
              <p className="text-sm text-gray-600 mt-1">Uploading: {uploadProgress}%</p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between mt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-[#5E0009] text-white text-lg hover:bg-red-800"
          >
            {editingItem ? "Save Changes" : "Add"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-400 text-white text-lg"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

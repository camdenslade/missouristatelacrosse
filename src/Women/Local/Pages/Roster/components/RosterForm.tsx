// src/Women/Local/Pages/Roster/components/RosterForm.jsx
import { useReducer, useRef, useState } from "react";

import Modal from "../../../../../Global/Common/Modal";
import { uploadCompressedImage } from "../../../../../Global/Common/hooks/uploadHelper";
import useCoaches from "../contenthooks/useCoaches";
import usePlayers from "../contenthooks/usePlayers";
import { formatSeason, generateSeasonOptions } from "../hooks/seasonUtils";
import { validateNumber, validateText } from "../../../../../Global/Common/utils/validation";

const CLASS_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

type RosterFormData = {
  name: string;
  number: string;
  position: string;
  height: string;
  weight: string;
  classYear: string;
  hometown: string;
  state: string;
  highSchool: string;
  previousSchool: string;
  bio: string;
  photo: File | string | null;
  userID: string;
  season: string;
};

type EditingItem = Partial<RosterFormData> & { id?: string | null };

type FormAction =
  | { type: "SET"; field: keyof RosterFormData; value: RosterFormData[keyof RosterFormData] }
  | { type: "RESET"; editingItem?: EditingItem | null; selectedSeason?: string };

const initialForm = (
  editingItem?: EditingItem | null,
  selectedSeason?: string
): RosterFormData => ({
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
  season: editingItem?.season || selectedSeason || "",
});

function formReducer(state: RosterFormData, action: FormAction): RosterFormData {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return initialForm(action.editingItem, action.selectedSeason);

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
}: {
  isCoach: boolean;
  editingItem?: EditingItem | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  selectedSeason: string;
}) {
  const [formData, dispatch] = useReducer(
    formReducer,
    initialForm(editingItem, selectedSeason)
  );

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(
    typeof editingItem?.photo === "string" ? editingItem.photo : null
  );
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  const nameLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { savePlayer, findPlayerByName } = usePlayers();
  const { saveCoach } = useCoaches();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target;
    const field = target.name as keyof RosterFormData;
    if (target instanceof HTMLInputElement && target.type === "file") {
      const file = target.files?.[0];
      if (file) {
        dispatch({ type: "SET", field, value: file });
        setPreviewPhoto(URL.createObjectURL(file));
      }
      return;
    }

    dispatch({ type: "SET", field, value: target.value });

    if (field === "name") {
      if (nameLookupTimer.current) clearTimeout(nameLookupTimer.current);
      nameLookupTimer.current = setTimeout(
        () => lookupExistingPlayer(target.value),
        600
      );
    }
  };

  const lookupExistingPlayer = async (nameValue: string) => {
    if (!nameValue?.trim() || nameValue.trim().length < 2) return;

    try {
      setLookupStatus("Searching...");
      const existing = await findPlayerByName(nameValue);

      if (existing) {
        dispatch({ type: "SET", field: "hometown", value: existing.hometown || "" });
        dispatch({ type: "SET", field: "state", value: existing.state || "" });
        dispatch({ type: "SET", field: "highSchool", value: existing.highSchool || "" });
        dispatch({ type: "SET", field: "previousSchool", value: existing.previousSchool || "" });
        dispatch({ type: "SET", field: "classYear", value: existing.classYear || "" });

        if (existing.photo) {
          dispatch({ type: "SET", field: "photo", value: existing.photo });
          setPreviewPhoto(existing.photo);
        }

        setLookupStatus(`Imported ${existing.name}'s info`);
      } else {
        setLookupStatus("No existing player found");
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setLookupStatus("Error searching player");
    }
  };

  const handleRemoveImage = () => {
    dispatch({ type: "SET", field: "photo", value: null });
    setPreviewPhoto(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setFormError("");
      const baseValidation =
        validateText(formData.name, "Name", { required: true, max: 80 }) ||
        validateText(formData.season, "Season", { required: true, max: 10 });
      if (baseValidation) {
        setFormError(baseValidation);
        return;
      }

      if (!isCoach) {
        const playerValidation =
          validateNumber(formData.number, "Number", { required: false, min: 0, max: 99 }) ||
          validateText(formData.position, "Position", { required: false, max: 40 }) ||
          validateText(formData.height, "Height", { required: false, max: 20 }) ||
          validateText(formData.weight, "Weight", { required: false, max: 20 }) ||
          validateText(formData.hometown, "Hometown", { required: false, max: 80 }) ||
          validateText(formData.state, "State", { required: false, max: 30 }) ||
          validateText(formData.highSchool, "High school", { required: false, max: 80 }) ||
          validateText(formData.previousSchool, "Previous school", { required: false, max: 80 }) ||
          validateText(formData.classYear, "Class year", { required: false, max: 20 });
        if (playerValidation) {
          setFormError(playerValidation);
          return;
        }
      } else {
        const coachValidation =
          validateText(formData.position, "Position", { required: false, max: 40 }) ||
          validateText(formData.bio, "Bio", { required: false, max: 400 });
        if (coachValidation) {
          setFormError(coachValidation);
          return;
        }
      }

      let photoURL = "";

      if (formData.photo instanceof File) {
        photoURL = await uploadCompressedImage(
          formData.photo,
          isCoach
            ? { type: "coaches", season: formatSeason(formData.season) }
            : { type: "players", season: formatSeason(formData.season) },
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

      await onSaved();
      onClose();
    } catch (err) {
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
          {lookupStatus && (
            <p className="text-sm text-gray-600 mt-1 italic">{lookupStatus}</p>
          )}
          {formError && (
            <p className="text-sm text-red-600 mt-1">{formError}</p>
          )}
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
              <label className="block text-gray-700 font-semibold mb-1">
                Class Year
              </label>
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
            <img
              src={previewPhoto}
              alt="Preview"
              className="w-32 h-48 object-cover mt-2"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="px-3 py-1 bg-gray-400 text-white mt-1 text-lg"
            >
              Remove
            </button>
            {uploadProgress && (
              <p className="text-sm text-gray-600 mt-1">
                Uploading: {uploadProgress}%
              </p>
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


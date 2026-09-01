import { useEffect, useReducer, useRef, useState } from "react";
import toast from "react-hot-toast";

import { uploadCompressedImage } from "../../../../../Global/Common/hooks/uploadHelper";
import Modal from "../../../../../Global/Common/Modal";
import { validateNumber, validateText } from "../../../../../Global/Common/utils/validation";
import { apiRequest } from "../../../../../Services/API";
import useCoaches from "../contenthooks/useCoaches";
import usePlayers from "../contenthooks/usePlayers";
import { formatSeason, fetchSeasons, displaySeasonLabel } from "../hooks/seasonUtils";
import type { Coach, Player, RosterFormData } from "../types";

const CLASS_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

const initialForm = (
  editingItem: Coach | Player | null,
  selectedSeason: string
): RosterFormData => {
  const base = (editingItem ?? {}) as Partial<Player & Coach>;
  return {
    name: base.name || "",
    number: base.number ? String(base.number) : "",
    position: base.position || "",
    height: base.height || "",
    weight: base.weight || "",
    classYear: base.classYear || "",
    hometown: base.hometown || "",
    state: base.state || "",
    highSchool: base.highSchool || "",
    previousSchool: base.previousSchool || "",
    bio: base.bio || "",
    photo: base.photo || null,
    userID: base.userID || "",
    season: base.season || selectedSeason,
    email: base.email || "",
    profileId: base.profileId || "",
  };
};

type FormAction =
  | { type: "SET"; field: keyof RosterFormData; value: RosterFormData[keyof RosterFormData] }
  | { type: "RESET"; editingItem: Coach | Player | null; selectedSeason: string };

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
  editingItem: Coach | Player | null;
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
  const [candidates, setCandidates] = useState<Player[]>([]);
  const [checkingCandidates, setCheckingCandidates] = useState(false);
  const [formError, setFormError] = useState<string>("");
  const [seasonOptions, setSeasonOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    fetchSeasons().then((seasons) =>
      setSeasonOptions(seasons.map((s) => ({ value: s.code, label: s.label || displaySeasonLabel(s.code) })))
    );
  }, []);

  const nameLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { savePlayer } = usePlayers();
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

    // Only search for a brand-new roster entry - an existing row being edited already has
    // whatever profile linkage it has, and re-searching mid-edit would be confusing.
    if (field === "name" && !isCoach && !editingItem) {
      // A prior match no longer applies once the name changes - clear it so a stale
      // profileId doesn't get submitted for someone who no longer matches it.
      dispatch({ type: "SET", field: "profileId", value: "" });
      setLookupStatus("");
      setCandidates([]);
      if (nameLookupTimer.current) clearTimeout(nameLookupTimer.current);
      nameLookupTimer.current = setTimeout(
        () => searchCandidates(target.value),
        600
      );
    }
  };

  const searchCandidates = async (nameValue: string) => {
    if (!nameValue?.trim() || nameValue.trim().length < 2) return;

    setCheckingCandidates(true);
    try {
      const results = await apiRequest<Player[]>(
        `/api/players/search-candidates?name=${encodeURIComponent(nameValue.trim())}`
      );
      setCandidates(results || []);
      if (!results || results.length === 0) {
        setLookupStatus("No existing account found - this will be a new player.");
      }
    } catch (err) {
      console.error("Candidate search error:", err);
      setCandidates([]);
    } finally {
      setCheckingCandidates(false);
    }
  };

  const selectCandidate = (candidate: Player) => {
    dispatch({ type: "SET", field: "hometown", value: candidate.hometown || "" });
    dispatch({ type: "SET", field: "state", value: candidate.state || "" });
    dispatch({ type: "SET", field: "highSchool", value: candidate.highSchool || "" });
    dispatch({ type: "SET", field: "previousSchool", value: candidate.previousSchool || "" });
    dispatch({ type: "SET", field: "classYear", value: candidate.classYear || "" });
    dispatch({ type: "SET", field: "email", value: candidate.email || "" });
    // Explicitly link to the matched player's stable account so this new season row
    // inherits their existing parent links, email, and payment history - this is the whole
    // point of the picker, making that link a deliberate choice instead of a guess.
    dispatch({ type: "SET", field: "profileId", value: candidate.profileId || "" });

    if (candidate.photo) {
      dispatch({ type: "SET", field: "photo", value: candidate.photo });
      setPreviewPhoto(candidate.photo);
    }

    setLookupStatus(`Linked to ${candidate.name}'s existing account (${candidate.season} season).`);
    setCandidates([]);
  };

  const dismissCandidates = () => {
    setCandidates([]);
    setLookupStatus("New player - no existing account linked.");
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
      toast.error("Failed to save. Please try again.");
    }
  };

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
          {checkingCandidates && (
            <p className="text-sm text-gray-600 mt-1 italic">Checking for an existing account…</p>
          )}
          {lookupStatus && (
            <p className="text-sm text-gray-600 mt-1 italic">{lookupStatus}</p>
          )}
          {formError && (
            <p className="text-sm text-red-600 mt-1">{formError}</p>
          )}

          {candidates.length > 0 && (
            <div className="mt-2 border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
              <p className="text-xs text-amber-800 font-medium">
                Found possible existing account{candidates.length > 1 ? "s" : ""} for "{formData.name.trim()}" - 
                pick one to carry their info/parent links/payment history forward, or confirm this is a new player:
              </p>
              {candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded px-2 py-1.5">
                  <span className="text-xs text-gray-700">
                    {c.name} <span className="text-gray-400">({c.season}{c.highSchool ? ` - ${c.highSchool}` : ""})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => selectCandidate(c)}
                    className="px-2 py-1 text-xs bg-[#5E0009] text-white rounded hover:bg-[#7a0012] transition"
                  >
                    Use this account
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={dismissCandidates}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 transition"
              >
                None of these - new player
              </button>
            </div>
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
              ["email", "Email (optional)", "email"],
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
            className="px-4 py-2 bg-[#5E0009] text-white text-lg hover:bg-[#7a0012]"
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

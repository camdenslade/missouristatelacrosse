import { useRef, useState } from "react";

import { useSponsors } from "../../../../Global/Common/hooks/useSponsors";
import { validateText, validateUrl } from "../../../../Global/Common/utils/validation";
import type { ApiSponsor } from "../../../../types/api";

export default function ManageSponsors() {
  const {
    sponsors,
    loading,
    uploadProgress,
    addSponsor,
    updateSponsor,
    removeSponsor,
    moveSponsor,
  } = useSponsors();

  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ApiSponsor | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName("");
    setLink("");
    setLogoFile(null);
    setPreview(null);
    setEditing(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const startEdit = (s: ApiSponsor) => {
    setEditing(s);
    setName(s.name || "");
    setLink(s.link || "");
    setLogoFile(null);
    setPreview(s.logo || null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError =
      validateText(name, "Sponsor name", { required: true, max: 100 }) ||
      (link ? validateUrl(link, "Website link") : null);
    if (validationError) {
      setError(validationError);
      return;
    }

    const logo = logoFile || (editing?.logo ?? null);
    if (!logo && !editing) {
      setError("Please select a logo image.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateSponsor(editing.id, name, link, logoFile || editing.logo || null);
      } else {
        await addSponsor(name, link, logo);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sponsor.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this sponsor?")) return;
    try {
      await removeSponsor(id);
      if (editing?.id === id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove sponsor.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn">
      <h2 className="text-2xl font-bold mb-6">Manage Sponsors</h2>

      {/* Add / Edit Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-gray-50 border rounded p-5 mb-8 space-y-4"
      >
        <h3 className="font-semibold text-lg">
          {editing ? "Edit Sponsor" : "Add Sponsor"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded p-2 focus:ring-2 focus:ring-[#5E0009] outline-none"
              placeholder="Sponsor name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website Link
            </label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full border rounded p-2 focus:ring-2 focus:ring-[#5E0009] outline-none"
              placeholder="https://example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Logo Image
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-sm"
          />
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="mt-2 h-16 object-contain border rounded p-1 bg-white"
            />
          )}
          {uploadProgress && (
            <p className="text-sm text-gray-500 mt-1">Uploading: {uploadProgress}%</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#5E0009] text-white px-5 py-2 rounded font-semibold hover:bg-red-800 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : editing ? "Update" : "Add Sponsor"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2 rounded bg-gray-300 hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Sponsor List */}
      {loading ? (
        <p className="text-gray-600 animate-pulse">Loading sponsors...</p>
      ) : sponsors.length === 0 ? (
        <p className="text-gray-500 text-center">No sponsors yet.</p>
      ) : (
        <div className="space-y-3">
          {sponsors.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-4 bg-gray-50 border rounded p-3"
            >
              {s.logo && (
                <img
                  src={s.logo}
                  alt={s.name || "Sponsor"}
                  className="h-12 w-20 object-contain flex-shrink-0"
                />
              )}

              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{s.name || "Unnamed"}</p>
                {s.link && (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate block"
                  >
                    {s.link}
                  </a>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => moveSponsor(s.id, "up")}
                  disabled={i === 0}
                  className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30"
                  title="Move up"
                >
                  &#9650;
                </button>
                <button
                  onClick={() => moveSponsor(s.id, "down")}
                  disabled={i === sponsors.length - 1}
                  className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30"
                  title="Move down"
                >
                  &#9660;
                </button>
                <button
                  onClick={() => startEdit(s)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

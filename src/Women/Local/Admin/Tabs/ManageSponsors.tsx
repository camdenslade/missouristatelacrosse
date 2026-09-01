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

  const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30";

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Manage Sponsors</h2>

      {/* Add / Edit Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm mb-8 space-y-4"
      >
        <h3 className="text-base font-bold text-gray-900">
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
              className={input}
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
              className={input}
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
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="mt-2 h-16 object-contain border border-gray-200 rounded-lg p-1 bg-white"
            />
          )}
          {uploadProgress && (
            <p className="text-sm text-gray-500 mt-1">Uploading: {uploadProgress}%</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-medium hover:bg-[#7a0012] transition disabled:opacity-60"
          >
            {saving ? "Saving..." : editing ? "Update" : "Add Sponsor"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Sponsor List */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Current Sponsors</h2>

        {loading ? (
          <p className="text-gray-500 animate-pulse text-sm">Loading sponsors...</p>
        ) : sponsors.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No sponsors yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sponsors.map((s, i) => (
              <li
                key={s.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50 rounded-lg px-2 transition"
              >
                {s.logo && (
                  <img
                    src={s.logo}
                    alt={s.name || "Sponsor"}
                    className="h-12 w-20 object-contain shrink-0"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{s.name || "Unnamed"}</p>
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

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => moveSponsor(s.id, "up")}
                    disabled={i === 0}
                    className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-30"
                    title="Move up"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => moveSponsor(s.id, "down")}
                    disabled={i === sponsors.length - 1}
                    className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-30"
                    title="Move down"
                  >
                    &#9660;
                  </button>
                  <button
                    onClick={() => startEdit(s)}
                    className="px-3 py-1.5 text-sm bg-[#5E0009] text-white rounded-lg font-medium hover:bg-[#7a0012] transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

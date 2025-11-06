// src/Men/Local/Pages/Payments/components/AddParentForm.jsx
export default function AddParentForm({
  addParentEmail,
  setAddParentEmail,
  handleAddParent,
  message,
}) {
  
  return (
    <div className="mt-4">
      <h3 className="font-medium">Linked Parents</h3>
      <div className="text-sm text-gray-700"></div>

      <h3 className="font-medium mt-3">Add Parent</h3>
      <div className="flex gap-2 mt-2">
        <input
          type="email"
          placeholder="Parent email"
          value={addParentEmail}
          onChange={(e) => setAddParentEmail(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />
        <button
  type="button"
  onClick={handleAddParent}
  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
>
  Add
</button>

      </div>
      {message && <p className="mt-2 text-sm text-gray-700">{message}</p>}
    </div>
  );
}

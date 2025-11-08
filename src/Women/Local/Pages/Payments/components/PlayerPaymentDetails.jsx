// src/Women/Local/Pages/Payments/components/PlayerPaymentDetails.jsx
import AddParentForm from "./AddParentForm.jsx";

export default function PlayerPaymentDetails({
  userRole,
  selectedPlayer,
  addParentEmail,
  setAddParentEmail,
  handleAddParent,
  handleRemoveParent,
  message,
  customAmount,
  setCustomAmount,
}) {
  const balance = selectedPlayer?.balance || 0;
  const parents = selectedPlayer?.parents || [];

  return (
    <div className="space-y-4">
      <div className="border-b pb-3">
        <h2 className="text-xl font-semibold text-[#5E0009]">
          {selectedPlayer?.name || "Player"}
        </h2>
        <p className="text-sm text-gray-600">Current Balance: ${balance.toFixed(2)}</p>
      </div>

      {userRole === "admin" && (
        <AddParentForm
          addParentEmail={addParentEmail}
          setAddParentEmail={setAddParentEmail}
          handleAddParent={handleAddParent}
          message={message}
        />
      )}

      {parents.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Linked Parents</h3>
          <div className="space-y-2">
            {parents.map((parent, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <span className="text-sm">{parent.email}</span>
                {userRole === "admin" && (
                  <button
                    onClick={() => handleRemoveParent(parent.email)}
                    className="text-red-600 text-sm hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="block font-medium mb-1">Custom Payment Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter amount"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />
      </div>
    </div>
  );
}

// src/Global/Common/UnavailableOverlay.jsx
export default function UnavailableOverlay({ message = "Currently Unavailable", offsetTop = 0 }) {
  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-40 flex items-center justify-center"
      style={{ top: offsetTop }}
      aria-hidden="true"
    >
      <div className="relative bg-white text-center p-8 rounded-lg shadow-2xl max-w-sm mx-4">
        <h2 className="text-2xl font-bold text-[#5E0009] mb-4">Unavailable</h2>
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  );
}

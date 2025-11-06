// src/Global/Common/Modal.jsx
export default function Modal({ children, onClose, size = "md" }) {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 flex justify-center items-center z-50 p-2 sm:p-4 overflow-y-auto pointer-events-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.dataset.closing = "true";
        }
      }}
      onMouseUp={(e) => {
        if (
          e.currentTarget.dataset.closing === "true" &&
          e.target === e.currentTarget
        ) {
          onClose?.();
        }
        delete e.currentTarget.dataset.closing;
      }}
    >
      <div
        className={`pointer-events-auto bg-white p-6 rounded-lg shadow-2xl border border-gray-300 w-full ${sizeClasses[size]} relative my-auto max-h-[90vh] overflow-y-auto animate-fadeIn`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-2 right-2 text-gray-600 hover:text-black"
          onClick={onClose}
        >
          ✕
        </button>

        {children}
      </div>
    </div>
  );
}

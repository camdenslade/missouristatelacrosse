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
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4 overflow-y-auto"
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
        className={`bg-white p-6 rounded-lg shadow-lg w-full ${sizeClasses[size]} relative my-auto max-h-[90vh] overflow-y-auto`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Close button */}
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

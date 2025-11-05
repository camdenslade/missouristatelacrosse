// src/Men/Local/Pages/Roster/components/CoachRow.jsx
import { useState } from "react";

export default function CoachRow({ coach, index, onEdit, onDelete, isAdmin }){
  const {
    name,
    position,
    bio,
    photo,
  } = coach;

  const bg = index % 2 === 0 ? "bg-white" : "bg-gray-100";
  const hasBio = bio?.trim();
  const [showBio, setShowBio] = useState(false);

  const toggleBio = () => {
    if (hasBio) setShowBio((prev) => !prev);
  };

  return (
    <div className={`flex flex-col sm:flex-row w-full ${bg} p-4 items-center sm:items-start`}>
      {/* Coach Image */}
      <img
        src={photo || "/assets/placeholder.png"}
        alt={name}
        className="w-24 h-36 object-cover rounded-md border border-gray-300 mr-0 sm:mr-4 mb-2 sm:mb-0"
        onError={(e) => (e.currentTarget.src = "/assets/placeholder.png")}
      />

      {/* Coach Info */}
      <div className="flex-1 flex flex-col justify-center text-left">
        <div className="text-black text-md font-bold">{position}</div>

        {hasBio ? (
          <button
            onClick={toggleBio}
            className="text-gray-800 font-bold text-2xl mt-2 text-left hover:underline focus:outline-none"
          >
            {name}
          </button>
        ) : (
          <h3 className="text-gray-800 font-bold text-2xl mt-2">{name}</h3>
        )}

        {/* Bio Section (animated expand/collapse) */}
        {hasBio && (
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              showBio ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
            }`}
          >
            <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
              {bio}
            </p>
          </div>
        )}
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 mt-3 sm:mt-0 sm:ml-4">
          <button
            onClick={() => onEdit?.(coach, true)}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete?.(coach, true)}
            className="px-3 py-1 bg-[#5E0009] hover:bg-red-900 text-white rounded text-sm"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function PlayerRow({ player, index, onEdit, onDelete, isAdmin }) {
  const {
    name,
    number,
    position,
    height,
    weight,
    classYear,
    hometown,
    state,
    highSchool,
    previousSchool,
    photo,
  } = player;

  const bg = index % 2 === 0 ? "bg-white" : "bg-gray-100";
  const imgSrc = photo || "/assets/placeholder.png";

  const infoLine = (
    <div className="text-black">
      {classYear && <span className="font-bold">{classYear}</span>}
      {classYear && " / "}
      {hometown && `${hometown}`}
      {state && `, ${state}`}
      {` / ${highSchool || ""}`}
      {previousSchool && ` / ${previousSchool}`}
    </div>
  );

  return (
    <div
      className={`flex flex-col sm:flex-row items-center sm:items-start w-full ${bg} p-4`}
    >
      <img
        src={imgSrc}
        alt={name}
        className="w-24 h-36 object-cover rounded-md mr-0 sm:mr-4 mb-2 sm:mb-0 border border-gray-300"
        onError={(e) => (e.currentTarget.src = "/assets/placeholder.png")}
      />

      <div className="flex-1 flex flex-col sm:flex-row justify-between w-full sm:h-36">
        <div className="flex flex-col justify-center text-left">
          <div className="text-black text-md">
            <span className="font-bold">{position}</span>
            {height && weight && ` | ${height}" | ${weight} lbs`}
          </div>

          <div className="flex items-center mt-2">
            <span className="inline-block w-10 text-center px-2 py-1 bg-[#5E0009] text-white font-bold mr-3">
              {number}
            </span>
            <h3 className="text-gray-800 font-bold text-2xl">{name}</h3>
          </div>

          {/* Mobile Info */}
          <div className="sm:hidden mt-2 text-sm">{infoLine}</div>
        </div>

        {/* Desktop Info */}
        <div className="hidden sm:flex flex-col justify-center text-right text-md">
          {infoLine}
        </div>
      </div>

      {isAdmin && (
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 mt-3 sm:mt-0 sm:ml-4">
          <button
            onClick={() => onEdit?.(player)}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete?.(player)}
            className="px-3 py-1 bg-[#5E0009] hover:bg-red-900 text-white rounded text-sm"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

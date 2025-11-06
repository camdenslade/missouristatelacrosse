// src/Global/Common/Spinner.jsx
function Spinner() {
  return (
    <div className="flex justify-center items-center py-10">
      <div
        className="w-10 h-10 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin"
        role="status"
      ></div>
    </div>
  );
}
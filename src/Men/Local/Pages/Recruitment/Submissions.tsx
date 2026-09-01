import { useEffect, useReducer } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import { apiRequest } from "../../../../Services/API";

const initialState = {
  submissions: [],
  loading: false,
};

function reducer(state, action){
  switch (action.type){
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_SUBMISSIONS":
      return { ...state, submissions: action.payload, loading: false };
    case "DELETE_SUBMISSION":
      return {
        ...state,
        submissions: state.submissions.filter((s) => s.id !== action.payload),
      };
    default:
      return state;
  }
}

export default function RecruitmentSubmissions({ userRole }) {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);
  const canDelete = ["admin", "player"].includes(userRole);

  useEffect(() => {
    const fetchSubmissions = async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const data = await apiRequest("/api/recruitment");
        dispatch({ type: "SET_SUBMISSIONS", payload: data });
      } catch (err) {
        console.error("Error fetching submissions:", err);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    fetchSubmissions();
  }, []);

  const handleDelete = async (id) => {
    if (!await confirm("Are you sure you want to delete this submission?"))
      return;

    try{
      await apiRequest(`/api/recruitment/${id}`, { method: "DELETE" });
      dispatch({ type: "DELETE_SUBMISSION", payload: id });
    } catch (err){
      console.error("Error deleting submission:", err);
      toast.error("Failed to delete submission.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
          <span className="h-px w-6 bg-white/40" />
          Recruiting Pipeline
          <span className="h-px w-6 bg-white/40" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Recruitment Submissions</h1>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-8 pb-16">
        {state.loading && (
          <p className="text-center text-gray-500 animate-pulse py-8">
            Loading submissions...
          </p>
        )}

        {!state.loading && state.submissions.length === 0 && (
          <p className="text-center text-gray-400 py-8">No submissions found.</p>
        )}

        {!state.loading && state.submissions.length > 0 && (
          <>
            {/* Desktop View */}
            <div className="hidden sm:block bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm">
                      <th className="px-4 py-3 text-left font-semibold">Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Email</th>
                      <th className="px-4 py-3 text-left font-semibold">Phone</th>
                      <th className="px-4 py-3 text-left font-semibold">Class Year</th>
                      <th className="px-4 py-3 text-left font-semibold">Position</th>
                      <th className="px-4 py-3 text-left font-semibold">High School</th>
                      <th className="px-4 py-3 text-left font-semibold">Hometown</th>
                      <th className="px-4 py-3 text-left font-semibold">State</th>
                      <th className="px-4 py-3 text-left font-semibold">Instagram</th>
                      {canDelete && <th className="px-4 py-3 text-left font-semibold">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">{sub.name}</td>
                        <td className="px-4 py-3 text-gray-600">{sub.email}</td>
                        <td className="px-4 py-3 text-gray-600">{sub.phone}</td>
                        <td className="px-4 py-3 text-gray-600">{sub.classYear}</td>
                        <td className="px-4 py-3 text-gray-600">{sub.position}</td>
                        <td className="px-4 py-3 text-gray-600">{sub.highSchool}</td>
                        <td className="px-4 py-3 text-gray-600">{sub.hometown}</td>
                        <td className="px-4 py-3 text-gray-600">{sub.state}</td>
                        <td className="px-4 py-3 text-gray-600">{sub.instagram || "-"}</td>
                        {canDelete && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDelete(sub.id)}
                              className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold uppercase tracking-wide rounded-full hover:bg-red-700 transition"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View */}
            <div className="sm:hidden flex flex-col gap-4">
              {state.submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1.5"
                >
                  <p className="font-bold text-gray-900 text-lg mb-1">{sub.name}</p>
                  <div className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Email:</span> {sub.email}</div>
                  <div className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Phone:</span> {sub.phone}</div>
                  <div className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Class Year:</span> {sub.classYear}</div>
                  <div className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Position:</span> {sub.position}</div>
                  <div className="text-sm text-gray-600"><span className="font-semibold text-gray-800">High School:</span> {sub.highSchool}</div>
                  <div className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Hometown:</span> {sub.hometown}</div>
                  <div className="text-sm text-gray-600"><span className="font-semibold text-gray-800">State:</span> {sub.state}</div>
                  <div className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Instagram:</span> {sub.instagram || "-"}</div>

                  {canDelete && (
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-full hover:bg-red-700 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}



// src/Men/Local/Pages/Recruitment/Submissions.jsx
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useEffect, useReducer } from "react";

import { db } from "../../../../Services/firebaseConfig.js";

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
  const [state, dispatch] = useReducer(reducer, initialState);
  const canDelete = ["admin", "player"].includes(userRole);

  useEffect(() => {
    const fetchSubmissions = async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const snapshot = await getDocs(collection(db, "recruitment"));
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        dispatch({ type: "SET_SUBMISSIONS", payload: data });
      } catch (err) {
        console.error("Error fetching submissions:", err);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    fetchSubmissions();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this submission?"))
      return;

    try{
      await deleteDoc(doc(db, "recruitment", id));
      dispatch({ type: "DELETE_SUBMISSION", payload: id });
    } catch (err){
      console.error("Error deleting submission:", err);
      alert("Failed to delete submission.");
    }
  };

  return (
    <div className="max-w-full px-4 py-8">
      <h2 className="text-3xl sm:text-5xl font-bold mb-6 text-center">
        Recruitment Submissions
      </h2>

      {state.loading && (
        <p className="text-center text-gray-600 animate-pulse">
          Loading submissions...
        </p>
      )}

      {!state.loading && state.submissions.length === 0 && (
        <p className="text-center text-gray-500">No submissions found.</p>
      )}

      {/* Desktop View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border">Name</th>
              <th className="px-4 py-2 border">Email</th>
              <th className="px-4 py-2 border">Phone</th>
              <th className="px-4 py-2 border">Class Year</th>
              <th className="px-4 py-2 border">Position</th>
              <th className="px-4 py-2 border">High School</th>
              <th className="px-4 py-2 border">Hometown</th>
              <th className="px-4 py-2 border">State</th>
              <th className="px-4 py-2 border">Instagram</th>
              {canDelete && <th className="px-4 py-2 border">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {state.submissions.map((sub) => (
              <tr key={sub.id} className="text-center">
                <td className="px-4 py-2 border">{sub.name}</td>
                <td className="px-4 py-2 border">{sub.email}</td>
                <td className="px-4 py-2 border">{sub.phone}</td>
                <td className="px-4 py-2 border">{sub.classYear}</td>
                <td className="px-4 py-2 border">{sub.position}</td>
                <td className="px-4 py-2 border">{sub.highSchool}</td>
                <td className="px-4 py-2 border">{sub.hometown}</td>
                <td className="px-4 py-2 border">{sub.state}</td>
                <td className="px-4 py-2 border">{sub.instagram || "-"}</td>
                {canDelete && (
                  <td className="px-4 py-2 border">
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
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

      {/* Mobile View */}
      <div className="sm:hidden flex flex-col gap-4">
        {state.submissions.map((sub) => (
          <div
            key={sub.id}
            className="border rounded p-4 shadow-sm bg-white flex flex-col gap-2"
          >
            <div><span className="font-semibold">Name:</span> {sub.name}</div>
            <div><span className="font-semibold">Email:</span> {sub.email}</div>
            <div><span className="font-semibold">Phone:</span> {sub.phone}</div>
            <div><span className="font-semibold">Class Year:</span> {sub.classYear}</div>
            <div><span className="font-semibold">Position:</span> {sub.position}</div>
            <div><span className="font-semibold">High School:</span> {sub.highSchool}</div>
            <div><span className="font-semibold">Hometown:</span> {sub.hometown}</div>
            <div><span className="font-semibold">State:</span> {sub.state}</div>
            <div><span className="font-semibold">Instagram:</span> {sub.instagram || "-"}</div>

            {canDelete && (
              <button
                onClick={() => handleDelete(sub.id)}
                className="mt-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


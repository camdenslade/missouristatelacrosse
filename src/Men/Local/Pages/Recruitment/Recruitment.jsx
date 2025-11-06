// src/Men/Local/Pages/Recruitment/Recruitment.jsx
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useReducer } from "react";
import { Link } from "react-router-dom";

import { db } from "../../../../Services/firebaseConfig.js";

const initialState = {
  formData: {
    name: "",
    email: "",
    phone: "",
    classYear: "",
    position: "",
    hometown: "",
    highSchool: "",
    state: "",
    instagram: "",
  },
  submitting: false,
};

function reducer(state, action){
  switch (action.type){
    case "UPDATE_FIELD":
      return {
        ...state,
        formData: { ...state.formData, [action.name]: action.value },
      };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.payload };
    case "RESET_FORM":
      return initialState;
    default:
      return state;
  }
}

export default function RecruitmentForm({ userRole }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleChange = (e) => {
    const { name, value } = e.target;
    dispatch({ type: "UPDATE_FIELD", name, value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({ type: "SET_SUBMITTING", payload: true });
    try{
      await addDoc(collection(db, "recruitment"), {
        ...state.formData,
        program: "men",
        timestamp: serverTimestamp(),
      });

      alert("Submission successful! Saved to recruitment");
      dispatch({ type: "RESET_FORM" });
    } catch (err){
      console.error(err);
      alert("Failed to submit. Please try again.");
      dispatch({ type: "SET_SUBMITTING", payload: false });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
        <h2 className="text-3xl sm:text-5xl font-bold">Recruitment Form</h2>

        {(userRole === "admin" || userRole === "player") && (
          <Link
            to="/recruitment/submissions"
            className="px-4 py-2 bg-[#5E0009] text-white text-lg rounded hover:bg-red-800 transition"
          >
            View Submissions
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {[
          { name: "name", placeholder: "Full Name", type: "text" },
          { name: "email", placeholder: "Email", type: "email" },
          { name: "phone", placeholder: "Phone Number", type: "text" },
          { name: "classYear", placeholder: "Class Year", type: "text" },
          { name: "position", placeholder: "Position", type: "text" },
          { name: "hometown", placeholder: "Hometown", type: "text" },
          { name: "highSchool", placeholder: "High School", type: "text" },
          { name: "state", placeholder: "State", type: "text" },
          { name: "instagram", placeholder: "Instagram Handle (optional)", type: "text" },
        ].map((field) => (
          <input
            key={field.name}
            type={field.type}
            name={field.name}
            placeholder={field.placeholder}
            value={state.formData[field.name]}
            onChange={handleChange}
            required={field.name !== "instagram"}
            className="p-3 border rounded shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-[#5E0009] w-full"
          />
        ))}

        <button
          type="submit"
          disabled={state.submitting}
          className="px-4 py-3 bg-[#5E0009] text-white text-lg rounded hover:bg-red-800 transition w-full sm:w-auto mt-4"
        >
          {state.submitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}

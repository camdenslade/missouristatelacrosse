// src/Global/Authentcation/RequestAccessForm.jsx
import { useReducer } from "react";
import { db } from "../../Services/firebaseConfig.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getActiveProgram } from "../../Services/programHelper.js";

const initialState = {
  form: { name: "", email: "" },
  submitted: false,
  error: "",
  submitting: false,
};

function reducer(state, action) {
  switch (action.type){
    case "SET_FORM":
      return { ...state, form: { ...state.form, [action.name]: action.value } };
    case "RESET_FORM":
      return { ...state, form: { name: "", email: "" } };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_SUBMITTED":
      return { ...state, submitted: action.value };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.value };
    default:
      return state;
  }
}

export default function RequestAccessForm(){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { form, submitted, error, submitting } = state;

  const program = getActiveProgram();

  const handleChange = (e) =>
    dispatch({ type: "SET_FORM", name: e.target.name, value: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "SET_SUBMITTING", value: true });

    try{
      await addDoc(collection(db, "accountRequests"), {
        ...form,
        program,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      dispatch({ type: "SET_SUBMITTED", value: true });
      dispatch({ type: "RESET_FORM" });
    } catch (err){
      console.error("Error submitting request:", err);
      dispatch({
        type: "SET_ERROR",
        error: "Failed to submit request. Please try again.",
      });
    } finally{
      dispatch({ type: "SET_SUBMITTING", value: false });
    }
  };

  if (submitted){
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center animate-fadeIn">
        <h2 className="text-xl font-semibold text-[#5E0009] mb-2">
          Request Submitted
        </h2>
        <p className="text-gray-700">
          Your request for access to the{" "}
          <span className="font-semibold">
            {program === "women"
              ? "Missouri State Women’s Lacrosse"
              : "Missouri State Men’s Lacrosse"}
          </span>{" "}
          program has been sent for approval.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 bg-white p-6 shadow-md rounded-lg max-w-md mx-auto"
    >
      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Full Name"
        required
        className="border px-3 py-2 rounded"
      />
      <input
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        placeholder="Email"
        required
        className="border px-3 py-2 rounded"
      />

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className={`bg-[#5E0009] text-white py-2 px-4 rounded hover:bg-red-800 transition ${
          submitting ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {submitting ? "Submitting..." : "Request Access"}
      </button>

      <p className="text-sm text-gray-500 text-center mt-2">
        Submitting request for <strong>{program.toUpperCase()}</strong> program
      </p>
    </form>
  );
}

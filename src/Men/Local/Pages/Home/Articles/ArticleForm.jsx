// src/Men/Local/Pages/Home/Articles/ArticleForm.jsx
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useEffect, useReducer } from "react";

import { storage } from "../../../../../Services/firebaseConfig.js";

const initialState = {
  title: "",
  content: "",
  published: false,
  imageFile: null,
  imageURL: "",
  uploading: false,
};

function reducer(state, action){
  switch (action.type){
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET":
      return initialState;
    case "LOAD_ARTICLE":
      return {
        ...state,
        title: action.article?.title || "",
        content: action.article?.content || "",
        published: action.article?.published || false,
        imageURL: action.article?.image || "",
        imageFile: null,
      };
    case "SET_UPLOADING":
      return { ...state, uploading: action.value };
    default:
      return state;
  }
}

export default function ArticleForm({ article, onSave, onCancel }){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { title, content, published, imageFile, imageURL, uploading } = state;

  useEffect(() => {
    if (article) dispatch({ type: "LOAD_ARTICLE", article });
    else dispatch({ type: "RESET" });
  }, [article]);

  const handleImageUpload = async () => {
    if (!imageFile) return imageURL;
    dispatch({ type: "SET_UPLOADING", value: true });
    const storageRef = ref(storage, `articles/${Date.now()}_${imageFile.name}`);
    await uploadBytes(storageRef, imageFile);
    const url = await getDownloadURL(storageRef);
    dispatch({ type: "SET_UPLOADING", value: false });
    return url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) return alert("Title and content are required.");
    const finalURL = await handleImageUpload();
    if (!finalURL) return alert("Image is required.");
    await onSave({ title, content, published }, finalURL);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-2">
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) =>
          dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })
        }
        className="border p-2 rounded w-full"
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) =>
          dispatch({ type: "SET_FIELD", field: "imageFile", value: e.target.files[0] })
        }
        className="border p-2 rounded w-full"
      />
      {uploading && <div className="text-gray-600">Uploading image…</div>}
      {imageURL && !imageFile && (
        <div className="text-gray-600 text-sm">Current image is uploaded.</div>
      )}
      <textarea
        placeholder="Content"
        value={content}
        onChange={(e) =>
          dispatch({ type: "SET_FIELD", field: "content", value: e.target.value })
        }
        className="border p-2 rounded w-full h-32"
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "published", value: e.target.checked })
          }
        />
        Published
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-[#5E0009] text-white px-4 py-2 rounded hover:bg-red-800 transition"
        >
          {article ? "Update Article" : "Add Article"}
        </button>
        {article && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-400 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
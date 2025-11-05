// src/Men/Local/Pages/Home/Articles/ManageArticles.jsx
import { useEffect, useReducer } from "react";
import { db } from "../../services/firebaseConfig.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "../../Context/AuthContext.jsx";
import ArticleForm from "./ArticleForm.jsx";
import ArticleList from "./ArticleList.jsx";

const initialState = {
  articles: [],
  editingArticle: null,
  hasPermission: false,
  loadingRole: true,
};

function reducer(state, action){
  switch (action.type){
    case "SET_ARTICLES":
      return { ...state, articles: action.articles };
    case "SET_EDITING":
      return { ...state, editingArticle: action.article };
    case "SET_PERMISSION":
      return { ...state, hasPermission: action.value };
    case "SET_LOADING_ROLE":
      return { ...state, loadingRole: action.value };
    default:
      return state;
  }
}

export default function ManageArticlesModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { articles, editingArticle, hasPermission, loadingRole } = state;
  const collectionName = "articles";

  useEffect(() => {
    if (!user) return;
    const checkUserRole = async () => {
      dispatch({ type: "SET_LOADING_ROLE", value: true });
      try{
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const roles = userSnap.data().roles || {};
          const userRole = roles.men?.toLowerCase?.() || "player";
          dispatch({
            type: "SET_PERMISSION",
            value: ["admin", "player"].includes(userRole),
          });
        }
      } catch (err){
        console.error("Error checking user role:", err);
        dispatch({ type: "SET_PERMISSION", value: false });
      } finally{
        dispatch({ type: "SET_LOADING_ROLE", value: false });
      }
    };
    checkUserRole();
  }, [user]);

  const fetchArticles = async () => {
    const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    dispatch({
      type: "SET_ARTICLES",
      articles: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  };

  useEffect(() => {
    if (isOpen) fetchArticles();
  }, [isOpen]);

  const handleSave = async (formData, imageURL) => {
    if (!hasPermission) return alert("You do not have permission to modify these articles.");

    if (editingArticle){
      await updateDoc(doc(db, collectionName, editingArticle.id), {
        ...formData,
        image: imageURL,
        updatedAt: serverTimestamp(),
      });
    } else{
      await addDoc(collection(db, collectionName), {
        ...formData,
        image: imageURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    dispatch({ type: "SET_EDITING", article: null });
    fetchArticles();
  };

  const handleDelete = async (id) => {
    if (!hasPermission) return alert("You do not have permission to delete articles.");
    if (window.confirm("Are you sure you want to delete this article?")) {
      await deleteDoc(doc(db, collectionName, id));
      fetchArticles();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl p-6 relative overflow-y-auto max-h-[90vh]">
        <button
          className="absolute top-2 right-2 text-gray-700 font-bold text-xl"
          onClick={onClose}
        >
          ×
        </button>

        <h2 className="text-2xl font-bold mb-4">Manage Men’s Articles</h2>

        {loadingRole ? (
          <p className="text-gray-500 italic mb-4">Checking permissions...</p>
        ) : !hasPermission ? (
          <p className="text-red-600 font-medium mb-4">
            You don’t have permission to add or edit these articles.
          </p>
        ) : (
          <ArticleForm
            article={editingArticle}
            onSave={handleSave}
            onCancel={() => dispatch({ type: "SET_EDITING", article: null })}
          />
        )}

        <ArticleList
          articles={articles}
          onEdit={hasPermission ? (a) => dispatch({ type: "SET_EDITING", article: a }) : null}
          onDelete={hasPermission ? handleDelete : null}
        />
      </div>
    </div>
  );
}

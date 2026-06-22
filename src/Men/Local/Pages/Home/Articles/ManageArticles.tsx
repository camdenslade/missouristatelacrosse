// src/Men/Local/Pages/Home/Articles/ManageArticles.jsx
import { useEffect, useReducer } from "react";
import type { ApiArticle, ApiUser } from "../../../../../types/api";
import toast from "react-hot-toast";
import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";

import { useAuth } from "../../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../../Services/API";
import { getActiveProgram } from "../../../../../Services/programHelper";
import ArticleForm from "./ArticleForm";
import ArticleList from "./ArticleList";

type ManageArticlesState = {
  articles: ApiArticle[];
  editingArticle: ApiArticle | null;
  hasPermission: boolean;
  loadingRole: boolean;
};

type ManageArticlesAction =
  | { type: "SET_ARTICLES"; articles: ApiArticle[] }
  | { type: "SET_EDITING"; article: ApiArticle | null }
  | { type: "SET_PERMISSION"; value: boolean }
  | { type: "SET_LOADING_ROLE"; value: boolean };

type ArticleFormData = {
  title: string;
  content: string;
  published: boolean;
};

type ManageArticlesProps = {
  isOpen: boolean;
  onClose: () => void;
};

const initialState: ManageArticlesState = {
  articles: [],
  editingArticle: null,
  hasPermission: false,
  loadingRole: true,
};

function reducer(state: ManageArticlesState, action: ManageArticlesAction): ManageArticlesState {
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

export default function ManageArticlesModal({ isOpen, onClose }: ManageArticlesProps) {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { articles, editingArticle, hasPermission, loadingRole } = state;
  const collectionName = "articles";

  useEffect(() => {
    if (!user) return;
    const checkUserRole = async () => {
      dispatch({ type: "SET_LOADING_ROLE", value: true });
      try{
        const userData = await apiRequest<ApiUser>(`/api/users/${user.uid}`);
        const program = getActiveProgram();
        const roles = userData?.roles || {};
        const userRole = roles?.[program]?.toLowerCase?.() || "player";
        dispatch({
          type: "SET_PERMISSION",
          value: ["admin", "player"].includes(userRole),
        });
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
    const snapshot = await apiRequest<ApiArticle[]>(`/api/articles`);
    dispatch({
      type: "SET_ARTICLES",
      articles: snapshot,
    });
  };

  useEffect(() => {
    if (isOpen) fetchArticles();
  }, [isOpen]);

  const handleSave = async (formData: ArticleFormData, imageURL: string) => {
    if (!hasPermission) { toast.error("You do not have permission to modify these articles."); return; }

    if (editingArticle){
      await apiRequest(`/api/articles/${editingArticle.id}`, {
        method: "PUT",
        json: {
          ...formData,
          image: imageURL,
        },
      });
    } else{
      await apiRequest(`/api/articles`, {
        method: "POST",
        json: {
          ...formData,
          image: imageURL,
        },
      });
    }

    dispatch({ type: "SET_EDITING", article: null });
    fetchArticles();
  };

  const handleDelete = async (id: string) => {
    if (!hasPermission) { toast.error("You do not have permission to delete articles."); return; }
    const ok = await confirm("Are you sure you want to delete this article?");
    if (ok) {
      await apiRequest(`/api/articles/${id}`, { method: "DELETE" });
      fetchArticles();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl p-6 relative overflow-y-auto max-h-[90vh]">
        <button
          className="absolute top-2 right-2 text-gray-700 font-bold text-xl"
          onClick={onClose}
        >
          ×
        </button>

        <h2 className="text-2xl font-bold mb-4">Manage Men's Articles</h2>

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


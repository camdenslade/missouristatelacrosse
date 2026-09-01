import { X } from "lucide-react";
import { useEffect, useReducer } from "react";
import toast from "react-hot-toast";

import ArticleForm from "./ArticleForm";
import ArticleList from "./ArticleList";
import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";
import { useAuth } from "../../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../../Services/API";
import { getActiveProgram } from "../../../../../Services/programHelper";
import type { ApiArticle, ApiUser } from "../../../../../types/api";

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="w-full max-w-3xl shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
        <div className="relative px-8 py-6 bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite] pointer-events-none" />
          <style>{`@keyframes shimmer{0%,100%{transform:translateX(-100%)}50%{transform:translateX(100%)}}`}</style>
          <div className="relative flex justify-between items-center">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                Admin
              </div>
              <h3 className="text-xl font-bold leading-tight text-white">Manage Men's Articles</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-white hover:bg-white/15 transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto">
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
    </div>
  );
}


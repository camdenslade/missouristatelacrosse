import { Pencil, Trash2 } from "lucide-react";

export default function ArticleRow({ article, onEdit, onDelete }) {
  const programLabel =
    article.program === "women"
      ? "Women’s"
      : article.program === "men"
      ? "Men’s"
      : null;

  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex items-center gap-3">
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${
            article.published ? "bg-emerald-500" : "bg-gray-300"
          }`}
        />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{article.title}</p>
          <p className="text-gray-400 text-xs">
            {article.published ? "Published" : "Draft"}
            {programLabel && <span className="italic"> ({programLabel})</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button
            onClick={() => onEdit(article)}
            aria-label="Edit article"
            className="p-2 rounded-full text-gray-400 hover:text-[#5E0009] hover:bg-gray-100 transition"
          >
            <Pencil size={16} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(article.id)}
            aria-label="Delete article"
            className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

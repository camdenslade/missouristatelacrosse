// src/Women/Local/Pages/Home/Articles/ArticleRow.jsx
export default function ArticleRow({ article, onEdit, onDelete }) {
  const programLabel =
    article.program === "women"
      ? "Women’s"
      : article.program === "men"
      ? "Men’s"
      : null;

  return (
    <div className="flex justify-between items-center border p-2 rounded">
      <div>
        <div className="font-semibold">{article.title}</div>
        <div className="text-sm text-gray-600">
          {article.published ? "Published" : "Draft"}
          {programLabel && (
            <span className="ml-2 text-gray-400 italic">({programLabel})</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onEdit(article)}
          className="text-blue-600 hover:underline"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(article.id)}
          className="text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

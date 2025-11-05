// src/Men/Local/Pages/Home/Articles/ArticleList.jsx
import ArticleRow from "./ArticleRow.jsx";

export default function ArticleList({ articles, onEdit, onDelete }) {
  const program =
    window.location.pathname.toLowerCase().includes("/women") ? "women" : "men";

  if (!articles.length) {
    return (
      <div className="text-center text-gray-500 py-4">
        No {program === "women" ? "women’s" : "men’s"} articles found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <ArticleRow
          key={article.id}
          article={article}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
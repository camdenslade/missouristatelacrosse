import ArticleRow from "./ArticleRow";

export default function ArticleList({ articles, onEdit, onDelete }) {
  const program =
    window.location.pathname.toLowerCase().includes("/women") ? "women" : "men";

  if (!articles.length) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">
        No {program === "women" ? "women’s" : "men’s"} articles found.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-gray-100">
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

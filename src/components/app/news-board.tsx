
import { ArticleListItem } from "./article-list-item";
import type { ArticleWithStatus } from "@/app/page";

interface NewsBoardProps {
  articles: ArticleWithStatus[];
}

export function NewsBoard({ articles }: NewsBoardProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold text-muted-foreground">No news to display</h2>
        <p className="text-muted-foreground mt-2">Select a collection and click "Fetch Top Stories" to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <ArticleListItem key={article.link} article={article} />
      ))}
    </div>
  );
}

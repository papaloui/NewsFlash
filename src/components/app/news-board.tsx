import type { SummarizedArticle } from "@/lib/types";
import { ArticleCard } from "./article-card";

interface NewsBoardProps {
  articles: SummarizedArticle[];
}

export function NewsBoard({ articles }: NewsBoardProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold text-muted-foreground">No news to display</h2>
        <p className="text-muted-foreground mt-2">Select a collection and fetch the news to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.link} article={article} />
      ))}
    </div>
  );
}

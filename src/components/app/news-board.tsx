import { ArticleListItem } from "./article-list-item";
import type { ArticleWithSummary } from "@/lib/schemas";

interface NewsBoardProps {
  articles: ArticleWithSummary[];
  onSummarize: (link: string) => void;
}

export function NewsBoard({ articles, onSummarize }: NewsBoardProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold text-muted-foreground">No news to display</h2>
        <p className="text-muted-foreground mt-2">Use the chat below to search for news.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <ArticleListItem key={article.link} article={article} onSummarize={onSummarize} />
      ))}
    </div>
  );
}

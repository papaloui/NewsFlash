
import { ArticleListItem } from "./article-list-item";
import type { Article } from "@/lib/types";

// The body is now potentially part of the Article object from the start
type ArticleWithContent = Article & { body?: string };

interface NewsBoardProps {
  articles: ArticleWithContent[];
  onSummarize: (link: string) => void;
}

export function NewsBoard({ articles, onSummarize }: NewsBoardProps) {
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
        <ArticleListItem key={article.link} article={article} onSummarize={onSummarize} />
      ))}
    </div>
  );
}

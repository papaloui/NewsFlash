import { ArticleCard } from "./article-card";
import { ArticleWithSummary } from "@/app/page";

interface NewsBoardProps {
  articles: ArticleWithSummary[];
  onSummarize: (link: string) => void;
}

export function NewsBoard({ articles, onSummarize }: NewsBoardProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <h2 className="text-xl font-semibold text-muted-foreground">No news to display</h2>
        <p className="text-muted-foreground mt-2">Select a topic to fetch the news.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.link} article={article} onSummarize={onSummarize} />
      ))}
    </div>
  );
}

import type { SummarizedArticle } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Globe, ExternalLink } from "lucide-react";

interface ArticleCardProps {
  article: SummarizedArticle;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-xl font-bold leading-tight">
          {article.headline}
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            <span>{article.source}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{article.publicationDate}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div>
          <h3 className="font-semibold text-sm mb-1 text-primary">Headline Summary</h3>
          <p className="text-sm text-muted-foreground">{article.summary}</p>
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-1 text-primary">Full Article Summary</h3>
          <p className="text-sm text-muted-foreground">{article.fullSummary}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm">
          <a href={article.link} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Read Original
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

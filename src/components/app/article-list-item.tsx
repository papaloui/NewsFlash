
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Globe, ExternalLink, FileText, Loader2 } from "lucide-react";
import type { ArticleWithSummary } from "@/lib/schemas";
import { Badge } from "../ui/badge";

// Updated type to expect a 'body' property
type ArticleWithContent = ArticleWithSummary & { body?: string };

interface ArticleListItemProps {
  article: ArticleWithContent;
  onSummarize: (link: string) => void;
}

export function ArticleListItem({ article, onSummarize }: ArticleListItemProps) {
  
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardContent className="p-4 space-y-3">
        <div>
          <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold leading-tight hover:underline">
            {article.headline}
          </a>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" />
                  <span>{article.source}</span>
              </div>
              <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>{article.publicationDate}</span>
              </div>
          </div>
        </div>

        {article.body ? (
          <div className="pt-3 border-t">
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Article Body
            </h4>
            <p className="text-sm text-muted-foreground max-h-48 overflow-y-auto">{article.body}</p>
          </div>
        ) : (
          <div className="pt-3 border-t flex items-center gap-2 text-muted-foreground">
             <Loader2 className="h-4 w-4 animate-spin" />
             <span>Fetching article content...</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
           <Button asChild variant="outline" size="sm">
              <a href={article.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Read Original
              </a>
           </Button>
        </div>
      </CardContent>
    </Card>
  );
}

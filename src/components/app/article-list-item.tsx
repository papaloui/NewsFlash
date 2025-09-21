
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Globe, ExternalLink } from "lucide-react";
import type { Article } from "@/lib/types";

interface ArticleListItemProps {
  article: Article;
}

export function ArticleListItem({ article }: ArticleListItemProps) {
  
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
        
        <p className="text-sm text-muted-foreground pt-3 border-t">{article.summary}</p>

        <div className="flex items-center justify-end gap-2 pt-2">
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

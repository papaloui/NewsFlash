import type { RankedArticle } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Globe, ExternalLink, Star } from "lucide-react";
import { Badge } from "../ui/badge";

interface ArticleCardProps {
  article: RankedArticle;
}

export function ArticleCard({ article }: ArticleCardProps) {
  
  const relevanceColor = (score: number) => {
    if (score > 0.8) return 'bg-green-100 border-green-300 text-green-800';
    if (score > 0.6) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-gray-100 border-gray-300 text-gray-800';
  };
  
  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-xl font-bold leading-tight">
          {article.headline}
        </CardTitle>
        <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1.5">
                    <Globe className="h-4 w-4" />
                    <span>{article.source}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{article.publicationDate}</span>
                </div>
            </div>
             <Badge variant="outline" className={`font-mono text-xs ${relevanceColor(article.relevanceScore)}`}>
                <Star className="mr-1.5 h-3 w-3 fill-current" />
                {article.relevanceScore.toFixed(2)}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
          <p className="text-sm text-muted-foreground">{article.summary}</p>
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

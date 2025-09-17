
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Globe, ExternalLink, Loader2, BookOpen, Sparkles } from "lucide-react";
import type { Article } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

type ArticleWithStatus = Article & { 
  body?: string;
  aiSummary?: string;
  isSummarizing?: boolean;
};


interface ArticleListItemProps {
  article: ArticleWithStatus;
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
        
        <div className="pt-3 border-t">
          {article.isSummarizing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating summary...</span>
            </div>
          )}
          {article.aiSummary && (
             <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Summary</h3>
                <p className="text-sm text-muted-foreground">{article.aiSummary}</p>
             </div>
          )}
           {!article.isSummarizing && !article.aiSummary && article.body && article.body.length > 100 && (
              <p className="text-sm text-red-500">Could not generate a summary for this article.</p>
           )}
        </div>


        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>
                <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Read Full Article
                </span>
            </AccordionTrigger>
            <AccordionContent>
                {article.body ? (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{article.body}</p>
                  </div>
                ) : (
                  <div className="pt-3 border-t flex items-center gap-2 text-muted-foreground">
                     <Loader2 className="h-4 w-4 animate-spin" />
                     <span>Fetching article content...</span>
                  </div>
                )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>


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


import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Globe, ExternalLink, FileText, Loader2, BookOpen } from "lucide-react";
import type { Article } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

type ArticleWithContent = Article & { body?: string };

interface ArticleListItemProps {
  article: ArticleWithContent;
  onSummarize: (link: string) => void;
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
        
        {article.summary && (
            <p className="text-sm text-muted-foreground pt-2 border-t">{article.summary}</p>
        )}

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

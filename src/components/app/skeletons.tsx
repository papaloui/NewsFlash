import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ArticleCardSkeleton() {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
        </div>
      </CardContent>
      <CardFooter>
        <Skeleton className="h-8 w-24" />
      </CardFooter>
    </Card>
  );
}

export function NewsBoardSkeleton() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ArticleCardSkeleton />
            <ArticleCardSkeleton />
            <ArticleCardSkeleton />
        </div>
    )
}

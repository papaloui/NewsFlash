
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

function ListItemSkeleton() {
  return (
     <Card>
        <CardContent className="p-4 space-y-4">
            <div>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                </div>
            </div>
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-5/6" />
            <div className="flex justify-end">
                <Skeleton className="h-9 w-24" />
            </div>
        </CardContent>
     </Card>
  )
}

export function NewsBoardSkeleton({ status }: { status?: string }) {
    return (
        <div className="space-y-4">
            {status && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{status}</span>
                </div>
            )}
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
        </div>
    )
}

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
            <div className="flex justify-end">
                <Skeleton className="h-9 w-24" />
            </div>
        </CardContent>
     </Card>
  )
}


export function NewsBoardSkeleton() {
    return (
        <div className="space-y-4">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
        </div>
    )
}

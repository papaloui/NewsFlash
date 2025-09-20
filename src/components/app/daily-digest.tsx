
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Loader2 } from "lucide-react";

interface DailyDigestProps {
  digest: string;
  isLoading: boolean;
}

export function DailyDigest({ digest, isLoading }: DailyDigestProps) {
  return (
    <Card className="bg-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          Today's Digest
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !digest ? (
            <div className="flex items-center gap-2 text-primary/90">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating digest...</span>
            </div>
        ) : (
            <p className="text-primary/90">{digest}</p>
        )}
      </CardContent>
    </Card>
  );
}

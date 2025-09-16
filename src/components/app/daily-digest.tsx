import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

interface DailyDigestProps {
  digest: string;
}

export function DailyDigest({ digest }: DailyDigestProps) {
  return (
    <Card className="bg-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          Today's Digest
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-primary/90">{digest}</p>
      </CardContent>
    </Card>
  );
}

import { Rss, Landmark, FileText, BookMarked } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <Rss className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            NewsFlash
          </h1>
        </Link>

        <nav className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/house-of-commons">
                <Landmark className="mr-2 h-4 w-4" />
                House of Commons
              </Link>
            </Button>
             <Button asChild variant="outline">
              <Link href="/bills">
                <FileText className="mr-2 h-4 w-4" />
                Bills
              </Link>
            </Button>
             <Button asChild variant="outline">
              <Link href="/canada-gazette">
                <BookMarked className="mr-2 h-4 w-4" />
                Canada Gazette
              </Link>
            </Button>
        </nav>
      </div>
    </header>
  );
}

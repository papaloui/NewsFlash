import { Rss, Landmark, FileText, BookMarked, Building, BookCopy, FileCode, Newspaper, HeartPulse, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const DropdownNav = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="outline">
                {title}
                <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
            {children}
        </DropdownMenuContent>
    </DropdownMenu>
);

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

        <nav className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline">
              <Link href="/fitness">
                <HeartPulse className="mr-2 h-4 w-4" />
                Fitness
              </Link>
            </Button>

            <DropdownNav title="Federal">
                <DropdownMenuItem asChild>
                    <Link href="/house-of-commons">
                        <Landmark className="mr-2 h-4 w-4" />
                        House of Commons
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/bills">
                        <FileText className="mr-2 h-4 w-4" />
                        Bills
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/canada-gazette">
                        <BookMarked className="mr-2 h-4 w-4" />
                        Canada Gazette
                    </Link>
                </DropdownMenuItem>
            </DropdownNav>
            
            <DropdownNav title="Ontario">
                 <DropdownMenuItem asChild>
                    <Link href="/ontario-bills">
                        <Building className="mr-2 h-4 w-4" />
                        Ontario Bills
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/ontario-debates">
                        <BookCopy className="mr-2 h-4 w-4" />
                        Ontario Debates
                    </Link>
                </DropdownMenuItem>
                 <DropdownMenuItem asChild>
                    <Link href="/ontario-gazette">
                        <Newspaper className="mr-2 h-4 w-4" />
                        Ontario Gazette
                    </Link>
                </DropdownMenuItem>
            </DropdownNav>

            <Button asChild variant="ghost">
              <Link href="/documentation">
                <FileCode className="mr-2 h-4 w-4" />
                Docs
              </Link>
            </Button>
        </nav>
      </div>
    </header>
  );
}

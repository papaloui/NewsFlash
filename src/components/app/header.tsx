import { Rss } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center gap-3">
        <div className="bg-primary text-primary-foreground p-2 rounded-lg">
          <Rss className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          NewsFlash
        </h1>
      </div>
    </header>
  );
}

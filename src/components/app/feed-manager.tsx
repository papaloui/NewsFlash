
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FeedCollection } from '@/lib/types';
import { PlusCircle, Trash2, Edit, X, Rss, Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';

interface FeedManagerProps {
  collections: FeedCollection[];
  setCollections: React.Dispatch<React.SetStateAction<FeedCollection[]>>;
  selectedCollectionId: string | null;
  setSelectedCollectionId: React.Dispatch<React.SetStateAction<string | null>>;
  onFetch: () => void;
  isFetching: boolean;
  fetchingStatus?: string;
}

export function FeedManager({ collections, setCollections, selectedCollectionId, setSelectedCollectionId, onFetch, isFetching, fetchingStatus }: FeedManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<FeedCollection | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [feeds, setFeeds] = useState(['']);

  const handleOpenDialog = (collection?: FeedCollection) => {
    if (collection) {
      setEditingCollection(collection);
      setCollectionName(collection.name);
      setFeeds(collection.feeds.length > 0 ? collection.feeds : ['']);
    } else {
      setEditingCollection(null);
      setCollectionName('');
      setFeeds(['']);
    }
    setDialogOpen(true);
  };

  const handleSaveCollection = () => {
    if (!collectionName.trim()) return;
    const validFeeds = feeds.filter(feed => feed.trim().startsWith('http'));

    if (editingCollection) {
      const updatedCollections = collections.map(c =>
        c.id === editingCollection.id ? { ...c, name: collectionName, feeds: validFeeds } : c
      );
      setCollections(updatedCollections);
    } else {
      const newCollection = { id: Date.now().toString(), name: collectionName, feeds: validFeeds };
      const newCollections = [...collections, newCollection];
      setCollections(newCollections);
      setSelectedCollectionId(newCollection.id);
    }
    setDialogOpen(false);
  };
  
  const handleDeleteCollection = (id: string) => {
    const updatedCollections = collections.filter(c => c.id !== id);
    setCollections(updatedCollections);
    if(selectedCollectionId === id) {
        setSelectedCollectionId(updatedCollections.length > 0 ? updatedCollections[0].id : null);
    }
  };

  const handleFeedChange = (index: number, value: string) => {
    const newFeeds = [...feeds];
    newFeeds[index] = value;
    setFeeds(newFeeds);
  };
  
  const addFeedInput = () => setFeeds([...feeds, '']);
  const removeFeedInput = (index: number) => {
    if (feeds.length > 1) {
        setFeeds(feeds.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-grow">
          <Label className="text-sm font-medium text-muted-foreground mb-2 block">News Collections</Label>
          {collections.length > 0 ? (
            <Tabs value={selectedCollectionId ?? ''} onValueChange={setSelectedCollectionId}>
              <TabsList className="flex-wrap h-auto justify-start">
                {collections.map(collection => (
                  <div key={collection.id} className="relative group p-1">
                    <TabsTrigger value={collection.id} className="pr-8">{collection.name}</TabsTrigger>
                     <Button variant="ghost" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleOpenDialog(collection)}>
                        <Edit className="h-3 w-3" />
                     </Button>
                  </div>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">No collections yet. Add one to get started!</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => handleOpenDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Manage Collections
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>{editingCollection ? 'Edit' : 'Add'} Collection</DialogTitle>
                <DialogDescription>
                  {editingCollection ? 'Update the details' : 'Create a new collection'} of RSS feeds.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={collectionName} onChange={e => setCollectionName(e.target.value)} className="col-span-3" placeholder="e.g., Tech News" />
                </div>
                <Separator />
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">RSS Feeds</Label>
                   <div className="col-span-3 space-y-2">
                    {feeds.map((feed, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input value={feed} onChange={e => handleFeedChange(index, e.target.value)} placeholder="https://example.com/rss.xml" />
                        <Button variant="ghost" size="icon" onClick={() => removeFeedInput(index)} disabled={feeds.length <= 1}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                     <Button variant="outline" size="sm" onClick={addFeedInput}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add another feed
                     </Button>
                   </div>
                </div>
              </div>
              <DialogFooter className="sm:justify-between sm:flex-row-reverse mt-4">
                 <Button onClick={handleSaveCollection}>Save changes</Button>
                {editingCollection && (
                  <Button variant="destructive" onClick={() => {
                      handleDeleteCollection(editingCollection.id);
                      setDialogOpen(false);
                  }}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={onFetch} disabled={isFetching || !selectedCollectionId}>
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rss className="mr-2 h-4 w-4" />}
            {isFetching ? (fetchingStatus || 'Fetching...') : 'Fetch Top Stories'}
          </Button>
        </div>
      </div>
    </div>
  );
}

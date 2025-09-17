
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles, Bot, User, Loader2 } from 'lucide-react';
import { askHansardAgent } from '@/app/house-of-commons/actions';
import { ScrollArea } from '../ui/scroll-area';

interface HansardChatProps {
    transcript: string;
    summary: string;
}

interface ChatMessage {
    role: 'user' | 'ai';
    content: string;
}

export function HansardChat({ transcript, summary }: HansardChatProps) {
    const [query, setQuery] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const handleQuery = async () => {
        if (!query.trim()) return;

        const newMessages: ChatMessage[] = [...messages, { role: 'user', content: query }];
        setMessages(newMessages);
        setIsThinking(true);
        setQuery('');

        try {
            const response = await askHansardAgent(transcript, summary, query);
            setMessages([...newMessages, { role: 'ai', content: response }]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            setMessages([...newMessages, { role: 'ai', content: `Error: ${errorMessage}` }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bot />
                    Chat with the Transcript
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-96 pr-4 mb-4 border rounded-md">
                   <div className="space-y-4 p-4">
                        {messages.length === 0 && (
                            <div className="text-center text-muted-foreground">
                                Ask a question about the debate to get started.
                            </div>
                        )}
                        {messages.map((message, index) => (
                            <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                                {message.role === 'ai' && <Bot className="h-6 w-6 text-primary flex-shrink-0" />}
                                <div className={`p-3 rounded-lg max-w-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                </div>
                                {message.role === 'user' && <User className="h-6 w-6 flex-shrink-0" />}
                            </div>
                        ))}
                         {isThinking && (
                            <div className="flex gap-3">
                                <Bot className="h-6 w-6 text-primary flex-shrink-0" />
                                <div className="p-3 rounded-lg bg-muted flex items-center">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                </div>
                            </div>
                        )}
                   </div>
                </ScrollArea>

                <div className="flex gap-2">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                        placeholder="Ask about who said what, key topics, etc."
                        disabled={isThinking}
                    />
                    <Button onClick={handleQuery} disabled={isThinking}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {isThinking ? 'Thinking...' : 'Ask'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

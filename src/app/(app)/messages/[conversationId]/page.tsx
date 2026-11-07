"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversationMessages } from "@/hooks/use-conversations";
import { useProfile } from "@/hooks/use-profile";
import { useAblyChannel } from "@/hooks/use-ably";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { data: profile } = useProfile();
  const { data, isLoading, send } = useConversationMessages(conversationId);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const messages = data?.messages ?? [];
  const myId = profile?.user.id;

  useAblyChannel(
    conversationId ? `conversation:${conversationId}` : null,
    (event) => {
      if (event === "message") {
        void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      }
    },
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await send.mutateAsync(text);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-4 py-4 lg:px-6">
      <ScrollArea className="flex-1 rounded-xl border border-border bg-card">
        <div className="space-y-3 p-4">
          {isLoading && (
            <p className="text-center text-sm text-muted-foreground">Loading messages…</p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === myId;
            return (
              <div
                key={m.id}
                className={cn("flex flex-col max-w-[85%]", mine ? "ml-auto items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    mine ? "bg-accent text-accent-foreground" : "bg-muted",
                  )}
                >
                  {m.content}
                </div>
                <span className="mt-1 text-[10px] text-muted-foreground">
                  {format(new Date(m.createdAt), "MMM d, h:mm a")}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          disabled={send.isPending}
        />
        <Button type="submit" variant="accent" disabled={send.isPending || !draft.trim()}>
          {send.isPending ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

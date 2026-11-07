"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAssistant } from "@/hooks/use-assistant";
import { cn } from "@/lib/utils";
import { useUiStore, type AiStudioTab } from "@/stores/ui-store";

const SUGGESTIONS: Record<AiStudioTab, string[]> = {
  self: [
    "Help me sound warmer but still professional.",
    "Add my interest in hiking and board games.",
    "Shorten this to two clear paragraphs.",
  ],
  seeking: [
    "I want ambitious but kind collaborators.",
    "Looking for gym buddies near campus.",
    "Prefer people who value deep conversation.",
  ],
};

function AssistantPanel({ side, title }: { side: AiStudioTab; title: string }) {
  const { data, isLoading, send, undo } = useAssistant(side);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const history = data?.history ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length, send.isPending]);

  const onSend = async (text: string) => {
    const message = text.trim();
    if (!message) return;
    setDraft("");
    try {
      const result = await send.mutateAsync(message);
      if (result.shouldUpdate && result.changesSummary?.length) {
        toast.success(result.changesSummary[0] ?? "Profile updated");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">
          {side === "self" ? "Who you are" : "Who you're looking for"}
        </p>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-4">
          {isLoading && (
            <p className="text-center text-sm text-muted-foreground">Loading conversation…</p>
          )}
          {history.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "ml-auto bg-accent text-accent-foreground"
                  : "mr-auto border border-border bg-muted/60",
              )}
            >
              {msg.content}
            </div>
          ))}
          {send.isPending && (
            <div className="mr-auto flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="space-y-2 border-t border-border p-4">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS[side].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void onSend(s)}
              className="rounded-md border border-border bg-card px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
        <motion.div layout className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tell the assistant what to change…"
            className="min-h-[72px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend(draft);
              }
            }}
          />
          <div className="flex shrink-0 flex-col gap-2">
            <Button
              size="icon"
              variant="accent"
              disabled={send.isPending || !draft.trim()}
              onClick={() => void onSend(draft)}
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              disabled={undo.isPending}
              title="Undo last profile update"
              onClick={() =>
                void undo.mutateAsync().then(() => toast.message("Reverted last change"))
              }
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function AiProfileStudio() {
  const aiStudioOpen = useUiStore((s) => s.aiStudioOpen);
  const setAiStudioOpen = useUiStore((s) => s.setAiStudioOpen);
  const tab = useUiStore((s) => s.aiStudioTab);
  const setTab = useUiStore((s) => s.setAiStudioTab);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const desktopPanel = (
    <aside
      className={cn(
        "hidden w-[min(24rem,32vw)] shrink-0 flex-col border-l border-border bg-card lg:flex",
        !aiStudioOpen && "lg:hidden",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="font-display text-sm font-semibold">AI Profile Studio</span>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setAiStudioOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex border-b border-border p-1">
        {(
          [
            ["self", "About Me"],
            ["seeking", "Ideal People"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 rounded-md py-2 text-xs font-medium transition-colors",
              tab === value ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <motion.div
        key={tab}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <AssistantPanel
          side={tab}
          title={tab === "self" ? "About Me" : "My Ideal People"}
        />
      </motion.div>
    </aside>
  );

  const mobileDock = (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card shadow-md lg:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setMobileExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2 font-display text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-accent" />
          AI Studio
        </span>
        <ChevronUp
          className={cn("h-4 w-4 transition-transform", mobileExpanded && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {mobileExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "min(70vh, 520px)" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="flex border-b border-border p-1">
              {(
                [
                  ["self", "About Me"],
                  ["seeking", "Ideal People"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "flex-1 rounded-md py-2 text-xs font-medium",
                    tab === value ? "bg-muted" : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="h-[calc(min(70vh,520px)-88px)]">
              <AssistantPanel
                side={tab}
                title={tab === "self" ? "About Me" : "My Ideal People"}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {desktopPanel}
      {mobileDock}
    </>
  );
}

export function AiStudioToggle() {
  const open = useUiStore((s) => s.aiStudioOpen);
  const toggle = useUiStore((s) => s.toggleAiStudio);

  return (
    <Button
      variant="outline"
      size="sm"
      className="hidden gap-2 lg:inline-flex"
      onClick={toggle}
    >
      <Sparkles className="h-4 w-4 text-accent" />
      {open ? "Hide studio" : "AI Studio"}
    </Button>
  );
}

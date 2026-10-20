"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Send, Loader2, HelpCircle } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { currentGuide } from "@/lib/ai/guide";
type Message = {
  role: "user" | "assistant";
  content: string;
  links?: { label: string; href: string }[];
};
export function AppAssistant() {
  const pathname = usePathname();
  return <PageAssistant key={pathname} pathname={pathname} />;
}
function PageAssistant({ pathname }: { pathname: string }) {
  const page = currentGuide(pathname);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [context, setContext] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const onHelp = (e: Event) => {
      setContext(String((e as CustomEvent<string>).detail).slice(0, 500));
    };
    const onInvalid = () =>
      setContext("A required form field is missing or invalid on this page.");
    window.addEventListener("taxtech:help", onHelp);
    document.addEventListener("invalid", onInvalid, true);
    return () => {
      window.removeEventListener("taxtech:help", onHelp);
      document.removeEventListener("invalid", onInvalid, true);
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  async function ask(text: string) {
    if (busy || !text.trim()) return;
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setQuestion("");
    setBusy(true);
    setError("");
    const request = new AbortController();
    controller.current = request;
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathname,
          question: text,
          context,
          history: history.map((m) => ({
            role: m.role,
            content: m.content.slice(0, 2000),
          })),
        }),
        signal: request.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer, links: data.links },
      ]);
    } catch (e) {
      if (!request.signal.aborted) {
        setError(
          e instanceof Error ? e.message : "Could not connect. Try again.",
        );
        setQuestion(text);
      }
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="fixed bottom-5 right-5 z-40 rounded-full shadow-md" />
        }
      >
        <MessageCircle className="size-4" />
        {context ? "Need a hand?" : "Ask TaxTech"}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Help with {page.title.toLowerCase()}</SheetTitle>
          <SheetDescription>
            Page guidance and AI assistance. You stay in control.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 space-y-5">
          <details open className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">
              How this page works
            </summary>
            <ol className="mt-3 list-decimal pl-4 space-y-2 text-sm text-muted-foreground">
              {page.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </details>
          {context && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <HelpCircle className="mr-1 inline size-4" />
              {context} Ask below for help.
            </p>
          )}
          {!messages.length && (
            <Button
              variant="outline"
              className="h-auto whitespace-normal text-left"
              onClick={() => ask(page.prompt)}
              disabled={busy}
            >
              {page.prompt}
            </Button>
          )}
          <div
            role="log"
            aria-label="Assistant conversation"
            aria-live="polite"
            className="space-y-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 ${m.role === "user" ? "bg-muted ml-5" : "border mr-3"}`}
              >
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  {m.role === "user" ? "You" : "TaxTech assistant"}
                </p>
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                {m.links?.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="mt-2 mr-3 inline-block text-sm underline"
                  >
                    {l.label} →
                  </Link>
                ))}
              </div>
            ))}
          </div>
          {busy && (
            <p
              role="status"
              className="flex gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Working on your question…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error} You can resend your question.
            </p>
          )}
          <div ref={end} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          className="space-y-2 border-t p-4"
        >
          <label htmlFor="assistant-question" className="sr-only">
            Ask about using TaxTech
          </label>
          <div className="flex gap-2">
            <textarea
              id="assistant-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1200}
              rows={2}
              placeholder="What are you trying to do?"
              className="min-w-0 flex-1 rounded-md border bg-background p-2 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send question"
              disabled={busy || !question.trim()}
            >
              <Send className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Uses NVIDIA Nemotron on Nebius. Your question, page and record
            counts are sent when you ask. Avoid private details. AI guidance can
            be wrong.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}

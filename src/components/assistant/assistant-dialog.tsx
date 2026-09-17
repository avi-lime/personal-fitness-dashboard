"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CornerDownLeft, Mic, MicOff, Sparkle, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/common/use-action";
import { runQuickEntryAction } from "@/server/actions/quick-entry";
import { QUICK_ENTRY_EXAMPLES, describeIntent, parseQuickEntry } from "@/lib/quick-entry";
import type { AssistantResponse, AssistantTurn, PendingAction } from "@/assistant/types";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "./use-speech-recognition";
import { useSpeechSynthesis } from "./use-speech-synthesis";

interface Exchange {
  id: number;
  heard: string;
  reply: string;
  actions: AssistantResponse["actions"];
  understood: boolean;
}

const CONFIRM_WORDS = /^(yes|yep|yeah|confirm|do it|go ahead|ok|okay|sure)\.?$/i;
const CANCEL_WORDS = /^(no|nope|cancel|stop|never mind|nevermind)\.?$/i;

/**
 * One box for everything. A recognised quick command runs locally with no
 * network; anything else goes to the assistant, which answers in a sentence and
 * lists what it did. Destructive requests come back as a card to confirm.
 */
export function AssistantDialog({
  open,
  onOpenChange,
  assistantEnabled,
  autoListen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assistantEnabled: boolean;
  /** Start the microphone as soon as the dialog opens. */
  autoListen?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          if (!autoListen) return;
          // Voice mode: keep focus off the text field, or the phone (and a
          // touch-screen PC) pops up the on-screen keyboard over the dialog
          // while the microphone is already listening.
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        className={cn(
          "gap-0 p-0 sm:max-w-lg",
          // Bottom sheet on phones: full width, pinned above the keyboard, with a grab handle.
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[80dvh] max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-foreground/20 sm:hidden" aria-hidden />
        <DialogHeader className="sr-only">
          <DialogTitle>Quick entry and assistant</DialogTitle>
          <DialogDescription>
            Type a command like &ldquo;+500 ml water&rdquo;, or ask the assistant to do something.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AssistantPanel
            assistantEnabled={assistantEnabled}
            autoListen={autoListen}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssistantPanel({
  assistantEnabled,
  autoListen,
  onDone,
}: {
  assistantEnabled: boolean;
  autoListen: boolean;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const historyRef = useRef<AssistantTurn[]>([]);
  const idRef = useRef(0);
  const router = useRouter();
  const { pending: quickPending, run } = useAction();

  const intent = useMemo(() => parseQuickEntry(value), [value]);
  const tts = useSpeechSynthesis();

  const record = (heard: string, response: AssistantResponse) => {
    tts.speak(response.reply);
    idRef.current += 1;
    setExchanges((previous) => [
      ...previous,
      {
        id: idRef.current,
        heard,
        reply: response.reply,
        actions: response.actions,
        understood: response.understood,
      },
    ]);
    const turns: AssistantTurn[] = [
      { role: "user", content: heard },
      { role: "assistant", content: response.reply },
    ];
    historyRef.current = [...historyRef.current, ...turns].slice(-6);
  };

  const post = async (url: string, body: unknown): Promise<AssistantResponse | null> => {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as AssistantResponse | { error: string };
      if (!response.ok || "error" in json) {
        toast.error("error" in json ? json.error : "The assistant did not respond.");
        return null;
      }
      if (json.actions.length > 0) router.refresh();
      return json;
    } catch {
      toast.error("Could not reach the assistant.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const ask = async (text: string) => {
    const response = await post("/api/assistant", { input: text, history: historyRef.current });
    if (!response) return;
    record(text, response);
    setPending(response.pending ?? null);
  };

  const confirm = async () => {
    if (!pending) return;
    const response = await post("/api/assistant/confirm", {
      tool: pending.tool,
      args: pending.args,
    });
    setPending(null);
    if (response) record("Yes", response);
  };

  const submitText = (raw: string) => {
    const text = raw.trim();
    if (!text || busy || quickPending) return;
    setValue("");

    if (pending && CONFIRM_WORDS.test(text)) return void confirm();
    if (pending && CANCEL_WORDS.test(text)) {
      setPending(null);
      return;
    }

    const parsed = parseQuickEntry(text);
    if (parsed) {
      run(() => runQuickEntryAction(text), { success: describeIntent(parsed), onSuccess: onDone });
      return;
    }
    if (!assistantEnabled) {
      toast.error("Not a recognised command. Set ASSISTANT_API_KEY to enable the assistant.");
      setValue(text);
      return;
    }
    void ask(text);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    submitText(value);
  };

  // Dictation: interim text fills the box; the final utterance is submitted as-is.
  const speech = useSpeechRecognition((text, final) => {
    setValue(text);
    if (final && text) submitText(text);
  });
  const { start: startListening, supported: speechSupported } = speech;
  useEffect(() => {
    if (autoListen && speechSupported) startListening();
  }, [autoListen, speechSupported, startListening]);
  useEffect(() => {
    if (speech.error) toast.error(speech.error);
  }, [speech.error]);

  const placeholder = assistantEnabled ? "+500 ml water · or tell the assistant what to do" : "+500 ml water";

  return (
    <div className="flex flex-col">
      {exchanges.length > 0 ? (
        <ol className="max-h-72 space-y-4 overflow-y-auto border-b px-5 py-4" aria-live="polite">
          {exchanges.map((exchange) => (
            <li key={exchange.id} className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Heard: {exchange.heard}</p>
              <p className={cn("text-sm", !exchange.understood && "text-muted-foreground")}>
                {exchange.reply}
              </p>
              {exchange.actions.length > 0 ? (
                <ul className="space-y-1">
                  {exchange.actions.map((action, index) => (
                    <li
                      key={`${exchange.id}-${index}`}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-hidden />
                      <span>{action.summary}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {pending ? (
        <div className="space-y-3 border-b bg-secondary/60 px-5 py-4">
          <p className="text-sm font-medium">{pending.summary}</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void confirm()}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <form onSubmit={submit} className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={speech.listening ? "Listening…" : placeholder}
            autoFocus={!autoListen}
            disabled={busy}
            aria-label="Quick entry or assistant command"
            className="h-12 text-base md:text-base"
          />
          {speech.supported ? (
            <Button
              type="button"
              variant={speech.listening ? "default" : "outline"}
              size="icon-lg"
              onClick={speech.toggle}
              disabled={busy}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? "Stop listening" : "Dictate"}
              className={cn("size-12 shrink-0", speech.listening && "bg-brand text-brand-foreground hover:bg-brand/90")}
            >
              {speech.listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
          ) : null}
          {tts.supported && assistantEnabled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => tts.setEnabled(!tts.enabled)}
              aria-pressed={tts.enabled}
              aria-label={tts.enabled ? "Stop reading replies aloud" : "Read replies aloud"}
              className="size-12 shrink-0"
            >
              {tts.enabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </Button>
          ) : null}
        </div>
        <div className="mt-3 flex min-h-9 items-center gap-3 text-sm">
          <div className="flex-1" aria-live="polite">
            {busy ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Sparkle className="size-4 animate-pulse" aria-hidden /> Working…
              </p>
            ) : speech.listening ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-brand" aria-hidden />
                Say something like &ldquo;log 500 ml water&rdquo;
              </p>
            ) : value.trim() === "" ? (
              <p className="text-muted-foreground">
                Try: {QUICK_ENTRY_EXAMPLES.slice(0, 3).join(" · ")}
              </p>
            ) : intent ? (
              <p className="flex items-center gap-2 font-medium">
                <CornerDownLeft className="size-4 text-muted-foreground" aria-hidden />
                {describeIntent(intent)}
              </p>
            ) : assistantEnabled ? (
              <p className="text-muted-foreground">Enter to ask the assistant</p>
            ) : (
              <p className="text-muted-foreground">
                Not recognised. Examples: {QUICK_ENTRY_EXAMPLES.slice(0, 3).join(" · ")}
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={busy || quickPending || (!intent && !assistantEnabled && !pending)}
          >
            {intent ? "Log entry" : pending ? "Send" : "Ask"}
          </Button>
        </div>
      </form>
    </div>
  );
}

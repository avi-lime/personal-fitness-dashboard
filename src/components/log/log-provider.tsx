"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FoodDialog } from "./food-dialog";
import { MoneyDialog, type MoneyAccountOption } from "./money-dialog";
import { NoteDialog } from "./note-dialog";
import { AssistantDialog } from "@/components/assistant/assistant-dialog";
import { SleepDialog } from "./sleep-dialog";
import { WaterDialog } from "./water-dialog";
import { WeightDialog } from "./weight-dialog";
import { WorkoutDialog, type WorkoutTemplateOption } from "./workout-dialog";
import type { Food } from "@/db/schema";

export type LogDialogKind =
  | "quick"
  | "food"
  | "water"
  | "money"
  | "weight"
  | "sleep"
  | "workout"
  | "note";

export interface OpenOptions {
  /** Start the microphone as the dialog opens (assistant dialog only). */
  listen?: boolean;
}

interface LogContextValue {
  open: (kind: LogDialogKind, options?: OpenOptions) => void;
  assistantEnabled: boolean;
}

const LogContext = createContext<LogContextValue | null>(null);

/** Opens any logging dialog from anywhere in the authenticated app. */
export function useLogDialogs(): LogContextValue {
  const context = useContext(LogContext);
  if (!context) throw new Error("useLogDialogs must be used inside <LogProvider>");
  return context;
}

/** True when the key event targets a place the user is typing. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function LogProvider({
  children,
  foods,
  workoutTemplates,
  latestWeight,
  accounts,
  assistantEnabled,
}: {
  children: ReactNode;
  foods: Food[];
  workoutTemplates: WorkoutTemplateOption[];
  latestWeight: number | null;
  accounts: MoneyAccountOption[];
  assistantEnabled: boolean;
}) {
  const [active, setActive] = useState<LogDialogKind | null>(null);
  const [listen, setListen] = useState(false);

  const open = useCallback((kind: LogDialogKind, options: OpenOptions = {}) => {
    setListen(Boolean(options.listen));
    setActive(kind);
  }, []);
  const value = useMemo(() => ({ open, assistantEnabled }), [open, assistantEnabled]);

  // Ctrl/Cmd+K opens quick entry, Ctrl/Cmd+Shift+K opens it listening —
  // from anywhere except while typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      if (isEditable(event.target)) return;
      event.preventDefault();
      setListen(event.shiftKey);
      setActive("quick");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = () => {
    setActive(null);
    setListen(false);
  };
  const bind = (kind: LogDialogKind) => ({
    open: active === kind,
    onOpenChange: (next: boolean) => (next ? setActive(kind) : close()),
  });

  return (
    <LogContext.Provider value={value}>
      {children}
      <AssistantDialog {...bind("quick")} assistantEnabled={assistantEnabled} autoListen={listen} />
      <FoodDialog {...bind("food")} foods={foods} />
      <WaterDialog {...bind("water")} />
      <MoneyDialog {...bind("money")} accounts={accounts} />
      <WeightDialog {...bind("weight")} suggested={latestWeight} />
      <SleepDialog {...bind("sleep")} />
      <WorkoutDialog {...bind("workout")} templates={workoutTemplates} />
      <NoteDialog {...bind("note")} />
    </LogContext.Provider>
  );
}

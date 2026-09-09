"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FoodDialog } from "./food-dialog";
import { NoteDialog } from "./note-dialog";
import { QuickEntryDialog } from "./quick-entry-dialog";
import { SleepDialog } from "./sleep-dialog";
import { WaterDialog } from "./water-dialog";
import { WeightDialog } from "./weight-dialog";
import { WorkoutDialog, type WorkoutTemplateOption } from "./workout-dialog";
import type { Food } from "@/db/schema";

export type LogDialogKind = "quick" | "food" | "water" | "weight" | "sleep" | "workout" | "note";

interface LogContextValue {
  open: (kind: LogDialogKind) => void;
}

const LogContext = createContext<LogContextValue | null>(null);

/** Opens any logging dialog from anywhere in the authenticated app. */
export function useLogDialogs(): LogContextValue {
  const context = useContext(LogContext);
  if (!context) throw new Error("useLogDialogs must be used inside <LogProvider>");
  return context;
}

export function LogProvider({
  children,
  foods,
  workoutTemplates,
  latestWeight,
}: {
  children: ReactNode;
  foods: Food[];
  workoutTemplates: WorkoutTemplateOption[];
  latestWeight: number | null;
}) {
  const [active, setActive] = useState<LogDialogKind | null>(null);

  const open = useCallback((kind: LogDialogKind) => setActive(kind), []);
  const value = useMemo(() => ({ open }), [open]);

  // Ctrl/Cmd+K opens quick entry from anywhere except while typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setActive("quick");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = () => setActive(null);
  const bind = (kind: LogDialogKind) => ({
    open: active === kind,
    onOpenChange: (next: boolean) => (next ? setActive(kind) : close()),
  });

  return (
    <LogContext.Provider value={value}>
      {children}
      <QuickEntryDialog {...bind("quick")} />
      <FoodDialog {...bind("food")} foods={foods} />
      <WaterDialog {...bind("water")} />
      <WeightDialog {...bind("weight")} suggested={latestWeight} />
      <SleepDialog {...bind("sleep")} />
      <WorkoutDialog {...bind("workout")} templates={workoutTemplates} />
      <NoteDialog {...bind("note")} />
    </LogContext.Provider>
  );
}

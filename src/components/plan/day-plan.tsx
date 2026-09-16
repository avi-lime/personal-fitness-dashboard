"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfirmButton } from "@/components/common/confirm-button";
import { Field } from "@/components/common/field";
import { EmptyState } from "@/components/common/empty-state";
import { AreaSelect } from "@/components/common/area-select";
import { useAction } from "@/components/common/use-action";
import {
  addBlockAction,
  createRoutineAction,
  deleteBlockAction,
  deleteRoutineAction,
  planDayAction,
  setBlockDoneAction,
  setRoutineActiveAction,
} from "@/server/actions/plan";
import { AREA_LABELS, type AreaKey } from "@/lib/domain";
import { addDays, formatLongDate, type LocalDate } from "@/lib/date";
import { WEEKDAYS, WEEKDAY_LABELS, currentBlock, maskToWeekdays, type Weekday } from "@/lib/plan";
import type { Routine, TimeBlock } from "@/db/schema";
import { cn } from "@/lib/utils";

export function DayPlan({
  date,
  today,
  timezone,
  now,
  blocks,
  routines,
  tasksDue,
}: {
  date: LocalDate;
  today: LocalDate;
  timezone: string;
  /** HH:MM in the user's timezone, only meaningful when date === today. */
  now: string;
  blocks: TimeBlock[];
  routines: Routine[];
  tasksDue: Array<{ id: string; title: string; dueDate: string | null }>;
}) {
  const { pending, run } = useAction();
  const isToday = date === today;
  const current = isToday ? currentBlock(blocks, now) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Plan</h1>
          <p className="text-sm text-muted-foreground">{formatLongDate(date, timezone)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/plan?date=${addDays(date, -1)}`} aria-label="Previous day">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          {!isToday ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/plan">Today</Link>
            </Button>
          ) : null}
          <Button variant="outline" size="icon" asChild>
            <Link href={`/plan?date=${addDays(date, 1)}`} aria-label="Next day">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() => planDayAction(date), { success: "Day planned from your routines" })
            }
          >
            <CalendarPlus className="size-4" aria-hidden /> Plan my day
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <Card className="gap-0 p-0">
            {blocks.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing planned"
                  description='Press "Plan my day" to lay out your routines, or add a block below.'
                />
              </div>
            ) : (
              <ol className="divide-y">
                {blocks.map((block) => {
                  const active = current?.id === block.id;
                  const past = isToday && block.endTime <= now;
                  return (
                    <li
                      key={block.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        active && "bg-surface-3",
                        past && !block.done && "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn("tabular w-24 shrink-0 text-xs", active ? "text-brand" : "text-muted-foreground")}
                      >
                        {block.startTime}–{block.endTime}
                      </span>
                      <Checkbox
                        checked={block.done}
                        disabled={pending}
                        onCheckedChange={(checked) =>
                          run(() => setBlockDoneAction({ blockId: block.id, done: checked === true }))
                        }
                        aria-label={`Mark "${block.label}" ${block.done ? "not done" : "done"}`}
                      />
                      <span className={cn("min-w-0 flex-1 text-sm", block.done && "line-through text-muted-foreground")}>
                        {block.label}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {block.kind !== "other" ? block.kind : ""}
                          {block.area ? ` · ${AREA_LABELS[block.area]}` : ""}
                        </span>
                      </span>
                      {active ? <span className="text-xs font-medium text-brand">now</span> : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        aria-label={`Remove ${block.label}`}
                        onClick={() => run(() => deleteBlockAction(block.id), { success: "Block removed" })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <AddBlockForm date={date} />

          {tasksDue.length > 0 ? (
            <Card className="gap-2 p-4">
              <h2 className="text-sm font-medium">Tasks due</h2>
              <ul className="space-y-1 text-sm">
                {tasksDue.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2">
                    <span>{task.title}</span>
                    <span className={cn("tabular text-xs", task.dueDate && task.dueDate < today ? "text-brand" : "text-muted-foreground")}>
                      {task.dueDate}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <RoutinesPanel routines={routines} />
      </div>
    </div>
  );
}

function AddBlockForm({ date }: { date: LocalDate }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");
  const { pending, run } = useAction();
  return (
    <Card className="gap-3 p-4">
      <h2 className="text-sm font-medium">Add a block</h2>
      <form
        className="grid grid-cols-2 items-end gap-3 md:grid-cols-[7rem_7rem_minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => addBlockAction({ date, startTime: start, endTime: end, label: label.trim() }), {
            success: "Block added",
            onSuccess: () => {
              setStart("");
              setEnd("");
              setLabel("");
            },
          });
        }}
      >
        <Field id="block-start" label="From">
          <Input id="block-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field id="block-end" label="To">
          <Input id="block-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
        <Field id="block-label" label="What" className="col-span-2 md:col-span-1">
          <Input id="block-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Deep work" required />
        </Field>
        <Button type="submit" size="sm" disabled={pending || !start || !end || !label.trim()}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </form>
    </Card>
  );
}

function RoutinesPanel({ routines }: { routines: Routine[] }) {
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [area, setArea] = useState<AreaKey | null>(null);
  const [days, setDays] = useState<Weekday[]>(["mon", "tue", "wed", "thu", "fri"]);
  const { pending, run } = useAction();

  return (
    <div className="space-y-4">
      <Card className="gap-3 p-4">
        <h2 className="text-sm font-medium">Routines</h2>
        <p className="text-xs text-muted-foreground">
          Recurring blocks. &ldquo;Plan my day&rdquo; turns the ones for that weekday into blocks.
        </p>
        {routines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No routines yet.</p>
        ) : (
          <ul className="divide-y">
            {routines.map((routine) => (
              <li key={routine.id} className="flex items-center gap-3 py-2">
                <Switch
                  checked={routine.active}
                  disabled={pending}
                  onCheckedChange={(checked) =>
                    run(() => setRoutineActiveAction({ routineId: routine.id, active: checked }))
                  }
                  aria-label={`${routine.active ? "Pause" : "Resume"} ${routine.label}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !routine.active && "text-muted-foreground")}>{routine.label}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {routine.startTime}–{routine.endTime} · {maskToWeekdays(routine.weekdays).map((d) => WEEKDAY_LABELS[d]).join(" ")}
                    {routine.area ? ` · ${AREA_LABELS[routine.area]}` : ""}
                  </p>
                </div>
                <ConfirmButton
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label={`Delete routine ${routine.label}`}
                  title={`Delete routine "${routine.label}"?`}
                  description="Blocks already planned from it stay."
                  confirmLabel="Delete"
                  onConfirm={() => run(() => deleteRoutineAction(routine.id), { success: "Routine deleted" })}
                >
                  <Trash2 className="size-4" />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-3 p-4">
        <h2 className="text-sm font-medium">Add a routine</h2>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                createRoutineAction({
                  label: label.trim(),
                  startTime: start,
                  endTime: end,
                  weekdays: days,
                  area,
                  kind: "routine",
                }),
              {
                success: "Routine added",
                onSuccess: () => {
                  setLabel("");
                  setStart("");
                  setEnd("");
                },
              },
            );
          }}
        >
          <Field id="routine-label" label="Label">
            <Input id="routine-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Gym" required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field id="routine-start" label="From">
              <Input id="routine-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </Field>
            <Field id="routine-end" label="To">
              <Input id="routine-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </Field>
            <Field id="routine-area" label="Area">
              <AreaSelect id="routine-area" value={area} onChange={setArea} allowNone />
            </Field>
          </div>
          <ToggleGroup
            type="multiple"
            value={days}
            onValueChange={(next) => setDays(next as Weekday[])}
            aria-label="Weekdays"
            className="flex-wrap justify-start"
          >
            {WEEKDAYS.map((day) => (
              <ToggleGroupItem key={day} value={day} size="sm" aria-label={WEEKDAY_LABELS[day]}>
                {WEEKDAY_LABELS[day]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button type="submit" size="sm" disabled={pending || !label.trim() || !start || !end || days.length === 0}>
            Add routine
          </Button>
        </form>
      </Card>
    </div>
  );
}

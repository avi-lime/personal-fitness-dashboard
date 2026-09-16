"use client";

import { useState } from "react";
import { Archive, ExternalLink, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/common/stat";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApplicationDialog } from "./application-dialog";
import { archiveApplicationAction, updateApplicationAction } from "@/server/actions/career";
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS, type ApplicationStage } from "@/lib/domain";
import { formatDuration } from "@/lib/format";
import { formatShortDate, type LocalDate } from "@/lib/date";
import type { Application } from "@/db/schema";
import { cn } from "@/lib/utils";

export function ApplicationsBoard({
  applications,
  today,
  prepMinutesThisWeek,
  sentThisWeek,
}: {
  applications: Application[];
  today: LocalDate;
  prepMinutesThisWeek: number;
  sentThisWeek: number;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const { pending, run } = useAction();

  const active = applications.filter((app) => app.stage !== "rejected");
  const dueSteps = active.filter((app) => app.nextStepDate !== null && app.nextStepDate <= today);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Career</h1>
          <p className="text-sm text-muted-foreground">
            The job-switch pipeline. Study and career time tracked this week counts as prep.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden /> Add application
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="In pipeline" value={active.length} detail={`${applications.length - active.length} rejected`} />
          <Stat label="Interviewing" value={active.filter((a) => a.stage === "interview" || a.stage === "offer").length} />
          <Stat label="Sent this week" value={sentThisWeek} />
          <Stat label="Prep this week" value={formatDuration(prepMinutesThisWeek / 60)} detail="study + career time" />
        </div>
        {dueSteps.length > 0 ? (
          <p className="mt-3 text-sm">
            <span className="text-brand">Due now:</span>{" "}
            {dueSteps.map((app) => `${app.nextStep ?? "next step"} (${app.company})`).join(" · ")}
          </p>
        ) : null}
      </Card>

      {applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description='Add one here, or say "add an application at Acme for senior engineer".'
          action={<Button size="sm" onClick={() => setCreating(true)}>Add application</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {APPLICATION_STAGES.map((stage) => {
            const column = applications.filter((app) => app.stage === stage);
            if (column.length === 0) return null;
            return (
              <section key={stage} aria-labelledby={`stage-${stage}`} className="space-y-2">
                <h2 id={`stage-${stage}`} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {APPLICATION_STAGE_LABELS[stage]} · {column.length}
                </h2>
                {column.map((app) => {
                  const due = app.nextStepDate !== null && app.nextStepDate <= today;
                  return (
                    <Card key={app.id} className="gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{app.company}</p>
                          <p className="truncate text-sm text-muted-foreground">{app.role}</p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          {app.url ? (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={app.url} target="_blank" rel="noreferrer" aria-label={`Open ${app.company} listing`}>
                                <ExternalLink className="size-4" />
                              </a>
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" aria-label={`Edit ${app.company}`} onClick={() => setEditing(app)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`Archive ${app.company}`}
                            onClick={() => {
                              if (window.confirm(`Archive ${app.role} at ${app.company}?`)) {
                                run(() => archiveApplicationAction(app.id), { success: "Archived" });
                              }
                            }}
                          >
                            <Archive className="size-4" />
                          </Button>
                        </div>
                      </div>
                      {app.nextStep ? (
                        <p className={cn("text-sm", due ? "text-brand" : "text-muted-foreground")}>
                          {app.nextStep}
                          {app.nextStepDate ? ` · ${formatShortDate(app.nextStepDate)}` : ""}
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {app.location ?? ""}
                          {app.location && app.appliedOn ? " · " : ""}
                          {app.appliedOn ? `applied ${formatShortDate(app.appliedOn)}` : ""}
                        </span>
                        <Select
                          value={app.stage}
                          onValueChange={(value) =>
                            run(
                              () =>
                                updateApplicationAction({
                                  applicationId: app.id,
                                  patch: { stage: value as ApplicationStage },
                                }),
                              { success: `Moved to ${APPLICATION_STAGE_LABELS[value as ApplicationStage]}` },
                            )
                          }
                        >
                          <SelectTrigger size="sm" className="h-7 w-32" aria-label={`Stage for ${app.company}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {APPLICATION_STAGES.map((option) => (
                              <SelectItem key={option} value={option}>
                                {APPLICATION_STAGE_LABELS[option]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </Card>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <ApplicationDialog open={creating} onOpenChange={setCreating} />
      <ApplicationDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} application={editing} />
    </div>
  );
}

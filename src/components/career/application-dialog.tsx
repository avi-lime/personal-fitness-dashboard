"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { createApplicationAction, updateApplicationAction } from "@/server/actions/career";
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS, type ApplicationStage } from "@/lib/domain";
import type { Application } from "@/db/schema";

export function ApplicationDialog({
  open,
  onOpenChange,
  application,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application?: Application | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{application ? "Edit application" : "Add application"}</DialogTitle>
          <DialogDescription>Company and role are required; the rest can come later.</DialogDescription>
        </DialogHeader>
        {open ? (
          <ApplicationForm
            key={application?.id ?? "new"}
            application={application}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ApplicationForm({
  application,
  onDone,
}: {
  application?: Application | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    company: application?.company ?? "",
    role: application?.role ?? "",
    stage: (application?.stage ?? "wishlist") as ApplicationStage,
    url: application?.url ?? "",
    location: application?.location ?? "",
    salaryNote: application?.salaryNote ?? "",
    nextStep: application?.nextStep ?? "",
    nextStepDate: application?.nextStepDate ?? "",
    appliedOn: application?.appliedOn ?? "",
    notes: application?.notes ?? "",
  });
  const { pending, run } = useAction();
  const set = (key: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const text = (value: string) => (value.trim() === "" ? null : value.trim());

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = {
          company: form.company.trim(),
          role: form.role.trim(),
          stage: form.stage,
          url: text(form.url),
          location: text(form.location),
          salaryNote: text(form.salaryNote),
          nextStep: text(form.nextStep),
          nextStepDate: text(form.nextStepDate),
          appliedOn: text(form.appliedOn),
          notes: text(form.notes),
        };
        run(
          () =>
            application
              ? updateApplicationAction({ applicationId: application.id, patch: payload })
              : createApplicationAction(payload),
          { success: application ? "Application updated" : "Application added", onSuccess: onDone },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="app-company" label="Company">
          <Input id="app-company" value={form.company} onChange={(e) => set("company", e.target.value)} required autoFocus />
        </Field>
        <Field id="app-role" label="Role">
          <Input id="app-role" value={form.role} onChange={(e) => set("role", e.target.value)} required />
        </Field>
        <Field id="app-stage" label="Stage">
          <Select value={form.stage} onValueChange={(value) => set("stage", value)}>
            <SelectTrigger id="app-stage" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPLICATION_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {APPLICATION_STAGE_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="app-applied" label="Applied on">
          <Input id="app-applied" type="date" value={form.appliedOn} onChange={(e) => set("appliedOn", e.target.value)} />
        </Field>
        <Field id="app-next" label="Next step">
          <Input id="app-next" value={form.nextStep} onChange={(e) => set("nextStep", e.target.value)} placeholder="Prepare for system design round" />
        </Field>
        <Field id="app-next-date" label="Next step by">
          <Input id="app-next-date" type="date" value={form.nextStepDate} onChange={(e) => set("nextStepDate", e.target.value)} />
        </Field>
        <Field id="app-location" label="Location">
          <Input id="app-location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Remote · Bengaluru" />
        </Field>
        <Field id="app-salary" label="Salary note">
          <Input id="app-salary" value={form.salaryNote} onChange={(e) => set("salaryNote", e.target.value)} placeholder="optional" />
        </Field>
        <Field id="app-url" label="Link" className="sm:col-span-2">
          <Input id="app-url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" inputMode="url" />
        </Field>
        <Field id="app-notes" label="Notes" className="sm:col-span-2">
          <Textarea id="app-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !form.company.trim() || !form.role.trim()}>
          {application ? "Save" : "Add"}
        </Button>
      </DialogFooter>
    </form>
  );
}

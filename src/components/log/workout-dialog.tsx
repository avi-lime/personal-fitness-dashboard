"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { createWorkoutAction } from "@/server/actions/workouts";

export interface WorkoutTemplateOption {
  id: string;
  name: string;
}

const NO_TEMPLATE = "none";

export function WorkoutDialog({
  open,
  onOpenChange,
  templates = [],
  navigateOnCreate = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates?: WorkoutTemplateOption[];
  navigateOnCreate?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a workout</DialogTitle>
          <DialogDescription>
            Starting from a template pre-fills its exercises and target sets.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <WorkoutForm
            templates={templates}
            navigateOnCreate={navigateOnCreate}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function WorkoutForm({
  templates,
  navigateOnCreate,
  onDone,
}: {
  templates: WorkoutTemplateOption[];
  navigateOnCreate: boolean;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE);
  const { pending, run } = useAction();
  const router = useRouter();

  return (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const template = templates.find((item) => item.id === templateId);
            run(
              () =>
                createWorkoutAction({
                  name: name.trim() || template?.name || "Workout",
                  templateId: templateId === NO_TEMPLATE ? null : templateId,
                }),
              {
                success: "Workout created",
                onSuccess: (data) => {
                  onDone();
                  if (navigateOnCreate) router.push(`/training/${data.id}`);
                },
              },
            );
          }}
        >
          {templates.length > 0 ? (
            <Field id="workout-template" label="Template">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger id="workout-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Empty workout</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field id="workout-name" label="Name" hint="Defaults to the template name.">
            <Input
              id="workout-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Push day"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Start workout
            </Button>
          </DialogFooter>
        </form>
  );
}

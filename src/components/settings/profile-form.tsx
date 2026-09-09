"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { updateProfileAction } from "@/server/actions/settings";
import { UNIT_SYSTEMS, type UnitSystem } from "@/lib/domain";
import type { Profile } from "@/db/schema";

const optional = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export function ProfileForm({
  profile,
  timezones,
}: {
  profile: Profile;
  timezones: string[];
}) {
  const [form, setForm] = useState({
    displayName: profile.displayName ?? "",
    heightCm: profile.heightCm === null ? "" : String(profile.heightCm),
    startingWeightKg:
      profile.startingWeightKg === null ? "" : String(profile.startingWeightKg),
    targetWeightKg: profile.targetWeightKg === null ? "" : String(profile.targetWeightKg),
    timezone: profile.timezone,
    unitSystem: profile.unitSystem,
  });
  const { pending, run } = useAction();

  const set = (key: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <Card className="gap-4 p-4">
      <div>
        <h2 className="text-sm font-medium">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Used for context and targets. Nothing here is required.
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            () =>
              updateProfileAction({
                displayName: form.displayName.trim() || null,
                heightCm: optional(form.heightCm),
                startingWeightKg: optional(form.startingWeightKg),
                targetWeightKg: optional(form.targetWeightKg),
                timezone: form.timezone,
                unitSystem: form.unitSystem,
              }),
            { success: "Profile saved" },
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field id="profile-name" label="Name">
            <Input
              id="profile-name"
              value={form.displayName}
              onChange={(event) => set("displayName", event.target.value)}
              placeholder="optional"
            />
          </Field>
          <Field id="profile-height" label="Height (cm)">
            <Input
              id="profile-height"
              inputMode="decimal"
              value={form.heightCm}
              onChange={(event) => set("heightCm", event.target.value)}
            />
          </Field>
          <Field id="profile-start" label="Starting weight (kg)">
            <Input
              id="profile-start"
              inputMode="decimal"
              value={form.startingWeightKg}
              onChange={(event) => set("startingWeightKg", event.target.value)}
            />
          </Field>
          <Field
            id="profile-target"
            label="Target weight (kg)"
            hint="Leave blank if you do not want a target."
          >
            <Input
              id="profile-target"
              inputMode="decimal"
              value={form.targetWeightKg}
              onChange={(event) => set("targetWeightKg", event.target.value)}
            />
          </Field>
          <Field
            id="profile-timezone"
            label="Timezone"
            hint="Decides which calendar day each entry belongs to."
          >
            <Select value={form.timezone} onValueChange={(value) => set("timezone", value)}>
              <SelectTrigger id="profile-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timezones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="profile-units" label="Units">
            <Select
              value={form.unitSystem}
              onValueChange={(value) => set("unitSystem", value as UnitSystem)}
            >
              <SelectTrigger id="profile-units" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_SYSTEMS.map((system) => (
                  <SelectItem key={system} value={system} className="capitalize">
                    {system}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}

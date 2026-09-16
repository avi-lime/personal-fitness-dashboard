"use client";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAction } from "@/components/common/use-action";
import { updateDashboardSectionsAction } from "@/server/actions/settings";
import { DASHBOARD_SECTIONS, type DashboardSection, type DashboardSectionVisibility } from "@/lib/domain";

const LABELS: Record<DashboardSection, string> = {
  nextAction: "Next action",
  today: "Today's goals",
  plan: "Today's plan",
  tasks: "Tasks",
  quickActions: "Quick actions",
  training: "Training",
  body: "Body & weight",
  money: "Money",
  career: "Career",
  weekly: "Last 7 days",
  notes: "Notes",
};

export function DashboardSectionsForm({ sections }: { sections: DashboardSectionVisibility }) {
  const { pending, run } = useAction();

  return (
    <Card className="gap-4 p-4">
      <div>
        <h2 className="text-sm font-medium">Dashboard sections</h2>
        <p className="text-sm text-muted-foreground">
          Hide anything you do not use. Goal ordering lives on the Goals page.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DASHBOARD_SECTIONS.map((section) => (
          <div key={section} className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
            <Label htmlFor={`section-${section}`} className="font-normal">
              {LABELS[section]}
            </Label>
            <Switch
              id={`section-${section}`}
              checked={sections[section]}
              disabled={pending}
              onCheckedChange={(checked) =>
                run(() => updateDashboardSectionsAction({ [section]: checked }), {
                  success: "Dashboard updated",
                })
              }
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

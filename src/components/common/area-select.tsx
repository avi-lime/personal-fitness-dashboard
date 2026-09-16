"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AREA_KEYS, AREA_LABELS, type AreaKey } from "@/lib/domain";

const NONE = "none";

/** Life-area picker. Pass `allowNone` for optional fields. */
export function AreaSelect({
  id,
  value,
  onChange,
  allowNone = false,
  className,
}: {
  id?: string;
  value: AreaKey | null;
  onChange: (value: AreaKey | null) => void;
  allowNone?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : (next as AreaKey))}
    >
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue placeholder="Area" />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>No area</SelectItem> : null}
        {AREA_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {AREA_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

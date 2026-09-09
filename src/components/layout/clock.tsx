"use client";

import { useEffect, useState } from "react";
import { toLocalTime } from "@/lib/date";

/**
 * Ticking wall clock. Rendered with the server-supplied value first so the
 * markup matches on hydration, then updated on the client.
 */
export function Clock({
  timezone,
  initialTime,
  withSeconds = false,
  className,
}: {
  timezone: string;
  initialTime: string;
  withSeconds?: boolean;
  className?: string;
}) {
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    const update = () => setTime(toLocalTime(new Date(), timezone, withSeconds));
    update();
    const interval = setInterval(update, withSeconds ? 1000 : 15_000);
    return () => clearInterval(interval);
  }, [timezone, withSeconds]);

  return (
    <span className={className} suppressHydrationWarning>
      {time}
    </span>
  );
}

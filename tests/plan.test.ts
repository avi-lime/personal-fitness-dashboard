import { describe, expect, it } from "vitest";
import {
  currentBlock,
  hhmmFromMinutes,
  isHHMM,
  maskToWeekdays,
  minutesOf,
  nextBlock,
  routineAppliesOn,
  sortBlocks,
  weekdayMask,
  weekdayOf,
} from "@/lib/plan";

describe("weekday masks", () => {
  it("round-trips a set of days", () => {
    const mask = weekdayMask(["mon", "wed", "fri"]);
    expect(mask).toBe(1 | 4 | 16);
    expect(maskToWeekdays(mask)).toEqual(["mon", "wed", "fri"]);
    expect(maskToWeekdays(0)).toEqual([]);
  });

  it("knows the weekday of a date and whether a routine applies", () => {
    expect(weekdayOf("2026-09-16")).toBe("wed");
    expect(weekdayOf("2026-09-20")).toBe("sun");
    expect(weekdayOf("2026-09-21")).toBe("mon");
    const weekdays = weekdayMask(["mon", "tue", "wed", "thu", "fri"]);
    expect(routineAppliesOn(weekdays, "2026-09-16")).toBe(true);
    expect(routineAppliesOn(weekdays, "2026-09-20")).toBe(false);
  });
});

describe("times", () => {
  it("validates and converts HH:MM", () => {
    expect(isHHMM("07:30")).toBe(true);
    expect(isHHMM("23:59")).toBe(true);
    expect(isHHMM("24:00")).toBe(false);
    expect(isHHMM("7:30")).toBe(false);
    expect(minutesOf("07:30")).toBe(450);
    expect(hhmmFromMinutes(450)).toBe("07:30");
    expect(hhmmFromMinutes(-5)).toBe("00:00");
  });

  it("finds the current and next block", () => {
    const blocks = [
      { id: "b", startTime: "12:00", endTime: "13:00" },
      { id: "a", startTime: "07:00", endTime: "08:00" },
      { id: "c", startTime: "20:00", endTime: "21:30" },
    ];
    expect(sortBlocks(blocks).map((b) => b.id)).toEqual(["a", "b", "c"]);
    expect(currentBlock(blocks, "07:30")?.id).toBe("a");
    expect(currentBlock(blocks, "08:00")).toBeNull();
    expect(nextBlock(blocks, "08:00")?.id).toBe("b");
    expect(nextBlock(blocks, "21:30")).toBeNull();
  });
});

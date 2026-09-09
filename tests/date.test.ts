import { describe, expect, it } from "vitest";
import {
  addDays,
  diffInDays,
  eachDay,
  endOfMonth,
  endOfWeek,
  hoursBetween,
  isLocalDate,
  lastNDays,
  localDayBounds,
  startOfMonth,
  startOfWeek,
  toLocalDate,
  toLocalTime,
} from "@/lib/date";

describe("local dates", () => {
  it("buckets an instant into the viewer's calendar day", () => {
    const instant = new Date("2026-03-01T20:30:00Z");
    expect(toLocalDate(instant, "UTC")).toBe("2026-03-01");
    // 20:30 UTC is already the next day in Asia/Kolkata (+05:30).
    expect(toLocalDate(instant, "Asia/Kolkata")).toBe("2026-03-02");
    // ...and still the previous evening in Los Angeles.
    expect(toLocalDate(instant, "America/Los_Angeles")).toBe("2026-03-01");
  });

  it("formats wall-clock time in the target zone", () => {
    expect(toLocalTime(new Date("2026-03-01T20:30:00Z"), "UTC")).toBe("20:30");
    expect(toLocalTime(new Date("2026-03-01T20:30:00Z"), "Asia/Kolkata")).toBe("02:00");
  });

  it("validates calendar dates", () => {
    expect(isLocalDate("2026-02-28")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("26-01-01")).toBe(false);
    expect(isLocalDate("not-a-date")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffInDays("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("computes Monday-based weeks and calendar months", () => {
    // 2026-09-09 is a Wednesday.
    expect(startOfWeek("2026-09-09")).toBe("2026-09-07");
    expect(endOfWeek("2026-09-09")).toBe("2026-09-13");
    expect(startOfWeek("2026-09-07")).toBe("2026-09-07");
    expect(startOfWeek("2026-09-13")).toBe("2026-09-07");
    expect(startOfMonth("2026-09-09")).toBe("2026-09-01");
    expect(endOfMonth("2026-02-09")).toBe("2026-02-28");
  });

  it("enumerates inclusive ranges", () => {
    expect(eachDay("2026-01-01", "2026-01-03")).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
    expect(lastNDays("2026-01-03", 3)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("bounds a local day in absolute time", () => {
    const { start, end } = localDayBounds("2026-06-15", "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-06-14T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-06-15T18:30:00.000Z");
  });

  it("measures sleep duration in hours", () => {
    expect(
      hoursBetween(new Date("2026-01-01T23:00:00Z"), new Date("2026-01-02T06:30:00Z")),
    ).toBe(7.5);
  });
});

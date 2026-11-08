import { afterEach, describe, expect, it } from "vitest";
import { enteredAtLabel, enteredTimeLabel, localDateTime, setTimeZone } from "../date";
import { setLanguage } from "../i18n";

describe("entered time", () => {
  afterEach(() => {
    setTimeZone("Asia/Tokyo");
    setLanguage("ja");
  });

  it("reads the time in the user's time zone", () => {
    setTimeZone("Europe/Budapest");
    expect(localDateTime("2026-11-08T13:05:00Z")).toEqual({ date: "2026-11-08", time: "14:05" });
    setTimeZone("Asia/Tokyo");
    expect(localDateTime("2026-11-08T15:30:00Z")).toEqual({ date: "2026-11-09", time: "0:30" });
  });

  it("gives nothing for a missing or broken time", () => {
    setTimeZone("Asia/Tokyo");
    expect(localDateTime("2026-11-07T23:05:00Z")).toEqual({ date: "2026-11-08", time: "8:05" });
    expect(localDateTime(undefined)).toBeNull();
    expect(localDateTime("")).toBeNull();
    expect(localDateTime("not a date")).toBeNull();
  });

  it("shows only the time in the list when entered on the record's day", () => {
    setTimeZone("Asia/Tokyo");
    expect(enteredTimeLabel("2026-11-08", "2026-11-08T03:12:00Z")).toBe("12:12");
    expect(enteredTimeLabel("2026-11-07", "2026-11-08T03:12:00Z")).toBeNull();
  });

  it("adds the day in the details when entered on another day", () => {
    setTimeZone("Asia/Tokyo");
    setLanguage("ja");
    expect(enteredAtLabel("2026-11-08", "2026-11-08T03:12:00Z")).toBe("12:12");
    expect(enteredAtLabel("2026-11-07", "2026-11-08T03:12:00Z")).toBe("11/8（日） 12:12");
    expect(enteredAtLabel("2025-12-31", "2026-01-01T03:00:00Z")).toBe("2026/1/1（木） 12:00");
    setLanguage("en");
    expect(enteredAtLabel("2026-11-07", "2026-11-08T03:12:00Z")).toBe("Sun 11/8 12:12");
  });
});

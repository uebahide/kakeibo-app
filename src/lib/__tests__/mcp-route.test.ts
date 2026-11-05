import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DELETE, GET, maxDuration } from "@/app/api/mcp/route";

// Long-lived connections on /api/mcp are billed for their whole lifetime, so the
// route must refuse them quickly and never run longer than a minute.
describe("/api/mcp", () => {
  it("refuses GET and DELETE with 405 and no stream", async () => {
    for (const method of [GET, DELETE]) {
      const res = method();
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
      expect(res.headers.get("content-type")).toContain("application/json");
    }
  });

  it("caps the run time at 60 seconds", () => {
    expect(maxDuration).toBe(60);
  });
});

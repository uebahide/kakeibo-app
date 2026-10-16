import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { accountMismatch } = await import("@/lib/mcp/auth");

/** A request whose connector token belongs to `email`. */
const ctx = (email: string) => ({ http: { authInfo: { token: "t", clientId: "", scopes: [], extra: { userId: "u", email } } } }) as never;

describe("accountMismatch", () => {
  it("lets the request through when the app's account is the connected one, ignoring case", () => {
    expect(accountMismatch(ctx("a@example.com"), "A@Example.com ")).toBeNull();
  });

  it("lets the request through when the app named no account", () => {
    expect(accountMismatch(ctx("a@example.com"), undefined)).toBeNull();
  });

  it("asks to reconnect with the app's account when another one is connected", () => {
    const message = accountMismatch(ctx("a@example.com"), "b@example.com");
    expect(message).toContain("家計簿コネクタは a@example.com でつながっていますが、アプリは b@example.com でログインしています");
    expect(message).toContain("何も読み書きしていません");
    expect(message).toContain("https://claude.ai/settings/connectors");
    expect(message).toContain("sign in as b@example.com");
  });
});

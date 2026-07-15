import { describe, expect, test, vi } from "vitest";
import {
  createPairingInvitation,
  getPairingStatus,
  isPairingCredential,
  isPairingInvitation,
  isPairingStatus,
  revokePairing,
} from "./pairing.ts";
import type { PairingCredential, PairingInvitation } from "./types.ts";

describe("durable pairing HTTP helpers", () => {
  test("creates an invitation without exposing the provider credential in the QR id", async () => {
    const invitation: PairingInvitation = {
      version: 2,
      pairingId: "pairing-public-id",
      role: "provider",
      credential: "provider-secret",
      expiresAt: "2030-01-01T00:00:00.000Z",
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invitation), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createPairingInvitation("https://auth.example/", {
        requestId: "pairing-public-id",
        fetch,
      }),
    ).resolves.toEqual(invitation);
    expect(fetch).toHaveBeenCalledWith(
      "https://auth.example/pairings/invitations",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ requestId: "pairing-public-id" }),
      }),
    );
  });

  test("revokes with a role-bound bearer credential", async () => {
    const pairing: PairingCredential = {
      version: 2,
      pairingId: "pairing/id",
      role: "controller",
      credential: "controller-secret",
    };
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      revokePairing("https://auth.example", pairing, { fetch }),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      "https://auth.example/pairings/pairing%2Fid",
      expect.objectContaining({
        method: "DELETE",
        headers: {
          Authorization: "Bearer controller-secret",
          "X-Pairing-Role": "controller",
        },
      }),
    );
  });

  test("reads and validates durable pairing status", async () => {
    const pairing: PairingCredential = {
      version: 2,
      pairingId: "pairing/id",
      role: "provider",
      credential: "provider-secret",
    };
    const status = {
      version: 2,
      pairingId: pairing.pairingId,
      role: pairing.role,
      status: "active",
      wallet: "WALLET",
    } as const;
    const fetch = vi.fn().mockResolvedValue(Response.json(status));

    await expect(getPairingStatus("https://auth.example/", pairing, { fetch })).resolves.toEqual(
      status,
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://auth.example/pairings/pairing%2Fid/status",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: "Bearer provider-secret",
          "X-Pairing-Role": "provider",
        },
      }),
    );
  });

  test("rejects malformed invitation responses", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ version: 2 }, { status: 201 }));
    await expect(createPairingInvitation("https://auth.example", { fetch })).rejects.toThrow(
      "Pairing invitation response was invalid",
    );
  });

  test("preserves an abort while reading a response body", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      statusText: "Created",
      json: vi.fn().mockRejectedValue(abortError),
    } as unknown as Response);

    await expect(createPairingInvitation("https://auth.example", { fetch })).rejects.toBe(
      abortError,
    );
  });

  test("rejects an invitation response for a different requested pairing", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          version: 2,
          pairingId: "different-pairing-id",
          role: "provider",
          credential: "provider-secret",
          expiresAt: "2030-01-01T00:00:00.000Z",
        },
        { status: 201 },
      ),
    );

    await expect(
      createPairingInvitation("https://auth.example", {
        requestId: "requested-pairing-id",
        fetch,
      }),
    ).rejects.toThrow("Pairing invitation response was invalid");
  });

  test("rejects a status response for a different pairing or role", async () => {
    const pairing: PairingCredential = {
      version: 2,
      pairingId: "pairing-id",
      role: "provider",
      credential: "provider-secret",
    };
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        version: 2,
        pairingId: pairing.pairingId,
        role: "controller",
        status: "active",
        wallet: "WALLET",
      }),
    );

    await expect(getPairingStatus("https://auth.example", pairing, { fetch })).rejects.toThrow(
      "Pairing status response was invalid",
    );
  });

  test("validates credentials, invitations, and status discriminants", () => {
    expect(
      isPairingCredential({
        version: 2,
        pairingId: "pairing-id",
        role: "controller",
        credential: "controller-secret",
      }),
    ).toBe(true);
    expect(
      isPairingCredential({
        version: 2,
        pairingId: "pairing-id",
        role: "controller",
        credential: "   ",
      }),
    ).toBe(false);
    expect(
      isPairingInvitation({
        version: 2,
        pairingId: "pairing-id",
        role: "provider",
        credential: "provider-secret",
        expiresAt: "not-a-date",
      }),
    ).toBe(false);
    expect(
      isPairingStatus({
        version: 2,
        pairingId: "pairing-id",
        role: "controller",
        status: "pending",
      }),
    ).toBe(false);
    expect(
      isPairingStatus({
        version: 2,
        pairingId: "pairing-id",
        role: "provider",
        status: "active",
      }),
    ).toBe(false);
  });

  test("rejects invalid inputs before making a request", async () => {
    const fetch = vi.fn();
    await expect(
      createPairingInvitation("https://auth.example?credential=leak", { fetch }),
    ).rejects.toThrow(
      "Pairing origin must be an absolute HTTP(S) URL without credentials, query, or fragment",
    );
    await expect(
      createPairingInvitation("https://auth.example", { requestId: "too-short", fetch }),
    ).rejects.toThrow("Pairing requestId must be 16-256 URL-safe characters");
    await expect(
      revokePairing(
        "https://auth.example",
        {
          version: 2,
          pairingId: "pairing-id",
          role: "controller",
          credential: "not a bearer token",
        },
        { fetch },
      ),
    ).rejects.toThrow("Invalid pairing credential");
    await expect(
      getPairingStatus(
        "https://auth.example",
        {
          version: 2,
          pairingId: "..",
          role: "provider",
          credential: "provider-secret",
        },
        { fetch },
      ),
    ).rejects.toThrow("Invalid pairing credential");
    expect(fetch).not.toHaveBeenCalled();
  });
});

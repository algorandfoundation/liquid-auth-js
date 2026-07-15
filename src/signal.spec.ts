import { vi, test, expect, describe, beforeEach, afterEach } from "vitest";
import { SocketServerMock } from "socket.io-mock-ts";
import { SignalClient, generateQRCode, generateDeepLink, type LinkMessage } from "./signal";
import {
  REQUEST_IN_PROCESS_MESSAGE,
  REQUEST_IS_MISSING_MESSAGE,
  UNAUTHENTICATED_MESSAGE,
} from "./errors";
import { createMocks } from "./test/test.config";
import type { LiquidExtensionOptions, LiquidSocket } from "./types";

import getResponseResponseFixtures from "../__fixtures__/attestation.response.response.fixtures.json";

import createResponseBodyFixtures from "../__fixtures__/attestation.response.body.fixtures.json";
import createResponseResponseFixtures from "../__fixtures__/attestation.response.response.fixtures.json";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createPeerConnection(overrides: Record<string, unknown> = {}) {
  return {
    createDataChannel: vi.fn(() => {
      return {
        send: vi.fn(),
      };
    }),
    createOffer: vi.fn().mockResolvedValue({
      type: "offer",
      sdp: "offer-sdp-fixture",
    }),
    createAnswer: vi.fn().mockResolvedValue({
      type: "answer",
      sdp: "answer-sdp-fixture",
    }),

    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    ondatachannel: vi.fn(),
    onicecandidate: vi.fn(),
    onnegotiationneeded: vi.fn(),
    oniceconnectionstatechange: vi.fn(),
    onicegatheringstatechange: vi.fn(),
    onsignalingstatechange: vi.fn(),
    onconnectionstatechange: vi.fn(),
    onicecandidateerror: vi.fn(),
    ontrack: vi.fn(),
    close: vi.fn(),
    ...overrides,
  } as unknown as RTCPeerConnection;
}

const peerConnectionConstructor = vi.fn(() => createPeerConnection());
globalThis.RTCPeerConnection = peerConnectionConstructor as unknown as typeof RTCPeerConnection;

globalThis.RTCIceCandidate = vi.fn().mockImplementation((candidate) => {
  return candidate;
});
let socket: SocketServerMock;
let lastSocketOptions: Record<string, unknown> | undefined;
vi.mock("socket.io-client", () => {
  return {
    io: (_url: string, options: Record<string, unknown>) => {
      lastSocketOptions = options;
      return socket.clientMock;
    },
  };
});

beforeEach(() => {
  socket = new SocketServerMock();
  lastSocketOptions = undefined;
  peerConnectionConstructor.mockReset();
  peerConnectionConstructor.mockImplementation(() => createPeerConnection());
});

describe("SignalClient", function () {
  const url = "https://localhost:0";
  let client: SignalClient;
  beforeEach(async () => {
    createMocks();
    client = new SignalClient(url);
    // @ts-expect-error accessing private property for testing
    await client._socketPromise;
    client.emit = vi.fn();
  });
  afterEach(() => {
    client.socket?.disconnect();
    socket.disconnect();
  });
  // Client Constructor
  test("constructor", function () {
    expect(client.url).toEqual(url);
    expect(lastSocketOptions).toMatchObject({ autoConnect: true, withCredentials: true });
    socket.emit("connect");
    socket.emit("disconnect");
    expect(client.emit).toHaveBeenNthCalledWith(1, "connect", undefined);
    expect(client.emit).toHaveBeenNthCalledWith(2, "disconnect", undefined);
  });
  test("treats a role-bound pairing credential as reconnect authorization", async function () {
    const resumed = new SignalClient(url, {
      auth: {
        version: 2,
        pairingId: "pairing-id",
        role: "controller",
        credential: "controller-secret",
      },
    });
    // @ts-expect-error accessing private initialization promise for testing
    await resumed._socketPromise;
    expect(resumed.authenticated).toBe(true);
    resumed.close(true);
  });
  test("does not trust auth that was not installed on an injected socket", function () {
    const injected = new SignalClient(url, {
      socket: socket.clientMock as unknown as LiquidSocket,
      auth: {
        version: 2,
        pairingId: "pairing-id",
        role: "controller",
        credential: "controller-secret",
      },
    });

    expect(injected.authenticated).toBe(false);
    injected.close();
  });
  // Request ID
  test("generateRequestId", function () {
    const id = SignalClient.generateRequestId();
    expect(id).toBeDefined();
    expect(id.length).toBe(36);
  });

  // TODO: Decide what to do with QR Code generation, possibly fork and maintain the library since Pera also uses it
  test("qrCode", async function () {
    await expect(() => client.qrCode()).rejects.toThrow(new Error(REQUEST_IS_MISSING_MESSAGE));

    client.requestId = SignalClient.generateRequestId();
    if (typeof window !== "undefined") {
      const qrCode = await client.qrCode();
      expect(qrCode).toBeDefined();
    } else {
      await expect(() => client.qrCode()).rejects.toThrow();
    }
  });

  test("deepLink", function () {
    expect(() => client.deepLink()).toThrow(new Error(REQUEST_IS_MISSING_MESSAGE));
    const requestId = SignalClient.generateRequestId();
    const fixture = `${client.url.replace("https://", "liquid://")}/?requestId=${requestId}`;
    const deepLink = client.deepLink(requestId);
    expect(deepLink).toEqual(fixture);

    client.requestId = requestId;
    expect(client.deepLink()).toEqual(fixture);
  });

  test("attestation", async function () {
    const response = await client.attestation(async (): Promise<LiquidExtensionOptions> => {
      return createResponseBodyFixtures[0].clientExtensionResults.liquid as LiquidExtensionOptions;
    });
    expect(response).toEqual(createResponseResponseFixtures[0]);
  });

  // FIDO Assertions
  test("assertion", async () => {
    const credentialId =
      "AYMPi2Rbhcnu2gSHOO1TNvzDJ38iU00rrlCqyH874XCIEoIotRc7eVRFpx0TvsQurg7BAnXy5KnWdKC8LeWs0k0";
    const response = await client.assertion(credentialId);
    expect(response).toEqual({
      ...getResponseResponseFixtures[0],
      credentials: [{ ...getResponseResponseFixtures[0].credentials[0], prevCounter: 1 }],
    });
  });

  test("assertion binds a durable pairing request without breaking the legacy debug argument", async () => {
    const credentialId =
      "AYMPi2Rbhcnu2gSHOO1TNvzDJ38iU00rrlCqyH874XCIEoIotRc7eVRFpx0TvsQurg7BAnXy5KnWdKC8LeWs0k0";
    const requestId = SignalClient.generateRequestId();

    await client.assertion(credentialId, { requestId });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${url}/assertion/request/${credentialId}`,
      expect.objectContaining({ body: JSON.stringify({ requestId }) }),
    );
    const responseCall = vi
      .mocked(globalThis.fetch)
      .mock.calls.filter(([input]) => String(input).endsWith("/assertion/response"))
      .at(-1);
    expect(JSON.parse(String(responseCall?.[1]?.body))).toMatchObject({
      clientExtensionResults: { liquid: { requestId } },
    });

    await expect(client.assertion(credentialId, false)).resolves.toBeDefined();
  });

  test("peer(offer) unbuffered", async function () {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture = {
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
    };
    const sdpFixture = {
      type: "offer",
      sdp: "offer-sdp-fixture",
    };
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        ack({
          data: linkMessageFixture,
        });
      },
    );
    // wait for an answer
    const result = client.peer(requestId, "offer");
    await Promise.resolve();
    await Promise.resolve();
    expect(client.emit).toHaveBeenNthCalledWith(1, "link", { requestId });
    expect(client.emit).toHaveBeenNthCalledWith(2, "link-message", linkMessageFixture);
    // Wait for the next tick
    if (typeof process !== "undefined") {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          resolve();
        });
      });
    } else {
      await Promise.resolve();
    }
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: "candidate-fixture" };
        },
      },
    });
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.onicecandidate({});

    // Emit an offer from a peer
    socket.emit("offer-description", sdpFixture.sdp);

    // @ts-expect-error, access private peerClient for testing
    client.peerClient.remoteDescription = "remote-description-fixture";

    // Emit an unbuffered candidate from the peer
    socket.emit("offer-candidate", { candidate: "candidate-fixture" });

    // Resolve the DataChannel from the Peer
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.ondatachannel({
      channel: {
        send: vi.fn(),
      },
    });
    // TODO: investigate browser issue
    if (typeof window === "undefined") {
      await expect(result).resolves.toHaveProperty("send");
    }
  });
  test("peer(offer)", async function () {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture: LinkMessage = {
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
    };
    const sdpFixture = {
      type: "offer",
      sdp: "offer-sdp-fixture",
    };
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        ack({
          data: linkMessageFixture,
        });
      },
    );
    // wait for an answer
    const result = client.peer(requestId, "offer");
    await Promise.resolve();
    await Promise.resolve();
    expect(client.emit).toHaveBeenNthCalledWith(1, "link", { requestId });
    expect(client.emit).toHaveBeenNthCalledWith(2, "link-message", linkMessageFixture);
    // Wait for the next tick
    if (typeof process !== "undefined") {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          resolve();
        });
      });
    } else {
      await Promise.resolve();
    }
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: "candidate-fixture" };
        },
      },
    });
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.onicecandidate({});

    // Emit a buffered candidate from the peer
    socket.emit("offer-candidate", { candidate: "candidate-fixture" });

    // Emit an offer from a peer
    socket.emit("offer-description", sdpFixture.sdp);
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.remoteDescription = "remote-description-fixture";

    // Emit an unbuffered candidate from the peer
    socket.emit("offer-candidate", { candidate: "candidate-fixture" });

    // Resolve the DataChannel from the Peer
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.ondatachannel({
      channel: {
        send: vi.fn(),
      },
    });

    if (typeof window === "undefined") {
      await expect(result).resolves.toHaveProperty("send");
    }
  });
  test("peer(answer) unbuffered", async function () {
    // Only allow one peer session at a time
    client.requestId = "019097ff-bb8d-7a31-83bb-aa934d351662";
    await expect(() =>
      client.peer("019097ff-bb8d-7a31-83bb-aa934d351662", "answer"),
    ).rejects.toThrow(new Error(REQUEST_IN_PROCESS_MESSAGE));
    delete client.requestId;

    const sdpFixture = {
      type: "answer",
      sdp: "answer-sdp-fixture",
    };
    const requestId = SignalClient.generateRequestId();
    client.authenticated = true;
    // wait for an answer
    const result = client.peer(requestId, "answer");
    await Promise.resolve();
    await Promise.resolve();

    // @ts-expect-error, access private peerClient for testing
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: "candidate-fixture" };
        },
      },
    });
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.onicecandidate({});

    // Check that the local candidate was emitted
    expect(client.emit).toHaveBeenNthCalledWith(1, "offer-candidate", {
      candidate: "candidate-fixture",
    });

    // Wait for the next tick
    if (typeof process !== "undefined") {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          resolve();
        });
      });
    } else {
      await Promise.resolve();
    }

    // Emit an answer from a peer
    socket.emit("answer-description", sdpFixture.sdp);
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.remoteDescription = "remote-description-fixture";

    // Emit an unbuffered candidate from the peer
    socket.emit("answer-candidate", { candidate: "candidate-fixture" });

    if (typeof window === "undefined") {
      await expect(result).resolves.toHaveProperty("send");
    }
  });
  test("peer(answer)", async function () {
    // Only allow one peer session at a time
    client.requestId = "019097ff-bb8d-7a31-83bb-aa934d351662";
    await expect(() =>
      client.peer("019097ff-bb8d-7a31-83bb-aa934d351662", "answer"),
    ).rejects.toThrow(new Error(REQUEST_IN_PROCESS_MESSAGE));
    delete client.requestId;

    const sdpFixture = {
      type: "answer",
      sdp: "answer-sdp-fixture",
    };
    const requestId = SignalClient.generateRequestId();
    client.authenticated = true;
    // wait for an answer
    const result = client.peer(requestId, "answer");
    await Promise.resolve();
    await Promise.resolve();

    // @ts-expect-error, access private peerClient for testing
    client.peerClient.onicecandidate({
      candidate: {
        toJSON() {
          return { candidate: "candidate-fixture" };
        },
      },
    });
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.onicecandidate({});

    // Check that the local candidate was emitted
    expect(client.emit).toHaveBeenNthCalledWith(1, "offer-candidate", {
      candidate: "candidate-fixture",
    });

    // Emit a buffered candidate from the peer
    socket.emit("answer-candidate", { candidate: "candidate-fixture" });

    // Wait for the next tick
    if (typeof process !== "undefined") {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          resolve();
        });
      });
    } else {
      await Promise.resolve();
    }
    // Emit an answer from a peer
    socket.emit("answer-description", sdpFixture.sdp);
    // @ts-expect-error, access private peerClient for testing
    client.peerClient.remoteDescription = "remote-description-fixture";

    // Emit an unbuffered candidate from the peer
    socket.emit("answer-candidate", { candidate: "candidate-fixture" });

    if (typeof window === "undefined") {
      await expect(result).resolves.toHaveProperty("send");
    }
  });

  // Link Messages
  test("link", async function () {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture: LinkMessage = {
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
    };
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        ack({
          data: linkMessageFixture,
        });
      },
    );
    const result = client.link(requestId);
    await Promise.resolve();
    expect(client.emit).toHaveBeenNthCalledWith(1, "link", { requestId });
    await expect(result).resolves.toEqual(linkMessageFixture);
    expect(client.emit).toHaveBeenNthCalledWith(2, "link-message", linkMessageFixture);

    client.requestId = requestId;
    await expect(() => client.link(requestId)).rejects.toThrow(
      new Error(REQUEST_IN_PROCESS_MESSAGE),
    );
  });

  test("accepts and preserves a durable pairing link response", async function () {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture: LinkMessage = {
      version: 2,
      pairingId: requestId,
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
      credId: "credential-id",
    };
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        ack({ data: linkMessageFixture });
      },
    );

    await expect(client.link(requestId)).resolves.toEqual(linkMessageFixture);
    expect(client.authenticated).toBe(true);
  });

  test("rejects a durable link response for a different pairing", async function () {
    const requestId = SignalClient.generateRequestId();
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        ack({
          data: {
            version: 2,
            pairingId: SignalClient.generateRequestId(),
            requestId,
            wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
          },
        });
      },
    );

    await expect(client.link(requestId)).rejects.toMatchObject({
      code: "SIGNAL_PROTOCOL_ERROR",
      message: "Invalid pairing response",
    });
    expect(client.authenticated).toBe(false);
    expect(client.requestId).toBeUndefined();
  });

  test("replays a pending link after reconnect and settles only once", async function () {
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture: LinkMessage = {
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
    };
    const acknowledgements: Array<(options: { data: LinkMessage }) => void> = [];
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        acknowledgements.push(ack);
        if (acknowledgements.length === 2) ack({ data: linkMessageFixture });
      },
    );

    const result = client.link(requestId, { timeoutMs: 1_000 });
    await Promise.resolve();
    expect(acknowledgements).toHaveLength(1);

    socket.emit("disconnect", "transport close");
    socket.emit("connect");
    await expect(result).resolves.toEqual(linkMessageFixture);
    expect(acknowledgements).toHaveLength(2);

    acknowledgements[0]?.({ data: linkMessageFixture });
    expect(client.emit).toHaveBeenCalledTimes(4); // link, disconnect, connect, link-message
  });

  test("rejects a pending link after a terminal Socket.IO disconnect", async function () {
    const result = client.link(SignalClient.generateRequestId(), { timeoutMs: 60_000 });
    await Promise.resolve();

    client.socket.active = true;
    socket.emit("disconnect", "io server disconnect");

    await expect(result).rejects.toMatchObject({ code: "SIGNAL_DISCONNECTED" });
    expect(client.requestId).toBeUndefined();
  });

  test("cancels a pending link without leaving request state behind", async function () {
    const controller = new AbortController();
    const linkStarted = createDeferred<void>();
    socket.on("link", () => linkStarted.resolve());
    const result = client.link(SignalClient.generateRequestId(), {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    await linkStarted.promise;

    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    expect(client.requestId).toBeUndefined();
  });

  test("treats an unclassified WebSocket exception as a retryable server error", async function () {
    const requestId = SignalClient.generateRequestId();
    const linkStarted = createDeferred<void>();
    socket.on("link", () => linkStarted.resolve());
    const result = client.link(requestId, { timeoutMs: 100 });
    await linkStarted.promise;

    socket.emit("exception", {
      status: "error",
      message: "Pairing does not match link request",
      cause: { pattern: "link", data: { requestId } },
    });

    await expect(result).rejects.toMatchObject({
      code: "SIGNAL_SERVER_ERROR",
      message: "Pairing does not match link request",
    });
    expect(client.requestId).toBeUndefined();

    const retryController = new AbortController();
    retryController.abort();
    await expect(
      client.link(SignalClient.generateRequestId(), { signal: retryController.signal }),
    ).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
  });

  test("only treats an explicitly coded WebSocket exception as a terminal pairing error", async function () {
    const requestId = SignalClient.generateRequestId();
    const linkStarted = createDeferred<void>();
    socket.on("link", () => linkStarted.resolve());
    const result = client.link(requestId, { timeoutMs: 100 });
    await linkStarted.promise;

    socket.emit("exception", {
      status: "error",
      message: "Pairing does not match link request",
      code: "PAIRING_UNAUTHORIZED",
      cause: { pattern: "link", data: { requestId } },
    });

    await expect(result).rejects.toMatchObject({
      code: "PAIRING_UNAUTHORIZED",
      message: "Pairing does not match link request",
    });
    expect(client.requestId).toBeUndefined();
  });

  test("treats an explicitly revoked WebSocket pairing as terminal", async function () {
    const requestId = SignalClient.generateRequestId();
    const linkStarted = createDeferred<void>();
    const closePeer = vi.fn();
    client.peerClient = { close: closePeer } as unknown as RTCPeerConnection;
    client.authenticated = true;
    socket.on("link", () => linkStarted.resolve());
    const result = client.link(requestId, { timeoutMs: 100 });
    await linkStarted.promise;

    socket.emit("exception", {
      status: "error",
      message: "Pairing has been revoked",
      code: "PAIRING_REVOKED",
      cause: { pattern: "link", data: { requestId } },
    });

    await expect(result).rejects.toMatchObject({
      code: "PAIRING_REVOKED",
      message: "Pairing has been revoked",
    });
    expect(client.authenticated).toBe(false);
    expect(closePeer).toHaveBeenCalledOnce();
    await expect(client.link(SignalClient.generateRequestId())).rejects.toMatchObject({
      code: "PAIRING_REVOKED",
    });
  });

  test("treats an unclassified link acknowledgement error as retryable", async function () {
    const requestId = SignalClient.generateRequestId();
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (response: { error: string }) => void) => {
        ack({ error: "Temporary database failure" });
      },
    );

    await expect(client.link(requestId, { timeoutMs: 100 })).rejects.toMatchObject({
      code: "SIGNAL_SERVER_ERROR",
      message: "Temporary database failure",
    });
  });

  test("captures an offer emitted synchronously with the link acknowledgement", async function () {
    const requestId = SignalClient.generateRequestId();
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        socket.emit("offer-description", "offer-sdp-fixture");
        ack({
          data: {
            requestId,
            wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
          },
        });
      },
    );

    const result = client.peer(requestId, "offer", undefined, { timeoutMs: 1_000 });
    await Promise.resolve();
    await Promise.resolve();
    // @ts-expect-error access private peerClient for the WebRTC test double
    client.peerClient.ondatachannel({ channel: { send: vi.fn() } });
    await expect(result).resolves.toHaveProperty("send");
  });

  test("captures an answer emitted synchronously in response to the offer", async function () {
    client.authenticated = true;
    socket.on("offer-description", () => {
      socket.emit("answer-description", "answer-sdp-fixture");
    });

    await expect(
      client.peer(SignalClient.generateRequestId(), "answer", undefined, {
        timeoutMs: 1_000,
      }),
    ).resolves.toHaveProperty("send");
  });

  test("aborting a provider peer during linking does not leave unhandled rejections", async function () {
    if (
      typeof process === "undefined" ||
      typeof process.on !== "function" ||
      typeof process.off !== "function"
    ) {
      return;
    }

    const controller = new AbortController();
    const linkStarted = createDeferred<void>();
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
    socket.on("link", () => linkStarted.resolve());
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      const result = client.peer(SignalClient.generateRequestId(), "offer", undefined, {
        signal: controller.signal,
        timeoutMs: 1_000,
      });
      const rejection = expect(result).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
      await linkStarted.promise;

      controller.abort();

      await rejection;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });

  test("does not send or accept a link when its public observer aborts the peer", async function () {
    const controller = new AbortController();
    const outgoingLink = vi.fn(
      (payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        ack({
          data: {
            requestId: payload.requestId,
            wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
          },
        });
      },
    );
    socket.on("link", outgoingLink);
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "link") controller.abort();
      return true;
    });

    await expect(
      client.peer(SignalClient.generateRequestId(), "offer", undefined, {
        signal: controller.signal,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    expect(outgoingLink).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalledWith("link-message", expect.anything());
    expect(client.authenticated).toBe(false);
  });

  test("rejects an acknowledgement delivered synchronously after the owner aborts", async function () {
    const controller = new AbortController();
    socket.on(
      "link",
      (payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        controller.abort();
        ack({
          data: {
            requestId: payload.requestId,
            wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
          },
        });
      },
    );

    await expect(
      client.peer(SignalClient.generateRequestId(), "offer", undefined, {
        signal: controller.signal,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    expect(client.emit).not.toHaveBeenCalledWith("link-message", expect.anything());
    expect(client.authenticated).toBe(false);
  });

  test("does not emit a stale offer when aborted during createOffer", async function () {
    const controller = new AbortController();
    const createOfferStarted = createDeferred<void>();
    const localOffer = createDeferred<RTCSessionDescriptionInit>();
    const createOffer = vi.fn(() => {
      createOfferStarted.resolve();
      return localOffer.promise;
    });
    const setLocalDescription = vi.fn().mockResolvedValue(undefined);
    const peer = createPeerConnection({ createOffer, setLocalDescription });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    const outgoingOffer = vi.fn();
    socket.on("offer-description", outgoingOffer);

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    const rejection = expect(result).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    await createOfferStarted.promise;

    controller.abort();
    localOffer.resolve({ type: "offer", sdp: "stale-offer" });

    await rejection;
    await Promise.resolve();
    expect(setLocalDescription).not.toHaveBeenCalled();
    expect(outgoingOffer).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalledWith("offer-description", "stale-offer");
  });

  test("times out during createOffer without emitting a stale offer", async function () {
    const createOfferStarted = createDeferred<void>();
    const localOffer = createDeferred<RTCSessionDescriptionInit>();
    const createOffer = vi.fn(() => {
      createOfferStarted.resolve();
      return localOffer.promise;
    });
    const setLocalDescription = vi.fn().mockResolvedValue(undefined);
    const peer = createPeerConnection({ createOffer, setLocalDescription });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    const outgoingOffer = vi.fn();
    socket.on("offer-description", outgoingOffer);

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 5,
    });
    await createOfferStarted.promise;
    await expect(result).rejects.toMatchObject({ code: "SIGNAL_TIMEOUT" });

    localOffer.resolve({ type: "offer", sdp: "late-offer" });
    await Promise.resolve();
    expect(setLocalDescription).not.toHaveBeenCalled();
    expect(outgoingOffer).not.toHaveBeenCalled();
  });

  test("rejects an abort while setRemoteDescription is pending", async function () {
    const controller = new AbortController();
    const setRemoteDescriptionStarted = createDeferred<void>();
    const remoteDescription = createDeferred<void>();
    const setRemoteDescription = vi.fn(() => {
      setRemoteDescriptionStarted.resolve();
      return remoteDescription.promise;
    });
    const peer = createPeerConnection({ setRemoteDescription });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    socket.on("offer-description", () => {
      socket.emit("answer-description", "answer-sdp-fixture");
    });

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    const rejection = expect(result).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    await setRemoteDescriptionStarted.promise;

    controller.abort();
    remoteDescription.resolve();

    await rejection;
    expect(setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer-sdp-fixture",
    });
    expect(peer.close).toHaveBeenCalledOnce();
  });

  test("rejects revocation while setRemoteDescription is pending", async function () {
    const setRemoteDescriptionStarted = createDeferred<void>();
    const remoteDescription = createDeferred<void>();
    const setRemoteDescription = vi.fn(() => {
      setRemoteDescriptionStarted.resolve();
      return remoteDescription.promise;
    });
    const peer = createPeerConnection({ setRemoteDescription });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    socket.on("offer-description", () => {
      socket.emit("answer-description", "answer-sdp-fixture");
    });

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 1_000,
    });
    await setRemoteDescriptionStarted.promise;

    socket.emit("pairing:revoked", { error: "Pairing removed" });

    await expect(result).rejects.toMatchObject({ code: "PAIRING_REVOKED" });
    remoteDescription.resolve();
    await Promise.resolve();
    expect(peer.close).toHaveBeenCalledOnce();
  });

  test("does not resolve when a data-channel observer aborts the operation", async function () {
    const controller = new AbortController();
    const peer = createPeerConnection();
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "data-channel") controller.abort();
      return true;
    });
    socket.on("offer-description", () => {
      socket.emit("answer-description", "answer-sdp-fixture");
    });

    await expect(
      client.peer(SignalClient.generateRequestId(), "answer", undefined, {
        signal: controller.signal,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    expect(peer.close).toHaveBeenCalledOnce();
  });

  test("ignores a description delivered synchronously after abort", async function () {
    const controller = new AbortController();
    const offerSent = createDeferred<void>();
    client.authenticated = true;
    socket.on("offer-description", () => offerSent.resolve());

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    const rejection = expect(result).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    await offerSent.promise;

    controller.abort();
    socket.emit("answer-description", "stale-answer");

    await rejection;
    expect(client.emit).not.toHaveBeenCalledWith("answer-description", {
      type: "answer",
      sdp: "stale-answer",
    });
  });

  test("stops public signaling when an offer-description observer aborts", async function () {
    const controller = new AbortController();
    const peer = createPeerConnection();
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "offer-description") controller.abort();
      return true;
    });

    await expect(
      client.peer(SignalClient.generateRequestId(), "answer", undefined, {
        signal: controller.signal,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    expect(client.emit).toHaveBeenCalledWith("offer-description", "offer-sdp-fixture");
    expect(client.emit).not.toHaveBeenCalledWith("signal", { type: "answer" });
    expect(peer.close).toHaveBeenCalledOnce();
  });

  test("does not publish a local candidate after its socket emission closes the client", async function () {
    const offerSent = createDeferred<void>();
    const peer = createPeerConnection();
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    socket.on("offer-description", () => offerSent.resolve());
    socket.on("offer-candidate", () => client.close());

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 1_000,
    });
    const rejection = expect(result).rejects.toMatchObject({ code: "SIGNAL_CLOSED" });
    await offerSent.promise;
    peer.onicecandidate?.({
      candidate: { toJSON: () => ({ candidate: "local-candidate" }) },
    } as RTCPeerConnectionIceEvent);

    await rejection;
    expect(client.emit).not.toHaveBeenCalledWith("offer-candidate", {
      candidate: "local-candidate",
    });
  });

  test("rejects a concurrent peer without consuming the first peer's SDP", async function () {
    client.authenticated = true;
    const firstPeer = createPeerConnection();
    peerConnectionConstructor.mockImplementationOnce(() => firstPeer);
    const firstOfferSent = createDeferred<void>();
    const nextOfferSent = createDeferred<void>();
    let offerCount = 0;
    socket.on("offer-description", () => {
      offerCount += 1;
      if (offerCount === 1) firstOfferSent.resolve();
      if (offerCount === 2) nextOfferSent.resolve();
    });

    const first = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 1_000,
    });
    await firstOfferSent.promise;

    const second = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 1_000,
    });
    const secondOutcome = second.then(
      () => ({ error: undefined }),
      (error: unknown) => ({ error }),
    );
    await Promise.resolve();
    socket.emit("answer-description", "first-answer");

    await expect(first).resolves.toHaveProperty("send");
    await expect(secondOutcome).resolves.toMatchObject({
      error: new Error(REQUEST_IN_PROCESS_MESSAGE),
    });
    expect(peerConnectionConstructor).toHaveBeenCalledOnce();
    expect(firstPeer.setRemoteDescription).toHaveBeenCalledOnce();
    expect(firstPeer.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "first-answer",
    });

    const next = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 1_000,
    });
    await nextOfferSent.promise;
    socket.emit("answer-description", "next-answer");
    await expect(next).resolves.toHaveProperty("send");
    expect(peerConnectionConstructor).toHaveBeenCalledTimes(2);
    expect(firstPeer.close).toHaveBeenCalledOnce();
  });

  test("signal", async function () {
    await expect(() => client.signal("offer")).rejects.toThrow(new Error(UNAUTHENTICATED_MESSAGE));
    client.authenticated = true;
    const sdpFixture = {
      type: "offer",
      sdp: "offer-sdp-fixture",
    };
    const result = client.signal("offer");
    await Promise.resolve();
    expect(client.emit).toHaveBeenNthCalledWith(1, "signal", { type: "offer" });
    socket.emit("offer-description", sdpFixture.sdp);
    await expect(result).resolves.toEqual(sdpFixture);
    expect(client.emit).toHaveBeenNthCalledWith(2, "offer-description", sdpFixture);
  });

  test("preserves the legacy ability to link while a standalone signal waits", async function () {
    client.authenticated = true;
    const signalStarted = createDeferred<void>();
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "signal") signalStarted.resolve();
      return true;
    });
    const requestId = SignalClient.generateRequestId();
    const linkMessageFixture: LinkMessage = {
      requestId,
      wallet: "65X3KSKFCNX3VUPQDVO3RQUHDZN7BONGBEC6PJWAVKX73DIC356M7M32JM",
    };
    socket.on(
      "link",
      (_payload: { requestId: string }, ack: (options: { data: LinkMessage }) => void) => {
        ack({ data: linkMessageFixture });
      },
    );

    const signaling = client.signal("offer", { timeoutMs: 1_000 });
    await signalStarted.promise;
    await expect(client.link(requestId, { timeoutMs: 1_000 })).resolves.toEqual(linkMessageFixture);
    socket.emit("offer-description", "offer-sdp-fixture");
    await expect(signaling).resolves.toEqual({ type: "offer", sdp: "offer-sdp-fixture" });
  });

  test("close rejects a pending signal operation immediately", async function () {
    client.authenticated = true;
    const signalStarted = createDeferred<void>();
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "signal") signalStarted.resolve();
      return true;
    });
    const result = client.signal("offer", { timeoutMs: 60_000 });
    await signalStarted.promise;

    client.close();
    await expect(result).rejects.toMatchObject({ code: "SIGNAL_CLOSED" });
  });

  test("close cancels an in-progress peer negotiation without closing its native peer", async function () {
    const createOfferStarted = createDeferred<void>();
    const localOffer = createDeferred<RTCSessionDescriptionInit>();
    const peer = createPeerConnection({
      createOffer: vi.fn(() => {
        createOfferStarted.resolve();
        return localOffer.promise;
      }),
    });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 60_000,
    });
    await createOfferStarted.promise;

    client.close();

    await expect(result).rejects.toMatchObject({ code: "SIGNAL_CLOSED" });
    expect(peer.close).not.toHaveBeenCalled();
    expect(peer.onicecandidate).toBeNull();
    localOffer.reject(new Error("late createOffer failure"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(peer.setLocalDescription).not.toHaveBeenCalled();
  });

  test("deferred peer cleanup waits for in-flight native SDP work", async function () {
    const setRemoteDescriptionStarted = createDeferred<void>();
    const remoteDescription = createDeferred<void>();
    const peer = createPeerConnection({
      setRemoteDescription: vi.fn(() => {
        setRemoteDescriptionStarted.resolve();
        return remoteDescription.promise;
      }),
    });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    socket.on("offer-description", () => {
      socket.emit("answer-description", "answer-sdp-fixture");
    });

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 60_000,
    });
    await setRemoteDescriptionStarted.promise;
    client.close();
    const cleanup = client.closePeerWhenSafe(1_000);

    await expect(result).rejects.toMatchObject({ code: "SIGNAL_CLOSED" });
    expect(peer.close).not.toHaveBeenCalled();

    remoteDescription.resolve();
    await cleanup;

    expect(peer.close).toHaveBeenCalledOnce();
    expect(client.peerClient).toBeUndefined();
  });

  test("deferred peer cleanup has a bounded fallback for stalled native work", async function () {
    const setRemoteDescriptionStarted = createDeferred<void>();
    const remoteDescription = createDeferred<void>();
    const peer = createPeerConnection({
      setRemoteDescription: vi.fn(() => {
        setRemoteDescriptionStarted.resolve();
        return remoteDescription.promise;
      }),
    });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    socket.on("offer-description", () => {
      socket.emit("answer-description", "answer-sdp-fixture");
    });

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 60_000,
    });
    await setRemoteDescriptionStarted.promise;
    client.close();

    await expect(result).rejects.toMatchObject({ code: "SIGNAL_CLOSED" });
    await client.closePeerWhenSafe(5);

    expect(peer.close).toHaveBeenCalledOnce();
    remoteDescription.resolve();
  });

  test("close can explicitly close an in-progress peer negotiation", async function () {
    const createOfferStarted = createDeferred<void>();
    const localOffer = createDeferred<RTCSessionDescriptionInit>();
    const peer = createPeerConnection({
      createOffer: vi.fn(() => {
        createOfferStarted.resolve();
        return localOffer.promise;
      }),
    });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 60_000,
    });
    await createOfferStarted.promise;

    client.close(false, true);

    await expect(result).rejects.toMatchObject({ code: "SIGNAL_CLOSED" });
    expect(peer.close).toHaveBeenCalledOnce();
    expect(client.peerClient).toBeUndefined();
    localOffer.resolve({ type: "offer", sdp: "late-offer" });
    await Promise.resolve();
    expect(peer.setLocalDescription).not.toHaveBeenCalled();
  });

  test("rejects active signaling when the pairing handshake is revoked", async function () {
    client.authenticated = true;
    const signalStarted = createDeferred<void>();
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "signal") signalStarted.resolve();
      return true;
    });
    const result = client.signal("offer", { timeoutMs: 60_000 });
    await signalStarted.promise;

    socket.emit(
      "connect_error",
      Object.assign(new Error("Pairing has been revoked"), {
        data: { code: "PAIRING_REVOKED" },
      }),
    );
    await expect(result).rejects.toMatchObject({ code: "PAIRING_REVOKED" });
    expect(client.authenticated).toBe(false);
  });

  test("applies pairing rejection before publishing connect_error", function () {
    const closePeer = vi.fn();
    client.peerClient = { close: closePeer } as unknown as RTCPeerConnection;
    client.authenticated = true;
    const observerError = new Error("observer failed");
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "connect_error") throw observerError;
      return true;
    });

    expect(() =>
      socket.emit(
        "connect_error",
        Object.assign(new Error("Pairing has been revoked"), {
          data: { code: "PAIRING_REVOKED" },
        }),
      ),
    ).toThrow(observerError);
    expect(client.authenticated).toBe(false);
    expect(closePeer).toHaveBeenCalledOnce();
    expect(client.peerClient).toBeUndefined();
  });

  test("fails peer negotiation before publishing a throwing disconnect observer", async function () {
    const offerSent = createDeferred<void>();
    const peer = createPeerConnection();
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    socket.on("offer-description", () => offerSent.resolve());
    const observerError = new Error("disconnect observer failed");
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "disconnect") throw observerError;
      return true;
    });

    const result = client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 1_000,
    });
    const rejection = expect(result).rejects.toMatchObject({ code: "SIGNAL_DISCONNECTED" });
    await offerSent.promise;

    expect(() => socket.emit("disconnect", "transport close")).toThrow(observerError);
    socket.emit("answer-description", "stale-answer");

    await rejection;
    expect(peer.setRemoteDescription).not.toHaveBeenCalled();
    expect(peer.close).toHaveBeenCalledOnce();
    client.close();
  });

  test("handles a pushed pairing revocation across pending and active signaling", async function () {
    const closePeer = vi.fn();
    client.peerClient = { close: closePeer } as unknown as RTCPeerConnection;
    client.authenticated = true;
    const linkStarted = createDeferred<void>();
    const signalStarted = createDeferred<void>();
    socket.on("link", () => linkStarted.resolve());
    vi.mocked(client.emit).mockImplementation((event: string | symbol) => {
      if (event === "signal") signalStarted.resolve();
      return true;
    });

    const pendingLink = client.link(SignalClient.generateRequestId(), { timeoutMs: 60_000 });
    await linkStarted.promise;
    const activeSignal = client.signal("offer", { timeoutMs: 60_000 });
    await signalStarted.promise;

    socket.emit("pairing:revoked", { error: "Pairing removed by provider" });

    await expect(pendingLink).rejects.toMatchObject({
      code: "PAIRING_REVOKED",
      message: "Pairing removed by provider",
    });
    await expect(activeSignal).rejects.toMatchObject({
      code: "PAIRING_REVOKED",
      message: "Pairing removed by provider",
    });
    expect(client.authenticated).toBe(false);
    expect(closePeer).toHaveBeenCalledOnce();
    expect(client.peerClient).toBeUndefined();
    socket.emit("connect");
    await expect(client.signal("answer")).rejects.toMatchObject({ code: "PAIRING_REVOKED" });
  });

  test("remembers a terminal pairing handshake error for the next operation", async function () {
    socket.emit(
      "connect_error",
      Object.assign(new Error("Pairing credential was not accepted"), {
        data: { code: "PAIRING_UNAUTHORIZED" },
      }),
    );

    await expect(
      client.link(SignalClient.generateRequestId(), { timeoutMs: 60_000 }),
    ).rejects.toMatchObject({ code: "PAIRING_UNAUTHORIZED" });
  });

  test("close", async function () {
    client.close(true);
    await Promise.resolve();
    expect(client.socket.connected).toBe(false);
    client.close();
    expect(client.requestId).toBeUndefined();
  });

  test("close preserves an established peer by default", function () {
    const closePeer = vi.fn();
    const peer = { close: closePeer } as unknown as RTCPeerConnection;
    client.peerClient = peer;

    client.close();

    expect(closePeer).not.toHaveBeenCalled();
    expect(client.peerClient).toBe(peer);
  });

  test("close stops late ICE signaling on a preserved established peer", async function () {
    client.authenticated = true;
    socket.on("offer-description", () => {
      socket.emit("answer-description", "answer-sdp-fixture");
    });
    const outgoingCandidate = vi.fn();
    socket.on("offer-candidate", outgoingCandidate);
    await client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 1_000,
    });
    const peer = client.peerClient as RTCPeerConnection;
    const lateCandidateHandler = peer.onicecandidate;
    client.emit = vi.fn();

    client.close();
    expect(peer.onicecandidate).toBeNull();
    lateCandidateHandler?.call(peer, {
      candidate: {
        toJSON: () => ({ candidate: "late-candidate" }),
      },
    } as RTCPeerConnectionIceEvent);

    expect(outgoingCandidate).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalledWith("offer-candidate", {
      candidate: "late-candidate",
    });
  });

  test("close fences a remote ICE candidate already being added", async function () {
    const addCandidateStarted = createDeferred<void>();
    const addCandidate = createDeferred<void>();
    const peer = createPeerConnection({
      addIceCandidate: vi.fn(() => {
        addCandidateStarted.resolve();
        return addCandidate.promise;
      }),
    });
    peerConnectionConstructor.mockImplementationOnce(() => peer);
    client.authenticated = true;
    socket.on("offer-description", () => {
      socket.emit("answer-description", "answer-sdp-fixture");
    });
    await client.peer(SignalClient.generateRequestId(), "answer", undefined, {
      timeoutMs: 1_000,
    });
    Object.defineProperty(peer, "remoteDescription", { value: { type: "answer" } });
    client.emit = vi.fn();

    socket.emit("answer-candidate", { candidate: "remote-candidate" });
    await addCandidateStarted.promise;
    client.close();
    addCandidate.resolve();
    await Promise.resolve();

    expect(client.emit).not.toHaveBeenCalledWith("answer-candidate", {
      candidate: "remote-candidate",
    });
  });

  test("close can explicitly close the peer and removes the pushed-revocation listener", async function () {
    const closePeer = vi.fn();
    const peer = { close: closePeer } as unknown as RTCPeerConnection;
    client.peerClient = peer;

    client.close(false, true);
    await Promise.resolve();
    socket.emit("pairing:revoked", { error: "late revocation" });

    expect(closePeer).toHaveBeenCalledOnce();
    expect(client.peerClient).toBeUndefined();
  });

  test("supports a legacy LiquidSocket adapter without targeted listener removal", async function () {
    class LegacySocket implements LiquidSocket {
      connected = true;
      private readonly listeners = new Map<string, Set<(...args: any[]) => void>>();

      on(event: string, listener: (...args: any[]) => void): this {
        const listeners = this.listeners.get(event) ?? new Set();
        listeners.add(listener);
        this.listeners.set(event, listeners);
        return this;
      }

      once(event: string, listener: (...args: any[]) => void): this {
        const wrapped = (...args: any[]) => {
          this.listeners.get(event)?.delete(wrapped);
          listener(...args);
        };
        return this.on(event, wrapped);
      }

      emit(event: string, ...args: any[]): this {
        for (const listener of Array.from(this.listeners.get(event) ?? [])) listener(...args);
        return this;
      }

      disconnect(): this {
        this.connected = false;
        this.emit("disconnect", "io client disconnect");
        return this;
      }

      removeAllListeners(event?: string): this {
        if (event === undefined) this.listeners.clear();
        else this.listeners.delete(event);
        return this;
      }
    }

    const legacySocket = new LegacySocket();
    const legacyClient = new SignalClient(url, { socket: legacySocket });
    legacyClient.authenticated = true;
    const controller = new AbortController();
    const signalStarted = createDeferred<void>();
    legacyClient.on("signal", () => signalStarted.resolve());
    const result = legacyClient.signal("offer", {
      signal: controller.signal,
      timeoutMs: 60_000,
    });
    await signalStarted.promise;

    controller.abort();

    await expect(result).rejects.toMatchObject({ code: "SIGNAL_ABORTED" });
    expect(() => legacyClient.close()).not.toThrow();
  });
});

test("generateQRCode", async () => {
  const qrFixture = {
    url: "https://liquid-auth.onrender.com",
    requestId: "34337d4a-0a42-4a51-a418-13a5b7c8e86d",
  };
  if (typeof window !== "undefined") {
    await expect(async () => generateQRCode({ url: qrFixture.url })).rejects.toThrow(
      new Error(REQUEST_IS_MISSING_MESSAGE),
    );
    const result = await generateQRCode(qrFixture);
    expect(result).toBeDefined();
  } else {
    await expect(() => generateQRCode(qrFixture)).rejects.toThrow();
  }
});

test("generateDeepLink", async () => {
  const url = "https://liquid-auth.onrender.com";
  const requestId = SignalClient.generateRequestId();
  const fixture = `${url.replace("https://", "liquid://")}/?requestId=${requestId}`;
  expect(generateDeepLink(url, requestId)).toEqual(fixture);
  expect(() => generateDeepLink(url, undefined as any)).toThrow(
    new Error(REQUEST_IS_MISSING_MESSAGE),
  );
});

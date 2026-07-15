/**
 * Signal Module
 *
 * @packageDocumentation
 * @document ./signal.offer.guide.md
 * @document ./signal.answer.guide.md
 */
import type { ManagerOptions, SocketOptions } from "socket.io-client";
import { EventEmitter } from "eventemitter3";
import { v7 as uuidv7 } from "uuid";

import { attestation } from "./attestation.ts";
import { assertion } from "./assertion.ts";

import { DEFAULT_QR_CODE_OPTIONS } from "./constants.ts";
import {
  ORIGIN_IS_MISSING_MESSAGE,
  REQUEST_IN_PROCESS_MESSAGE,
  REQUEST_IS_MISSING_MESSAGE,
  SignalError,
  UNAUTHENTICATED_MESSAGE,
} from "./errors.ts";
import { DEFAULT_ATTESTATION_OPTIONS } from "./attestation.fetch.ts";
import type { User, LiquidExtensionOptions, LiquidSocket, QRCodeOptions } from "./types.ts";
import { isPairingCredential } from "./pairing.ts";

const DEFAULT_SIGNAL_TIMEOUT_MS = 120_000;

export type SignalOperationOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type PeerOptions = SignalOperationOptions & {
  dataChannels?: Record<string, RTCDataChannelInit>;
  tracks?: MediaStreamTrack[];
};

export type SignalAssertionOptions = {
  debug?: boolean;
  /** Public invitation id to bind to this verified assertion ceremony. */
  requestId?: string;
};

export type LegacyLinkMessage = {
  credId?: string;
  requestId: string;
  wallet: string;
  version?: never;
  pairingId?: string;
};

export type PairingLinkMessage = {
  version: 2;
  pairingId: string;
  credId?: string;
  requestId: string;
  wallet: string;
};

export type LinkMessage = LegacyLinkMessage | PairingLinkMessage;

type PendingLink = {
  requestId: string;
  resolve: (data: LinkMessage) => void;
  reject: (error: Error) => void;
  settled: boolean;
  owner?: symbol;
  timeout?: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort?: () => void;
  onException?: (error: LinkException) => void;
};

type LinkException = {
  status?: string;
  message?: string;
  error?: string;
  code?: string;
  cause?: {
    pattern?: string;
    data?: unknown;
  };
};

type PeerOperation = {
  readonly id: symbol;
  readonly error?: Error;
  readonly closePeerOnFailure: boolean;
  fail(error: Error, closePeer?: boolean): void;
  finish(): void;
  throwIfFailed(): void;
  wait<T>(promise: PromiseLike<T>): Promise<T>;
};

function signalErrorFromAbort(): SignalError {
  return new SignalError("SIGNAL_ABORTED", "Signaling operation was aborted");
}

function signalErrorFromLinkFailure(
  failure: LinkException | undefined,
  fallbackMessage: string,
): SignalError {
  const detail =
    [failure?.message, failure?.error].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    ) ?? fallbackMessage;
  const code = failure?.code;
  if (code === "PAIRING_REVOKED" || code === "PAIRING_UNAUTHORIZED") {
    return new SignalError(code, detail, { cause: failure });
  }
  return new SignalError("SIGNAL_SERVER_ERROR", detail, { cause: failure });
}

function isLinkMessageForRequest(value: unknown, requestId: string): value is LinkMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (
    data.requestId !== requestId ||
    typeof data.wallet !== "string" ||
    data.wallet.length === 0 ||
    (data.credId !== undefined && typeof data.credId !== "string")
  ) {
    return false;
  }
  if (data.version === undefined) {
    return data.pairingId === undefined || typeof data.pairingId === "string";
  }
  return data.version === 2 && data.pairingId === requestId;
}

export async function generateQRCode(
  { requestId, url }: { requestId?: string; url: string },
  qrCodeOptions: QRCodeOptions = DEFAULT_QR_CODE_OPTIONS,
): Promise<string> {
  if (typeof requestId === "undefined") throw new Error(REQUEST_IS_MISSING_MESSAGE);
  qrCodeOptions.data = generateDeepLink(url, requestId);

  const { default: QRCodeStyling } = await import("qr-code-styling");
  const qrCode = new QRCodeStyling(qrCodeOptions as import("qr-code-styling").Options);
  return await qrCode.getRawData("png").then((blob) => {
    if (!blob) throw new TypeError("Could not get qrcode blob");
    return URL.createObjectURL(blob as Blob);
  });
}

/**
 * Generate a Deep Link URI
 * @param {string} origin
 * @param requestId
 */
export function generateDeepLink(origin: string, requestId: string) {
  if (typeof origin !== "string") {
    throw new Error(ORIGIN_IS_MISSING_MESSAGE);
  }
  if (typeof requestId !== "string") {
    throw new Error(REQUEST_IS_MISSING_MESSAGE);
  }
  return `liquid://${origin.replace("https://", "")}/?requestId=${requestId}`;
}
/**
 *
 */
export class SignalClient extends EventEmitter {
  url: string;
  type: "offer" | "answer" | null = null;
  authenticated: boolean = false;
  requestId: string | undefined;
  peerClient: RTCPeerConnection | undefined;
  qrCodeOptions: QRCodeOptions = DEFAULT_QR_CODE_OPTIONS;
  socket!: LiquidSocket;
  private _socketPromise?: Promise<void>;
  private _pendingLink?: PendingLink;
  private _peerSocketCleanup?: () => void;
  private readonly _operationFailureHandlers = new Set<(error: Error) => void>();
  private _activePeerOperation?: PeerOperation;
  private _activeStandaloneSignal = false;
  private readonly _managedSocketListeners = new Map<string, Set<(...args: any[]) => void>>();
  private readonly _socketDispatchers = new Map<string, (...args: any[]) => void>();
  private readonly _pendingPeerWork = new WeakMap<RTCPeerConnection, Set<Promise<unknown>>>();
  private _pairingAuthError?: SignalError;
  private _closed = false;
  private readonly _onSocketConnect = () => {
    // Revocation is terminal for a role credential. A later transport-level
    // connect event must not make this client usable again with that secret.
    if (this._pairingAuthError?.code !== "PAIRING_REVOKED") {
      this._pairingAuthError = undefined;
    }
    if (this._pendingLink && !this._pendingLink.settled) this._emitPendingLink();
    this.emit("connect", this.socket.id);
  };
  private readonly _onSocketDisconnect = (reason?: unknown) => {
    const reconnectablePeerLink = Boolean(
      this._activePeerOperation &&
      this._pendingLink?.owner === this._activePeerOperation.id &&
      !this._pendingLink.settled &&
      this._isReconnectableDisconnect(reason),
    );
    if (this._pendingLink && !this._isReconnectableDisconnect(reason)) {
      this._rejectPendingLink(
        new SignalError(
          "SIGNAL_DISCONNECTED",
          "Signaling socket disconnected and will not reconnect",
        ),
      );
    }
    if (!reconnectablePeerLink) {
      const disconnectError = new SignalError(
        "SIGNAL_DISCONNECTED",
        "Signaling socket disconnected during an active operation",
      );
      for (const failOperation of this._operationFailureHandlers) {
        failOperation(disconnectError);
      }
    }
    if (reason === undefined) this.emit("disconnect", this.socket.id);
    else this.emit("disconnect", this.socket.id, reason);
  };
  private readonly _onSocketConnectError = (error: Error & { data?: { code?: string } }) => {
    const code = error?.data?.code;
    if (code === "PAIRING_REVOKED" || code === "PAIRING_UNAUTHORIZED") {
      const pairingError = new SignalError(
        code,
        error.message ||
          (code === "PAIRING_REVOKED"
            ? "Pairing has been revoked"
            : "Pairing credential was not accepted"),
        { cause: error },
      );
      this._failPairingAuthorization(pairingError, code === "PAIRING_REVOKED");
    }
    this.emit("connect_error", error);
  };
  private readonly _onPairingRevoked = (
    message?: string | { error?: string; message?: string },
  ) => {
    const detail =
      typeof message === "string"
        ? message
        : (message?.error ?? message?.message ?? "Pairing has been revoked");
    const pairingError = new SignalError("PAIRING_REVOKED", detail);
    this._failPairingAuthorization(pairingError, true);
    this.emit("pairing:revoked", pairingError);
  };

  private _trackPeerWork<T>(peer: RTCPeerConnection, work: PromiseLike<T>): Promise<T> {
    const tracked = Promise.resolve(work);
    let pending = this._pendingPeerWork.get(peer);
    if (!pending) {
      pending = new Set();
      this._pendingPeerWork.set(peer, pending);
    }
    pending.add(tracked);
    const remove = () => {
      pending?.delete(tracked);
      if (pending?.size === 0) this._pendingPeerWork.delete(peer);
    };
    void tracked.then(remove, remove);
    return tracked;
  }

  private async _waitForPeerWork(peer: RTCPeerConnection, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const pending = [...(this._pendingPeerWork.get(peer) ?? [])];
      if (pending.length === 0) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.allSettled(pending),
        new Promise<void>((resolve) => {
          timeout = setTimeout(resolve, remaining);
        }),
      ]);
      if (timeout) clearTimeout(timeout);
    }
  }

  /**
   *
   * @param url
   * @param options
   */
  constructor(
    url: string,
    options: Partial<ManagerOptions & SocketOptions & { socket: LiquidSocket }> = {},
  ) {
    super();
    this.url = url;
    const socketOptions = {
      autoConnect: true,
      withCredentials: true,
      ...options,
    } as Partial<ManagerOptions & SocketOptions & { socket: LiquidSocket }>;
    if (options && "socket" in options && options.socket) {
      this.socket = options.socket;
      // An injected socket may already have completed its handshake. Only trust
      // credentials actually installed on that socket; `options.auth` is not
      // automatically applied to adapters supplied by the caller.
      this.authenticated = isPairingCredential(this.socket.auth);
      this._setupSocket();
      this._socketPromise = Promise.resolve();
    } else {
      if (isPairingCredential(socketOptions.auth)) this.authenticated = true;
      this._socketPromise = this._initSocket(url, socketOptions);
    }
  }

  private _setupSocket() {
    this._addSocketListener("connect", this._onSocketConnect);
    this._addSocketListener("disconnect", this._onSocketDisconnect);
    this._addSocketListener("connect_error", this._onSocketConnectError);
    this._addSocketListener("pairing:revoked", this._onPairingRevoked);
  }

  private async _initSocket(
    url: string,
    options: Partial<ManagerOptions & SocketOptions & { socket: LiquidSocket }>,
  ) {
    const { io } = await import("socket.io-client");
    this.socket = io(url, options);
    this._setupSocket();
  }

  static generateRequestId(): string {
    return uuidv7();
  }

  /**
   * Handles the process of attestation by invoking the provided challenge handler and the specified options.
   *
   * @param {function(Uint8Array): Promise<LiquidExtensionOptions>} onChallenge - A callback function to handle the challenge. Receives a Uint8Array representing the challenge.
   * @param {object} [options=DEFAULT_ATTESTATION_OPTIONS] - Configuration options for the attestation process.
   * @param debug
   * @return {Promise<User>} A promise that resolves when attestation is successfully completed or rejects with an error if it fails.
   */
  async attestation(
    onChallenge: (challenge: Uint8Array) => Promise<LiquidExtensionOptions>,
    options: object = DEFAULT_ATTESTATION_OPTIONS,
    debug = false,
  ): Promise<User> {
    try {
      const response = await attestation({
        origin: this.url,
        onChallenge,
        options,
        debug,
      });
      this.authenticated = true;
      return response;
    } catch (e) {
      this.authenticated = false;
      throw e;
    }
  }
  async assertion(
    credId: string,
    debugOrOptions: boolean | SignalAssertionOptions = false,
  ): Promise<User | null> {
    try {
      const debug =
        typeof debugOrOptions === "boolean" ? debugOrOptions : (debugOrOptions?.debug ?? false);
      const requestId =
        typeof debugOrOptions === "object" && debugOrOptions ? debugOrOptions.requestId : undefined;
      const response = await assertion({
        origin: this.url,
        credId,
        debug,
        ...(requestId === undefined ? {} : { requestOptions: { requestId } }),
      });
      this.authenticated = true;
      return response;
    } catch (e) {
      this.authenticated = false;
      throw e;
    }
  }
  /**
   * Create QR Code
   */
  async qrCode(): Promise<string> {
    if (typeof this.requestId === "undefined") throw new Error(REQUEST_IS_MISSING_MESSAGE);
    return generateQRCode({ requestId: this.requestId, url: this.url }, this.qrCodeOptions);
  }

  /**
   * Create a Deep Link URI
   * @param requestId
   */
  deepLink(requestId?: string): string {
    if (typeof requestId !== "string" && typeof this.requestId === "undefined") {
      throw new Error(REQUEST_IS_MISSING_MESSAGE);
    }
    return generateDeepLink(this.url, requestId || this.requestId || "");
  }
  /**
   * # Create a peer connection
   *
   * Send the nonce to the server and listen to a specified type.
   *
   * ## Offer
   *   - Will wait for an offer-description from the server
   *   - Will send an answer-description to the server
   *   - Will send candidates to the server
   *
   * ## Answer
   *  - Will send an offer-description to the server
   *  - Will wait for an answer-description from the server
   *  - Will send candidates to the server
   *
   * @param requestId
   * @param type
   * @param config
   */
  async peer(
    requestId: string | undefined,
    type: "offer" | "answer",
    config: RTCConfiguration = {
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
      ],
      iceCandidatePoolSize: 10,
    },
    options: PeerOptions = {},
  ): Promise<RTCDataChannel> {
    await this._socketPromise;
    if (this._closed) throw new SignalError("SIGNAL_CLOSED", "Signal client is closed");
    if (this._pairingAuthError) throw this._pairingAuthError;
    if (typeof requestId === "undefined" && typeof this.requestId === "undefined")
      throw new Error(REQUEST_IS_MISSING_MESSAGE);
    if (this._activePeerOperation || this._activeStandaloneSignal) {
      throw new Error(REQUEST_IN_PROCESS_MESSAGE);
    }
    if (typeof this.requestId !== "undefined") throw new Error(REQUEST_IN_PROCESS_MESSAGE);
    if (options.signal?.aborted) throw signalErrorFromAbort();
    if (type === "answer" && !this.authenticated) throw new Error(UNAUTHENTICATED_MESSAGE);

    const operation = this._createPeerOperation(options);
    this._activePeerOperation = operation;
    const effectiveRequestId = requestId ?? this.requestId;

    this._peerSocketCleanup?.();
    this._peerSocketCleanup = undefined;
    try {
      this.peerClient?.close();
    } catch {
      // best-effort cleanup of a superseded peer
    }
    this.peerClient = undefined;

    let peerClient: RTCPeerConnection;
    try {
      peerClient = new RTCPeerConnection(config);
    } catch (error) {
      operation.finish();
      if (this._activePeerOperation === operation) this._activePeerOperation = undefined;
      throw error;
    }
    this.peerClient = peerClient;
    this.type = type === "offer" ? "answer" : "offer";

    let peerSignalingEnabled = true;
    let descriptionWaiter:
      | { promise: Promise<RTCSessionDescriptionInit>; cancel: () => void }
      | undefined;
    let dataChannelWaiter: { promise: Promise<RTCDataChannel>; cancel: () => void } | undefined;

    let candidatesBuffer: RTCIceCandidateInit[] = [];
    const remoteCandidateEvent = `${type}-candidate`;
    const onRemoteCandidate = async (candidate: RTCIceCandidateInit) => {
      if (!peerSignalingEnabled || operation.error || this.peerClient !== peerClient) {
        return;
      }
      try {
        if (peerClient.remoteDescription) {
          await this._trackPeerWork(
            peerClient,
            peerClient.addIceCandidate(new RTCIceCandidate(candidate)),
          );
          if (!peerSignalingEnabled || operation.error || this.peerClient !== peerClient) {
            return;
          }
          this.emit(remoteCandidateEvent, candidate);
        } else {
          candidatesBuffer.push(candidate);
        }
      } catch (error) {
        if (!peerSignalingEnabled || operation.error || this.peerClient !== peerClient) {
          return;
        }
        this.emit(
          "error",
          error instanceof Error
            ? error
            : new Error(`Failed to add ICE candidate: ${String(error)}`),
        );
      }
    };
    let onLocalCandidate: RTCPeerConnection["onicecandidate"] | undefined;
    const cleanupPeerSocketListeners = () => {
      peerSignalingEnabled = false;
      this._removeSocketListener(remoteCandidateEvent, onRemoteCandidate);
      dataChannelWaiter?.cancel();
      if (onLocalCandidate && peerClient.onicecandidate === onLocalCandidate) {
        peerClient.onicecandidate = null;
      }
    };
    try {
      this._addSocketListener(remoteCandidateEvent, onRemoteCandidate);
    } catch (error) {
      operation.finish();
      try {
        peerClient.close();
      } catch {
        // best effort
      }
      if (this.peerClient === peerClient) this.peerClient = undefined;
      if (this._activePeerOperation === operation) this._activePeerOperation = undefined;
      throw error;
    }
    this._peerSocketCleanup = cleanupPeerSocketListeners;

    const localCandidateEvent = `${this.type}-candidate`;
    onLocalCandidate = (event) => {
      if (
        !event.candidate ||
        !peerSignalingEnabled ||
        operation.error ||
        this._closed ||
        this.peerClient !== peerClient
      ) {
        return;
      }
      const candidate = event.candidate.toJSON();
      this.socket.emit(localCandidateEvent, candidate);
      if (
        !peerSignalingEnabled ||
        operation.error ||
        this._closed ||
        this.peerClient !== peerClient
      ) {
        return;
      }
      this.emit(localCandidateEvent, candidate);
    };
    peerClient.onicecandidate = onLocalCandidate;

    const flushCandidates = async () => {
      const buffered = candidatesBuffer;
      candidatesBuffer = [];
      await operation.wait(
        Promise.all(
          buffered.map(async (candidate) => {
            await this._trackPeerWork(
              peerClient,
              peerClient.addIceCandidate(new RTCIceCandidate(candidate)),
            );
            operation.throwIfFailed();
            if (!peerSignalingEnabled || this.peerClient !== peerClient) return;
            this.emit(remoteCandidateEvent, candidate);
          }),
        ),
      );
    };

    try {
      for (const track of options.tracks ?? []) {
        operation.throwIfFailed();
        peerClient.addTrack(track);
      }

      // Register before linking or sending the local offer. Socket.IO delivery
      // is at-most-once, so a fast peer's SDP must already have a listener.
      descriptionWaiter = this._preparePeerDescription(type, operation);

      if (type === "offer") {
        dataChannelWaiter = this._preparePeerDataChannel(peerClient, operation);
        await operation.wait(
          this._link(effectiveRequestId as string, { timeoutMs: 0 }, operation.id),
        );
        operation.throwIfFailed();
        this.emit("signal", { type });
        const sdp = await operation.wait(descriptionWaiter.promise);
        await operation.wait(this._trackPeerWork(peerClient, peerClient.setRemoteDescription(sdp)));
        const answer = await operation.wait(
          this._trackPeerWork(peerClient, peerClient.createAnswer()),
        );
        await operation.wait(
          this._trackPeerWork(peerClient, peerClient.setLocalDescription(answer)),
        );
        await flushCandidates();
        operation.throwIfFailed();
        this.socket.emit(`${this.type}-description`, answer.sdp);
        operation.throwIfFailed();
        this.emit(`${this.type}-description`, answer.sdp);
        operation.throwIfFailed();
        return await operation.wait(dataChannelWaiter.promise);
      }

      const dataChannelsConfig = options.dataChannels || { liquid: {} };
      const channels: Record<string, RTCDataChannel> = {};
      for (const [label, init] of Object.entries(dataChannelsConfig)) {
        operation.throwIfFailed();
        channels[label] = peerClient.createDataChannel(label, init);
      }

      const localSdp = await operation.wait(
        this._trackPeerWork(peerClient, peerClient.createOffer()),
      );
      await operation.wait(
        this._trackPeerWork(peerClient, peerClient.setLocalDescription(localSdp)),
      );
      operation.throwIfFailed();
      this.socket.emit(`${this.type}-description`, localSdp.sdp);
      operation.throwIfFailed();
      this.emit(`${this.type}-description`, localSdp.sdp);
      operation.throwIfFailed();
      this.emit("signal", { type });
      operation.throwIfFailed();
      const sdp = await operation.wait(descriptionWaiter.promise);
      await operation.wait(this._trackPeerWork(peerClient, peerClient.setRemoteDescription(sdp)));
      await flushCandidates();
      operation.throwIfFailed();
      for (const configuredChannel of Object.values(channels)) {
        operation.throwIfFailed();
        this.emit("data-channel", configuredChannel);
        operation.throwIfFailed();
      }
      const channel = channels["liquid"] || channels["ac2-v1"] || Object.values(channels)[0];
      if (!channel) throw new Error("At least one data channel is required");
      operation.throwIfFailed();
      return channel;
    } catch (error) {
      const operationError = error instanceof Error ? error : new Error(String(error));
      this._rejectPendingLink(operationError, operation.id);
      descriptionWaiter?.cancel();
      dataChannelWaiter?.cancel();
      cleanupPeerSocketListeners();
      if (this._peerSocketCleanup === cleanupPeerSocketListeners) {
        this._peerSocketCleanup = undefined;
      }
      if (operation.closePeerOnFailure && this.peerClient === peerClient) {
        try {
          peerClient.close();
        } catch {
          // best effort
        }
        this.peerClient = undefined;
      }
      throw operationError;
    } finally {
      operation.finish();
      if (this._activePeerOperation === operation) this._activePeerOperation = undefined;
    }
  }

  /**
   * Await for a link message for a given requestId
   * @param requestId
   */
  async link(requestId: string, options: SignalOperationOptions = {}): Promise<LinkMessage> {
    return this._link(requestId, options);
  }

  private async _link(
    requestId: string,
    options: SignalOperationOptions = {},
    owner?: symbol,
  ): Promise<LinkMessage> {
    await this._socketPromise;
    if (this._closed) throw new SignalError("SIGNAL_CLOSED", "Signal client is closed");
    if (this._pairingAuthError) throw this._pairingAuthError;
    if (!owner && this._activePeerOperation) {
      throw new Error(REQUEST_IN_PROCESS_MESSAGE);
    }
    if (typeof this.requestId !== "undefined") throw new Error(REQUEST_IN_PROCESS_MESSAGE);
    if (options.signal?.aborted) throw signalErrorFromAbort();
    this.requestId = requestId;

    const result = new Promise<LinkMessage>((resolve, reject) => {
      const pending: PendingLink = {
        requestId,
        resolve,
        reject,
        settled: false,
        ...(owner ? { owner } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      };
      this._pendingLink = pending;
      try {
        const timeoutMs = options.timeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS;
        if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
          pending.timeout = setTimeout(() => {
            this._rejectPendingLink(
              new SignalError(
                "SIGNAL_TIMEOUT",
                `Timed out waiting for pairing approval after ${timeoutMs}ms`,
              ),
            );
          }, timeoutMs);
        }
        if (options.signal) {
          pending.onAbort = () => this._rejectPendingLink(signalErrorFromAbort());
          options.signal.addEventListener("abort", pending.onAbort, { once: true });
        }
        pending.onException = (exception) => {
          if (this._pendingLink !== pending || pending.settled) return;
          const pattern = exception.cause?.pattern;
          if (pattern && pattern !== "link") return;
          const causeData = exception.cause?.data;
          if (
            causeData &&
            typeof causeData === "object" &&
            "requestId" in causeData &&
            (causeData as { requestId?: unknown }).requestId !== pending.requestId
          ) {
            return;
          }
          const linkError = signalErrorFromLinkFailure(exception, "Link request failed");
          if (linkError.code === "PAIRING_REVOKED") {
            this._failPairingAuthorization(linkError, true);
          } else this._rejectPendingLink(linkError);
        };
        this._addSocketListener("exception", pending.onException);
      } catch (error) {
        pending.settled = true;
        this._cleanupPendingLink(pending);
        delete this.requestId;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    try {
      this.emit("link", { requestId });
      this._emitPendingLink();
    } catch (error) {
      this._rejectPendingLink(error instanceof Error ? error : new Error(String(error)), owner);
    }
    return result;
  }

  private _emitPendingLink(): void {
    const pending = this._pendingLink;
    if (!pending || pending.settled || this._closed) return;
    const ownerError = this._pendingLinkOwnerError(pending);
    if (ownerError) {
      this._rejectPendingLink(ownerError, pending.owner);
      return;
    }
    // Socket.IO buffers emits while disconnected. Waiting for the connect event
    // avoids sending both the buffered copy and our explicit reconnect replay.
    if (this.socket.connected === false) return;
    try {
      this.socket.emit(
        "link",
        { requestId: pending.requestId },
        (response: { data?: unknown; error?: string; code?: string }) => {
          if (this._pendingLink !== pending || pending.settled) return;
          const ownerError = this._pendingLinkOwnerError(pending);
          if (ownerError) {
            this._rejectPendingLink(ownerError, pending.owner);
            return;
          }
          if (response?.error) {
            const linkError = signalErrorFromLinkFailure(response, "Link request failed");
            if (linkError.code === "PAIRING_REVOKED") {
              this._failPairingAuthorization(linkError, true);
            } else this._rejectPendingLink(linkError);
            return;
          }
          const data = response?.data;
          if (!isLinkMessageForRequest(data, pending.requestId)) {
            this._rejectPendingLink(
              new SignalError("SIGNAL_PROTOCOL_ERROR", "Invalid pairing response"),
            );
            return;
          }
          pending.settled = true;
          this._cleanupPendingLink(pending);
          this.authenticated = true;
          delete this.requestId;
          pending.resolve(data);
          this.emit("link-message", data);
        },
      );
    } catch (error) {
      this._rejectPendingLink(
        error instanceof Error ? error : new Error(String(error)),
        pending.owner,
      );
    }
  }

  private _cleanupPendingLink(pending: PendingLink): void {
    if (pending.timeout) clearTimeout(pending.timeout);
    if (pending.signal && pending.onAbort) {
      pending.signal.removeEventListener("abort", pending.onAbort);
    }
    if (pending.onException) {
      this._removeSocketListener("exception", pending.onException);
    }
    if (this._pendingLink === pending) this._pendingLink = undefined;
  }

  private _pendingLinkOwnerError(pending: PendingLink): Error | undefined {
    if (!pending.owner) return undefined;
    if (this._activePeerOperation?.id === pending.owner) {
      return this._activePeerOperation.error;
    }
    return new SignalError("SIGNAL_CLOSED", "Owning peer operation is no longer active");
  }

  private _rejectPendingLink(error: Error, owner?: symbol): void {
    const pending = this._pendingLink;
    if (!pending || pending.settled || (owner && pending.owner !== owner)) return;
    pending.settled = true;
    this._cleanupPendingLink(pending);
    delete this.requestId;
    pending.reject(error);
  }

  private _createPeerOperation(options: SignalOperationOptions): PeerOperation {
    const id = Symbol("peer-operation");
    let operationError: Error | undefined;
    let closePeerOnFailure = true;
    let finished = false;
    let resolveFailure!: (error: Error) => void;
    const failure = new Promise<Error>((resolve) => {
      resolveFailure = resolve;
    });
    const cleanups = new Set<() => void>();

    const cleanup = () => {
      for (const dispose of cleanups) {
        cleanups.delete(dispose);
        try {
          dispose();
        } catch {
          // Cleanup must never replace the operation's first failure.
        }
      }
    };

    const fail = (error: Error, closePeer = true) => {
      if (finished) return;
      if (!closePeer) closePeerOnFailure = false;
      if (operationError) return;
      operationError = error;
      cleanup();
      resolveFailure(error);
    };

    const onAbort = () => fail(signalErrorFromAbort());
    options.signal?.addEventListener("abort", onAbort, { once: true });
    cleanups.add(() => options.signal?.removeEventListener("abort", onAbort));

    const timeoutMs = options.timeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS;
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      const timeout = setTimeout(
        () =>
          fail(
            new SignalError(
              "SIGNAL_TIMEOUT",
              `Timed out during peer negotiation after ${timeoutMs}ms`,
            ),
          ),
        timeoutMs,
      );
      cleanups.add(() => clearTimeout(timeout));
    }

    const onOperationFailure = (error: Error) => fail(error);
    this._operationFailureHandlers.add(onOperationFailure);
    cleanups.add(() => this._operationFailureHandlers.delete(onOperationFailure));

    const operation: PeerOperation = {
      id,
      get error() {
        return operationError;
      },
      get closePeerOnFailure() {
        return closePeerOnFailure;
      },
      fail,
      finish: () => {
        if (finished) return;
        finished = true;
        cleanup();
      },
      throwIfFailed: () => {
        if (operationError) throw operationError;
      },
      wait: async <T>(promise: PromiseLike<T>): Promise<T> => {
        if (operationError) throw operationError;
        const outcome = await Promise.race([
          Promise.resolve(promise).then((value) => ({ value }) as const),
          failure.then((error) => ({ error }) as const),
        ]);
        if ("error" in outcome) throw outcome.error;
        if (operationError) throw operationError;
        return outcome.value;
      },
    };
    return operation;
  }

  /**
   *
   * @param type
   */
  async signal(
    type: "offer" | "answer",
    options: SignalOperationOptions = {},
  ): Promise<RTCSessionDescriptionInit> {
    await this._socketPromise;
    if (this._closed) throw new SignalError("SIGNAL_CLOSED", "Signal client is closed");
    if (this._pairingAuthError) throw this._pairingAuthError;
    if (!this.authenticated) throw new Error(UNAUTHENTICATED_MESSAGE);
    if (this._activePeerOperation || this._activeStandaloneSignal) {
      throw new Error(REQUEST_IN_PROCESS_MESSAGE);
    }
    this._activeStandaloneSignal = true;
    try {
      return await this._prepareSignal(type, options, false, true).promise;
    } finally {
      this._activeStandaloneSignal = false;
    }
  }

  /**
   * Stop signaling and optionally disconnect the Socket.IO transport.
   *
   * Established peer connections are preserved by default for backward
   * compatibility. Pass `true` as the second argument to close the peer too.
   * An in-progress negotiation is always cancelled and detached from signaling.
   * Its native peer is only closed when `closePeer` is true.
   */
  close(disconnect = false, closePeer = false): void {
    const cleanup = () => {
      if (this.socket) {
        this._peerSocketCleanup?.();
        this._peerSocketCleanup = undefined;
        this._removeAllManagedSocketListeners();
        if (disconnect) this.socket.disconnect();
      }
    };
    this._closed = true;
    this._rejectPendingLink(new SignalError("SIGNAL_CLOSED", "Signal client is closed"));
    const closeError = new SignalError("SIGNAL_CLOSED", "Signal client is closed");
    this._activePeerOperation?.fail(closeError, closePeer);
    for (const failOperation of this._operationFailureHandlers) failOperation(closeError);
    this._operationFailureHandlers.clear();
    if (closePeer) {
      this._closePeer();
    }
    if (this.socket) {
      cleanup();
    } else if (this._socketPromise) {
      this._socketPromise.then(cleanup).catch(() => {});
    }
    delete this.requestId;
    this.authenticated = false;
    this.emit("close");
  }

  /**
   * Close the current native peer after in-flight WebRTC bridge work settles.
   *
   * React Native may still be applying an SDP description after a signaling
   * operation has been cancelled. Closing its RTCPeerConnection immediately
   * can race that native call. This method waits for tracked peer promises and
   * uses `timeoutMs` only as a bounded final fallback, then closes the exact
   * peer that was current when the method was called.
   */
  async closePeerWhenSafe(timeoutMs = 10_000): Promise<void> {
    const peer = this.peerClient;
    if (!peer) return;
    const waitMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10_000;
    await this._waitForPeerWork(peer, waitMs);
    try {
      peer.close();
    } catch {
      // The peer may already have closed while deferred cleanup was waiting.
    }
    if (this.peerClient === peer) this.peerClient = undefined;
  }

  private _failPairingAuthorization(error: SignalError, closePeer: boolean): void {
    this._pairingAuthError = error;
    this.authenticated = false;
    this._rejectPendingLink(error);
    for (const failOperation of this._operationFailureHandlers) failOperation(error);
    if (closePeer) this._closePeer();
  }

  private _closePeer(): void {
    this._peerSocketCleanup?.();
    this._peerSocketCleanup = undefined;
    try {
      this.peerClient?.close();
    } catch {
      // best effort
    }
    this.peerClient = undefined;
  }

  private _addSocketListener(event: string, listener: (...args: any[]) => void): void {
    let listeners = this._managedSocketListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this._managedSocketListeners.set(event, listeners);
    }
    if (listeners.has(listener)) return;
    listeners.add(listener);

    try {
      if (
        typeof this.socket.off === "function" ||
        typeof this.socket.removeListener === "function"
      ) {
        this.socket.on(event, listener);
        return;
      }

      if (this._socketDispatchers.has(event)) return;
      const dispatcher = (...args: any[]) => {
        const listenersSnapshot = Array.from(this._managedSocketListeners.get(event) ?? []);
        for (const managedListener of listenersSnapshot) {
          managedListener(...args);
        }
      };
      this._socketDispatchers.set(event, dispatcher);
      try {
        this.socket.on(event, dispatcher);
      } catch (error) {
        this._socketDispatchers.delete(event);
        throw error;
      }
    } catch (error) {
      listeners.delete(listener);
      if (listeners.size === 0) this._managedSocketListeners.delete(event);
      throw error;
    }
  }

  private _isReconnectableDisconnect(reason?: unknown): boolean {
    if (reason === "io server disconnect" || reason === "io client disconnect") return false;
    if (this.socket.active === true) return true;
    if (this.socket.active === false) return false;
    return true;
  }

  private _removeSocketListener(event: string, listener: (...args: any[]) => void): void {
    const listeners = this._managedSocketListeners.get(event);
    if (!listeners?.delete(listener)) return;
    if (typeof this.socket.off === "function") {
      this.socket.off(event, listener);
    } else if (typeof this.socket.removeListener === "function") {
      this.socket.removeListener(event, listener);
    }
    if (listeners.size === 0) this._managedSocketListeners.delete(event);
  }

  private _removeAllManagedSocketListeners(): void {
    if (typeof this.socket.off === "function") {
      for (const [event, listeners] of this._managedSocketListeners) {
        for (const listener of listeners) this.socket.off(event, listener);
      }
    } else if (typeof this.socket.removeListener === "function") {
      for (const [event, listeners] of this._managedSocketListeners) {
        for (const listener of listeners) this.socket.removeListener(event, listener);
      }
    } else {
      // Legacy LiquidSocket adapters only exposed event-wide removal. This is
      // intentionally limited to events for which we installed a dispatcher.
      for (const event of this._socketDispatchers.keys()) this.socket.removeAllListeners(event);
    }
    this._managedSocketListeners.clear();
    this._socketDispatchers.clear();
  }

  private _prepareSignal(
    type: "offer" | "answer",
    options: SignalOperationOptions,
    allowDisconnectWhileLinking: boolean,
    announce: boolean,
  ): { promise: Promise<RTCSessionDescriptionInit>; cancel: () => void } {
    const event = `${type}-description`;
    let cleanup = () => {};
    let settled = false;
    const promise = new Promise<RTCSessionDescriptionInit>((resolve, reject) => {
      if (options.signal?.aborted) {
        settled = true;
        reject(signalErrorFromAbort());
        return;
      }
      const timeoutMs = options.timeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        action();
      };
      const onDescription = (sdp: string) => {
        const description = { type, sdp } as RTCSessionDescriptionInit;
        finish(() => {
          resolve(description);
          this.emit(event, description);
        });
      };
      const onDisconnect = () => {
        if (allowDisconnectWhileLinking && this._pendingLink) return;
        finish(() =>
          reject(
            new SignalError(
              "SIGNAL_DISCONNECTED",
              `Signaling socket disconnected while waiting for ${event}`,
            ),
          ),
        );
      };
      const onAbort = () => finish(() => reject(signalErrorFromAbort()));
      const onOperationFailure = (error: Error) => finish(() => reject(error));
      cleanup = () => {
        if (timeout) clearTimeout(timeout);
        this._removeSocketListener(event, onDescription);
        this._removeSocketListener("disconnect", onDisconnect);
        options.signal?.removeEventListener("abort", onAbort);
        this._operationFailureHandlers.delete(onOperationFailure);
      };
      try {
        this._addSocketListener(event, onDescription);
        this._addSocketListener("disconnect", onDisconnect);
        options.signal?.addEventListener("abort", onAbort, { once: true });
        this._operationFailureHandlers.add(onOperationFailure);
        if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
          timeout = setTimeout(
            () =>
              finish(() =>
                reject(
                  new SignalError(
                    "SIGNAL_TIMEOUT",
                    `Timed out waiting for ${event} after ${timeoutMs}ms`,
                  ),
                ),
              ),
            timeoutMs,
          );
        }
        if (announce) this.emit("signal", { type });
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    });
    return {
      promise,
      cancel: () => {
        if (settled) return;
        settled = true;
        cleanup();
      },
    };
  }

  private _preparePeerDescription(
    type: "offer" | "answer",
    operation: PeerOperation,
  ): {
    promise: Promise<RTCSessionDescriptionInit>;
    cancel: () => void;
  } {
    const event = `${type}-description`;
    let settled = false;
    let onDescription = (_sdp: string) => {};
    const cleanup = () => this._removeSocketListener(event, onDescription);
    const promise = new Promise<RTCSessionDescriptionInit>((resolve) => {
      onDescription = (sdp: string) => {
        if (settled || operation.error) return;
        settled = true;
        cleanup();
        const description = { type, sdp } as RTCSessionDescriptionInit;
        resolve(description);
        this.emit(event, description);
      };
      this._addSocketListener(event, onDescription);
    });
    return {
      promise,
      cancel: () => {
        if (settled) return;
        settled = true;
        cleanup();
      },
    };
  }

  private _preparePeerDataChannel(
    peerClient: RTCPeerConnection,
    operation: PeerOperation,
  ): {
    promise: Promise<RTCDataChannel>;
    cancel: () => void;
  } {
    let resolved = false;
    let canceled = false;
    let onDataChannel = (_event: RTCDataChannelEvent) => {};
    const promise = new Promise<RTCDataChannel>((resolve) => {
      onDataChannel = (event: RTCDataChannelEvent) => {
        if (canceled || operation.error) return;
        if (!resolved) {
          resolved = true;
          resolve(event.channel);
        }
        this.emit("data-channel", event.channel);
      };
      peerClient.ondatachannel = onDataChannel;
    });
    return {
      promise,
      cancel: () => {
        canceled = true;
        if (peerClient.ondatachannel === onDataChannel) peerClient.ondatachannel = null;
      },
    };
  }
}

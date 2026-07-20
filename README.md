# @algorandfoundation/liquid-client

[![CI](https://github.com/algorandfoundation/liquid-auth-js/actions/workflows/CI.yml/badge.svg)](https://github.com/algorandfoundation/liquid-auth-js/actions/workflows/CI.yml)[![Publish Package](https://github.com/algorandfoundation/liquid-auth-js/actions/workflows/package-release.yml/badge.svg)](https://github.com/algorandfoundation/liquid-auth-js/actions/workflows/package-release.yml)[![codecov](https://codecov.io/gh/algorandfoundation/liquid-auth-js/graph/badge.svg?token=AKN7VATWTO)](https://codecov.io/gh/algorandfoundation/liquid-auth-js)[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](code_of_conduct.md)

This project is an example Client for TypeScript for using the Liquid-Auth API.

# 🎉 Getting Started

## 📦 Install

```bash
npm install @algorandfoundation/liquid-client --save
```

# 📝 Usage

```typescript
import { SignalClient, encoding, attestation, assertion } from "@algorandfoundation/liquid-client";
const client = new SignalClient(window.origin);
```

See the [liquid-auth documentation](https://liquidauth.com/clients/browser/introduction/) for more information on the API.

## 🔐 Browser Wallet Integration

#### Create a new account and passkey

```typescript
const testAccount = algosdk.generateAccount();
// Sign in to the service with a new credential and wallet
await attestation.attestation({
  origin: window.origin,
  onChallenge: async (challenge: Uint8Array) => ({
    type: "algorand", // The type of signature and public key
    address: testAccount.addr, // The address of the account
    signature: encoding.toBase64URL(nacl.sign.detached(challenge, testAccount.sk)), // The signature of the challenge
    requestId: "019097ff-bb8d-7f68-9062-89543625aca5", // Optionally authenticate a remote peer
    device: "Demo Web Wallet", // Optional device name
  }),
});
```

#### Sign in with an existing account

```typescript
await assertion.assertion({
  origin: window.origin,
  credId: credentialId, // Some known credential ID
  requestOptions: {
    requestId: "019097ff-bb8d-7f68-9062-89543625aca5", // Optional durable pairing invitation
  },
});
```

#### Peering with a remote client

```typescript
// Create the Peer Connection and await the remote client's answer
client
  .peer("019097ff-bb8d-7f68-9062-89543625aca5", "answer")
  .then((dataChannel: RTCDataChannel) => {
    // Handle the data channel
    dataChannel.onmessage = (event: MessageEvent) => {
      console.log(event.data);
    };
  });
```

## 🌐 Dapp Integration

```typescript
const requestId = SignalClient.generateRequestId();
client.peer(requestId, "offer").then((dataChannel: RTCDataChannel) => {
  // Handle the data channel
  dataChannel.onmessage = (event: MessageEvent) => {
    console.log(event.data);
  };
});
const blob = await client.qrCode();
```

## Durable pairing and reconnect

Create an invitation before displaying its deep link. The public `pairingId`
goes in the link; the provider credential does not. Use HTTPS outside local
development, and treat both provider and controller credentials as bearer
secrets: keep them out of URLs, logs, analytics, and ordinary browser storage.

```typescript
import { createPairingInvitation, SignalClient } from "@algorandfoundation/liquid-client";

const providerPairing = await createPairingInvitation(origin);
// Persist the full object in the platform's secret store before showing the link.
const provider = new SignalClient(origin, { auth: providerPairing });
const deepLink = provider.deepLink(providerPairing.pairingId);
const channelPromise = provider.peer(providerPairing.pairingId, "offer");
showPairingLink(deepLink);
const channel = await channelPromise;
```

The invitation is usable until `providerPairing.expiresAt`. After the
controller approves it, the same provider credential authorizes future
signaling connections for that pairing.

An existing controller credential can approve the invitation without creating
a new passkey. Pass the public id from the deep link on the assertion challenge
request, then store the returned controller credential:

```typescript
const controller = new SignalClient(origin);
const user = await controller.assertion(credentialId, {
  requestId: pairingIdFromDeepLink,
});
persistSecret(user?.pairing);
```

After the controller completes its initial assertion or attestation, persist the
`pairing` object returned with the authenticated user in the controller's secret
store. Every later process launch can authorize signaling directly:

```typescript
const controller = new SignalClient(origin, { auth: storedControllerPairing });
const channel = await controller.peer(storedControllerPairing.pairingId, "answer", undefined, {
  signal: abortController.signal,
  timeoutMs: 30_000,
});
```

The provider and controller credentials are different and role-bound; neither
can be substituted for the other. Repeating a valid WebAuthn approval for an
already active pairing rotates the controller credential, so replace the
previously stored controller object with the newly returned one.

A physical WebRTC session is disposable. On a network or background suspension,
close it and start a fresh negotiation with the stored role-bound credential;
do not repeat WebAuthn. `getPairingStatus()` reports `pending`, `active`, or
`revoked` after authenticating the caller's role credential.

Call `revokePairing()` when the user explicitly removes the pairing. Revocation
of an active pairing applies to both roles, is permanent, and is safe to retry.
Either credential can still read its terminal `revoked` status, but neither can
signal or reactivate the pairing; create a new invitation to pair again.
Revoking a still-pending provider invitation records a terminal tombstone too.
Retries with the original provider credential are therefore idempotent even if
the first DELETE response is lost; the invitation cannot later be approved or
re-created with the same id.

Supplying a structurally valid pairing credential sets `authenticated` before
the asynchronous Socket.IO handshake completes. This means “credentials are
configured,” not that the server has accepted them yet. Treat a successful
connection or signaling operation as verification and handle `connect_error`
for rejected or revoked credentials.

After negotiation, `close()` stops this client's signaling work and listener
ownership while preserving the established WebRTC peer for backward
compatibility. Use `close(false, true)` when the client also owns and should
close the peer; pass `true` as the first argument only when it should disconnect
the shared Socket.IO transport too.

React Native callers cancelling a negotiation while an SDP bridge call may
still be in flight should call `close()` first, then await
`closePeerWhenSafe()`. It waits for tracked native WebRTC promises (with a
bounded 10-second fallback) before closing that peer, avoiding both an immediate
native close race and an abandoned RTCPeerConnection across repeated retries.

Signaling failures use `SignalError.code` for retry decisions. Only explicit
`PAIRING_UNAUTHORIZED` and `PAIRING_REVOKED` responses are terminal credential
failures; `SIGNAL_SERVER_ERROR`, transport disconnects, timeouts, and protocol
failures must not be interpreted as proof that a durable pairing was removed.

`peer()`, `link()`, and `signal()` apply a 120-second default operation timeout.
Pass `timeoutMs` (and, where appropriate, an `AbortSignal`) when a caller needs
a shorter or longer supervision window.

## 🏗️ Interfaces

```typescript
interface SignalClient {
  url: string; // Origin of the service
  type: "offer" | "answer" | null; // Type of client
  peerClient: RTCPeerConnection | undefined;
  socket: LiquidSocket; // Socket.IO or a compatible adapter

  authenticated: boolean; // State of authentication
  requestId?: string; // The current request being signaled

  attestation(
    onChallenge: (challenge: Uint8Array) => Promise<LiquidExtensionOptions>,
    options?: object,
    debug?: boolean,
  ): Promise<User>;
  assertion(
    credId: string,
    debugOrOptions?: boolean | SignalAssertionOptions,
  ): Promise<User | null>;

  /**
   * Top level Friendly interface for signaling
   * @param args
   */
  peer(
    requestId: string,
    type: "offer" | "answer",
    config?: RTCConfiguration,
    options?: PeerOptions,
  ): Promise<RTCDataChannel>;

  /**
   * Link a Request ID to this client
   * @param args
   */
  link(requestId: string, options?: SignalOperationOptions): Promise<LinkMessage>;

  /**
   * Wait for a desciption signal
   * @param args
   */
  signal(
    type: "offer" | "answer",
    options?: SignalOperationOptions,
  ): Promise<RTCSessionDescriptionInit>;

  /**
   * Terminate the signaling session
   */
  close(disconnect?: boolean, closePeer?: boolean): void;

  /** Defer native peer cleanup until tracked WebRTC bridge work settles. */
  closePeerWhenSafe(timeoutMs?: number): Promise<void>;

  /**
   * Listen to Interface events
   * @param args
   */
  on(event: string, listener: (...args: any[]) => void): this;

  /**
   * Emit an event to the interface
   * @param channel
   * @param callback
   */
  emit(event: string, ...args: any[]): boolean;
}
```

Generate public request IDs with the static `SignalClient.generateRequestId()` helper.

## ❤️ Community

[![stargazers](https://reporoster.com/stars/dark/algorandfoundation/liquid-auth-js)](https://github.com/algorandfoundation/liquid-auth-js/stargazers)
[![forks](https://reporoster.com/forks/dark/algorandfoundation/liquid-auth-js)](https://github.com/algorandfoundation/liquid-auth-js/network/members)

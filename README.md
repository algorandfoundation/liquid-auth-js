# @algorandfoundation/liquid-client

[![CI](https://github.com/algorandfoundation/liquid-auth-js/actions/workflows/CI.yml/badge.svg)](https://github.com/algorandfoundation/liquid-auth-js/actions/workflows/CI.yml)[![Publish Package](https://github.com/algorandfoundation/liquid-auth-js/actions/workflows/package-release.yml/badge.svg)](https://github.com/algorandfoundation/liquid-auth-js/actions/workflows/package-release.yml)[![codecov](https://codecov.io/gh/algorandfoundation/liquid-auth-js/graph/badge.svg?token=AKN7VATWTO)](https://codecov.io/gh/algorandfoundation/liquid-auth-js)[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](code_of_conduct.md)

This project is an example Client for TypeScript for using the Liquid-Auth API.

# 🎉 Getting Started

## 📦 Install

```bash
npm install algorandfoundation/liquid-auth-js --save
````

# 📝 Usage

```typescript
import {SignalClient} from '@algorandfoundation/liquid-client';
const client = new SignalClient(window.origin);
```

See the [liquid-auth documentation](https://liquidauth.com/clients/browser/introduction/) for more information on the API.

## 🔐 Browser Wallet Integration

#### Create a new account and passkey
```typescript
const testAccount = algosdk.generateAccount();
// Sign in to the service with a new credential and wallet
await client.attestation(async (challenge: Uint8Array) => ({
    type: 'algorand', // The type of signature and public key
    address: testAccount.addr, // The address of the account
    signature: toBase64URL(nacl.sign.detached(challenge, testAccount.sk)), // The signature of the challenge
    requestId: '019097ff-bb8d-7f68-9062-89543625aca5', // Optionally authenticate a remote peer
    device: 'Demo Web Wallet' // Optional device name
}))
```
#### Sign in with an existing account
```typescript
await client.assertion(
    credentialId, // Some known credential ID
    {requestId: '019097ff-bb8d-7f68-9062-89543625aca5'} // Optional requestId to link
)
```
#### Peering with a remote client

```typescript
// Create the Peer Connection and await the remote client's answer
client.peer('019097ff-bb8d-7f68-9062-89543625aca5', 'answer').then((dataChannel: RTCDataChannel)=>{
    // Handle the data channel
    dataChannel.onmessage = (event: MessageEvent) => {
        console.log(event.data)
    }
})
```

## 🌐 Dapp Integration

```typescript
const requestId = SignalClient.generateRequestId();
client
    .peer(requestId, 'offer')
    .then((dataChannel: RTCDataChannel)=>{
        // Handle the data channel
        dataChannel.onmessage = (event: MessageEvent) => {
            console.log(event.data)
        }
    })
const blob = await client.qrCode()
```

## 🏗️ Interfaces

```typescript
interface SignalClient {
  readonly url: string; // Origin of the service
  type: "offer" | "answer" // Type of client
  peerClient: RTCPeerConnection | PeerClient // Native WebRTC Wrapper/Interface
  socket: Socket // The socket to the service

  readonly authenticated: boolean; // State of authentication
  readonly requestId?: string; // The current request being signaled

  /**
   * Generate a Request ID
   */
  generateRequestId(): string;

  attestation(...args: any[]): Promise<any>;
  assertion(...args: any[]): Promise<any>;
  
  /**
   * Top level Friendly interface for signaling
   * @param args
   */
  peer(requestId: string, type: 'offer' | 'answer', config?: RTCConfiguration): Promise<void>;

  /**
   * Link a Request ID to this client
   * @param args
   */
  link(...args: any[]): Promise<LinkMessage>;

  /**
   * Wait for a desciption signal
   * @param args
   */
  signal(...args: any[]): Promise<string>;

  /**
   * Terminate the signaling session
   */
  close(): void
  
  
  /**
   * Listen to Interface events
   * @param args
   */
  on(...args: any[]): void;

  /**
   * Emit an event to the interface
   * @param channel
   * @param callback
   */
  emit(channel: string, callback: (...args: any[])=>void)

}
```
## ❤️ Community

[![stargazers](https://reporoster.com/stars/dark/algorandfoundation/liquid-auth-js)](https://github.com/algorandfoundation/liquid-auth-js/stargazers)
[![forks](https://reporoster.com/forks/dark/algorandfoundation/liquid-auth-js)](https://github.com/algorandfoundation/liquid-auth-js/network/members)
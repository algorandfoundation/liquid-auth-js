---
title: 'Browser: Peer Answer'
---

The answer client is used to respond to a remote client's offer.
The remote client will have sent an offer to the answer client, which will then respond with an answer.

### Who is this for?

- **dApps** that want to leverage liquid-auth to connect to other clients
- **Mobile Wallets** that want to tailor the onboarding and connect experience
- **Browser Wallets** that want to communicate with other clients

### Request ID

Answer clients are responsible for creating the request id.
Request IDs are given to the remote peer, usually as a deep-link encoded into a QR Code.
This ID is used by the remote peer to authenticate the current client.

```typescript
import { SignalClient } from '@algorandfoundation/liquid-client';
const requestId = SignalClient.generateRequestId();
```

## Signaling

```typescript
// Wait for a remote offer for the current request id
client
    .peer(requestId, 'offer')
    .then(handleDataChannel)

// Display QR Code
const blob = await client.qrCode()
```

## Data Channel

Handling the Datachannel can be done with the `@algorandfoundation/provider` library

```typescript
import {encode as cborEncode, decode as cborDecode} from 'cbor-x';
import {encode as msgpackEncode} from 'algorand-msgpack';
import { v7 as uuidv7 } from 'uuid';

import {
  RequestMessageBuilder,
  SignTransactionsParamsBuilder,
  toBase64URL,
  fromBase64URL,
} from "@algorandfoundation/provider";


let dc: RTCDataChannel

// Provider ID of the Wallet, otherwise it should be the default Liquid UUID
const providerId = uuidv7()

// Create an encoded transaction using your algorand specific library
const txns = [
  toBase64URL(
    // Replace this with Encoded Transaction
    new Uint8Array(64)
  )
]

// UUID of the Message
const messageId = uuidv7()
const params = new SignTransactionsParamsBuilder()
  .addProviderId(providerId)
  .addTxns(txns)
  .get()

// Create the Request Message
const request = new RequestMessageBuilder(messageId, "arc0027:sign_transactions:request")
  .addParams(params)
  .get()

// Send the Request Message
dc.send(toBase64URL(cborEncode(request)))

// Wait for a response for the message
dc.onmessage = async (evt: {data: string}) => {
  const message = cborDecode(fromBase64URL(evt.data))
  // Handle message types and create response

  if(message.reference === '"arc0027:sign_transactions:response'){
    // Make sure it's the appropriate message we are attaching the signature to
    if(message.requestId !== messageId) return

    const encodedSignatures: string[] = message.params.stxns

    // Attach Signature Example:
    const transactionsToSend: string[] = txns.map((encodedTxn, idx)=>{
      // Getting the Transaction Bytes
      const txnBytes = fromBase64URL(encodedTxn)

      // Decode and attach the signature with the library you prefer:
      const txn = decodeUnsignedTransaction(txnBytes)
      return txn.attachSignature(fromBase64URL(encodedSignatures[idx]))
    })

    // Send the txns to the network:
    for(const txn in transactionsToSend){
      const { txId } = await algod.sendRawTransaction(txn).do();
    }
  }
}
```
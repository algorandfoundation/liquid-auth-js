import './style.css'
import * as nacl from 'tweetnacl'
import { SignalClient, toBase64URL } from "@algorandfoundation/liquid-client";
import {
    Algodv2,
    decodeUnsignedTransaction,
    encodeUnsignedTransaction,
    makePaymentTxnWithSuggestedParamsFromObject
} from "algosdk";
import { decode, encode } from "cbor-x";

const testAccount = {
    addr: "IKMUKRWTOEJMMJD4MUAQWWB4C473DEHXLCYHJ4R3RZWZKPNE7E2ZTQ7VD4",
    sk: new Uint8Array([
        153,
        99,
        94,
        233,
        195,
        182,
        109,
        64,
        9,
        200,
        81,
        184,
        78,
        219,
        114,
        95,
        177,
        210,
        244,
        157,
        200,
        206,
        99,
        196,
        224,
        196,
        38,
        72,
        151,
        81,
        204,
        245,
        66,
        153,
        69,
        70,
        211,
        113,
        18,
        198,
        36,
        124,
        101,
        1,
        11,
        88,
        60,
        23,
        63,
        177,
        144,
        247,
        88,
        176,
        116,
        242,
        59,
        142,
        109,
        149,
        61,
        164,
        249,
        53
    ])
}
// The Signaling Client
const client = new SignalClient(window.origin)
// WebRTC Configuration
const RTC_CONFIGURATION = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ],
        },
        {
            urls: [
                "turn:global.turn.nodely.network:80?transport=tcp",
                "turns:global.turn.nodely.network:443?transport=tcp",
                "turn:eu.turn.nodely.io:80?transport=tcp",
                "turns:eu.turn.nodely.io:443?transport=tcp",
                "turn:us.turn.nodely.io:80?transport=tcp",
                "turns:us.turn.nodely.io:443?transport=tcp",
            ],
            username: import.meta.env.VITE_NODELY_TURN_USERNAME || 'username',
            credential: import.meta.env.VITE_NODELY_TURN_CREDENTIAL || 'credential',
        }
    ],
    iceCandidatePoolSize: 10,
}
// RequestId for this client
const requestId = SignalClient.generateRequestId()
// RequestId for a remote client
let altRequestId = requestId
// Render the UI
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div class="call-session">
        <div class="offer">
            <a id="qr-link" href="https://github.com/algorandfoundation/liquid-auth-js" target="_blank">
              <img src="" class="logo hidden" alt="Liquid QR Code" />
            </a>
            <hgroup>
            <h1>Offer Client</h1>
            <h2>Local ID: ${requestId}</h2>
            </hgroup> 
            <button id="start" onclick="handleOfferClient()">Start</button>
            <button id="toggle" onclick="toggle()">Switch</button>
        </div>
        <div class="answer hidden">
            <h1>Answer Client</h1>    
            <label for="alt-request">Remote ID:</label>
            <input id="alt-request" value="${altRequestId}" onchange="handleAlternativeRequestId()"/>
            <button id="attestation" onclick="handleSignChallenge()">Sign In</button>
        </div>
    </div>
    <div class="message-container hidden">
        <h1>Messages</h1>
        <div class="messages"></div>
        <input type="text" id="message" />
        <button onclick="sendMessage()">Send</button>
    </div>
  </div>
`

/**
 * Send a Message to the remote client
 */
async function sendMessage() {
    const messages = document.querySelector('.messages') as HTMLDivElement
    const message = document.querySelector('#message') as HTMLInputElement
    const count = 13370;
    let txns= []
    const encoder = new TextEncoder();
    const algod = new Algodv2(
      "",
      "https://testnet-api.algonode.cloud",
      443
    )
    const suggestedParams = await algod.getTransactionParams().do();
    for(var i = 0; i < count; i++){
        txns.push(encodeUnsignedTransaction(makePaymentTxnWithSuggestedParamsFromObject({
            from: testAccount.addr,
            suggestedParams,
            to: testAccount.addr,
            amount: 0,
            note: encoder.encode(`Transaction ${i}`)
        })))
    }
    console.log('Created transactions')
    const encoded = encode(txns)
    console.log('Encoded transactions', encoded)

    console.log(encoded.length > 256000)
    const chunkSize = 256000;
    dc.send(JSON.stringify({"length": encoded.length, chunkSize: chunkSize, timestamp: Date.now()}))
    for (let i = 0; i < encoded.length; i += chunkSize) {
        dc.send(encoded.slice(i, i + chunkSize))
        // do whatever
    }

    // if(encoded.length > dc.bu
    dc.onbufferedamountlow = () => {
        console.log('Buffered Amount Low', dc.bufferedAmount)
    }
    // for await (let binaryChunk of encodeAsAsyncIterable(txns)){
    //     // progressively get binary chunks as asynchronous data source is encoded
    //     dc.send(binaryChunk)
    // }
    // dc.send(message.value)
    messages.innerHTML += `<p class="local-message">${message.value}</p>`
    message.value = ''
}
/**
 * Handle the data channel
 * @param dataChannel
 */
function handleDataChannel(dataChannel: RTCDataChannel) {
    globalThis.dc = dataChannel
    dc.bufferedAmountLowThreshold = 1000
    dc.binaryType = 'arraybuffer'
    const messagesContainer = document.querySelector('.message-container') as HTMLDivElement
    messagesContainer.classList.remove('hidden')
    const messages = document.querySelector('.messages') as HTMLDivElement
    let data: number[] = [];
    let length = 0;
    let received = 0;
    let isLoading = false;
    let start = Date.now()
    dc.onmessage = (e) => {
        if(typeof e.data === 'string'){
            let message = JSON.parse(e.data)
            length = message.length
            isLoading = true
            start = message.timestamp
        } else if(isLoading){
            data = [...data, ...new Uint8Array(e.data)]
            received += e.data.byteLength
            if(received >= length){
                console.log('Received all data', Date.now() - start)
                //@ts-expect-error, we know more than tsc
                const decoded = decode(new Uint8Array(data)).map(txn=>decodeUnsignedTransaction(txn))
                const delta = Date.now() - start
                const deltaSeconds = delta/1000
                const tps = Math.round(decoded.length/deltaSeconds)
                messages.innerHTML += `<p class="remote-message">That's ${decoded.length} Transactions in ${delta/1000}s. A causual ${tps} TPS 🤯</p>`
                isLoading = false
                data = []
                received = 0
                length = 0
            }
        }
    }
}
/**
 * Create a peer connection, wait for an offer and send an answer to the remote client
 */
async function handleOfferClient() {
    // Peer to the remote client and await their offer
    console.log('requestId', requestId);
    client.peer(requestId, 'offer', RTC_CONFIGURATION).then(handleDataChannel)
    // Once the link message is received by the remote wallet, hide the offer
    client.on('link-message', () => {
        document.querySelector('.offer')!!.classList.add('hidden')
    })

    // Update the render
    const image = document.querySelector('.logo') as HTMLImageElement
    image.src = await client.qrCode()
    image.classList.toggle('hidden')

    const deepLink = document.querySelector('#qr-link') as HTMLAnchorElement
    deepLink.href = client.deepLink(requestId)

    document.querySelector('#start')!.classList.add('hidden')
    document.querySelector('#toggle')!.classList.add('hidden')
}

/**
 * Sign the challenge and send the offer to the remote client
 *
 * This is mainly for extension wallets or other browser-based wallets, they must sign the challenge
 * before they can peer with the remote client.
 */
async function handleSignChallenge() {
    // Sign in to the service with a new credential
    await client.attestation(async (challenge: Uint8Array) => ({
        requestId: altRequestId,
        origin: window.origin,
        type: 'algorand',
        address: testAccount.addr,
        signature: toBase64URL(nacl.sign.detached(challenge, testAccount.sk)),
        device: 'Demo Web Wallet'
    }))
    // TODO: sign in with an existing credential
    //await client.assertion()

    document.querySelector('.answer')!!.classList.add('hidden')

    // Create the Peer Connection and await the remote client's answer
    client.peer(altRequestId, 'answer', RTC_CONFIGURATION).then(handleDataChannel)
}

// UI Functions
function toggle() {
    document.querySelector('.offer')!.classList.toggle('hidden')
    document.querySelector('.answer')!.classList.toggle('hidden')
}
function handleAlternativeRequestId() {
    altRequestId = document.querySelector('input')!.value
}

// Globals
declare global {
    var toggle: () => void
    var handleOfferClient: () => void
    var handleSignChallenge: () => void
    var handleAlternativeRequestId: () => void
    var sendMessage: () => void
    var dc: RTCDataChannel
}
globalThis.toggle = toggle
globalThis.handleOfferClient = handleOfferClient
globalThis.handleSignChallenge = handleSignChallenge
globalThis.sendMessage = sendMessage
globalThis.handleAlternativeRequestId = handleAlternativeRequestId


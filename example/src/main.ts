import './style.css'
import * as nacl from 'tweetnacl'
import { mnemonicToSecretKey } from 'algosdk'
import { SignalClient, toBase64URL } from "@algorandfoundation/liquid-client";

// Test Account
const testAccount = mnemonicToSecretKey(
    'industry kangaroo visa history swarm exotic doctor fade strike honey ride bicycle pistol large eager solution midnight loan give list company behave purpose abstract good',
);
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
                "turn:global.relay.metered.ca:80",
                "turn:global.relay.metered.ca:80?transport=tcp",
                "turn:global.relay.metered.ca:443",
                "turns:global.relay.metered.ca:443?transport=tcp"
            ],
            // default username and credential when the turn server doesn't
            // use auth, the client still requires a value
            username: import.meta.env.VITE_TURN_USERNAME || 'username',
            credential: import.meta.env.VITE_TURN_CREDENTIAL || 'credential',
        },
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
            <a href="https://github.com/algorandfoundation/liquid-auth-js" target="_blank">
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
function sendMessage() {
    const messages = document.querySelector('.messages') as HTMLDivElement
    const message = document.querySelector('#message') as HTMLInputElement
    dc.send(message.value)
    messages.innerHTML += `<p class="local-message">${message.value}</p>`
    message.value = ''
}
/**
 * Handle the data channel
 * @param dataChannel
 */
function handleDataChannel(dataChannel: RTCDataChannel) {
    globalThis.dc = dataChannel
    const messagesContainer = document.querySelector('.message-container') as HTMLDivElement
    messagesContainer.classList.remove('hidden')
    const messages = document.querySelector('.messages') as HTMLDivElement
    dc.onmessage = (e) => {
        messages.innerHTML += `<p class="remote-message">${e.data}</p>`
    }
}
/**
 * Create a peer connection, wait for an offer and send an answer to the remote client
 */
async function handleOfferClient() {
    // Peer to the remote client and await their offer
    client.peer(requestId, 'offer', RTC_CONFIGURATION).then(handleDataChannel)
    // Once the link message is received by the remote wallet, hide the offer
    client.on('link-message', () => {
        document.querySelector('.offer')!!.classList.add('hidden')
    })

    // Update the render
    const image = document.querySelector('.logo') as HTMLImageElement
    image.src = await client.qrCode()
    image.classList.toggle('hidden')
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
        requestId: parseFloat(altRequestId),
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


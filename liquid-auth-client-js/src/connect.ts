import qrcode, {QRCodeToDataURLOptions} from 'qrcode'
import type {Account} from 'algosdk'
import {encodeAddress} from "algosdk";
import nacl from 'tweetnacl'
import {toBase64URL} from './encoding.js'
export class Message {
    origin: string;
    challenge: string;
    requestId: number;
    wallet?: string;
    signature?: string;
    constructor(origin: string, challenge: string, requestId: number) {
        this.origin = origin
        this.challenge = challenge
        this.requestId = requestId
    }
    static async fromResponse(response){
        const msg = response instanceof Response ? await response.json(): response;
        return new Message(msg.origin, msg.challenge, msg.requestId)
    }
    /**
     * Convert Message to Barcode
     *
     * @param options
     * @param el
     */
    toBarcode(options?: QRCodeToDataURLOptions,  el?: HTMLCanvasElement){
        if(typeof window === 'undefined' || !(el instanceof HTMLCanvasElement)){
            return qrcode.toDataURL(this.toString(), options)
        }
        return qrcode.toDataURL(el, this.toString(), options)
    }

    /**
     * Sign Message with Wallet Key
     *
     * @param key
     */
    sign(key: string | Account | Uint8Array | nacl.SignKeyPair): void{
        const encoder = new TextEncoder()
        let keyPair: nacl.SignKeyPair


        // Seed or Secret Key
        if(key instanceof Uint8Array){
            if(key.length === 32){
                keyPair = nacl.sign.keyPair.fromSeed(key)
            } else if(key.length === 64){
                keyPair = nacl.sign.keyPair.fromSecretKey(key)
            } else {
                throw new TypeError('Invalid seed or secret key')
            }
        }

        // Algorand SDK
        if(typeof (key as Account).addr !== 'undefined' && typeof (key as Account).addr === 'string'){
            keyPair = nacl.sign.keyPair.fromSecretKey((key as Account).sk)
        }


        // NACL
        if((key as nacl.SignKeyPair).publicKey instanceof Uint8Array && (key as nacl.SignKeyPair).secretKey instanceof Uint8Array){
            console.log('nacl')
            keyPair = key as nacl.SignKeyPair
        }
        this.signature = toBase64URL(nacl.sign.detached(encoder.encode(this.challenge), keyPair.secretKey));
        this.wallet = encodeAddress(keyPair.publicKey)
    }

    toString(){
        let optional: {wallet?: string, signature?: string} = {}

        if(typeof this.wallet === 'string'){
            optional.wallet = this.wallet;
        }

        if(typeof this.signature === 'string'){
            optional.signature = this.signature
        }
        return JSON.stringify({ origin: this.origin, requestId: this.requestId, challenge: this.challenge, ...optional })
    }
}

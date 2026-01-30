import { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { Options as QRCodeOptions } from 'qr-code-styling';
import { EventEmitter } from 'eventemitter3';
export type LinkMessage = {
    credId?: string;
    requestId: string;
    wallet: string;
};
export declare function generateQRCode({ requestId, url }: {
    requestId?: string;
    url: string;
}, qrCodeOptions?: QRCodeOptions): Promise<any>;
/**
 * Generate a Deep Link URI
 * @param {string} origin
 * @param requestId
 */
export declare function generateDeepLink(origin: string, requestId: string): string;
/**
 *
 */
export declare class SignalClient extends EventEmitter {
    url: string;
    type: 'offer' | 'answer' | null;
    private authenticated;
    private requestId;
    peerClient: RTCPeerConnection | undefined;
    private qrCodeOptions;
    socket: Socket;
    /**
     *
     * @param url
     * @param options
     */
    constructor(url: string, options?: Partial<ManagerOptions & SocketOptions>);
    static generateRequestId(): string;
    /**
     * Handles the process of attestation by invoking the provided challenge handler and the specified options.
     *
     * @param {function(Uint8Array): any} onChallenge - A callback function to handle the challenge. Receives a Uint8Array representing the challenge.
     * @param {object} [options=DEFAULT_ATTESTATION_OPTIONS] - Configuration options for the attestation process.
     * @param debug
     * @return {Promise<void>} A promise that resolves when attestation is successfully completed or rejects with an error if it fails.
     */
    attestation(onChallenge: (challenge: Uint8Array) => any, options?: {
        attestationType: string;
        authenticatorSelection: {
            authenticatorAttachment: string;
            userVerification: string;
            requireResidentKey: boolean;
        };
        extensions: {
            liquid: boolean;
        };
    }, debug?: boolean): Promise<any>;
    assertion(credId: string, debug?: boolean): Promise<any>;
    /**
     * Create QR Code
     */
    qrCode(): Promise<any>;
    /**
     * Create a Deep Link URI
     * @param requestId
     */
    deepLink(requestId: string): string;
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
    peer(requestId: string | undefined, type: 'offer' | 'answer', config?: RTCConfiguration): Promise<RTCDataChannel>;
    /**
     * Await for a link message for a given requestId
     * @param requestId
     */
    link(requestId: string): Promise<LinkMessage>;
    /**
     *
     * @param type
     */
    signal(type: 'offer' | 'answer'): Promise<RTCSessionDescriptionInit>;
    close(disconnect?: boolean): void;
}

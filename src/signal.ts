/**
 * Signal Module
 *
 * @packageDocumentation
 * @document ./signal.offer.guide.md
 * @document ./signal.answer.guide.md
 */
import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import QRCodeStyling, { Options as QRCodeOptions } from 'qr-code-styling';
import { EventEmitter } from 'eventemitter3';
import { v7 as uuidv7 } from 'uuid';

import { attestation } from './attestation.js';
import { assertion } from './assertion.js';

import { DEFAULT_QR_CODE_OPTIONS } from './constants.js';
import {
  ORIGIN_IS_MISSING_MESSAGE,
  REQUEST_IN_PROCESS_MESSAGE,
  REQUEST_IS_MISSING_MESSAGE,
  UNAUTHENTICATED_MESSAGE,
} from './errors.js';
import { DEFAULT_ATTESTATION_OPTIONS } from './attestation.fetch.js';

export type LinkMessage = {
  credId?: string;
  requestId: string;
  wallet: string;
};

export async function generateQRCode(
  { requestId, url }: { requestId?: string; url: string },
  qrCodeOptions: QRCodeOptions = DEFAULT_QR_CODE_OPTIONS,
) {
  if (typeof requestId === 'undefined')
    throw new Error(REQUEST_IS_MISSING_MESSAGE);
  qrCodeOptions.data = generateDeepLink(url, requestId);

  const qrCode = new (QRCodeStyling as any).default(qrCodeOptions);
  return await qrCode.getRawData('png').then((blob) => {
    if (!blob) throw new TypeError('Could not get qrcode blob');
    return URL.createObjectURL(blob);
  });
}

/**
 * Generate a Deep Link URI
 * @param {string} origin
 * @param requestId
 */
export function generateDeepLink(origin: string, requestId: string) {
  if (typeof origin !== 'string') {
    throw new Error(ORIGIN_IS_MISSING_MESSAGE);
  }
  if (typeof requestId !== 'string') {
    throw new Error(REQUEST_IS_MISSING_MESSAGE);
  }
  return `liquid://${origin.replace('https://', '')}/?requestId=${requestId}`;
}
/**
 *
 */
export class SignalClient extends EventEmitter {
  url: string;
  type: 'offer' | 'answer' | null = null;
  private authenticated: boolean = false;
  private requestId: string | undefined;
  peerClient: RTCPeerConnection | undefined;
  private qrCodeOptions: QRCodeOptions = DEFAULT_QR_CODE_OPTIONS;
  socket: Socket;

  private isIgnorableIceCandidateError(err: unknown): boolean {
    const anyErr = err as any;
    const msg = String(anyErr?.message ?? anyErr);
    const name = String(anyErr?.name ?? '');

    // node-datachannel can throw when candidates arrive out-of-order:
    // "libdatachannel error while adding remote candidate: Got a remote candidate without ICE transport"
    if (
      name === 'NotFoundError' &&
      msg.includes('remote candidate') &&
      msg.includes('ICE transport')
    )
      return true;
    if (
      msg.includes('libdatachannel error while adding remote candidate') &&
      msg.includes('ICE transport')
    )
      return true;
    return false;
  }

  private async safeAddIceCandidate(
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const pc = this.peerClient;
    if (!pc) return;

    // Avoid calling into a closed PC (extra safety)
    if ((pc as any).signalingState === 'closed') return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      if (this.isIgnorableIceCandidateError(err)) return;
      throw err;
    }
  }

  /**
   *
   * @param url
   * @param options
   */
  constructor(
    url: string,
    options: Partial<ManagerOptions & SocketOptions> = { autoConnect: true },
  ) {
    super();
    this.url = url;
    this.socket = io(url, options);

    this.socket.on('connect', () => {
      this.emit('connect', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      this.emit('disconnect', this.socket.id);
    });
  }

  static generateRequestId(): string {
    return uuidv7();
  }

  /**
   * Handles the process of attestation by invoking the provided challenge handler and the specified options.
   *
   * @param {function(Uint8Array): any} onChallenge - A callback function to handle the challenge. Receives a Uint8Array representing the challenge.
   * @param {object} [options=DEFAULT_ATTESTATION_OPTIONS] - Configuration options for the attestation process.
   * @param debug
   * @return {Promise<void>} A promise that resolves when attestation is successfully completed or rejects with an error if it fails.
   */
  async attestation(
    onChallenge: (challenge: Uint8Array) => any,
    options = DEFAULT_ATTESTATION_OPTIONS,
    debug = false,
  ) {
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
  async assertion(credId: string, debug = false) {
    try {
      const response = await assertion({
        origin: this.url,
        credId,
        debug,
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
  async qrCode() {
    if (typeof this.requestId === 'undefined')
      throw new Error(REQUEST_IS_MISSING_MESSAGE);
    return generateQRCode(
      { requestId: this.requestId, url: this.url },
      this.qrCodeOptions,
    );
  }

  /**
   * Create a Deep Link URI
   * @param requestId
   */
  deepLink(requestId: string) {
    if (
      typeof requestId !== 'string' &&
      typeof this.requestId === 'undefined'
    ) {
      throw new Error(REQUEST_IS_MISSING_MESSAGE);
    }
    return generateDeepLink(this.url, requestId || this.requestId || '');
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
    type: 'offer' | 'answer',
    config: RTCConfiguration = {
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
          ],
        },
      ],
      iceCandidatePoolSize: 10,
    },
  ): Promise<RTCDataChannel> {
    if (typeof this.requestId !== 'undefined')
      throw new Error(REQUEST_IN_PROCESS_MESSAGE);

    return new Promise(async (resolve) => {
      if (typeof requestId === 'undefined') {
        throw new Error(REQUEST_IS_MISSING_MESSAGE);
      }
      let candidatesBuffer: RTCIceCandidateInit[] = [];
      // Create Peer Connection
      this.peerClient = new RTCPeerConnection(config);

      this.type = type === 'offer' ? 'answer' : 'offer';
      // Wait for a link message
      type === 'offer' && (await this.link(requestId));
      // Listen for Local Candidates
      this.peerClient.onicecandidate = (event) => {
        if (event.candidate) {
          this.emit(`${this.type}-candidate`, event.candidate.toJSON());
          this.socket.emit(`${this.type}-candidate`, event.candidate.toJSON());
        }
      };
      // Listen to Remote Candidates
      this.socket.on(
        `${type}-candidate`,
        async (candidate: RTCIceCandidateInit) => {
          if (
            this.peerClient?.remoteDescription &&
            this.peerClient?.remoteDescription
          ) {
            this.emit(`${type}-candidate`, candidate);
            await this.safeAddIceCandidate(candidate);
          } else {
            candidatesBuffer.push(candidate);
          }
        },
      );

      // Listen for Remote DataChannel and Resolve
      this.peerClient.ondatachannel = (event) => {
        this.emit('data-channel', event.channel);
        resolve(event.channel);
      };
      // Handle Session Descriptions
      if (type === 'offer') {
        const sdp = await this.signal(type);
        await this.peerClient.setRemoteDescription(sdp);
        const answer = await this.peerClient.createAnswer();
        await this.peerClient.setLocalDescription(answer);
        if (candidatesBuffer.length > 0) {
          await Promise.all(
            candidatesBuffer.map(async (candidate) => {
              this.emit(`${type}-candidate`, candidate);
              await this.safeAddIceCandidate(candidate);
            }),
          );
          candidatesBuffer = [];
        }
        this.emit(`${this.type}-description`, answer.sdp);
        this.socket.emit(`${this.type}-description`, answer.sdp);
      } else {
        const dataChannel = this.peerClient.createDataChannel('liquid');
        const localSdp = await this.peerClient.createOffer();
        await this.peerClient.setLocalDescription(localSdp);
        this.socket.emit(`${this.type}-description`, localSdp.sdp);
        this.emit(`${this.type}-description`, localSdp.sdp);
        const sdp = await this.signal(type);
        await this.peerClient.setRemoteDescription(sdp);
        if (candidatesBuffer.length > 0) {
          await Promise.all(
            candidatesBuffer.map(async (candidate) => {
              this.emit(`${type}-candidate`, candidate);
              await this.safeAddIceCandidate(candidate);
            }),
          );
          candidatesBuffer = [];
        }
        this.emit('data-channel', dataChannel);
        resolve(dataChannel);
      }
    });
  }

  /**
   * Await for a link message for a given requestId
   * @param requestId
   */
  async link(requestId: string) {
    if (typeof this.requestId !== 'undefined')
      throw new Error(REQUEST_IN_PROCESS_MESSAGE);
    this.requestId = requestId;
    this.emit('link', { requestId });

    return new Promise<LinkMessage>((resolve) => {
      this.socket.emit(
        'link',
        { requestId },
        ({ data }: { data: LinkMessage }) => {
          this.authenticated = true;
          delete this.requestId;

          this.emit('link-message', data);
          resolve(data);
        },
      );
    });
  }

  /**
   *
   * @param type
   */
  async signal(type: 'offer' | 'answer') {
    if (!this.authenticated) throw new Error(UNAUTHENTICATED_MESSAGE);
    this.emit('signal', { type });
    return new Promise<RTCSessionDescriptionInit>((resolve) => {
      this.socket.once(`${type}-description`, (sdp: string) => {
        const description = { type, sdp } as RTCSessionDescriptionInit;
        this.emit(`${type}-description`, description);
        resolve(description);
      });
    });
  }

  close(disconnect = false) {
    this.socket.removeAllListeners();
    delete this.requestId;
    this.authenticated = false;
    if (disconnect) this.socket.disconnect();
    this.emit('close');
  }
}

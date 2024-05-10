/**
 * This module is deprecated
 */
import { DEFAULT_FETCH_OPTIONS } from './constants.js';
import type { Account } from 'algosdk';
import type { SignKeyPair } from 'tweetnacl';
import nacl from 'tweetnacl';
import { toBase64URL, encodeAddress } from '@liquid/core/encoding';
import {
  INVALID_INPUT_MESSAGE,
  isValidResponse,
  UNSIGNED_MESSAGE,
} from './errors.js';

/**
 * @todo: Refactor auth message to FIDO extension
 * @deprecated
 */
export class Message {
  /**
   * Origin of the Request
   */
  origin: string;
  /**
   * Challenge to be signed
   */
  challenge: string;
  /**
   * Linking Request ID
   */
  requestId: number;
  /**
   * Label for the remote Service
   */
  label?: string;
  /**
   * Address that signed the message
   */
  wallet?: string;
  /**
   * Signature of the challenge
   */
  signature?: string;
  constructor(
    origin: string,
    challenge: string,
    requestId: number,
    label?: string,
  ) {
    this.origin = origin;
    this.challenge = challenge;
    this.requestId = requestId;
    this.label = label;
  }

  static async fromResponse(response: Response | Message) {
    const msg = response instanceof Response ? await response.json() : response;
    return new Message(msg.origin, msg.challenge, msg.requestId);
  }

  /**
   * Sign Message with Wallet Key
   *
   * @param key
   * @deprecated
   */
  sign(key: string | Account | Uint8Array | SignKeyPair): this {
    const encoder = new TextEncoder();
    let keyPair: SignKeyPair | null = null;

    // Seed or Secret Key
    if (key instanceof Uint8Array) {
      if (key.length === 32) {
        keyPair = nacl.sign.keyPair.fromSeed(key);
      } else if (key.length === 64) {
        keyPair = nacl.sign.keyPair.fromSecretKey(key);
      } else {
        throw new TypeError('Invalid seed or secret key');
      }
    }

    // Algorand SDK
    if (
      typeof (key as Account).addr !== 'undefined' &&
      typeof (key as Account).addr === 'string'
    ) {
      keyPair = nacl.sign.keyPair.fromSecretKey((key as Account).sk);
    }

    // NACL
    if (
      (key as SignKeyPair).publicKey instanceof Uint8Array &&
      (key as SignKeyPair).secretKey instanceof Uint8Array
    ) {
      console.log('nacl');
      keyPair = key as SignKeyPair;
    }
    if (keyPair === null) {
      throw new TypeError('Invalid key');
    }
    this.signature = toBase64URL(
      nacl.sign.detached(encoder.encode(this.challenge), keyPair.secretKey),
    );
    this.wallet = encodeAddress(keyPair.publicKey);
    return this;
  }

  toString(): string {
    const optional: { wallet?: string; signature?: string; label?: string } =
      {};

    if (typeof this.wallet === 'string') {
      optional.wallet = this.wallet;
    }

    if (typeof this.signature === 'string') {
      optional.signature = this.signature;
    }

    if (typeof this.label === 'string') {
      optional.label = this.label;
    }

    return JSON.stringify({
      origin: this.origin,
      requestId: this.requestId,
      challenge: this.challenge,
      ...optional,
    });
  }
}

/**
 *
 * @deprecated
 * @param origin
 * @param requestId
 */
export async function fetchConnectRequest(origin: string, requestId: number) {
  if (typeof origin !== 'string' || typeof requestId !== 'number')
    throw new TypeError(INVALID_INPUT_MESSAGE);
  return await fetch(`${origin}/connect/request`, {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify({ requestId }),
  });
}

/**
 * @deprecated
 * @param msg
 */
export async function fetchConnectResponse(msg: Message) {
  if (!(msg instanceof Message)) throw new TypeError(INVALID_INPUT_MESSAGE);
  if (typeof msg.signature === 'undefined') {
    throw new TypeError(UNSIGNED_MESSAGE);
  }
  return await fetch('/connect/response', {
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(msg),
  }).then((r) => {
    if (!isValidResponse(r)) throw new Error(r.statusText);
    return r.json();
  });
}

/**
 * Connect
 * @param origin
 * @param requestId
 * @param key
 * @deprecated
 */
export async function connect(
  origin: string,
  requestId: number,
  key: string | Account | Uint8Array | SignKeyPair,
) {
  if (
    typeof origin !== 'string' ||
    typeof requestId !== 'number' ||
    typeof key === 'undefined'
  )
    throw new TypeError(INVALID_INPUT_MESSAGE);
  const msg = await Message.fromResponse(
    await fetchConnectRequest(origin, requestId),
  );
  msg.sign(key);
  return await fetchConnectResponse(msg);
}
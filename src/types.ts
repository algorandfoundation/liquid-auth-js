/**
 * Represents a user in the system.
 *
 * This interface defines the structure for a User, including their unique identifier,
 * wallet information, and associated credentials.
 *
 * Properties:
 * - `id`: A unique identifier for the user.
 * - `wallet`: A string representing the user's wallet address or identifier.
 * - `credentials`: An array of Credential objects associated with the user.
 */
export interface User {
  /**
   * A unique identifier represented as a string.
   */
  id: string;
  /**
   * Represents the wallet identifier or address.
   */
  wallet: string;
  /**
   * Represents an array of credential objects used for authentication or authorization purposes.
   */
  credentials: Credential[];

  /**
   * Durable pairing authorization returned after a Liquid Auth ceremony.
   * The credential is role-bound and MUST be stored as a secret.
   */
  pairing?: ControllerPairingCredential;
}

/** A participant's role in a durable pairing. */
export type PairingRole = "provider" | "controller";

/**
 * Durable, role-bound authorization for reconnecting to a pairing.
 *
 * `credential` is a bearer secret. It must not be logged, placed in a URL, or
 * shared with the other role.
 */
export type PairingCredential = {
  version: 2;
  pairingId: string;
  role: PairingRole;
  credential: string;
};

/** Durable authorization held by the provider that created an invitation. */
export type ProviderPairingCredential = PairingCredential & {
  role: "provider";
};

/** Durable authorization returned to the controller after WebAuthn approval. */
export type ControllerPairingCredential = PairingCredential & {
  role: "controller";
};

/** Provider authorization created before an invitation is shown. */
export type PairingInvitation = ProviderPairingCredential & {
  expiresAt: string;
};

/** State of an invitation that has not yet completed WebAuthn approval. */
export type PendingPairingStatus = {
  version: 2;
  pairingId: string;
  role: "provider";
  status: "pending";
  wallet?: never;
};

/** State of a pairing that has completed WebAuthn approval. */
export type EstablishedPairingStatus = {
  version: 2;
  pairingId: string;
  role: PairingRole;
  status: "active" | "revoked";
  wallet: string;
};

/** Current server-side state for a role-authorized pairing. */
export type PairingStatus = PendingPairingStatus | EstablishedPairingStatus;

/** A color gradient used by QR code styling options. */
export type QRCodeGradient = {
  type: "radial" | "linear";
  rotation?: number;
  colorStops: Array<{ offset: number; color: string }>;
};

/**
 * Browser-safe QR code styling options.
 *
 * This mirrors the public options accepted by the optional `qr-code-styling`
 * peer without exposing that package's Node-only `canvas` and `jsdom` types to
 * every TypeScript consumer of liquid-client.
 */
export type QRCodeOptions = {
  type?: "canvas" | "svg";
  shape?: "square" | "circle";
  width?: number;
  height?: number;
  margin?: number;
  data?: string;
  image?: string;
  nodeCanvas?: unknown;
  jsdom?: unknown;
  qrOptions?: {
    typeNumber?: number;
    mode?: "Numeric" | "Alphanumeric" | "Byte" | "Kanji";
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  };
  imageOptions?: {
    saveAsBlob?: boolean;
    hideBackgroundDots?: boolean;
    imageSize?: number;
    crossOrigin?: string;
    margin?: number;
  };
  dotsOptions?: {
    type?: "dots" | "rounded" | "classy" | "classy-rounded" | "square" | "extra-rounded";
    color?: string;
    gradient?: QRCodeGradient;
    roundSize?: boolean;
  };
  cornersSquareOptions?: {
    type?: "dot" | "square" | "extra-rounded" | "dots" | "rounded" | "classy" | "classy-rounded";
    color?: string;
    gradient?: QRCodeGradient;
  };
  cornersDotOptions?: {
    type?: "dot" | "square" | "dots" | "rounded" | "classy" | "classy-rounded" | "extra-rounded";
    color?: string;
    gradient?: QRCodeGradient;
  };
  backgroundOptions?: {
    round?: number;
    color?: string;
    gradient?: QRCodeGradient;
  };
};

/**
 * Represents a credential used for authentication purposes.
 *
 * This interface defines the structure of a credential object,
 * which contains information necessary to identify and validate
 * a user's authentication device and related properties.
 *
 * Properties:
 * - `device` (optional): Specifies the name or description of the device associated with the credential.
 * - `publicKey`: A string representing the public key associated with the credential.
 * - `credId`: A unique identifier for the credential.
 * - `prevCounter`: A numeric value representing the counter from the previous authentication attempt.
 */
export interface Credential {
  device?: string;
  publicKey: string;
  credId: string;
  prevCounter: number;
}

/**
 * Defines the options for configuring a LiquidExtension, providing detailed
 * specifications for origin, type, address, signature, and optional identifiers.
 */
export type LiquidExtensionOptions = {
  /**
   * Represents the origin or source of a specific entity, data, or request.
   * Typically used to denote where something was initiated or originates from.
   */
  origin: string;
  /**
   * Defines the type of the item, which can either be 'algorand'
   * or any other string value. The 'algorand' option typically
   * indicates a specific blockchain platform, while the string
   * type allows for extensibility to other values.
   */
  type: "algorand" | string;
  /**
   * Represents the address of a location, person, or entity.
   * This variable is intended to store a string containing
   * the address details, which may include elements such as
   * street name, city, state, postal code, and country.
   */
  address: string;
  /**
   * Represents the digital signature associated with a specific entity or data.
   * This signature is typically used for verification and validation purposes
   * to ensure data integrity and authenticity.
   */
  signature: string;

  /**
   * Represents an optional unique identifier for a specific request.
   * This identifier can be used to track or correlate requests in a system.
   */
  requestId?: string;
  /**
   * Represents the type or identifier of a device.
   * This variable can store a string value that describes the device being referenced.
   * It is optional, meaning it may be undefined if not provided.
   */
  device?: string;
};

/**
 * A basic socket interface that can be used with other libraries other than socket.io-client.
 */
export interface LiquidSocket {
  id?: string;
  connected?: boolean;
  /** Whether Socket.IO will automatically reconnect after the latest disconnect. */
  active?: boolean;
  auth?: object | ((callback: (data: object) => void) => void);
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  /** Optional EventEmitter-compatible targeted listener removal. */
  off?(event: string, listener?: (...args: any[]) => void): this;
  /** Optional Node/EventEmitter alias for adapters that do not expose `off`. */
  removeListener?(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): this;
  connect?(): this;
  disconnect(): this;
  removeAllListeners(event?: string): this;
}

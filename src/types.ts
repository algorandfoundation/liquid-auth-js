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
}

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
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): this;
  disconnect(): this;
  removeAllListeners(event?: string): this;
}

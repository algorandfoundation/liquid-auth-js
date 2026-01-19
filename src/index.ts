// Encoding Module
export * as encoding from './encoding.js';

// FIDO Modules
export * as assertion from './assertion.js';
export * as attestation from './attestation.js';

// Module helpers
export * as constants from './constants.js';
export * as errors from './errors.js';

// P2P Clients
export * as signal from './signal.js';

// Explicitly export SignalClient to facilitate importing in certain environments
// that do not work well with subpath exports. Note that in those environments,
// assertion and attestation flows will need to be implemented manually.
export { SignalClient } from './signal.js';
export { toBase64URL, fromBase64Url } from './encoding.js';

/**
 * Module For Defaults
 *
 *
 * @packageDocumentation
 * @protected
 */

import { Options as QRCodeOptions } from 'qr-code-styling';

/**
 * DEFAULT_FETCH_OPTIONS is a constant object used as a default configuration
 * for HTTP fetch requests. It defines the HTTP method and headers settings
 * to ensure consistent and appropriate behavior across network requests.
 *
 * The object specifies the following:
 * - `method`: The HTTP method to be used for the request, set to 'POST' by default.
 * - `headers`: A set of HTTP headers, including 'Content-Type', which is set
 *   to 'application/json' to indicate that the request body is formatted as JSON.
 *
 * This configuration is intended to simplify the process of making
 * standardized fetch requests and can be extended or overridden
 * based on the application's specific requirements.
 *
 * @internal
 */
export const DEFAULT_FETCH_OPTIONS = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

export const DEFAULT_QR_CODE_OPTIONS: QRCodeOptions = {
  width: 500,
  height: 500,
  type: 'svg',
  data: 'liquid://',
  margin: 25,
  imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 15 },
  dotsOptions: {
    type: 'extra-rounded',
    gradient: {
      type: 'radial',
      rotation: 0,
      colorStops: [
        { offset: 0, color: '#9966ff' },
        { offset: 1, color: '#332257' },
      ],
    },
  },
  backgroundOptions: { color: '#ffffff' },
  // TODO: Host logo publicly
  image:
    'https://algorandtechnologies.com/assets/media-kit/logos/logo-marks/png/algorand_logo_mark_black.png',
  cornersSquareOptions: {
    color: '#000000',
    gradient: {
      type: 'linear',
      rotation: 0,
      colorStops: [
        { offset: 0, color: '#332257' },
        { offset: 1, color: '#040908' },
      ],
    },
  },
  cornersDotOptions: {
    type: 'dot',
    color: '#000000',
    gradient: {
      type: 'linear',
      rotation: 0,
      colorStops: [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#000000' },
      ],
    },
  },
};

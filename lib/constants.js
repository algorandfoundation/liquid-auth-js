const DEFAULT_FETCH_OPTIONS = {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  }
};
const DEFAULT_QR_CODE_OPTIONS = {
  width: 500,
  height: 500,
  type: "svg",
  data: "liquid://",
  margin: 25,
  imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 15 },
  dotsOptions: {
    type: "extra-rounded",
    gradient: {
      type: "radial",
      rotation: 0,
      colorStops: [
        { offset: 0, color: "#9966ff" },
        { offset: 1, color: "#332257" }
      ]
    }
  },
  backgroundOptions: { color: "#ffffff" },
  // TODO: Host logo publicly
  image: "https://algorandtechnologies.com/assets/media-kit/logos/logo-marks/png/algorand_logo_mark_black.png",
  cornersSquareOptions: {
    color: "#000000",
    gradient: {
      type: "linear",
      rotation: 0,
      colorStops: [
        { offset: 0, color: "#332257" },
        { offset: 1, color: "#040908" }
      ]
    }
  },
  cornersDotOptions: {
    type: "dot",
    color: "#000000",
    gradient: {
      type: "linear",
      rotation: 0,
      colorStops: [
        { offset: 0, color: "#000000" },
        { offset: 1, color: "#000000" }
      ]
    }
  }
};
export {
  DEFAULT_FETCH_OPTIONS,
  DEFAULT_QR_CODE_OPTIONS
};
//# sourceMappingURL=constants.js.map

// Firebase Android configuration is supplied by EAS as a file-type
// environment variable. No local credentials fallback is permitted.

const appJson = require("./app.json");
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
const isAndroidEasBuild =
  process.env.EAS_BUILD === "true" &&
  process.env.EAS_BUILD_PLATFORM?.toLowerCase() === "android";

if (isAndroidEasBuild && !googleServicesFile) {
  throw new Error(
    "Missing GOOGLE_SERVICES_JSON. Configure it as a file-type environment variable in the EAS development environment."
  );
}

module.exports = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
};

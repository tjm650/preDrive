// Dynamic Expo config: EAS supplies GOOGLE_SERVICES_JSON as a secret file variable.
// Keep the local fallback for developers who have an ignored local google-services.json.
const { expo } = require("./app.json");

module.exports = {
  ...expo,
  android: {
    ...expo.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
};

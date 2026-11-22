"use strict";

// Verified against the public Partner Center "Glean / Product identity" page (2026-10-15).
// These are PUBLIC package identifiers, NOT a signing key or a GitHub Secret.
// Changing identity or AppID after the first Store publication breaks future package upgrades.
const STORE_IDENTITY = Object.freeze({
  identityName: "Glean.GleanNote",
  publisher: "CN=74C7CC89-20E0-4BEA-AD68-6A3238278EF3",
  publisherDisplayName: "Glean",
  applicationId: "GleanNote",
  storeId: "9MZ7Z6S39LL3",
});

// If CI variables or local environment are configured, reject any accidental drift.
function getVerifiedStoreIdentity(env = process.env) {
  const overrides = {
    identityName: env.GLEAN_STORE_IDENTITY_NAME,
    publisher: env.GLEAN_STORE_PUBLISHER,
    publisherDisplayName: env.GLEAN_STORE_PUBLISHER_DISPLAY_NAME,
    applicationId: env.GLEAN_STORE_APPLICATION_ID,
  };
  for (const [field, override] of Object.entries(overrides)) {
    if (override == null || String(override).trim() === "") continue;
    if (String(override).trim() !== STORE_IDENTITY[field]) {
      throw new Error("[Microsoft Store] " + field +
        " differs from the reserved Glean package identity in Partner Center.");
    }
  }
  return {
    identityName: STORE_IDENTITY.identityName,
    publisher: STORE_IDENTITY.publisher,
    publisherDisplayName: STORE_IDENTITY.publisherDisplayName,
    applicationId: STORE_IDENTITY.applicationId,
  };
}

module.exports = { STORE_IDENTITY, getVerifiedStoreIdentity };

/**
 * SSOService
 *
 * Handles GENIUS platform SSO token validation and NetsBlox credential derivation.
 *
 * Standalone mode:  no sso_token in URL → getSSOToken() returns null → app uses
 *                   the normal LoginView form, nothing here is called.
 *
 * GENIUS SSO mode:  GENIUS embeds this app with ?sso_token=<JWT> appended to the URL.
 *                   LoginView.mounted() detects the token and calls this service to
 *                   validate it and derive NetsBlox credentials, bypassing the form.
 *
 * Username mapping: email prefix (before @) when email is present, otherwise the
 *                   display name lowercased with spaces replaced by underscores.
 *                   NetsBlox accounts must be pre-created by the admin with the same
 *                   username and the password produced by deriveNetsBloxPassword().
 */

function _base64urlToBytes(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function _base64urlDecodeJSON(str) {
  return JSON.parse(new TextDecoder().decode(_base64urlToBytes(str)));
}

export default {
  /** Returns the raw sso_token query param from the current URL, or null. */
  getSSOToken() {
    return new URLSearchParams(window.location.search).get("sso_token");
  },

  /**
   * Validate a GENIUS SSO JWT (HS256) and return its decoded payload.
   * Throws on invalid signature, expiry, or wrong issuer.
   *
   * @param {string} token   Raw JWT string from the URL
   * @param {string} secret  Must match SSO_SECRET in the GENIUS express-server
   * @returns {Promise<Object>}
   */
  async validateToken(token, secret) {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("[SSO] Malformed JWT");
    const [headerB64, payloadB64, sigB64] = parts;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      _base64urlToBytes(sigB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) throw new Error("[SSO] Invalid token signature");

    const payload = _base64urlDecodeJSON(payloadB64);

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp)
      throw new Error("[SSO] Token expired");
    if (payload.iss !== "genius-learning-platform")
      throw new Error("[SSO] Unexpected issuer: " + payload.iss);

    return payload;
  },

  /**
   * Derive the NetsBlox username from the SSO payload.
   * Uses email prefix when available, otherwise sanitizes the display name.
   *
   * @param {Object} payload  Decoded SSO token payload
   * @returns {string}
   */
  netsBloxUsername(payload) {
    if (payload.email) return payload.email.split("@")[0];
    return payload.name.replace(/\s+/g, "_");
  },
};

// Cognito user-migration trigger: lets existing Firebase users sign in to Cognito with the
// password they already have. Cognito calls this only when the email is not yet in the pool.
// On success the user is created in Cognito and never reaches this code again.
// Remove this trigger once every active user has migrated.
const https = require("https");

const API_KEY = process.env.FIREBASE_WEB_API_KEY;

function firebase(method, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "identitytoolkit.googleapis.com",
        path: `/v1/accounts:${method}?key=${API_KEY}`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data || "{}") });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("firebase timeout")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const profile = (email) => ({
  email,
  email_verified: "true",
});

exports.handler = async (event) => {
  const email = String(event.userName || "").trim().toLowerCase();

  if (event.triggerSource === "UserMigration_Authentication") {
    const r = await firebase("signInWithPassword", {
      email,
      password: event.request.password,
      returnSecureToken: false,
    });
    if (r.status !== 200) {
      throw new Error("Bad credentials");
    }
    event.userName = email;
    event.response.userAttributes = profile(email);
    event.response.finalUserStatus = "CONFIRMED";
    event.response.messageAction = "SUPPRESS";
    return event;
  }

  if (event.triggerSource === "UserMigration_ForgotPassword") {
    const r = await firebase("createAuthUri", { identifier: email, continueUri: "https://missouristatelacrosse.com" });
    if (r.status !== 200 || r.body.registered !== true) {
      throw new Error("Unknown user");
    }
    event.userName = email;
    event.response.userAttributes = profile(email);
    event.response.messageAction = "SUPPRESS";
    return event;
  }

  throw new Error("Unsupported trigger");
};

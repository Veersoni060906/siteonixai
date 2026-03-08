const functions = require("firebase-functions");
const https = require("https");

exports.generate = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }

  const body = JSON.stringify(req.body);
  const apiKey = functions.config().anthropic.key;

  const options = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const proxy = https.request(options, upstream => {
    let data = "";
    upstream.on("data", chunk => data += chunk);
    upstream.on("end", () => res.status(upstream.statusCode).send(data));
  });

  proxy.write(body);
  proxy.end();
});
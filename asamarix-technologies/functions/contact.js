const inbox = "inquiries@asamarix.com";
const maxBodyBytes = 48 * 1024;
const fieldNames = ["kind", "name", "email", "person", "message", "cf-turnstile-response"];
const turnstileOrigin = "https://challenges.cloudflare.com";
const emailPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function headersForContact(enableForm = false, headers = new Headers()) {
  const base = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'";
  const csp = enableForm
    ? `${base}; form-action 'self'; script-src ${turnstileOrigin}; frame-src ${turnstileOrigin}`
    : `${base}; form-action 'none'`;

  headers.set("Content-Security-Policy", csp);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", enableForm ? "same-origin" : "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set("Cache-Control", "no-store");
  return headers;
}

function result(status, title, message) {
  // Only call with fixed strings. Submitted fields are never rendered here.
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | Asamarix Technologies</title>
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body>
  <main class="wrap page">
    <header class="page-heading">
      <h1>${title}</h1>
      <p class="lede">${message}</p>
    </header>
    <a class="button" href="/contact/">Back to contact</a>
  </main>
</body>
</html>`;
  const headers = headersForContact();
  headers.set("Content-Type", "text/html; charset=UTF-8");
  if (status === 405) headers.set("Allow", "GET, HEAD, POST");
  return new Response(body, { status, headers });
}

function configured(env, url) {
  const allowed = (env.CONTACT_ORIGINS || "").split(",").map((value) => value.trim());
  return allowed.includes(url.origin)
    && /^[A-Za-z0-9_-]{10,100}$/.test(env.TURNSTILE_SITE_KEY || "")
    && Boolean(env.TURNSTILE_SECRET && env.EMAIL_API_TOKEN)
    && /^[a-f0-9]{32}$/i.test(env.EMAIL_ACCOUNT_ID || "")
    && emailPattern.test(env.EMAIL_FROM || "");
}

async function showForm(context, enabled) {
  const asset = await context.next();
  if (asset.status !== 200) return asset;

  const headers = headersForContact(enabled, new Headers(asset.headers));
  headers.delete("Content-Length");
  headers.delete("ETag");
  const page = new Response(asset.body, { headers });
  if (!enabled || context.request.method === "HEAD") return page;

  return new HTMLRewriter()
    .on("#form-offline", { element(element) { element.remove(); } })
    .on("#contact-form", { element(element) { element.removeAttribute("hidden"); } })
    .on("#contact-fields", { element(element) { element.removeAttribute("disabled"); } })
    .on("#contact-challenge", {
      element(element) { element.setAttribute("data-sitekey", context.env.TURNSTILE_SITE_KEY); },
    })
    .on("head", {
      element(element) {
        element.append('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>', { html: true });
      },
    })
    .transform(page);
}

async function readBody(request) {
  const length = request.headers.get("Content-Length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBodyBytes)) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return body + decoder.decode();
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

function readFields(body) {
  const pairs = body.split("&");
  if (pairs.length !== fieldNames.length) return null;
  const values = new Map();
  const decode = (value) => decodeURIComponent(value.replace(/\+/g, " "));

  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator < 1) return null;
    const name = decode(pair.slice(0, separator));
    if (!fieldNames.includes(name) || values.has(name)) return null;
    values.set(name, decode(pair.slice(separator + 1)));
  }

  const kind = values.get("kind");
  const name = values.get("name").normalize("NFC");
  const person = values.get("person").normalize("NFC");
  const email = values.get("email");
  const message = values.get("message").replace(/\r\n?/g, "\n").normalize("NFC");
  const token = values.get("cf-turnstile-response");
  const singleLineControls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
  const messageControls = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u;

  if (!["company", "individual"].includes(kind)) return null;
  if ([name, person].some((value) => !value.trim() || value.length > 120 || singleLineControls.test(value))) return null;
  if (email.length > 254 || email.split("@")[0].length > 64 || singleLineControls.test(email) || !emailPattern.test(email)) return null;
  if (!message.trim() || message.length > 3000 || messageControls.test(message)) return null;
  if (!/^[A-Za-z0-9_.-]{1,2048}$/.test(token) || singleLineControls.test(token)) return null;
  return { kind, name: name.trim(), email, person: person.trim(), message: message.trim(), token };
}

async function postJson(url, data, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Provider rejected the request");
  }
  return response.json();
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const enabled = configured(env, url);

  if (request.method === "GET" || request.method === "HEAD") return showForm(context, enabled);
  if (request.method !== "POST") return result(405, "Method unavailable", "Open the contact page to send an inquiry.");
  if (!enabled) return result(503, "Form unavailable", "Please email contact@asamarix.com.");
  if (request.headers.get("Origin") !== url.origin) return result(403, "Request blocked", "Open the contact page and try again.");

  const contentType = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded" || request.headers.has("Content-Encoding")) {
    return result(415, "Unsupported submission", "Open the contact form and try again.");
  }

  let fields;
  try {
    const body = await readBody(request);
    if (body === null) return result(413, "Inquiry too large", "Shorten your message and try again.");
    fields = readFields(body);
  } catch {
    fields = null;
  }
  if (!fields) return result(400, "Check your details", "Use a valid email address and complete all fields and the security check.");

  try {
    const verification = await postJson(`${turnstileOrigin}/turnstile/v0/siteverify`, {
      secret: env.TURNSTILE_SECRET,
      response: fields.token,
    });
    if (verification.success !== true || verification.hostname !== url.hostname || verification.action !== "contact") {
      return result(403, "Security check failed", "Reopen the contact page and try again.");
    }

    const account = env.EMAIL_ACCOUNT_ID;
    const delivery = await postJson(`https://api.cloudflare.com/client/v4/accounts/${account}/email/sending/send`, {
      from: env.EMAIL_FROM,
      to: inbox,
      subject: "Asamarix website consultation inquiry",
      text: [
        `Inquiry type: ${fields.kind}`,
        `Company or individual: ${fields.name}`,
        `Contact email: ${fields.email}`,
        `Contact person: ${fields.person}`,
        "",
        fields.message,
      ].join("\n"),
    }, env.EMAIL_API_TOKEN);

    const accepted = delivery.result?.delivered?.includes(inbox) || delivery.result?.queued?.includes(inbox);
    if (delivery.success !== true || !accepted) throw new Error("Delivery was not accepted");
    return result(200, "Inquiry submitted", "Your inquiry was accepted for delivery. Thank you for contacting Asamarix.");
  } catch {
    return result(502, "Delivery could not be confirmed", "Please email contact@asamarix.com if you need to follow up.");
  }
}

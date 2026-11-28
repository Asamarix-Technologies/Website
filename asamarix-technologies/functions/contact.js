const inbox = "marinoozkaya@asamarix.com";
const maxBodyBytes = 48 * 1024;
const fieldNames = ["kind", "name", "email", "person", "service", "timeline", "message", "cf-turnstile-response"];
const services = new Map([
  ["penetration-testing", "Penetration testing"],
  ["defensive-security", "Defensive cybersecurity"],
  ["systems-administration", "Systems administration"],
  ["it-project-management", "IT project management"],
  // Keep accepting open forms from the previous release.
  ["security", "Cybersecurity consulting or assessment"],
  ["integration", "Systems integration"],
  ["automation", "Workflow automation"],
  ["unsure", "Other or unsure"],
]);
const timelines = new Map([
  ["", "Not specified"],
  ["within-month", "Within a month"],
  ["one-to-three", "In 1–3 months"],
  ["later", "In more than 3 months"],
  ["flexible", "Flexible or exploring options"],
]);
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
  const accountId = env.EMAIL_ACCOUNT_ID;
  const checks = {
    CONTACT_ORIGINS: allowed.includes(url.origin),
    TURNSTILE_SITE_KEY: /^[A-Za-z0-9_-]{10,100}$/.test(env.TURNSTILE_SITE_KEY || ""),
    TURNSTILE_SECRET: Boolean(env.TURNSTILE_SECRET),
    EMAIL_ACCOUNT_ID: typeof accountId === "string" && /^[a-f0-9]{32}$/i.test(accountId),
    EMAIL_FROM: emailPattern.test(env.EMAIL_FROM || ""),
    EMAIL_API_TOKEN: Boolean(env.EMAIL_API_TOKEN),
  };

  const failed = Object.keys(checks).filter((name) => !checks[name]);
  if (failed.length > 0) {
    console.warn("Contact configuration failed:", failed.join(", "));
  }
  if (!checks.EMAIL_ACCOUNT_ID) {
    console.warn("EMAIL_ACCOUNT_ID runtime check", {
      type: typeof accountId,
      length: typeof accountId === "string" ? accountId.length : null,
      valid: false,
    });
  }
  return failed.length === 0;
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
  const service = services.get(values.get("service"));
  const timeline = timelines.get(values.get("timeline"));
  const token = values.get("cf-turnstile-response");
  const singleLineControls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
  const messageControls = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u;

  if (!["company", "individual"].includes(kind)) return null;
  if (!service || !timeline || !person.trim()) return null;
  if ([name, person].some((value) => value.length > 120 || singleLineControls.test(value))) return null;
  if (email.length > 254 || email.split("@")[0].length > 64 || singleLineControls.test(email) || !emailPattern.test(email)) return null;
  if (!message.trim() || message.length > 3000 || messageControls.test(message)) return null;
  if (!/^[A-Za-z0-9_.-]{1,2048}$/.test(token) || singleLineControls.test(token)) return null;
  return { kind, name: name.trim(), email, person: person.trim(), service, timeline, message: message.trim(), token };
}

async function postJson(url, data, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const signal = AbortSignal.timeout(6000);
  const provider = new URL(url).hostname;
  console.info("Contact provider request starting", { provider });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    // Workers returns redirects without following them. The non-2xx check rejects them.
    redirect: "manual",
    signal,
  });
  console.info("Contact provider response received", {
    provider,
    status: response.status,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    console.warn("Contact provider rejected request", {
      provider,
      status: response.status,
      codes: Array.isArray(error?.errors)
        ? error.errors.map((item) => item?.code).filter(Number.isInteger)
        : [],
    });
    throw new Error("Provider rejected the request");
  }
  return response.json();
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const enabled = configured(env, url);

  if (request.method === "GET" || request.method === "HEAD") return showForm(context, enabled);
  if (request.method !== "POST") return result(405, "Method Unavailable", "Open the contact page to send an inquiry.");
  if (!enabled) return result(503, "Form Unavailable", "Please email contact@asamarix.com.");
  if (request.headers.get("Origin") !== url.origin) return result(403, "Request Blocked", "Open the contact page and try again.");

  const contentType = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded" || request.headers.has("Content-Encoding")) {
    return result(415, "Unsupported Submission", "Open the contact form and try again.");
  }

  let fields;
  try {
    const body = await readBody(request);
    if (body === null) return result(413, "Inquiry Too Large", "Shorten your message and try again.");
    fields = readFields(body);
  } catch {
    fields = null;
  }
  if (!fields) return result(400, "Check Your Details", "Use a valid email address and complete all fields and the security check.");

  let stage = "turnstile";
  try {
    const verification = await postJson(`${turnstileOrigin}/turnstile/v0/siteverify`, {
      secret: env.TURNSTILE_SECRET,
      response: fields.token,
    });
    if (verification.success !== true || verification.hostname !== url.hostname || verification.action !== "contact") {
      return result(403, "Security Check Failed", "Reopen the contact page and try again.");
    }

    stage = "email-request";
    const account = env.EMAIL_ACCOUNT_ID;
    const delivery = await postJson(`https://api.cloudflare.com/client/v4/accounts/${account}/email/sending/send`, {
      from: env.EMAIL_FROM,
      to: inbox,
      subject: "Asamarix website consultation inquiry",
      text: [
        `Inquiry type: ${fields.kind}`,
        `Organization: ${fields.name || "Not specified"}`,
        `Contact email: ${fields.email}`,
        `Contact person: ${fields.person}`,
        `Service area: ${fields.service}`,
        `Target kickoff: ${fields.timeline}`,
        "",
        fields.message,
      ].join("\n"),
    }, env.EMAIL_API_TOKEN);

    stage = "email-result";
    const accepted = delivery.result?.delivered?.includes(inbox) || delivery.result?.queued?.includes(inbox);
    if (delivery.success !== true || !accepted) throw new Error("Delivery was not accepted");
    return result(200, "Inquiry Submitted", "Your inquiry was accepted for delivery. Thank you for contacting Asamarix.");
  } catch (error) {
    console.warn("Contact submission failed", {
      stage,
      errorType: error instanceof Error ? error.name : "Unknown",
    });
    return result(502, "Delivery Could Not Be Confirmed", "Please email contact@asamarix.com if you need to follow up.");
  }
}

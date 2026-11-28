import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/contact.js";

const origin = "https://asamarix.example";
const inbox = "marinoozkaya@asamarix.com";
const env = {
  CONTACT_ORIGINS: origin,
  TURNSTILE_SITE_KEY: "example-site-key",
  TURNSTILE_SECRET: "test-only-secret",
  EMAIL_ACCOUNT_ID: "1".repeat(32),
  EMAIL_FROM: "website@asamarix.example",
  EMAIL_API_TOKEN: "test-only-api-token",
};
const fields = {
  kind: "company",
  name: "Example Logistics",
  person: "Test Contact",
  email: "test@example.com",
  service: "penetration-testing",
  timeline: "",
  message: "Please tell us about a scoped assessment.",
  "cf-turnstile-response": "test-token",
};

function submit({ body = new URLSearchParams(fields), headers = {} } = {}) {
  const request = new Request(origin + "/contact/", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body,
  });
  return onRequest({ request, env });
}

function mockProviders(t, options = {}) {
  return t.mock.method(globalThis, "fetch", async (url) => {
    if (new URL(url).hostname === "challenges.cloudflare.com") {
      return Response.json({
        success: true,
        hostname: new URL(origin).hostname,
        action: "contact",
        ...options.verification,
      });
    }
    assert.equal(new URL(url).hostname, "api.cloudflare.com");
    if (options.emailFailure) return Response.json({ success: false }, { status: 503 });
    return Response.json({ success: true, result: { queued: [inbox] } });
  });
}

test("accepts the current dropdown choices and the previous cybersecurity choice", async (t) => {
  const fetch = mockProviders(t);
  const choices = new Map([
    ["penetration-testing", "Penetration testing"],
    ["defensive-security", "Defensive cybersecurity"],
    ["systems-administration", "Systems administration"],
    ["it-project-management", "IT project management"],
    ["integration", "Systems integration"],
    ["automation", "Workflow automation"],
    ["unsure", "Other or unsure"],
    ["security", "Cybersecurity consulting or assessment"],
  ]);
  for (const [service, label] of choices) {
    const response = await submit({ body: new URLSearchParams({ ...fields, service }) });
    assert.equal(response.status, 200, service);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await response.text(), /Example Logistics/);
    const args = fetch.mock.calls.at(-1).arguments;
    const email = JSON.parse(args[1].body);
    assert.equal(email.to, inbox);
    assert.equal(email.html, undefined);
    assert.ok(email.text.includes("Service area: " + label + "\n"));
  }
  assert.equal(fetch.mock.callCount(), choices.size * 2);
});

test("rejects invalid requests before contacting providers", async (t) => {
  const fetch = mockProviders(t);
  const cases = [
    [{ headers: { Origin: "https://other.example" } }, 403],
    [{ headers: { "Content-Type": "application/json" } }, 415],
    [{ body: "a".repeat(48 * 1024 + 1) }, 413],
    [{ body: new URLSearchParams({ ...fields, service: "unknown" }) }, 400],
    [{ body: new URLSearchParams({ ...fields, timeline: "unknown" }) }, 400],
    [{ body: new URLSearchParams({ ...fields, email: "no-at-sign" }) }, 400],
    [{ body: new URLSearchParams({ ...fields, message: "" }) }, 400],
    [{ body: new URLSearchParams({ ...fields, extra: "unexpected" }) }, 400],
    [{ body: new URLSearchParams(fields).toString() + "&name=second" }, 400],
  ];
  for (const [request, status] of cases) {
    assert.equal((await submit(request)).status, status);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("rejects a failed Turnstile check, a different hostname, or a different action", async (t) => {
  for (const verification of [{ success: false }, { hostname: "other.example" }, { action: "other" }]) {
    await t.test(JSON.stringify(verification), async (subtest) => {
      const fetch = mockProviders(subtest, { verification });
      assert.equal((await submit()).status, 403);
      assert.equal(fetch.mock.callCount(), 1);
    });
  }
});

test("reports an email provider error without echoing inquiry details", async (t) => {
  mockProviders(t, { emailFailure: true });
  const response = await submit();
  assert.equal(response.status, 502);
  assert.match(await response.text(), /Delivery Could Not Be Confirmed/);
});

test("keeps the static email fallback on hosts outside the allowlist", async (t) => {
  const fetch = mockProviders(t);
  const request = new Request("https://preview.example/contact/");
  const response = await onRequest({
    request,
    env,
    next: () => new Response('<p id="form-offline">Use email instead.</p>'),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /form-action 'none'/);
  assert.match(await response.text(), /Use email instead/);
  assert.equal(fetch.mock.callCount(), 0);
});

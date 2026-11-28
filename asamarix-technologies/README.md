# Asamarix Technologies website

Beta V1.21. The public site uses static HTML and CSS. A Cloudflare Pages Function handles the contact form and validates Turnstile before submitting plain-text email through Cloudflare Email Sending.

## Repository layout

| Path | Purpose |
| --- | --- |
| `public/` | Deployable pages, assets, security headers and routing configuration |
| `public/deliverables/` | Browser-openable PDFs linked from Services and Projects |
| `docs/` | Editable report content and the PDF generator |
| `functions/contact.js` | Contact page activation, submission validation and delivery |
| `tests/contact.test.mjs` | Local contact regression tests with mocked providers |

## Local preview and tests

From the repository root, start a static preview and open [http://127.0.0.1:8000/](http://127.0.0.1:8000/).

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory public
```

The static server shows the contact email fallback. Test the live form on a Cloudflare Pages deployment configured for that host.

Run the contact regression tests with Node.js 22 or newer. The tests use synthetic data and mock all provider calls.

```sh
node --test tests/contact.test.mjs
```

## Deploy Beta V1.21

1. Merge the archive contents into the existing repository root on the preview branch. Commit the changes and push the branch. Use `public` as the Pages build output and keep `functions/` at the repo root.
2. Review Services, Projects, About and Contact on preview. Open the PDFs and confirm the browser viewer loads them. Cloudflare Pages serves them inline and redirects the old `/projects/sample-assessment/` URL to the new PDF. If you are merging the ZIP into an existing checkout, remove the obsolete `public/projects/sample-assessment/index.html` from that checkout. Check the site at phone width and with keyboard navigation. Confirm the services dropdown includes penetration testing, defensive cybersecurity, systems administration and IT project management.
3. Before publishing the About page, verify the active OSCP+ designation, KLCP, the Vault Breach role, and the exact degree names. Confirm the M.S. status is current. Add official badge URLs when available. Restore PenTest+, Oracle SQL, the doctorate, the cybersecurity management degree and the Temple degree only once their exact names and statuses are confirmed. List any current studies separately from awarded credentials.
4. Merge the reviewed commit to the production branch. Check the home, contact and missing-page responses on `https://asamarix.com`. Home should serve the static CSP, contact should serve its Turnstile-specific CSP and `Cache-Control: no-store`, and the unknown path should return 404. Confirm production is indexable and links in public profiles point to the production domain.
5. Submit one ordinary inquiry on production and confirm receipt in the form’s configured destination. Separately send an email to `contact@asamarix.com` to verify the public email path. The form sends to the internal inbox defined in `functions/contact.js`; the public address is shown on the Contact page.

## Cloudflare settings

Under **Workers & Pages → the Pages project → Settings → Variables and Secrets**, review the settings for Production and Preview independently. Redeploy after changing them. Keep all secrets out of Git.

| Setting | Purpose |
| --- | --- |
| `CONTACT_ORIGINS` | Exact HTTPS origins, comma-separated with no trailing slash. Use `https://asamarix.com` for production unless another production hostname should intentionally accept inquiries. |
| `TURNSTILE_SITE_KEY` | Site key for the managed widget configured for that environment’s hostnames. |
| `TURNSTILE_SECRET` | Encrypted secret for the same widget. Use a separate widget for preview, with pre-clearance off. |
| `EMAIL_ACCOUNT_ID` | Account ID for the Cloudflare account with Email Sending configured. |
| `EMAIL_FROM` | Sender on the verified sending domain. |
| `EMAIL_API_TOKEN` | Encrypted, account-scoped Email Sending token with only the required sending permission. Use a separate token for preview if email preview testing is needed. |

If you want dev to be private, enable the Pages preview access policy and verify the branch alias and a deployment-specific URL while signed out. If preview only needs visual review, omit its contact credentials and use the fallback. Verify that the production `pages.dev` alias or other unintended hosts are excluded from the form origin allowlist. See [Cloudflare preview access](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

For abuse protection, create a zone-level WAF rate limiting rule on the production domain if your plan supports the needed match fields. Scope the rule to the production hostname and `/contact` and `/contact/` paths, and to POST when the method field is available. Use per-IP counting, choose a threshold supported by your plan, and check Security Events after rollout so you can adjust it for legitimate traffic. If the available match fields would also throttle normal page views, review that impact before enabling the rule. See [Cloudflare rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/).

The contact page describes what is collected and how inquiries are routed. Keep that note aligned with actual handling and access to the inbox.

## Reusing the Report Template

The PDF named **Asamarix.com Pentest Report** is a hypothetical web application report. Its editable source is the first entry in `docs/deliverables.json`. To reuse the structure for a future authorized assessment, duplicate that entry, choose a unique filename, and fill in the engagement record, approved scope and exclusions, coverage, findings, evidence references, impact, remediation and retest criteria. Record actual results separately from planned work. Keep client evidence and any non-public report sources outside this public repository.

The PDFs are already included in the release. To regenerate public examples locally, edit `docs/deliverables.json` and run the following from the repo root. ReportLab is required only for authoring PDFs. Cloudflare needs no PDF build step.

```sh
python -m pip install reportlab
python docs/build_deliverables.py
```

## Future Projects

The sample report uses fictional findings and synthetic context. Add any carrier integration reliability demo as a separate project, then link its case study from the site when it is ready.

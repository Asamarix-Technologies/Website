# Asamarix Technologies website

Beta V1.22. The public site uses static HTML and CSS. A Cloudflare Pages Function handles the contact form and validates Turnstile before submitting plain-text email through Cloudflare Email Sending.

## Repository layout

| Path | Purpose |
| --- | --- |
| `public/` | Deployable pages, assets, security headers and routing configuration |
| `public/deliverables/` | Browser-openable PDFs linked from Services and Projects |
| `docs/templates/` | Nine editable Word templates for engagement work |
| `docs/deliverables.json` | Source content for the nine public examples |
| `docs/build_deliverables.py` | Local PDF generator |
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

## Deploy Beta V1.22

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

## Using the Engagement Templates

Each PDF under `public/deliverables/` has a corresponding editable Word file in `docs/templates/`. The filenames share a stem. Open the PDF to see a completed fictional example and make a copy of the matching DOCX in the authorized engagement workspace. The Word files are separate working masters, with document control, bracketed instructions, editable tables and approval fields. Only the PDFs are linked from the website. A public GitHub repository also exposes the files under `docs/`, so keep completed client work and supporting evidence in private engagement storage.

1. Record the client, engagement ID, scope, timeframe, audience and reviewers. For an assessment, identify the written authorization and approved activities. Replace the bracketed prompts and remove drafting instructions before issue.
2. In a pentest report, duplicate the finding page for each issue. Assign stable IDs to findings and evidence. Document the business consequence, assumptions and limits for each result. Tie each finding to a treatment owner, deadline, acceptance condition and independent retest.
3. For defensive work, start with the risk register. Put named accountable owners and measurable exit criteria in the schedule. Record the evidence reference, residual risk and approval or exception expiry before closure.
4. The other three templates are designed for use during delivery. Use the maintenance runbook to set the last safe rollback time, the cutover plan to assign go/no-go authority, and the interface specification to agree on replay, reconciliation and acceptance behavior.
5. Export the reviewed copy to PDF, then verify page breaks, references, handling labels and recipient list. Record the issue date, version and approval in the private engagement record.

### Interpreting the Example Scores

| Measure | How the examples use it |
| --- | --- |
| CVSS v3.1 Base | Technical severity on a 0–10 scale. The record identifies the vector and whether the score comes from NVD or the sample analyst. Version 3.1 matches the published vectors selected for these examples. Record the version used in a new engagement. |
| CVE | Use a published identifier only after checking vendor, product, build, configuration and backport status. A bespoke access-control gap can have a severity rating without an assigned CVE. |
| EPSS | FIRST’s estimate of the probability that a published CVE will see exploitation activity in the wild during the next 30 days. The examples freeze the **1 January 2025** data for reproducibility. Retrieve and date a fresh value for each engagement. |
| Engagement risk | Estimate the likelihood of a specified material impact to this organization over 90 days. The examples use illustrative bands of below 10%, 10–40% inclusive and above 40%. Multiply the likelihood tier (1–3) by business impact (1–3). Products of 1–2 are Low, 3–4 Moderate, 6 High and 9 Critical. Record the assumptions and evidence quality. |

Each security example links its framework choices to a finding or decision. MITRE CWE identifies weakness classes, ATT&CK describes relevant behaviors, OWASP supplies an applicable category and edition, and PTES informs the executive and technical reporting structure. The watermark identifies the original Asamarix report material. The underlying standards and third-party advisory material retain their respective attribution.

### Updating the Published Examples

Edit the corresponding entry in `docs/deliverables.json`. Each entry supplies a stable filename and an ordered list of pages. Page blocks support narrative, notes, metric summaries, tables, reference links, bar charts and milestones. Keep the public label and synthetic evidence on website examples. The Word templates can be edited directly and have their own layout.

From the repo root, run the commands below to rebuild the PDFs. ReportLab is a local authoring dependency. The repository already contains the finished PDFs for Cloudflare Pages.

```sh
python -m pip install reportlab
python docs/build_deliverables.py
```

Open the regenerated files before committing. Review the longest finding, chart labels, source links and printed page numbers. If content no longer fits, split the section into another page in the source.
 
## Future Projects

The sample report uses fictional findings and synthetic context. Add any carrier integration reliability demo as a separate project, then link its case study from the site when it is ready.

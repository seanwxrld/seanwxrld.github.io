# Backstage setup and release

This branch adds a real Firebase-backed admin dashboard, guest request cart, member accounts, live product catalogue, contact inbox and branded newsletter tools to the existing GitHub Pages site. It does not deploy Firebase or publish the branch automatically.

## What is included

- `/admin/`: private admin sign-in, overview, old and new requests, statuses, product creation/editing, availability controls, image uploads, newsletter contacts, CSV export, contact messages, email drafts/preview/HTML export/test/scheduled queue.
- `/cart/`: multiple products/options, quantities, local persistence, optional account sync and one request containing all selections.
- `/account/`: sign-up/sign-in, password reset, email verification, account-linked request history and newsletter preferences.
- Existing product detail URLs and collection layouts use the live catalogue; `/shop/product/?id=...` works for newly created products.
- Server-authoritative prices and availability, bounded request input, rate limits, idempotent request submission, admin-only functions and deny-by-default database rules.

Request checkout remains a personal availability/shipping enquiry, not a payment flow. Stock is checked but not reserved/deducted on submission. Update stock as fulfilment is confirmed. Current catalogue prices are preserved in USD ($30 shirts, $8 CD).

## Required owner setup

Use Node 22 and an authenticated Firebase CLI account that can manage **sean-mosikili-official-website**. Never commit service-account files, private keys or sending API keys. The browser's existing Firebase config is a public project identifier, not admin authorization.

1. In Firebase Authentication, enable Email/Password and add `seanwxrld.com` and `seanwxrld.github.io` to authorized domains. Add `localhost` only if needed for local integration checks. Create your own admin user through Firebase Console, or through `/account/` after the branch is available in a private preview.
2. Use Google Application Default Credentials locally for the one-time scripts (`gcloud auth application-default login`). Copy your Firebase Authentication UID and run:

   ```sh
   npm ci
   npm ci --prefix functions
   node functions/setup-admin.js YOUR_FIREBASE_AUTH_UID
   node functions/seed-products.js
   ```

   The admin script preserves other claims and adds `admin: true`. Sign out and back in after granting the role. It does not use a client-side email allowlist or give newly registered members any admin access. The catalogue script only creates missing products and preserves existing edits. All three original products start with availability requests open, as on the existing site.

3. Enable Cloud Functions (a billing-enabled Firebase plan is required). Enable Firebase Storage if using image uploads. Existing `/assets/` paths and HTTPS image URLs work without uploading.
4. Before publishing, compare the included Firestore and Storage rules with your **currently deployed rules**. This repository previously had no rules files, so the current remote rules and any other apps/collections are unknown. The new rules close direct client writes to requests, newsletter records, messages and products; those writes go through validated functions. Merge any unrelated rules you legitimately need instead of blindly removing them.
5. Set up a verified sending domain in Resend. Store the API key and a long random unsubscribe-signing secret using Secret Manager:

   ```sh
   npx firebase functions:secrets:set RESEND_API_KEY
   npx firebase functions:secrets:set UNSUBSCRIBE_SECRET
   ```

   Enter the values in the CLI prompts, never into source files. Keep the unsubscribe secret stable so existing unsubscribe links remain valid.
6. Copy `functions/.env.example` to `functions/.env.sean-mosikili-official-website` (ignored by Git). Set `MAIL_FROM` to the verified sender and `MAIL_ADDRESS` to your actual business postal address. The example address is a placeholder. Do not queue mail until the sender, domain authentication and recipient-consent review are complete.
7. Deploy backend code and rules during a coordinated release:

   ```sh
   npx firebase deploy --only functions,firestore:rules,storage
   ```

   This command does **not** deploy the website to Firebase Hosting. Keep the existing GitHub Pages hosting. Deploying the new rules before the new website briefly prevents old direct-write forms from submitting; publishing the new website before functions deploy leaves those new forms unavailable. Coordinate the cutover, or use a short maintenance window. Preserve a copy of prior rules for rollback.
8. Verify all live gates below, then merge the reviewed pull request to publish the GitHub Pages changes.

If email delivery is being enabled later, deploy only the non-email functions initially and leave the newsletter send controls unused; draft/preview/export remain available. The test-send and delivery functions require their secrets to deploy. The scheduled worker can incur scheduler/function usage even when there is no mail to send.

## Newsletter behaviour

- Contact submissions and product requests are never added to the mailing list automatically.
- New signup forms have an explicit consent checkbox. Legacy `newsletter_signups` records are shown but excluded from sends unless their consent is verified and they have `consent: true, status: "subscribed"`. Review old signup sources before any migration; do not bulk mark them consented without evidence.
- An unsubscribe adds an email-hash suppression record checked again at send time, including duplicate legacy signup records. A public signup cannot silently resubscribe a suppressed address. A verified member can opt back in.
- HTML export contains `{{unsubscribe_url}}`. A delivery service must replace it; exporting a file does not send mail. Custom HTML must include that placeholder. The browser preview is sandboxed.
- Test emails go only to the signed-in admin's verified email. Queuing requires an explicit review action in the dashboard. No campaigns have been sent by this implementation work.
- One scheduled worker processes one due campaign at a time, up to 30 subscriber records per minute. Duplicate addresses, nonconsenting records and suppressions are skipped. Delivery calls use provider idempotency keys and persisted receipts. If retry ambiguity exceeds 23 hours, the campaign moves to `needs_review` rather than risking duplicate delivery outside the provider retry window. Inspect its private `deliveries` subcollection and Resend logs before manually restarting anything.
- "Accepted by email service" is not confirmed inbox delivery. This initial version does not display open/click analytics, bounce webhooks or automatic order-status emails. Monitor bounces/complaints in Resend and suppress contacts as needed.
- Cancellation stops remaining sends, but an in-flight or already sent email cannot be recalled.

## Data/access notes

Products use stable document IDs. Members can read only requests whose `userId` is their authenticated UID. Guest and historical requests remain admin-only; they are not attached to accounts merely because an email matches. No historical customer data is migrated or deleted by the code changes.

The rate-limit collection has `expiresAt` timestamps. Configure a Firestore TTL policy on `rate_limits.expiresAt` to clean up expired buckets. This release implements server rate limits, but Firebase App Check is not configured; consider it if public form abuse becomes a problem.

Product images accept JPEG/PNG/WebP under 5 MB. They are public assets stored under `product-images/`; updates/deletes are denied and uploads use fresh random names. Nothing uploads to the existing assets folder automatically.

The current site still has its existing client-side store-preview password mechanism. It is a presentation gate, not protection for customer information; Firebase rules and admin claims protect the dashboard data.

## Validation

Local checks:

```sh
npm test
# Java 21+ is required for the Firestore emulator:
npm run test:rules
# Browser test starts a temporary local server itself:
npx playwright install chromium --only-shell
node tests/browser.mjs
```

Browser tests deliberately replace Firebase modules with fixtures; they verify UI behaviour without accessing production or sending mail. The rule tests use a `demo-` project in the emulator. They do not verify production configuration.

Before calling this live-ready, verify with the actual Firebase project:

- An ordinary/anonymous user cannot read newsletter contacts, other members' requests, hidden products or the admin dashboard data.
- Admin authentication, all collections and product image uploads work.
- The catalogue has been seeded; product edits reach existing store pages and the new product route.
- Guest request, contact and consent signup submissions save; account signup/reset/verification work; a signed-in request appears only in that member's history.
- Resend domain and secrets work; send an explicitly authorized test to yourself, inspect it on mobile and desktop, and test its unsubscribe link before sending a campaign.
- Confirm current Firebase rules, billing, authorized domains and deployed function health. Those production settings cannot be verified through repository access alone.

## Reference documentation

- [Firebase callable functions](https://firebase.google.com/docs/functions/callable)
- [Firebase custom admin claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase function parameters and secrets](https://firebase.google.com/docs/functions/config-env)
- [Resend email sending API](https://resend.com/docs/api-reference/emails/send-email)

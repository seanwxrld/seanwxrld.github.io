# Website content in Backstage

Open `/admin/` on your phone or desktop and sign in with your existing admin account.

- **Website** opens homepage, releases, tour dates, visuals, page copy and artist/social settings. Choose one section, then a record to edit. Save publishes the change immediately.
- **Store** keeps the existing products, prices, stock and availability tools. “Edit store page” changes the public store introduction.
- **Requests**, **People & messages**, **Newsletter** and **Insights** remain separate workspaces. Backstage returns to the task chooser instead of displaying a permanent tab bar.
- Existing artwork can be selected from a list; new artwork can use an HTTPS image URL. Uploading new files still requires a configured image host. No paid image service is enabled by this change.
- Set a release or show to **Hidden** to retain it in Backstage without publishing it. Past tour dates move to the past-performance list. Hiding a product uses the existing product controls.
- A save checks whether the section changed on another device. Conflicting saves retain your unsaved input and ask you to reload rather than overwrite the other edit.

## One-time Firebase update

The existing admin custom claim is reused. Customer, newsletter and product permissions are unchanged. The two new collections are:

- `site_content_private`: admin-only editable records, including hidden entries.
- `site_content`: the public version with hidden entries removed.

After reviewing the rules against the currently deployed project, publish the included rules from an authenticated owner checkout:

```sh
npm ci
npx firebase deploy --only firestore:rules --project sean-mosikili-official-website
```

Alternatively merge the `validContent`, `site_content` and `site_content_private` blocks from `firestore.rules` into the existing Firebase Console rules. Do not remove rules for any unrelated applications.

No Cloud Functions, new billing plan, data migration, or admin-role changes are needed for content editing. Editors stay disabled with a clear message until the rules permit access. The existing store/request tools continue using their existing collections.

## Static fallbacks and schema

`app/content-data.js` is the bundled initial content. `npm run build:content` renders it into HTML and JSON-LD for first load and network failures. Public pages then subscribe to published content; visible content and structured data update together. Changes from Backstage do not commit to GitHub. If Firestore is unavailable at first load, the bundled content is shown; it can be older than the last remote edit. Keep bundled defaults current during future code releases.

The artist identity, music catalogue, public social profiles and existing release anchors remain connected. Monaco is present, the original album is in the archive, and the Deluxe announcement is dated 30 October 2026. Unknown artwork, listening URLs, tracklists and event start times have not been invented.

## Checks

```sh
npm test
npm run test:content
# Requires Java 21 or newer:
npm run test:rules
```

The content UI tests execute the actual admin modules against a simulated DOM and an isolated Firebase fixture. They never read customer data, publish content to production, or send emails. `docs/responsive-preview.html` provides phone and tablet frames for reviewing the public pages.

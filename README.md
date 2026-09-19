# seanwxrld.com

Official SĒAN MOSIKILI website, hosted on GitHub Pages.

Backstage admin, cart requests, member accounts and newsletters use Firebase. See [setup and release instructions](docs/BACKSTAGE-SETUP.md) before publishing the dashboard branch.

Run `npm test`, `npm run test:rules` (Java 21+), and `npm run test:browser` (Playwright Chromium installed). Browser tests use sample fixtures and never call the production database or email service.

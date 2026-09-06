# Cristina Lalinde portfolio

A standalone reproduction of the live [cristinalalinde.com](https://www.cristinalalinde.com/) portfolio captured on September 6, 2026. It preserves the original content, typography, colors, spacing, responsive image order, animated GIFs, and scrolling headings. Images, fonts, and styles are served locally; the app does not depend on Squarespace or a CDN at runtime.

## Run

Requires Node.js 22 or newer. No package installation or build step is required to run the app.

```sh
npm start
```

Open **http://localhost:3000**. For automatic server restarts during development:

```sh
npm run dev
```

You can set `PORT` and `HOST`, for example `PORT=4000 npm start`.

## Contact form

The form validates submissions and displays the original “Thank you!” message after the Node server saves them to `data/messages.jsonl`. Each line is a JSON object with the email, subject, message, ID, and timestamp. This directory is excluded from Git and is not publicly served.

**Email delivery is not connected.** Submissions are saved locally. To send them to an inbox, connect an email provider in the `/api/contact` handler in `server.js`.

## Files

- `public/index.html`: page content and original layout markup.
- `public/assets/`: original images, GIFs, fonts, favicon, and stylesheets.
- `public/app.js`: scrolling headings, navigation keyboard support, and contact form behavior.
- `public/app.css`: local interaction and accessibility styles.
- `server.js`: dependency-free Node HTTP server and contact storage.
- `reference/`: source captures and desktop/mobile layout measurements.

## Verification

```sh
npm test
npm install
npm run test:browser
```

The browser check requires Google Chrome. It verifies four screen sizes, image loading, animations, reduced motion, local contact submission, browser errors, and the absence of external network requests. Screenshots and layout comparisons are written to `test-results/`.

`node scripts/compare-contact.mjs` compares the contact section directly against the live site. The desktop (1440px) and mobile (390px) contact screenshots were byte-for-byte identical in the completed verification. The whole page's measured layout matched the saved reference within one pixel at both sizes.

The scripts in `scripts/inspect-reference.mjs` and `scripts/create-local-page.mjs` document the capture and conversion process. They are not needed to run or edit the app.

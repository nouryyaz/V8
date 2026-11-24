# Mateology Play Society Website

Static website for sensory play sessions and play kits, with a booking calendar that syncs with Google Calendar.

## How bookings work
- You add sessions in a Google Calendar. The Sessions page reads it.
- Parents book on the Sessions page. Bookings are saved to a Google Sheet, emailed to the parent and to you, and counted against the session's capacity.
- Setup guide: SETUP-GOOGLE-BOOKING.md (about 20 minutes, one time).
- Until setup is done, the Sessions page shows a preview from data/sessions.json with booking switched off.

## Files
- index.html, sessions.html, shop.html: the pages
- style.css: all styling
- booking.js: the calendar and booking form on the Sessions page
- config.js: where you paste your Google web app URL
- app.js: builds the shop from data/products.json
- google-apps-script/Code.gs: the Google script to paste into your Google Sheet
- data/products.json: shop products. Paste in your Stripe Payment Links.
- data/sessions.json: preview sessions, used only until Google booking is connected
- images/: photos, with sources and licence notes in CREDITS.txt

## Updating products
Edit data/products.json. Paste in the Stripe Payment Link for each product.

## Hosting
GitHub Pages: Settings, Pages, main branch, root folder.

## Coming next
Admin page for products, plus customer accounts and saved orders.

## Animation and 3D layer (v3)

- `fun.css` and `motion.js` add the floating balloons and clouds, the tumbling 3D letter blocks on the home page, the pop-out hover on cards, buttons and photos, and the scroll pop-in.
- Each page links `fun.css` after `style.css` and loads `motion.js` last. To remove all the fun, delete those two lines from each page.
- Everything is drawn in code, so there are no extra images. People who have "reduce motion" switched on get a calm, still version.

## Scroll-through story (v4)

- `index.html` is now a scrolling story: hero, a pinned "Touch / Pour / Squish" chapter, sliding words, a trail that draws itself, kits that slide sideways, and a finale.
- `story.css` and `story.js` add that, plus the floating menu, the paint progress bar and the bubble cursor. They are linked on every page.
- The kits on the home page come from `data/products.json`, so editing a product there updates the shop and the story.
- Phones get a simpler version: the kits become a swipeable row. People with "reduce motion" switched on get no moving bubbles, cursor or drifting words.

## Glass look (v5)

- `glass.css` gives every page frosted, see-through surfaces (menu, cards, calendar, booking form, buttons, footer, 3D blocks) over soft colour glows. It is linked last on every page.
- To go back to the solid look, remove the `glass.css` line from the three pages.
- Older browsers without frosted-glass support automatically get a calmer, more solid version.

## Mateology Play Society (v8)

- The site is branded Mateology Play Society. The logo is `images/logo.png` (transparent) and `images/icon.png` (browser tab and phone icon). The logo sits in the menu, the finale and the footer on every page.
- The organisation name used in emails and the booking form is set in `google-apps-script/Code.gs` (`BUSINESS_NAME`).

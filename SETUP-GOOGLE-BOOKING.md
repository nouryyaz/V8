# Set up the booking calendar (about 20 minutes, one time)

Your Google Calendar becomes the place where you add sessions. The website reads it, parents book on the Sessions page, and every booking is saved to a Google Sheet and emailed to you and the parent. No other services, and no cost.

You need: the Google account you want to run this from.

## 1. Make a calendar for your sessions
1. Open Google Calendar on a computer.
2. On the left, next to "Other calendars", click **+** then **Create new calendar**.
3. Name it **Mateology Play Sessions** and click **Create calendar**.
4. Open the new calendar's **Settings**, scroll to **Integrate calendar**, and copy the **Calendar ID** (it looks like `abc123@group.calendar.google.com`). Keep it for step 3.

The calendar stays private. You do not need to make it public.

## 2. Make a Google Sheet for bookings
1. Go to sheets.google.com and create a blank sheet named **Mateology Bookings**.
2. Keep this sheet private. It will hold parents' names, emails and phone numbers.

## 3. Add the script
1. In the sheet, click **Extensions**, then **Apps Script**.
2. Delete the code that is already there.
3. Open the file `google-apps-script/Code.gs` from the website folder, copy everything, and paste it in.
4. At the top, edit the CONFIG block:
   - `OWNER_EMAIL`: your email. Booking alerts come here, and parents' replies go here.
   - `CALENDAR_ID`: paste the Calendar ID from step 1.
   - `BUSINESS_NAME`, `DEFAULT_CAPACITY` and `DAYS_AHEAD`: change if you like.
5. Click the **Save** icon.

## 4. Run the one-time setup
1. In the toolbar, pick **setup** in the function dropdown, then click **Run**.
2. Google asks for permission. Click **Review permissions**, choose your account, then **Advanced**, then **Go to (project name) (unsafe)**, then **Allow**. The warning appears because you wrote the script yourself and it has not been through Google's review. It only runs on your account.
3. When it finishes, your sheet has a **Bookings** tab with headings.

## 5. Publish it
1. Click **Deploy**, then **New deployment**.
2. Click the gear icon and choose **Web app**.
3. Set **Execute as** to **Me** and **Who has access** to **Anyone**.
4. Click **Deploy** and copy the **Web app URL**.

## 6. Connect the website
1. Open `config.js` in the website folder.
2. Paste the URL between the quotes: `const BOOKING_API_URL = "https://script.google.com/macros/s/.../exec";`
3. Upload `config.js` to your GitHub repo.

## 7. Add your first session
In your **Mateology Play Sessions** calendar, create an event:
- **Title:** for example `Mateology Play Session`
- **Date and time:** the session time
- **Location:** the venue and address, for example `Merrylands Community Centre, Merrylands NSW`
- **Description:** one detail per line, like this:

```
capacity: 20
price: $15 per child
ages: 1 to 5 years
```

Only `capacity` is needed for booking. The other lines are optional. Any other text in the description shows on the website as a short note.

Optional lines:
- `pay: https://buy.stripe.com/...` adds a **Pay now** button after booking. Create a Stripe Payment Link that lets the customer choose the quantity, so they can pay for each child.
- `status: potential` shows the day in yellow as "pencilled in", with no booking. You can also put **TBC** in the title. When the venue is confirmed, remove that line or word and the session opens for booking.

Sessions show on the website within about a minute.

## 8. Test it
1. Open your Sessions page. The session should show as a green day.
2. Book it with your own email.
3. You should get a confirmation email, an alert email, a new row in the **Bookings** tab, and a line such as `Booked: 1 of 20` at the bottom of the event description in Google Calendar.

## Running it day to day
- **Add or move a session:** edit the Google Calendar. This works well on your phone.
- **Cancel a booking:** in the Bookings tab, change **Status** to `cancelled`. The spots free up within a minute. Email the parent yourself.
- **Parents' emails:** they come from your Google account. Replies come to `OWNER_EMAIL`.
- **If you move a session's date or time:** parents who booked are not told automatically. Use the emails in the sheet to let them know.
- **Don't edit the `Booked:` line** in the event description. The script rewrites it.
- **Edit the script later:** after changes, click **Deploy**, then **Manage deployments**, then the pencil icon, choose **New version**, and click **Deploy**. The URL stays the same.

## Good to know
- **Email limits:** each booking sends 2 emails. A free Gmail account can send about 100 a day, and Google Workspace about 1,500.
- **Overbooking:** the script handles one booking at a time, so two parents can't take the same last spot.
- **Privacy:** the form asks for parents' contact details and, optionally, children's first names, ages and allergies. Keep the sheet private, only collect what you need, and put a privacy policy on the website before you launch. Australian privacy law applies. I'm not a lawyer, so check with one.
- **Sessions don't load?** Check the URL in `config.js`, and that **Who has access** is **Anyone**. After changing the script, deploy a new version.

# Setting up "Save to class" (about 10 minutes, once)

1. In Google Drive (your CPS account), create a new **Google Sheet**. Name it e.g. `Walk Studio saves`.
2. In the sheet: **Extensions → Apps Script**.
3. Delete the starter code, paste in everything from `Code.gs`, and click **Save** (💾).
4. Click **Deploy → New deployment**.
   - Gear icon → **Web app**
   - Description: `Walk Studio`
   - Execute as: **Me**
   - Who has access: **Anyone** (if CPS doesn't offer this, choose **Anyone within Chicago Public Schools**, see note below)
5. Click **Deploy**, approve the permissions prompt, and copy the **Web app URL** (ends in `/exec`).
6. Open that URL in a browser. You should see `{"ok":true,"service":"walk-studio",...}`.
7. Paste the URL into `config.js` as `sheetUrl: '...'` and publish the site. The **Save to class** button appears.

**Collecting:** File → Download → Comma-separated values (.csv) on the Saves tab, drop the CSV into your collect
inbox with any downloaded files / pasted codes, and run `collect_saves.py`.

**If CPS only allows "within Chicago Public Schools":** the browser may block the save because students' requests
come from GitHub Pages. The page will then show a message telling the student to use **Download** or **Copy my code**,
which always work. Test this once on a student Chromebook before class.

**Updating the script later:** Deploy → Manage deployments → edit (pencil) → Version: New version. The URL stays the same.

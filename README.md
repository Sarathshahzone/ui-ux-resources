# UI/UX Resources Web App

A clean, mobile-first, high-fidelity curation website for UI/UX designers displaying resource cards with a precise 2:1 width-to-height ratio, 24px grid gaps, and interactive detail drawers.

This project is built using **pure static HTML, CSS, and JavaScript**. It is lightweight, has no build step, and loads instantly.

---

## How to Run Locally

Because this project uses ES6 Modules (`import`/`export` in JavaScript) to keep the code modular and clean, browsers restrict loading them directly via the `file://` protocol due to CORS policies. You need a local web server to run it.

Here are the easiest ways to start one:

### Option 1: Python (Built-in)
If you have Python installed, open your terminal/command prompt in this directory and run:
```bash
python -m http.server 8000
```
Then, open your browser and navigate to `http://localhost:8000`.

### Option 2: VS Code "Live Server"
If you use VS Code:
1. Open this directory in VS Code.
2. Install the **Live Server** extension by Ritwick Dey.
3. Click the **Go Live** button at the bottom right corner of the status bar.

### Option 3: Node.js (Vite / http-server)
If you install Node.js later, you can run:
```bash
npm install
npm run dev
```

---

## How to Deploy to Vercel
Deploying this to Vercel is extremely fast since it's a static site:
1. Push this directory to a new repository on **GitHub**.
2. Go to [Vercel](https://vercel.com) and sign in.
3. Click **Add New > Project** and select your GitHub repository.
4. Vercel will automatically detect that it is a static project. Keep the default settings and click **Deploy**.

---

## How to Connect to Google Sheets Later
To replace the dummy data with a live Google Sheet:

1. Create a Google Sheet with these column headers in row 1:
   * `category` (e.g., *Inspiration*, *Design Systems*)
   * `title` (e.g., *Material Design*)
   * `description` (e.g., *Google's design guidelines...*)
   * `url` (e.g., *https://m3.material.io*)
   * `tag` (e.g., *System*)

2. Populate rows with your design resources.
3. In Google Sheets, go to **File > Share > Publish to web**.
4. In the link settings, select **Whole Document** and change **Web page** to **Comma-separated values (.csv)**, then click **Publish**.
5. Copy the generated CSV link.
6. Open [src/main.js](file:///src/main.js) and locate the `fetchResources()` function. Replace the dummy data load with a fetch to your CSV url and parse the CSV content into objects:

```javascript
async function fetchResources() {
  const csvUrl = "YOUR_COPIED_GOOGLE_SHEETS_CSV_URL_HERE";
  const response = await fetch(csvUrl);
  const csvText = await response.text();
  return parseCsv(csvText);
}

// Simple CSV parser
function parseCsv(text) {
  const lines = text.split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  return lines.slice(1).map((line, index) => {
    // Basic CSV parse (supports quoted values with commas)
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const item = { id: String(index + 1) };
    
    headers.forEach((header, i) => {
      const val = values[i] ? values[i].trim().replace(/^"|"$/g, '') : '';
      item[header] = val;
    });
    return item;
  });
}
```
Now, whenever you edit your Google Sheet, the website will automatically display the fresh resources!

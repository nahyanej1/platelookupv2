# Deploying PlateFind to Railway

Railway runs the full Express server (`server.js`), making it ideal for APIs that need to reach Philippine-based endpoints.

---

## Prerequisites

- A [Railway account](https://railway.app) — sign up with GitHub (free tier works)
- Your API credentials (`LOGIN_KEY`, `LOGIN_USER`, `LOGIN_PAYLOAD`)
- Project pushed to a GitHub repository

---

## Step 1 — Push the project to GitHub

If not done yet:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

> Make sure `.env` is in `.gitignore` — it already is. Never push it.

---

## Step 2 — Create a new Railway project

1. Go to [railway.app](https://railway.app) and log in.
2. Click **"New Project"**.
3. Select **"Deploy from GitHub repo"**.
4. Authorize Railway to access your GitHub if prompted.
5. Select your repository from the list.
6. Railway will detect it as a Node.js project automatically and begin the first deploy.

---

## Step 3 — Set environment variables

The server will crash on startup without these. Set them before or immediately after the first deploy.

1. Click on your service inside the project.
2. Go to the **"Variables"** tab.
3. Add each variable:

| Name | Value |
|---|---|
| `LOGIN_KEY` | your actual key |
| `LOGIN_USER` | your actual user |
| `LOGIN_PAYLOAD` | your actual payload |

> Do **not** set `PORT` — Railway injects it automatically.

4. After saving variables, Railway will automatically redeploy.

---

## Step 4 — Get your public URL

1. Go to the **"Settings"** tab of your service.
2. Under **"Networking"**, click **"Generate Domain"**.
3. Railway gives you a public URL like `https://your-app.up.railway.app`.

---

## Step 5 — Verify it works

Open the Railway URL in a browser. The site should load and plate lookups should work.

Test via curl:

```bash
curl -X POST https://your-app.up.railway.app/api/plate-lookup \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC1234"}'
```

Expected response:
```json
{
  "plate": "ABC1234",
  "profile": {
    "firstName": "...",
    "lastName": "...",
    "email": "...",
    "mobilePhone": "..."
  }
}
```

---

## Step 6 — Set a custom domain (optional)

1. In **Settings → Networking**, click **"Custom Domain"**.
2. Enter your domain (e.g. `platefind.yourdomain.com`).
3. Add the CNAME record Railway shows you in your DNS provider.
4. SSL is provisioned automatically.

---

## Redeploying after code changes

Any push to `main` triggers an automatic redeploy on Railway.

```bash
git add .
git commit -m "your change"
git push
```

---

## Updating environment variables

1. Go to **Variables** tab in your Railway service.
2. Edit the value and click **Save**.
3. Railway automatically redeploys with the new values.

---

## Why Railway instead of Vercel for this app

Vercel runs serverless functions from US/EU data centers. The upstream plate lookup API is hosted in the Philippines and only responds to regional IPs. Railway runs a persistent server and lets you pick the **deployment region** — choose **Southeast Asia** for the best connectivity to Philippine APIs.

To set the region:
1. Go to **Settings → Deploy**.
2. Under **"Region"**, select **Southeast Asia (Singapore)**.
3. Redeploy.

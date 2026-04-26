# Deploying PlateFind to Vercel

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free tier works)
- A [GitHub account](https://github.com) to host the code
- Your API credentials (`LOGIN_KEY`, `LOGIN_USER`, `LOGIN_PAYLOAD`)

---

## Step 1 — Push the project to GitHub

1. Go to [github.com/new](https://github.com/new) and create a new **private** repository (recommended since this is a sensitive tool).
2. Open a terminal inside the project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

> Make sure `.env` is listed in `.gitignore` — it should already be. Never push your `.env` file.

---

## Step 2 — Import the project into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in.
2. Click **"Add New Project"**.
3. Click **"Import"** next to your GitHub repository.
4. Vercel will auto-detect the project. Leave the framework preset as **Other**.
5. **Do not change** the build/output settings — leave them blank.

---

## Step 3 — Set environment variables

This is the most important step. Your API credentials must **never** be in the code — they live here.

1. On the import screen, expand **"Environment Variables"** (or go to **Project Settings → Environment Variables** after deploy).
2. Add each of the following one by one:

| Name | Value |
|---|---|
| `LOGIN_KEY` | your actual key |
| `LOGIN_USER` | your actual user |
| `LOGIN_PAYLOAD` | your actual payload |

> Do **not** set `PORT` — Vercel manages that automatically.  
> `API_BASE` is optional; only set it if the upstream URL changes.

3. Make sure all three are set for **Production**, **Preview**, and **Development** environments.

---

## Step 4 — Deploy

1. Click **"Deploy"**.
2. Vercel will build and deploy in about 30–60 seconds.
3. Once done, you'll get a live URL like `https://your-project.vercel.app`.

---

## Step 5 — Verify it works

1. Open your Vercel URL in a browser.
2. The limitation popup should appear on load.
3. Enter a valid plate number and click **Search Plate**.
4. Confirm results are returned correctly.

To check the API node directly, you can test it with curl:

```bash
curl -X POST https://your-project.vercel.app/api/plate-lookup \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC1234"}'
```

---

## Step 6 — Set a custom domain (optional)

1. In your Vercel project, go to **Settings → Domains**.
2. Click **"Add Domain"** and enter your custom domain.
3. Follow the DNS instructions Vercel provides (usually a CNAME or A record).
4. Vercel automatically provisions an SSL certificate.

---

## Redeploying after code changes

Any `git push` to the `main` branch will automatically trigger a new deployment on Vercel. No manual steps needed.

```bash
git add .
git commit -m "your change"
git push
```

---

## Updating environment variables

1. Go to **Project Settings → Environment Variables** in Vercel.
2. Edit the value and save.
3. Go to **Deployments** and click **"Redeploy"** on the latest deployment for the change to take effect.

---

## Rate limiting note

The API is limited to **3 requests per 10 minutes per IP address**. This is enforced server-side in `api/plate-lookup.js`. No additional configuration needed.

> For high-traffic deployments, consider replacing the in-memory rate store with [Upstash Redis](https://upstash.com) + `@upstash/ratelimit` for persistent rate limiting across all Vercel edge regions.

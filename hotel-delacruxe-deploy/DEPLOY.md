# Hotel Delacruxe Web Deployment

This project is a Node website because bookings and admin settings are saved on the server.

The local `data/hotel-data.json` file can contain real guest details. It is intentionally ignored by Git. Deploy the code and let the web server create its own private data file, or copy only safe data from `data/hotel-data.example.json`.

## Start Locally

```bash
npm start
```

Open:

- Guest site: `http://127.0.0.1:8770`
- Admin site: `http://127.0.0.1:8770/admin.html`

Local admin password fallback: `delacruxe-admin`

## Before Going Public

Set these environment variables on the host:

- `ADMIN_PASSWORD`: the private password for the admin page
- `ADMIN_SECRET`: any long random text, used to sign the admin login token
- `PORT`: supplied automatically by many hosts
- `HOST`: optional, default is `0.0.0.0`
- `DATA_DIR` or `DATA_FILE`: optional location for saved bookings and settings

## Recommended Host

You can use Netlify. This project now includes:

- `netlify.toml` for Netlify build settings and API redirects
- `netlify/functions/api.mjs` for bookings, admin login, settings, and availability
- Netlify Blobs storage through `@netlify/blobs`

Do not use Netlify Drop for the booking/admin version. Netlify Drop is fine for static pages, but this project needs Functions and package installation. Use GitHub connected to Netlify, or use the Netlify CLI.

## Netlify Setup

1. Create a GitHub repo and upload this project.
2. In Netlify, choose **Add new site** > **Import an existing project**.
3. Connect the GitHub repo.
4. Netlify should read `netlify.toml`.
5. Build command: `npm run build`.
6. Publish directory: `public`.
7. Functions directory: `netlify/functions`.
8. Add environment variables:
   - `ADMIN_PASSWORD`: your private admin password
   - `ADMIN_SECRET`: any long random secret text
9. Deploy.

After deploy:

- Guest site: your Netlify URL
- Admin site: `https://your-site-name.netlify.app/admin.html`
- API path: `/api/...`

## Other Hosts

Static-only hosts such as GitHub Pages or basic Netlify static upload are not enough for the admin booking system unless you replace the backend with a database/API service.

For a normal Node server host, use the included `server.js`.

Render Free web services are useful for previews, but they do not support persistent disks. Use a paid web service with a persistent disk if bookings must survive restarts.

## Render Quick Setup

1. Create a new Web Service.
2. Connect the project repository.
3. Render can read `render.yaml` from the repo root.
4. When prompted, set `ADMIN_PASSWORD`.
5. Deploy.

If you create the service manually:

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables: `NODE_ENV=production`, `ADMIN_PASSWORD`, `ADMIN_SECRET`, `DATA_DIR=/var/data`
- Add a persistent disk mounted at `/var/data`

# Deploy Papermint

Papermint is a static frontend for an existing Paperless-ngx installation. This guide assumes Paperless runs at the root of its upstream URL and Papermint has a dedicated HTTPS hostname. The reverse proxy serves the frontend and Paperless API on one browser origin, so Paperless handles authentication and document permissions.

## Build and configure

Use Node.js 24 LTS and npm. Build from the repository root, then copy the contents of `dist/` into a directory served by your reverse proxy.

```sh
npm ci
npm run build
```

To serve Papermint under a sub-path, set `PAPERMINT_BASE` when you build, for example `PAPERMINT_BASE=/docs/ npm run build`. Copy `dist/` to that path. The app, its service worker, and `config.json` then live under `/docs/`. The Paperless API stays at `/api/` on the same origin.

The default configuration works with an existing archive. To customize it, copy `config.example.json` beside the deployed `index.html` as `config.json`. Keep this file in your deployment and copy it into each release. Reload the page to apply changes.

| Setting          | Default           | Purpose                                                                                   |
| ---------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `readOnly`       | `false`           | Disable editing controls in the frontend. Enforce read-only access at the server as well. |
| `successorField` | `"Superseded by"` | Name of the Paperless document-link custom field used to point to a replacement record.   |
| `recoveryFiles`  | `[]`              | Optional list of server-protected file links.                                             |

The browser reads this file. Store credentials, recovery codes, and document contents separately. Each recovery entry has a stable `key`, human-readable `title`, `href`, `kind` (`text`, `pdf`, or `archive`), short `label`, and download `filename`. Use same-origin paths under `/recovery/`, `/recovery-files/`, or `/backups/`. Store and protect the linked files on your server.

## Route requests and sign in

Add `records.example.com` to Paperless's allowed hosts and `https://records.example.com` to its trusted CSRF origins. If this is your primary Paperless origin, you can set both with `PAPERLESS_URL=https://records.example.com`. Configure Paperless to recognize HTTPS at your trusted proxy if it connects upstream over HTTP. See [Paperless hosting and security settings](https://docs.paperless-ngx.com/configuration/#hosting-security).

Place the following routing rules in your Nginx HTTPS `server` block. Supply your own certificate settings, frontend directory, and private Paperless upstream. Adjust the upload limit to fit your archive.

```nginx
server_name records.example.com;
root /srv/papermint;
client_max_body_size 100m;

location ~ ^/(api|accounts|media|static)(/|$) {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Remote-User "";
    proxy_hide_header Cache-Control;
    add_header Cache-Control "no-store" always;
}

location ^~ /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location = /config.json {
    try_files $uri =404;
    add_header Cache-Control "no-store" always;
}

location / {
    try_files $uri /index.html;
    add_header Cache-Control "no-cache";
}
```

For a normal Paperless session, sign in at `https://records.example.com/accounts/login/?next=/`, then open the frontend at `/`. Sign in on the Papermint hostname so the request carries the right cookies. The frontend reads Paperless's standard `csrftoken` cookie for writes. If a write returns `403`, check that the proxy forwards the HTTPS scheme and that Paperless trusts this origin.

You can also use an existing authenticated reverse proxy with [Paperless remote-user API authentication](https://docs.paperless-ngx.com/advanced_usage/#sso-and-third-party-authentication-with-paperless-ngx). The proxy must authenticate each client, overwrite the identity header using its verified session, and keep the upstream inaccessible to clients.

For optional recovery files, add dedicated authenticated routes outside the SPA fallback. Send `Cache-Control: no-store`, `Content-Disposition: attachment`, and a suitable MIME type. Authenticate `HEAD` and `GET` requests and return `404` for missing files.

## Organize the archive

Top-level Paperless tags become **Areas** and descendants become **Topics**. When Areas exist, choose one when filing a standalone upload. An archive with no Areas can accept untagged uploads. To use the status controls, create `Current` and `Superseded` tags in Paperless. `Signed` and `Sensitive` act as visual markers. `Sensitive` also disables speculative preview requests. Paperless's permissions control access to the records.

To link an older record to its replacement, create a custom field with type **Document Link** in Paperless and use its name for `successorField`.

## Install, update, and verify

The build includes a service worker. Serve `index.html`, `sw.js`, and `manifest.webmanifest` with revalidation. Hashed assets can be cached long term. Switch the frontend directory as a unit to keep the worker and assets aligned, and preserve `config.json` across deployments.

After deploying, sign in and open a record on the Papermint hostname. Check that an original download works, that a permitted edit persists, and that an unauthenticated request to `/api/documents/` cannot read your archive. If you configure recovery files, check their authorization separately.

The worker caches the app shell. For offline browsing, IndexedDB stores a limited index with document titles, tags, dates, version summaries, and replacement links. Titles can contain private information. Use a trusted browser profile and clear site data before changing accounts on a shared device. API responses, document bodies, previews, and recovery files are outside the worker cache. Offline writes are disabled.

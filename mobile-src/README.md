# Mobile app view (React)

Phone-sized screens are redirected from the website to `/m/`, a React app that uses the same backend and login.
The built files live in `../m/` (committed, so the static host needs no build step). This folder is the source.

```bash
cd mobile-src
npm install
npm run dev      # http://localhost:5174, talks to http://localhost:3000
npm run build    # writes the production build to ../m/  (commit it)
```

Add `?desktop=1` to the site URL to see the full website on a phone;
"Switch to app view" in the website's menu goes back.

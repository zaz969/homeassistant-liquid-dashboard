# At Home — Glass Dashboard

A portrait-first Home Assistant dashboard app built with Next.js, TypeScript,
and Glass UI registry components. It runs as a Supervisor-managed Home
Assistant app/add-on, opens through Ingress, and stores its shared layout in the
add-on's persistent data directory.

See [DOCS.md](./DOCS.md) for installation, permissions, backup, kiosk setup,
and troubleshooting.

For local development:

```sh
npm ci
npm run dev
```

The dashboard API requires `SUPERVISOR_TOKEN`, which Home Assistant provides
when the app runs under Supervisor. The development server starts without it,
but Home Assistant entity controls will report that Supervisor is unavailable.

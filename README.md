# Nako

Nako is a lightweight transport network: a public introduction, an installable passenger finder, a simple driver registration and location portal, and an association dashboard for approvals, routes, and anonymous usage.

The installed app is the full finder. Approved drivers appear only while they choose to share location. Location samples are rate-limited and passenger markers refresh in short intervals to reduce bandwidth.

Association staff sign in at `/admin/`. Passengers do not create accounts.

Drivers register and share location at `/driver/`. Apply `supabase/schema.sql` before using driver features. Configure a browser-restricted Google Maps JavaScript API key in `src/js/config.js`; without one the existing low-bandwidth offline-capable map remains as a fallback.

# Mobile / iPhone local testing

Video calls, camera, and location need a **secure context** (HTTPS).  
Opening `http://192.168.x.x:5173` on iPhone will fail with:

> Open MenRush from its secure HTTPS address…

## Quick start

```bash
cd frontend
# .env.local
# VITE_API_URL=https://backend-staging-f3aa.up.railway.app/api
# VITE_SOCKET_URL=https://backend-staging-f3aa.up.railway.app

npm run dev
```

Vite is configured with `@vitejs/plugin-basic-ssl` and `server.host: true`.

| Device | URL |
|--------|-----|
| Mac Chrome | https://localhost:5173/ |
| iPhone (same Wi‑Fi) | https://\<your-mac-lan-ip\>:5173/ |

Find LAN IP: `ipconfig getifaddr en0`

## iPhone Safari first visit

1. Type **https://** (with the **s**) + Mac IP + `:5173`
2. Certificate warning → **Show Details** → **visit this website** → confirm
3. Address bar must **not** say “Not Secure”
4. Allow camera / mic when prompted

## Call test accounts

Create a matched pair via admin (requires `ADMIN_TOKEN`):

```bash
curl -s -X POST "$API/admin/users/test-pair" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d '{"password":"test1234"}'
```

Or use:

| Device | Email | Password |
|--------|--------|----------|
| iPhone | `iphone-call@menrush.test` | `test1234` |
| Chrome | `chrome-call@menrush.test` | `test1234` |

Both must keep the app **open on screen**. Push alone cannot answer WebRTC.

## Firewall

If the phone cannot load the page: System Settings → Network → Firewall → allow **Node**.

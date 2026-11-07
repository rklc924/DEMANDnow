// The daily reminder run, started by the Render cron job (render.yaml). It asks the web service to send
// today's reminder emails. Locally: CRON_SECRET=... APP_URL=http://localhost:3000 node scripts/send-reminders.mjs [--dry-run]
const secret = process.env.CRON_SECRET;
const base = process.env.WEB_HOSTPORT ? `http://${process.env.WEB_HOSTPORT}` : process.env.APP_URL;
if (!secret || !base) {
  console.error("Set CRON_SECRET and WEB_HOSTPORT or APP_URL.");
  process.exit(1);
}
const dry = process.argv.includes("--dry-run") ? "?dryRun=1" : "";

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/cron/reminders${dry}`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    const body = await res.text();
    console.log(`${res.status} ${body}`);
    if (res.ok) process.exit(0);
    if (res.status < 500) process.exit(1);
  } catch (e) {
    console.error(`Attempt ${attempt} failed: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, attempt * 30_000)); // the web service may be waking up or deploying
}
process.exit(1);

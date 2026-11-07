import "./globals.css";
import type { ReactNode } from "react";
import { getUser, acct, isAdmin } from "@/lib/auth";
import { readDB } from "@/lib/store";
import { usage } from "@/lib/usage";

export const metadata = { title: "Demand Now", description: "Overdue invoice demands and BC enforcement guidance" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  const accountDb = user ? await readDB(acct(user)) : null;
  const u = accountDb ? usage(accountDb) : null;
  const admin = user ? isAdmin(user) : false;
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap">
            <a className="brand" href="/"><img src="/brand/demand-now-logo.svg" alt="Demand Now" height={30} /></a>
            {user ? (
              <>
                <nav>
                  <a href="/">Receivables</a>
                  <a href="/calendar">Calendar</a>
                  <a href="/notifications">Reminders</a>
                  <a href="/liens">Liens</a>
                  {admin && <a href="/team">Team</a>}
                  {admin && <a href="/settings">Settings</a>}
                  {admin && <a href="/billing">Billing</a>}
                  <a href="/help">Help</a>
                </nav>
                <div className="row" style={{ marginLeft: "auto", fontSize: 13 }}>
                  {u?.plan ? (
                    <span className="pill blue">{u.plan.name} · {u.limit === null ? `${u.used} letters this month` : `${u.used}/${u.limit} letters this month`}</span>
                  ) : (
                    admin ? <a className="pill warn" href="/billing">No plan</a> : <span className="pill warn">No plan</span>
                  )}
                  <span className="note email" title={`${user.name || user.email} (${user.email})`}><b>{accountDb?.company.name}</b> · {admin ? "Admin" : "Regular user"}</span>
                  <form action="/api/auth/logout" method="post"><button className="btn small ghost">Log out</button></form>
                </div>
              </>
            ) : (
              <nav style={{ marginLeft: "auto" }}>
                <a href="/about">About us</a>
                <a href="/start">One-off demand</a>
                <a href="/pricing">Pricing</a>
                <a href="/help">Help</a>
                <a href="/login">Log in</a>
                <a className="btn small" href="/signup">Start</a>
              </nav>
            )}
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="foot">
          <div className="wrap">
            <img src="/brand/demand-now-icon.svg" alt="" width={20} height={20} />
            <span>© {new Date().getFullYear()} Demand Now</span>
            <a href="/about">About us</a>
            <a href="/pricing">Pricing</a>
            <a href="/help">User manual</a>
            <a href="/support">Support</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
          </div>
        </footer>
      </body>
    </html>
  );
}

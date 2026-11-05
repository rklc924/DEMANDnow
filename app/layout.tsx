import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Demand Company", description: "Overdue invoice demands and BC enforcement guidance" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap">
            <span className="brand">Demand Company</span>
            <nav>
              <a href="/">Receivables</a>
              <a href="/settings">Company &amp; letterhead</a>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}

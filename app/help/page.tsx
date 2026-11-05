import { chapters } from "@/lib/manual";
import { ManualNav } from "./nav";

export const metadata = { title: "User manual · Demand Now" };

export default async function Help() {
  const list = await chapters();
  const groups = [...new Set(list.map((c) => c.group))];
  return (
    <div className="manual">
      <ManualNav list={list} />
      <div className="manual-body">
        <h1>Demand Now user manual</h1>
        <p className="sub">How to use every part of Demand Now, from your first demand letter to serving court documents. New to Demand Now? Start with <a href="/help/getting-started">Getting started</a>.</p>
        {groups.map((g) => (
          <section key={g}>
            <h2>{g}</h2>
            <div className="manual-cards">
              {list.filter((c) => c.group === g).map((c) => (
                <a key={c.slug} className="card manual-card" href={`/help/${c.slug}`}>
                  <b>{c.title}</b>{c.placeholder && <> <span className="pill grey">soon</span></>}
                  <span className="note">{c.summary}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
        <p className="note">Can't find what you need? <a href="/support">Contact support</a>.</p>
      </div>
    </div>
  );
}

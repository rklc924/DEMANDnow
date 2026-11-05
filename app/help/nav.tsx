import type { Chapter } from "@/lib/manual";

/** The manual's table of contents, grouped. Shared by /help and each chapter. */
export function ManualNav({ list, current }: { list: Chapter[]; current?: string }) {
  const groups = [...new Set(list.map((c) => c.group))];
  return (
    <nav className="manual-nav" aria-label="User manual">
      <a href="/help" className={`manual-home ${current ? "" : "on"}`}>User manual</a>
      {groups.map((g) => (
        <div key={g}>
          <div className="manual-group">{g}</div>
          {list.filter((c) => c.group === g).map((c) => (
            <a key={c.slug} href={`/help/${c.slug}`} className={c.slug === current ? "on" : ""}>
              {c.title}{c.placeholder && <span className="pill grey">soon</span>}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

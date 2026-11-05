import { notFound } from "next/navigation";
import { chapter, chapters, headings } from "@/lib/manual";
import { ManualNav } from "../nav";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await chapter(params.slug);
  return { title: c ? `${c.meta.title} · Demand Now manual` : "User manual · Demand Now" };
}

export default async function ManualChapter({ params }: { params: { slug: string } }) {
  const [list, c] = await Promise.all([chapters(), chapter(params.slug)]);
  if (!c) notFound();
  const i = list.findIndex((x) => x.slug === c.meta.slug);
  const prev = list[i - 1];
  const next = list[i + 1];
  const toc = headings(c.html);
  return (
    <div className="manual">
      <ManualNav list={list} current={c.meta.slug} />
      <article className="manual-body">
        <p className="note"><a href="/help">User manual</a> · {c.meta.group}</p>
        <h1>{c.meta.title}</h1>
        <p className="sub">{c.meta.summary}</p>
        {toc.length > 2 && (
          <div className="manual-toc">
            <b>On this page</b>
            <ul>{toc.map((h) => <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>)}</ul>
          </div>
        )}
        <div className="manual-text" dangerouslySetInnerHTML={{ __html: c.html }} />
        <div className="manual-pager">
          {prev ? <a href={`/help/${prev.slug}`}>← {prev.title}</a> : <span />}
          {next ? <a href={`/help/${next.slug}`}>{next.title} →</a> : <span />}
        </div>
      </article>
    </div>
  );
}

import mysql from "mysql2/promise";

const KEY = process.env.OLLAMA_KEY;
if (!KEY) throw new Error("OLLAMA_KEY required");
const MODEL = "deepseek-v4-flash:cloud";
const CONCURRENCY = Number(process.env.CONC ?? 3);
const BODY_LIMIT = 16000;

const INSTRUCTION =
  "You process a foreign tech/AI news article and do TWO things, returning them in the EXACT format below.\n" +
  "1) KEYWORDS: extract 3 to 8 keywords that literally appear in the SOURCE-LANGUAGE text — verbatim substrings, original script, no translation, no invention.\n" +
  "2) TRANSLATION: translate the title and body into natural, fluent Korean (한국어). The body is HTML or Markdown — preserve its markup (every tag/attribute/URL or Markdown token) EXACTLY and translate only visible text. Keep proper nouns, code, numbers, dates, and citation tokens like [#1] unchanged.\n" +
  "\n" +
  "Respond in EXACTLY this format and nothing else (no code fences, no commentary):\n" +
  "KEYWORDS: <single-line JSON array of source-language strings>\n" +
  "TITLE: <translated Korean title>\n" +
  "BODY:\n" +
  "<translated Korean body with markup preserved>";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (a: number) =>
  Math.min(20000, 700 * (a + 1) * (a + 1)) + Math.floor(Math.random() * 400);

const callOllama = async (user: string) => {
  for (let a = 0; ; a++) {
    let res: Response;
    try {
      res = await fetch("https://ollama.com/api/chat", {
        method: "POST",
        signal: AbortSignal.timeout(120000),
        headers: {
          authorization: `Bearer ${KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          think: false,
          stream: false,
          options: { temperature: 0.2, num_ctx: 32768 },
          messages: [
            { role: "system", content: INSTRUCTION },
            { role: "user", content: user },
          ],
        }),
      });
    } catch (e) {
      if (a >= 5) throw e;
      await sleep(backoff(a));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (a >= 6) throw new Error(`ollama ${res.status}`);
      await sleep(backoff(a));
      continue;
    }
    if (!res.ok)
      throw new Error(
        `ollama ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    const data = (await res.json()) as { message?: { content?: string } };
    const content = String(data?.message?.content ?? "").trim();
    if (!content) {
      if (a >= 6) throw new Error("empty content");
      await sleep(backoff(a));
      continue;
    }
    return content;
  }
};

const parseKeywords = (line: string) => {
  const m = /\[[\s\S]*\]/.exec(line);
  if (!m) return [] as string[];
  try {
    const p = JSON.parse(m[0]) as unknown[];
    return p
      .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      .map((k) => k.trim().slice(0, 191));
  } catch {
    return [] as string[];
  }
};

const parseOut = (out: string, fallbackTitle: string) => {
  const kw = /KEYWORDS:\s*(.*)/.exec(out);
  const tt = /TITLE:\s*(.*)/.exec(out);
  const bi = out.indexOf("BODY:");
  return {
    keywords: parseKeywords(kw?.[1] ?? ""),
    titleKo: tt?.[1]?.trim() || fallbackTitle,
    bodyKo: bi >= 0 ? out.slice(bi + 5).trim() : out.trim(),
  };
};

const conn = mysql.createPool({
  uri: process.env.DATABASE_URL as string,
  connectionLimit: CONCURRENCY + 2,
  waitForConnections: true,
});

type Row = {
  id: number;
  lang: string;
  title_original: string;
  content_original: string | null;
};

const processOne = async (row: Row) => {
  const body = row.content_original
    ? row.content_original.slice(0, BODY_LIMIT)
    : "";
  const out = await callOllama(`TITLE: ${row.title_original}\nBODY:\n${body}`);
  const { keywords, titleKo, bodyKo } = parseOut(out, row.title_original);
  if (!bodyKo) throw new Error("empty body translation");
  await conn.query(
    "update articles set title_translated_ko=?, content_translated_ko=?, translated_at=now(), keywords_extracted_at=now() where id=?",
    [titleKo.slice(0, 512), bodyKo, row.id],
  );
  await conn.query("delete from keywords_extracted where article_id=?", [
    row.id,
  ]);
  if (keywords.length > 0) {
    await conn.query(
      "insert into keywords_extracted (article_id, keyword) values " +
        keywords.map(() => "(?,?)").join(","),
      keywords.flatMap((k) => [row.id, k]),
    );
  }
};

let done = 0;
let failed = 0;
const failedIds = new Set<number>();
const startedAt = Date.now();

while (true) {
  const exclude = failedIds.size
    ? ` and id not in (${[...failedIds].join(",")})`
    : "";
  const [rows] = (await conn.query(
    `select id, lang, title_original, content_original from articles
         where lang<>'ko' and content_translated_ko is null and content_original is not null and content_original<>''
         and coalesce(published_at, fetched_at) >= '2026-01-01'${exclude}
         order by id desc limit 60`,
  )) as unknown as [Row[]];
  if (!rows.length) break;

  let idx = 0;
  const worker = async () => {
    while (true) {
      const i = idx++;
      if (i >= rows.length) break;
      const row = rows[i];
      try {
        await processOne(row);
        done++;
      } catch (e) {
        failed++;
        failedIds.add(row.id);
        console.error("FAIL id", row.id, String(e).slice(0, 160));
      }
      if ((done + failed) % 25 === 0) {
        const rate = (done / ((Date.now() - startedAt) / 1000)).toFixed(2);
        console.log(`progress: done=${done} failed=${failed} rate=${rate}/s`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`batch end: done=${done} failed=${failed}`);
}

console.log(
  `DONE translated=${done} failed=${failed} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`,
);
await conn.end();

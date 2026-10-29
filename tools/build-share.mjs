// 링크 공유 썸네일 + 검색엔진용 파일 생성기 (GitHub Actions 가 배포 직전에 실행)
//  - web/p/글주소.html : 글별 공유 썸네일 페이지
//  - web/sitemap.xml   : 구글·네이버에 알려줄 페이지 목록
//  - web/robots.txt    : 검색엔진 안내 (관리자 페이지 제외)
//
// 카카오톡·슬랙 등은 링크 미리보기를 만들 때 자바스크립트를 실행하지 않습니다.
// 그래서 글마다 썸네일 정보가 박힌 작은 HTML(/p/글주소.html)을 미리 만들어 둡니다.
// 사람이 열면 곧바로 실제 글 페이지로 이동합니다.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";

const ROOT = "web";
const cfg = await readFile(`${ROOT}/assets/js/config.js`, "utf8");
const pick = (key) => (cfg.match(new RegExp(`\\b${key}\\s*:\\s*"([^"]*)"`)) || [])[1] || "";

const SUPABASE_URL = pick("SUPABASE_URL").replace(/\/$/, "");
const KEY = pick("SUPABASE_ANON_KEY");
const SITE_URL = pick("SITE_URL").replace(/\/$/, "");
const NAME = pick("name") || "엔투소프트";
const DEFAULT_IMG = `${SITE_URL}/assets/img/og-default.png`;

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 1) 모든 페이지의 __SITE_URL__ 을 실제 주소로 교체
for (const f of await readdir(ROOT)) {
  if (!f.endsWith(".html")) continue;
  const p = `${ROOT}/${f}`;
  const html = await readFile(p, "utf8");
  if (html.includes("__SITE_URL__")) await writeFile(p, html.replaceAll("__SITE_URL__", SITE_URL));
}
console.log(`사이트 주소: ${SITE_URL || "(config.js 에 SITE_URL 이 없습니다)"}`);

// 검색엔진 파일 작성
async function writeSeoFiles(posts) {
  if (!SITE_URL) return;
  await writeFile(`${ROOT}/robots.txt`,
    `User-agent: *\nDisallow: /admin/\nDisallow: /unsubscribe.html\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: today },
    { loc: `${SITE_URL}/blog.html`, lastmod: (posts[0]?.published_at || today).slice(0, 10) },
    ...posts.filter((p) => /^[a-z0-9-]+$/.test(p.slug)).map((p) => ({
      loc: `${SITE_URL}/post.html?slug=${p.slug}`,
      lastmod: (p.updated_at || p.published_at || today).slice(0, 10),
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;
  await writeFile(`${ROOT}/sitemap.xml`, xml);
  console.log(`sitemap.xml 에 페이지 ${urls.length}개를 넣었습니다.`);
}

// 2) 공개된 글 목록 가져오기
if (!SUPABASE_URL || !KEY) {
  console.log("Supabase 설정이 없어 글별 공유 페이지는 건너뜁니다.");
  await writeSeoFiles([]);
  process.exit(0);
}
const headers = { apikey: KEY };
if (!KEY.startsWith("sb_")) headers.Authorization = `Bearer ${KEY}`;

let posts = [];
try {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?select=slug,title,excerpt,cover_url,published_at,updated_at&published=eq.true&order=published_at.desc`,
    { headers },
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  posts = await res.json();
} catch (e) {
  console.log("글 목록을 가져오지 못했습니다. 공유 페이지 없이 배포합니다:", e.message);
  await writeSeoFiles([]);
  process.exit(0);
}

// 3) 글마다 공유 페이지 만들기
await mkdir(`${ROOT}/p`, { recursive: true });
for (const p of posts) {
  if (!/^[a-z0-9-]+$/.test(p.slug)) continue;
  const target = `../post.html?slug=${p.slug}`;
  const img = /^https?:\/\//.test(p.cover_url || "") ? p.cover_url : DEFAULT_IMG;
  const desc = p.excerpt || `${NAME} 금융소식`;
  const html = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)} | ${esc(NAME)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(NAME)}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${SITE_URL}/p/${p.slug}.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${SITE_URL}/post.html?slug=${p.slug}">
<script>location.replace(${JSON.stringify(target)} + location.hash);</script>
</head><body style="font-family:sans-serif;padding:40px">
<p><a href="${target}">${esc(p.title)} 글 보러 가기</a></p>
</body></html>`;
  await writeFile(`${ROOT}/p/${p.slug}.html`, html);
}
console.log(`글 공유 페이지 ${posts.length}개를 만들었습니다.`);
await writeSeoFiles(posts);

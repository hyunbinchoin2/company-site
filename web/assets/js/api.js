// 데이터 계층: 화면 코드는 이 파일의 함수만 사용합니다.
// IS_DEMO 이면 메모리 속 샘플 데이터로, 아니면 Supabase 로 동작합니다.
import { CONFIG, IS_DEMO } from "./config.js";

let sb = null;
if (!IS_DEMO) {
  const { createClient } = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"
  );
  sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

export const postUrl = (slug, extra = "") =>
  `${CONFIG.SITE_URL}/post.html?slug=${encodeURIComponent(slug)}${extra}`;

/* ------------------------------------------------------------------ */
/*  데모 데이터                                                         */
/* ------------------------------------------------------------------ */
const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

const demo = {
  posts: [
    {
      id: "p1", slug: "predictive-maintenance-case", category: "고객 사례", published: true, published_at: day(3),
      title: "설비 고장 예측으로 계획 외 정지를 41% 줄인 방법",
      excerpt: "자동차 부품 공장 A사는 진동 센서 데이터를 6주 동안 학습시켜 베어링 고장을 평균 9일 먼저 알게 되었습니다.",
      cover_url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=70",
      content: "## 문제\n\nA사의 프레스 라인은 한 달에 두세 번씩 예고 없이 멈췄습니다.\n\n## 접근\n\n기존 PLC 데이터에 진동 센서 12개를 더해 **6주** 동안 정상 패턴을 학습했습니다.\n\n## 결과\n\n- 계획 외 정지 41% 감소\n- 예비 부품 재고 18% 절감\n\n> 이제는 고장이 나기 전에 정비 일정을 잡습니다. — A사 생산기술팀장",
    },
    {
      id: "p2", slug: "release-2-4", category: "제품 소식", published: true, published_at: day(10),
      title: "2.4 업데이트: 교대조별 리포트와 알림 묶음 보내기",
      excerpt: "교대가 바뀔 때마다 자동으로 요약 리포트가 만들어지고, 비슷한 알림은 하나로 묶여 전달됩니다.",
      cover_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=70",
      content: "## 교대조별 리포트\n\n교대 종료 10분 전 생산량, 불량률, 설비 상태를 한 장으로 정리해 드립니다.\n\n## 알림 묶음\n\n같은 설비에서 5분 안에 반복된 알림은 하나로 합쳐집니다.",
    },
    {
      id: "p3", slug: "smart-factory-voucher-2027", category: "인사이트", published: true, published_at: day(18),
      title: "2027 스마트공장 지원사업, 지금 준비해야 할 세 가지",
      excerpt: "공고 전에 미리 정리해두면 좋은 데이터 현황표, 투자 계획, 성과 지표를 정리했습니다.",
      cover_url: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1200&q=70",
      content: "지원사업 공고가 나오면 준비 기간은 보통 4주 남짓입니다. 미리 챙겨두면 좋은 항목을 정리했습니다.",
    },
    {
      id: "p4", slug: "draft-hiring", category: "회사 소식", published: false, published_at: null,
      title: "(작성 중) 데이터 엔지니어를 찾습니다", excerpt: "", cover_url: "", content: "",
    },
  ],
  subscribers: Array.from({ length: 24 }, (_, i) => ({
    id: "s" + i,
    email: ["kim", "lee", "park", "choi", "jung", "kang"][i % 6] + (i + 1) + "@example.com",
    name: ["김민준", "이서연", "박도윤", "최하은", "정우진", "강지아"][i % 6],
    status: i % 9 === 8 ? "unsubscribed" : "active",
    created_at: day(60 - i * 2),
  })),
  newsletters: [],
  events: [],
};

// 데모용 발송 이력과 이벤트 생성
(function seedDemo() {
  const sent = [
    { id: "n1", subject: "10월 소식: 2.4 업데이트와 고객 사례", post_ids: ["p1", "p2"], ago: 2 },
    { id: "n2", subject: "9월 소식: 스마트공장 지원사업 준비하기", post_ids: ["p3"], ago: 30 },
  ];
  sent.forEach((n, k) => {
    demo.newsletters.push({
      id: n.id, subject: n.subject, preheader: "", intro: "안녕하세요, 라이트하우스랩입니다.",
      post_ids: n.post_ids, status: "sent", recipient_count: 22, sent_at: day(n.ago), created_at: day(n.ago + 1), html: "",
    });
    demo.subscribers.slice(0, 22).forEach((s, i) => {
      if ((i + k) % 3 !== 0) {
        demo.events.push({ newsletter_id: n.id, subscriber_id: s.id, type: "open", url: null,
          created_at: new Date(Date.parse(day(n.ago)) + i * 36e5 * 0.7).toISOString(), subscribers: s });
      }
      if ((i + k) % 4 === 0) {
        n.post_ids.forEach((pid, j) => {
          if (j === 0 || i % 8 === 0) {
            const p = demo.posts.find((x) => x.id === pid);
            demo.events.push({ newsletter_id: n.id, subscriber_id: s.id, type: "click",
              url: postUrl(p.slug, "&utm_source=newsletter"),
              created_at: new Date(Date.parse(day(n.ago)) + i * 36e5).toISOString(), subscribers: s });
          }
        });
      }
    });
  });
  demo.newsletters.unshift({
    id: "n3", subject: "11월 소식 (임시저장)", preheader: "", intro: "", post_ids: ["p1"],
    status: "draft", recipient_count: 0, sent_at: null, created_at: day(0), html: "",
  });
})();

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ------------------------------------------------------------------ */
/*  공개 페이지용                                                       */
/* ------------------------------------------------------------------ */
export async function listPublishedPosts({ limit = 50, category = null } = {}) {
  if (IS_DEMO) {
    await wait();
    return clone(demo.posts.filter((p) => p.published && (!category || p.category === category))
      .sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, limit));
  }
  let q = sb.from("posts").select("id,slug,title,excerpt,cover_url,category,published_at")
    .eq("published", true).order("published_at", { ascending: false }).limit(limit);
  if (category) q = q.eq("category", category);
  return must(await q);
}

export async function getPostBySlug(slug) {
  if (IS_DEMO) { await wait(); return clone(demo.posts.find((p) => p.slug === slug && p.published) || null); }
  return must(await sb.from("posts").select("*").eq("slug", slug).eq("published", true).maybeSingle());
}

export async function subscribe(email, name = "") {
  if (IS_DEMO) {
    await wait(400);
    if (demo.subscribers.some((s) => s.email === email)) return { already: true };
    demo.subscribers.push({ id: uid(), email, name, status: "active", created_at: new Date().toISOString() });
    return { ok: true };
  }
  const { error } = await sb.from("subscribers").insert({ email: email.trim().toLowerCase(), name });
  if (error?.code === "23505") return { already: true };
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function logPageView(slug, source) {
  if (IS_DEMO) return;
  await sb.from("page_views").insert({ slug, source: source || "direct" });
}

/* ------------------------------------------------------------------ */
/*  인증                                                                */
/* ------------------------------------------------------------------ */
export async function getSession() {
  if (IS_DEMO) return sessionStorage.getItem("demo-admin") ? { user: { email: "demo@admin" } } : null;
  return (await sb.auth.getSession()).data.session;
}
export async function signIn(email, password) {
  if (IS_DEMO) { sessionStorage.setItem("demo-admin", "1"); return; }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error("이메일 또는 비밀번호가 맞지 않습니다.");
  const ok = must(await sb.rpc("is_admin"));
  if (!ok) { await sb.auth.signOut(); throw new Error("관리자로 등록되지 않은 계정입니다. README의 '관리자 등록'을 확인하세요."); }
}
export async function signOut() {
  if (IS_DEMO) { sessionStorage.removeItem("demo-admin"); return; }
  await sb.auth.signOut();
}

/* ------------------------------------------------------------------ */
/*  관리자: 게시글                                                       */
/* ------------------------------------------------------------------ */
export async function listAllPosts() {
  if (IS_DEMO) { await wait(); return clone(demo.posts); }
  return must(await sb.from("posts").select("*").order("created_at", { ascending: false }));
}
export async function savePost(post) {
  const row = { ...post, updated_at: new Date().toISOString() };
  if (row.published && !row.published_at) row.published_at = new Date().toISOString();
  if (IS_DEMO) {
    await wait();
    if (!row.id) { row.id = uid(); demo.posts.unshift(row); }
    else Object.assign(demo.posts.find((p) => p.id === row.id), row);
    return clone(row);
  }
  if (!row.id) delete row.id;
  const res = must(await sb.from("posts").upsert(row).select().single());
  return res;
}
export async function deletePost(id) {
  if (IS_DEMO) { demo.posts = demo.posts.filter((p) => p.id !== id); return; }
  must(await sb.from("posts").delete().eq("id", id));
}

/* ------------------------------------------------------------------ */
/*  관리자: 이미지 업로드 (Supabase Storage 의 post-images 보관함)        */
/* ------------------------------------------------------------------ */
// 큰 사진은 가로 1600px 이하 JPG 로 줄여서 올립니다 (메일·웹 속도용).
async function shrink(file, max = 1600) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file; // gif·svg 는 그대로
  const img = await createImageBitmap(file);
  if (img.width <= max && file.size < 900 * 1024) return file;
  const scale = Math.min(1, max / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export async function uploadImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있습니다.");
  const f = await shrink(file);
  if (f.size > 5 * 1024 * 1024) throw new Error("이미지가 너무 큽니다. 5MB 이하로 올려주세요.");
  if (IS_DEMO) { await wait(400); return URL.createObjectURL(f); }
  const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await sb.storage.from("post-images").upload(path, f, { contentType: f.type, cacheControl: "31536000" });
  if (error) {
    if (/bucket/i.test(error.message)) throw new Error("이미지 보관함이 없습니다. README의 'storage.sql'을 먼저 실행하세요.");
    throw new Error(error.message);
  }
  return sb.storage.from("post-images").getPublicUrl(path).data.publicUrl;
}

/* ------------------------------------------------------------------ */
/*  관리자: 구독자                                                       */
/* ------------------------------------------------------------------ */
export async function listSubscribers() {
  if (IS_DEMO) { await wait(); return clone(demo.subscribers).reverse(); }
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await sb.from("subscribers").select("*").order("created_at", { ascending: false }).range(from, from + 999));
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}
export async function addSubscribers(list) {
  // list: [{email, name}] — 이미 있는 이메일은 건너뜀
  const rows = list.map((r) => ({ email: r.email.trim().toLowerCase(), name: r.name || "" }));
  if (IS_DEMO) {
    let added = 0;
    rows.forEach((r) => { if (!demo.subscribers.some((s) => s.email === r.email)) { demo.subscribers.push({ ...r, id: uid(), status: "active", created_at: new Date().toISOString() }); added++; } });
    return added;
  }
  const res = must(await sb.from("subscribers").upsert(rows, { onConflict: "email", ignoreDuplicates: true }).select("id"));
  return res.length;
}
export async function updateSubscriber(id, patch) {
  if (IS_DEMO) { Object.assign(demo.subscribers.find((s) => s.id === id), patch); return; }
  must(await sb.from("subscribers").update(patch).eq("id", id));
}
export async function deleteSubscriber(id) {
  if (IS_DEMO) { demo.subscribers = demo.subscribers.filter((s) => s.id !== id); return; }
  must(await sb.from("subscribers").delete().eq("id", id));
}

/* ------------------------------------------------------------------ */
/*  관리자: 뉴스레터                                                     */
/* ------------------------------------------------------------------ */
export async function listNewsletters() {
  if (IS_DEMO) {
    await wait();
    return demo.newsletters.map((n) => ({ ...clone(n), ...statsFromEvents(demo.events.filter((e) => e.newsletter_id === n.id)) }));
  }
  return must(await sb.from("newsletter_stats").select("*").order("created_at", { ascending: false }));
}
export async function getNewsletter(id) {
  if (IS_DEMO) return clone(demo.newsletters.find((n) => n.id === id));
  return must(await sb.from("newsletters").select("*").eq("id", id).single());
}
export async function saveNewsletter(nl) {
  if (IS_DEMO) {
    if (!nl.id) { nl = { ...nl, id: uid(), status: "draft", created_at: new Date().toISOString(), recipient_count: 0 }; demo.newsletters.unshift(nl); }
    else Object.assign(demo.newsletters.find((n) => n.id === nl.id), nl);
    return clone(nl);
  }
  const row = { ...nl };
  if (!row.id) delete row.id;
  return must(await sb.from("newsletters").upsert(row).select().single());
}
export async function deleteNewsletter(id) {
  if (IS_DEMO) { demo.newsletters = demo.newsletters.filter((n) => n.id !== id); return; }
  must(await sb.from("newsletters").delete().eq("id", id));
}
export async function sendNewsletter(id, { testEmail } = {}) {
  if (IS_DEMO) {
    await wait(900);
    if (testEmail) return { ok: true, demo: true, sent: 1 };
    const n = demo.newsletters.find((x) => x.id === id);
    const count = demo.subscribers.filter((s) => s.status === "active").length;
    Object.assign(n, { status: "sent", sent_at: new Date().toISOString(), recipient_count: count });
    return { ok: true, demo: true, sent: count };
  }
  const { data, error } = await sb.functions.invoke("send-newsletter", { body: { newsletter_id: id, test_email: testEmail || null } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return data;
}
export async function getNewsletterEvents(id) {
  if (IS_DEMO) { await wait(); return clone(demo.events.filter((e) => e.newsletter_id === id)); }
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await sb.from("events").select("type,url,created_at,subscriber_id,subscribers(email,name)")
      .eq("newsletter_id", id).order("created_at").range(from, from + 999));
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}
export async function getPageViews(days = 30) {
  if (IS_DEMO) {
    return demo.posts.filter((p) => p.published).map((p, i) => ({ slug: p.slug, views: 120 - i * 31, from_newsletter: 40 - i * 9 }));
  }
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const rows = must(await sb.from("page_views").select("slug,source").gte("created_at", since).limit(20000));
  const map = {};
  rows.forEach((r) => {
    map[r.slug] ??= { slug: r.slug, views: 0, from_newsletter: 0 };
    map[r.slug].views++;
    if (r.source === "newsletter") map[r.slug].from_newsletter++;
  });
  return Object.values(map).sort((a, b) => b.views - a.views);
}

function statsFromEvents(evts) {
  const openers = new Set(evts.filter((e) => e.type === "open").map((e) => e.subscriber_id));
  const clicks = evts.filter((e) => e.type === "click");
  return { unique_opens: openers.size, total_clicks: clicks.length, unique_clicks: new Set(clicks.map((e) => e.subscriber_id)).size };
}

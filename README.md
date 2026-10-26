# 기업 홍보 사이트 + 뉴스레터 관리자

회사 홍보 사이트(블로그 포함)와, 블로그 글을 골라 뉴스레터로 보내고 누가 어떤 링크를 눌렀는지 보는 관리자 페이지입니다.

```
web/                    ← GitHub Pages 로 배포되는 정적 사이트
  index.html            회사 홈 (소개 · 최근 글 · 구독 신청)
  blog.html             블로그 목록 (분류 필터)
  post.html?slug=...    글 상세 (뉴스레터 링크가 여기로 연결됨)
  admin/                관리자 페이지
  assets/js/config.js   ★ 회사 정보와 Supabase 연결 정보 (여기만 고치면 됨)
  assets/js/email-template.js  메일 디자인 (미리보기와 실제 발송이 같은 템플릿 사용)
supabase/
  schema.sql            DB 테이블 + 보안 정책
  functions/
    send-newsletter/    뉴스레터 발송 (Resend)
    track/              오픈 · 클릭 기록 후 원래 글로 이동
    unsubscribe/        수신거부 처리
.github/workflows/      main 에 push 하면 사이트와 함수를 자동 배포
```

## 왜 Supabase 가 필요한가요?

GitHub Pages 는 정적 파일만 올릴 수 있어서 메일 발송, 구독자 저장, 클릭 집계를 할 수 없습니다. 그래서 화면은 GitHub Pages 에 두고, 데이터와 발송은 Supabase(무료 플랜으로 시작 가능)와 Resend(메일 발송 서비스)에 맡기는 구조입니다.

```
구독자 메일함 ──클릭──▶ Supabase track 함수 (누가·어떤 링크 기록) ──이동──▶ GitHub Pages 블로그 글
관리자 페이지 ──발송──▶ Supabase send-newsletter 함수 ──▶ Resend ──▶ 구독자 메일함
```

---

## 0. 먼저 데모로 보기 (설정 없이)

`config.js` 의 Supabase 값이 비어 있으면 샘플 데이터로 동작하는 데모 모드입니다.

```bash
cd web
python3 -m http.server 8080
```

- 사이트: http://localhost:8080
- 관리자: http://localhost:8080/admin (아무 값으로 로그인)

> 파일을 더블클릭해서 열면(file://) 동작하지 않습니다. 꼭 위처럼 로컬 서버로 여세요.

## 1. Supabase 준비

1. https://supabase.com 에서 새 프로젝트를 만듭니다. (지역은 Northeast Asia (Seoul) 권장)
2. **SQL Editor** 에 `supabase/schema.sql` 전체를 붙여넣고 Run.
3. **Authentication → Sign In / Providers → Email** 에서 *Allow new users to sign up* 을 끕니다. (아무나 관리자 계정을 만들지 못하게)
4. **Authentication → Users → Add user** 로 관리자 계정을 만듭니다.
5. SQL Editor 에서 관리자로 등록합니다.
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = '관리자이메일@회사.com';
   ```
6. **Project Settings → API** 에서 `Project URL` 과 `anon public` 키를 복사해 둡니다.

## 2. Resend 준비 (메일 발송)

1. https://resend.com 가입 → **Domains** 에서 회사 도메인을 추가하고, 안내하는 DNS 레코드(SPF, DKIM)를 도메인 관리 화면에 등록합니다. 이걸 해야 스팸함으로 덜 갑니다.
2. **API Keys** 에서 키를 발급합니다.
3. 요금제마다 하루·월 발송 한도가 다르니 구독자 수에 맞는지 확인하세요.

## 3. 함수 비밀값 설정 + 배포

[Supabase CLI](https://supabase.com/docs/guides/cli) 설치 후:

```bash
supabase login
supabase link --project-ref <프로젝트REF>

supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxx \
  NEWSLETTER_FROM="라이트하우스랩 <news@회사도메인.kr>" \
  COMPANY_NAME="라이트하우스랩" \
  SITE_URL="https://아이디.github.io/저장소이름"

supabase functions deploy send-newsletter
supabase functions deploy track --no-verify-jwt
supabase functions deploy unsubscribe --no-verify-jwt
```

이후에는 GitHub 에 push 하면 자동 배포되게 할 수 있습니다. 저장소 **Settings → Secrets and variables → Actions** 에 다음 두 값을 등록하세요.

| 이름 | 값 |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens 에서 발급 |
| `SUPABASE_PROJECT_REF` | `https://<이 부분>.supabase.co` |

## 4. config.js 수정

`web/assets/js/config.js`

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",              // anon 키만. service_role 키는 절대 넣지 마세요
SITE_URL: "https://아이디.github.io/저장소이름",
COMPANY: { name: "...", ... }
```

anon 키는 브라우저에 공개되는 용도의 키라 저장소에 올려도 됩니다. 데이터 보호는 `schema.sql` 의 RLS 정책이 담당합니다.

## 5. GitHub Pages 배포

```bash
git init && git add . && git commit -m "첫 배포"
git branch -M main
git remote add origin https://github.com/아이디/저장소이름.git
git push -u origin main
```

저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다. 이후 `web/` 안의 파일을 고쳐서 push 할 때마다 1~2분 안에 자동 반영됩니다.

- 사이트: `https://아이디.github.io/저장소이름/`
- 관리자: `https://아이디.github.io/저장소이름/admin/`

회사 도메인을 쓰려면 Settings → Pages → Custom domain 에 입력하고, `config.js` 와 `SITE_URL` 비밀값도 같은 주소로 바꾸세요.

---

## 사용 흐름

1. **블로그 글** 에서 글을 쓰고 *사이트에 공개* 를 켭니다.
2. **새 뉴스레터** 에서 제목·인사말을 쓰고 보낼 글을 고릅니다. 오른쪽 미리보기에 메일 디자인이 바로 적용되고, 데스크톱/모바일로 바꿔 볼 수 있습니다.
3. **테스트 메일 보내기** 로 내 메일함에서 실제 모습을 확인합니다. (통계에 잡히지 않음)
4. **구독자에게 발송** → 발송이 끝나면 통계 화면으로 이동합니다.
5. **발송 내역·통계** 에서 오픈율, 클릭률, 링크별 클릭, 발송 후 반응 시점, 누가 무엇을 눌렀는지 확인하고 CSV 로 받을 수 있습니다.

## 통계는 어떻게 집계되나요?

- **클릭**: 메일 속 모든 링크가 `track` 함수 주소로 바뀌어 나갑니다. 누르면 구독자·링크·시각을 기록한 뒤 원래 글로 이동합니다. 메일에 실제로 있던 링크로만 이동하도록 막아둬서 다른 사이트로 악용할 수 없습니다.
- **오픈**: 메일 맨 아래 1×1 투명 이미지가 불러와질 때 기록합니다. 이미지를 막은 메일 앱에서는 빠지고, Apple 메일·Gmail 의 이미지 미리 불러오기 때문에 높게 잡힐 수 있어 참고용입니다.
- **블로그 조회수**: 글 상세 페이지를 열 때 기록하고, 뉴스레터에서 들어온 방문은 따로 셉니다.

## 꼭 확인할 것: 정보통신망법

홍보 목적의 뉴스레터는 법에서 말하는 '광고성 정보'에 해당할 수 있습니다. 일반적으로 다음이 요구됩니다. 저는 법률 전문가가 아니므로 정확한 적용은 전문가에게 확인하세요.

- 수신 **동의를 받은 사람에게만** 발송 (사이트 구독 폼은 본인이 직접 신청하는 방식)
- 제목 앞에 **(광고)** 표기 — 필요하면 뉴스레터 제목에 직접 붙이세요
- 발신자 이름·연락처와 **수신거부 방법** 표시 — 템플릿 하단에 이미 들어 있습니다
- 오후 9시~오전 8시 발송은 별도 동의 필요
- 수신 동의를 받은 지 2년마다 동의 여부 재확인

## 알아두면 좋은 점

- 발송 함수는 한 번 실행에 시간 제한이 있어 구독자 수천 명까지는 무난합니다. 그보다 많아지면 큐 방식으로 바꾸는 것이 좋습니다.
- 같은 뉴스레터는 한 번만 발송됩니다. (발송 시작 시 상태를 잠가 중복 클릭을 막음)
- 메일 디자인은 `email-template.js` 하나만 고치면 미리보기와 실제 메일이 함께 바뀝니다. 메일 프로그램 호환을 위해 표(table) 레이아웃과 인라인 스타일로 만들어져 있으니 그 방식을 유지하세요.
- 브랜드 색은 `config.js` 의 `brandColor` 하나로 사이트·관리자·메일에 함께 적용됩니다.
- 홈 화면 문구(히어로, 하는 일)는 `web/index.html` 에서 직접 고치면 됩니다.

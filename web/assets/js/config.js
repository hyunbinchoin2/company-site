// ============================================================
//  사이트 설정 — 이 파일만 수정하면 회사 정보와 연결이 바뀝니다.
//  SUPABASE_URL / ANON_KEY 를 비워두면 "데모 모드"로 동작합니다.
//  (샘플 데이터로 화면을 미리 볼 수 있고, 실제 저장·발송은 되지 않음)
// ============================================================
export const CONFIG = {
  // Supabase 프로젝트 > Settings > API 에서 복사
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "", // anon(public) 키는 공개되어도 되는 키입니다. service_role 키는 절대 넣지 마세요.

  // GitHub Pages 주소 (끝에 / 없이). 뉴스레터 속 링크가 이 주소로 만들어집니다.
  SITE_URL: "https://your-id.github.io/your-repo",

  COMPANY: {
    name: "라이트하우스랩",
    nameEn: "Lighthouse Lab",
    tagline: "제조 현장의 데이터를 읽기 쉬운 결정으로 바꿉니다",
    description:
      "라이트하우스랩은 공장 설비 데이터를 실시간으로 모아 불량과 고장을 미리 알려주는 산업용 분석 플랫폼을 만듭니다.",
    email: "hello@lighthouselab.kr",
    phone: "02-000-0000",
    address: "서울특별시 성동구 성수이로 00, 5층",
    brandColor: "#1F3FD8", // 메일 템플릿과 사이트 포인트 색
  },
};

export const IS_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;

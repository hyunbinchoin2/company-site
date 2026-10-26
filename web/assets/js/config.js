// ============================================================
//  사이트 설정 — 이 파일만 수정하면 회사 정보와 연결이 바뀝니다.
//  SUPABASE_URL / ANON_KEY 를 비워두면 "데모 모드"로 동작합니다.
//  (샘플 데이터로 화면을 미리 볼 수 있고, 실제 저장·발송은 되지 않음)
// ============================================================
export const CONFIG = {
  // Supabase 프로젝트 > Settings > API 에서 복사
  SUPABASE_URL: "https://wzcwbdmuyrejlxnafsrq.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Y3diZG11eXJlamx4bmFmc3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODM0NzQsImV4cCI6MjEwODU1OTQ3NH0.UHtFqUqaVnV2hDNDgWqYP4SgeQ5Lcqf-j3VKdBQT140", // anon(public) 키는 공개되어도 되는 키입니다. service_role 키는 절대 넣지 마세요.

  // GitHub Pages 주소 (끝에 / 없이). 뉴스레터 속 링크가 이 주소로 만들어집니다.
  SITE_URL: "https://hyunbinchoin2.github.io/company-site",

  COMPANY: {
    name: "엔투소프트",
    nameEn: "N2SOFT",
    tagline: "금융시스템 전문 IT솔루션 기업",
    description:
      "금융전문 솔루션 경험을 바탕으로 정확하고 직관적인 솔루션을 제공합니다.",
    email: "hbchoi@n2soft.co.kr",
    phone: "1877-1977",
    address: "경기도 성남시 갈마치로 288번길14 skv1타워 1003호",
    brandColor: "#A42F2B", // 메일 템플릿과 사이트 포인트 색
  },
};

export const IS_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;

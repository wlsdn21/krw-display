# Changelog

모든 주요 변경 사항은 이 파일에 기록합니다.

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

---

## [Unreleased]

### Changed
- 다중 통화 지원 제거
  - EUR, JPY, CNY 변환 옵션 및 관련 UI 제거
  - 확장 기능을 USD, USDT, USDC 중심 동작으로 단순화
- 경제지표 및 알림 기능 제거
  - 팝업의 지표 탭과 주요 뉴스 알림 설정 제거
  - 백그라운드 경제지표 fetch 및 High Impact 알림 로직 제거
  - `notifications` 권한과 Myfxbook 관련 접근 권한 제거

### Planned
- 단위 테스트 추가
- 국제화(i18n) 지원

---

## [1.3.0] - 2026-01-18

### Added
- 다중 통화 지원 추가
  - EUR, JPY, CNY 변환 옵션 및 관련 UI 추가
  - 통화별 패턴과 환율 설정 확장

### Technical
- `background.js`: 다중 통화 환율 조회 로직 확장
- `content.js`: 통화별 변환 로직 확장
- `popup.html`, `popup.js`: 다중 통화 설정 UI 추가

---

## [1.2.0] - 2026-01-18

### Added
- 한국어 통화 표현 지원
  - `만`, `억`, `조`, `달러` 조합 인식
  - 기존 변환 로직과 함께 동작하도록 패턴 추가

---

## [1.1.0] - 2026-01-18

### Fixed
- 메모리 누수 방지
  - 페이지 종료 시 `MutationObserver` 정리
  - SPA 환경에서 리소스 누수 방지

### Changed
- 오류 UX 개선
  - 환율 API 실패 시 상태와 오류 메시지 노출
- 주석과 실제 동작의 일치성 정리

### Security
- Content Security Policy 추가
  - `script-src 'self'`
  - `object-src 'self'`

---

## [1.0.0] - 2026-01-18

### Initial Release
- 웹페이지의 USD, USDT, USDC 금액을 KRW로 함께 표시
- 국제 환율, 업비트 USDT, 업비트 USDC, 사용자 지정 환율 지원
- 김치 프리미엄 계산 보조 정보 제공
- 영문 단위와 한국어 단위 인식
- 음수 금액 처리
- 억/조 단위 표시 옵션
- 소수점 자리수 조절
- 사이트별 활성화 설정

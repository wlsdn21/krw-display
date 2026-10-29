# Changelog

## [1.6.1] - 2026-10-30

### Fixed
- 사이트 적용 조건을 정확한 도메인과 하위 도메인 기준으로 제한
- 변환 끄기 및 사이트 제외 시 확장이 변경한 텍스트를 원문으로 복원
- 스크립트, 스타일, 코드 예제와 편집 영역을 일반 변환에서 제외
- 소수점 패턴, `$-50` 형태의 음수와 `kn` 단위 처리 수정
- 조회 실패 시 마지막 성공 시각 유지, 실제 사용 중인 환율 기준 표시 및 이전 오류 해제
- 업비트 실패 시 국제 환율을 업비트 시세로 표시하던 문제 수정
- 환율 요청 시간 제한과 중복 요청 통합, 이전 소스의 늦은 응답 덮어쓰기 방지
- 확인된 환율 없이 1,300원 기준으로 페이지나 KRW 주문 입력을 시작하지 않도록 변경
- 사용자 지정 환율을 페이지, 바이낸스 잔고 및 KRW 입력에 일관되게 적용
- 바이낸스 번역 끄기 시 원문 복원 및 번역을 꺼도 잔고 갱신 처리 유지

### Changed
- 환율 숫자와 기준을 분리하고 `지금 갱신` 버튼, 입력 오류 안내, 키보드 조작 추가
- 1분 알람과 갱신 안내 간격 통일, 팝업의 반복 저장소 조회 제거
- 사용자 지정 환율 입력 중 자동 갱신이 입력 내용을 덮어쓰지 않도록 개선
- 사이트 목록의 외부 favicon 요청 제거

### Added
- 공용 기본값과 입력 검증 모듈
- 환율 오류·요청 경합·원문 복원·페이지 변환·팝업의 자동 회귀 검사
- 개발용 의존성 고정 파일 및 배포 ZIP에 공용 모듈 포함

## [1.6.0] - 2026-08-14

### Changed
- 바이낸스 번역을 국내 현물·선물·옵션 거래 용어 중심으로 전면 정비
- 주문 유형, 포지션, 증거금, 펀딩, 호가창의 의미가 드러나는 번역으로 개선
- 숫자가 포함된 동적 라벨을 번역하되 티커·주문값·코인명은 원문으로 유지

### Added
- 번역 사전을 독립 파일로 분리하고 핵심 거래 용어 자동 검증 추가

## [1.5.7] - 2026-08-12

### Fixed
- Start Binance features with safe defaults while delayed storage responses arrive.
- Keep observers alive when Binance replaces the page during SPA navigation or an incomplete render.
- Add a lightweight position-table watchdog so missing labels recover automatically.
- Isolate individual DOM conversion errors so one malformed node cannot disable the whole extension.

## [1.5.6] - 2026-08-12

### Fixed
- Matched the position-return column to BinanceNova typography and Binance's standard text colors.
- Matched the KRW order selector and input typography to the surrounding Binance controls.
- Reduced unnecessary rescans and made the column resilient to Binance's dynamic position-table rerenders.

## [1.5.5] - 2026-08-11

### Added
- Added a `Position Return` column next to Binance Futures `PNL (ROI %)`.
- Calculates unleveraged long/short return from entry price to mark price.

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
- 국제화(i18n) 지원

---

## [1.3.7] - 2026-04-05

### Fixed
- 업데이트 배너 표시 조건 보강
  - 현재 설치 버전과 동일한 경우 배너가 남지 않도록 정리
  - 팝업 초기 렌더에서 잘못된 업데이트 배너가 보이지 않도록 수정
- 한국어 문장 내 달러 변환 누락 개선
  - 긴 뉴스 본문 텍스트에서도 `70달러` 같은 표현을 다시 스캔하도록 조정
  - `70달러를`, `70달러는`처럼 조사와 함께 쓰인 표현도 인식하도록 개선

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
# v1.5.2

- USDT/USDC 종목 전환 시 KRW 입력칸의 내부 환산 단위가 이전 종목 값으로 남는 문제 수정
- 기존 USDT/USDC 주문값이 있는 상태에서 KRW를 선택하면 해당 값을 원화로 이어받도록 개선
- 단위 전환 시 기존 주문값이 한 최소 단위 줄어들 수 있는 반올림 오차 방지
- KRW 모드 해제 후 단위 메뉴의 체크 표시가 KRW에 남는 문제 수정

# v1.5.1

- 별도 원화 주문 도우미 상자를 제거하고 바이낸스 기본 수량 단위 메뉴에 `KRW` 통합
- KRW 선택 시 주문 입력칸은 원화로 표시하고 내부 값은 USDT/USDC로 자동 환산
- 바이낸스의 `주문 규모 / 초기 증거금` 선택을 그대로 유지해 두 방식 모두 원화 입력 지원
- 종목 수량 단위를 선택하면 KRW 모드를 자동 해제하고 바이낸스 기본 입력으로 복원
- 실제 주문 제출 기능은 추가하지 않고 기존 매수·매도 확인 절차 유지

# v1.5.0

- 바이낸스 선물 주문창에 원화 주문 도우미 추가
- 1만·5만·10만·50만원 빠른 금액 선택 및 USDT/USDC 환산 지원
- 주문 입력 최소 단위에 맞춰 환산 금액을 내림 처리
- 수량 단위가 USDT/USDC가 아닐 때 자동 입력을 차단해 오계산 방지
- 실제 매수·매도 제출 없이 주문 수량 칸만 채우도록 안전 장치 적용
- 입력 금액이 증거금이 아닌 포지션 명목금액 기준임을 주문창에 명시

# v1.4.1

- 바이낸스 선물 주문창, 호가창, 포지션, 계정 영역의 한국어 용어 확대
- 바이낸스 옵션 홈의 통계, 시장 정보, 최근 체결 및 안내 영역 번역 추가
- 검색창, 툴팁 등 `placeholder`, `title`, `aria-label` 속성 문구 번역 지원
- 수량이 포함된 포지션·미체결 주문과 종목별 거래량 문구의 동적 번역 추가

# v1.4.0

- 바이낸스 주요 메뉴, 마켓, 거래 화면 문구의 한국어 표시 추가
- 원화 병기 기능과 별도로 바이낸스 한국어 표시를 켜고 끌 수 있는 설정 추가
- 바이낸스의 동적 화면 전환에도 번역이 다시 적용되도록 개선
## 1.5.3

- Binance 선물 종목/주문 패널 전환 시 KRW 입력 모드가 꺼지지 않도록 수정
- 단위 메뉴의 비동기 렌더링을 재확인해 KRW 옵션이 간헐적으로 빠지는 문제 완화
- USDT/USDC 지원 패널로 돌아오면 KRW 입력창이 자동으로 복구되도록 수정
## 1.5.4

- Binance 선물 화면의 `잔고`와 `미실현 손익`에도 USDT/USDC 원화 병기 추가
- 음수·소수 금액과 실시간 갱신되는 계정 지표를 안정적으로 처리
- 일반 원화 변환을 꺼도 Binance KRW 주문 도우미가 켜져 있으면 계정 지표 병기 유지

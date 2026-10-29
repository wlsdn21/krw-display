# 출시 준비 패키지

버전은 프로젝트 루트의 `manifest.json`에서 읽습니다. 개발용 검사 파일과 의존성은 배포 ZIP에 포함하지 않습니다.

이 폴더는 Chrome Web Store 출시 준비에 필요한 문서와 배포용 ZIP 생성 스크립트를 한곳에 모아둔 패키지입니다.

## 포함 파일

- `chrome-web-store-listing-ko.md`
  - 웹스토어 등록용 이름, 짧은 설명, 상세 설명, 스크린샷 문안
- `privacy-policy.md`
  - 개인정보 처리 및 권한 사용 설명 초안
- `release-checklist.md`
  - 제출 전 확인, 등록 폼 입력, 출시 직후 점검 체크리스트
- `build-release-zip.ps1`
  - 실제 배포 파일만 모아 `dist/`에 버전 ZIP을 생성하는 스크립트

## 빠른 사용 순서

1. `chrome-web-store-listing-ko.md` 내용을 웹스토어 설명문 초안으로 사용합니다.
2. `release-checklist.md`를 따라 스크린샷, 아이콘, 설명문, 권한 설명을 준비합니다.
3. 아래 명령으로 배포용 ZIP을 생성합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\release\build-release-zip.ps1
```

4. 생성된 `dist/krw-master-pro-v<version>.zip` 파일을 웹스토어에 업로드합니다.
5. `privacy-policy.md` 내용을 GitHub Pages, Notion 공개 페이지, 개인 사이트 중 하나에 게시한 뒤 웹스토어 개인정보처리방침 URL로 연결합니다.

## 제출 전 꼭 바꿔야 할 것

- 스크린샷 3~5장 실제 캡처 업로드
- 스토어 대표 이름과 개발자 표기 확정
- 개인정보처리방침 공개 URL 생성
- 필요하면 Discord 링크 외에 문의 이메일 추가

## 권장 제출 포지셔닝

- 핵심 메시지: 웹페이지의 달러/스테이블코인 금액을 즉시 원화로 보여주는 확장 프로그램
- 차별점: Upbit USDT/USDC 기준 선택, 사이트별 적용, 간단한 환율 상태 확인
- 초기 타깃 사용자: 해외 거래소, 크립토 가격 페이지, 글로벌 투자 사이트를 자주 보는 한국 사용자

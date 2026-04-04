# v1.1.0 개선사항 요약

**릴리스 일자**: 2026-01-18  
**버전**: v1.0.0 → v1.1.0  
**커밋 수**: 2개 (v1.0.0 초기 커밋, v1.1.0 개선)

---

## 📋 적용된 개선사항

### 1. 메모리 누수 방지 ✅

**파일**: `content.js`  
**변경 내용**:
```javascript
// 페이지 언로드 시 리소스 정리
window.addEventListener('beforeunload', () => {
  if (obs) {
    obs.disconnect();
    obs = null;
  }
  pendingMutations = [];
  isExtensionRunning = false;
});
```

**영향**:
- SPA(Single Page Application) 환경에서 메모리 누수 방지
- 페이지 전환 시 MutationObserver 자동 정리
- 장시간 브라우저 사용 시 안정성 향상

**위험도**: 낮음 - 기존 기능 영향 없음

---

### 2. 에러 UX 개선 ✅

**파일**: `background.js`, `popup.js`

**background.js 변경**:
```javascript
// API 실패 시 에러 메시지 저장
await chrome.storage.local.set({
  lastFetchStatus: 'failed',
  lastFetchError: error.message  // 추가
});

// 성공 시 에러 메시지 제거
await chrome.storage.local.set({
  lastFetchStatus: 'success',
  lastFetchError: null  // 추가
});
```

**popup.js 변경**:
```javascript
// 팝업에서 에러 메시지 표시
if (result.lastFetchError && status === 'failed') {
  const errorHint = ` (오류: ${result.lastFetchError.substring(0, 30)}...)`;
  lastUpdate.textContent += errorHint;
}
```

**영향**:
- API 실패 시 사용자에게 구체적인 에러 정보 제공
- 문제 해결이 용이해짐
- 디버깅 시간 단축

**위험도**: 낮음 - UI 개선, 기능 변경 없음

---

### 3. 보안 강화 (CSP) ✅

**파일**: `manifest.json`

**변경 내용**:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

**영향**:
- XSS(Cross-Site Scripting) 공격 방어
- 외부 스크립트 실행 차단
- Chrome 웹 스토어 보안 정책 준수

**위험도**: 낮음 - 확장 프로그램 보안성 향상

---

### 4. 주석 정확성 개선 ✅

**파일**: `background.js`

**변경 전**:
```javascript
// Set up periodic alarm (30 seconds)  // ❌ 부정확
chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1.0 });
```

**변경 후**:
```javascript
// Set up periodic alarm (1 minute interval, actual rate limiting is in fetchExchangeRate)
chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1.0 });
```

**영향**:
- 코드 가독성 향상
- 실제 동작과 주석 일치
- 유지보수 용이성 증가

**위험도**: 없음 - 주석만 수정

---

## 📊 변경 통계

```bash
5 files changed, 51 insertions(+), 5 deletions(-)
```

**수정된 파일**:
1. `content.js` - 10줄 추가 (메모리 누수 방지)
2. `background.js` - 3줄 추가 (에러 저장)
3. `popup.js` - 10줄 추가 (에러 표시)
4. `manifest.json` - 4줄 추가 (CSP + 버전)
5. `CHANGELOG.md` - 21줄 추가 (변경 이력)

---

## 🎯 Git 버전 관리 체계

### 생성된 태그

- **v1.0.0**: 초기 릴리스 (코드 리뷰 전)
- **v1.1.0**: High Priority 개선사항 적용

### 커밋 히스토리

```
7fa1570 (HEAD -> main, tag: v1.1.0) feat: v1.1.0 - High priority improvements
3137202 (tag: v1.0.0) chore: initial commit - v1.0.0
```

### 문서화 파일

1. **`.gitignore`**: Git에서 제외할 파일 정의
2. **`CHANGELOG.md`**: 버전별 변경 이력
3. **`CONTRIBUTING.md`**: 개발 가이드라인 및 주의사항

---

## 🔍 테스트 가이드

### 필수 테스트 항목

#### 1. 기본 기능 테스트
- [ ] Binance.com에서 USD 변환 확인
- [ ] Hyperliquid에서 USDT 변환 확인
- [ ] 음수 금액 표시 확인 (`-$100`)
- [ ] 억/조 단위 표시 확인

#### 2. 메모리 누수 테스트
1. Chrome DevTools → Performance 탭 열기
2. 페이지를 여러 번 새로고침 (F5)
3. SPA 사이트에서 페이지 전환 반복
4. Memory 사용량이 계속 증가하지 않는지 확인

**예상 결과**: 메모리 사용량이 일정 수준 유지

#### 3. 에러 처리 테스트
1. Chrome DevTools → Network 탭 → Offline 모드 활성화
2. 확장 프로그램 팝업 열기
3. 에러 메시지가 표시되는지 확인

**예상 결과**: 
```
"방금 전 갱신 (오류: Failed to fetch...)"
```

#### 4. CSP 테스트
1. Chrome → `chrome://extensions/` 이동
2. "오류" 버튼 확인
3. CSP 관련 오류가 없는지 확인

**예상 결과**: 오류 없음

---

## ⚠️ 중요 주의사항

### 건드리면 안 되는 코드

다음 부분은 **반드시 테스트 후에만** 수정해야 합니다:

#### 1. 정규식 패턴 (`content.js` 35-36줄)
```javascript
const DOLLAR_REGEX = /(-?)\$\s?([\\d,]+(?:\\.\\d+)?)\s?([kKmMbBtT만억조](?:n|N)?)?(?:\\s*\\(₩[^)]+\\))?/g;
const SUFFIX_REGEX = /(-?)([\\d,]+(?:\\.\\d+)?)\\s?([kKmMbBtT만억조](?:n|N)?)?\\s?(USD|USDT|USDC)(?![A-Za-z])(?:\\s*\\(₩[^)]+\\))?/gi;
```

**이유**: 다양한 금액 형식 인식, 엣지 케이스 처리

#### 2. 환율 변환 로직 (`content.js` 78-98줄)
```javascript
function convertToKRW(match, sign, numStr, unit, currency) {
  // 모든 단위 변환 (k, m, b, t, 만, 억, 조)
  // 음수 처리
}
```

**이유**: 핵심 비즈니스 로직, 금액 계산 정확성

#### 3. MutationObserver 설정 (`content.js` 207-224줄)
```javascript
obs.observe(document.body, { 
  subtree: true, 
  childList: true, 
  characterData: true 
});
```

**이유**: 성능 직접 영향, 메모리 사용량 결정

#### 4. API 폴백 로직 (`background.js` 169-204줄)
```javascript
async function fetchUsdKrwRate(startIndex = 0) {
  // 3개 API 순차 시도
}
```

**이유**: 안정성 보장, 환율 데이터 가용성

### 수정 시 반드시 해야 할 것

1. **변경 전 백업**: Git 커밋으로 자동 백업됨
2. **충분한 테스트**: 모든 엣지 케이스 확인
3. **CHANGELOG 업데이트**: 변경 사항 문서화
4. **버전 증가**: manifest.json 버전 업데이트

---

## 📌 다음 단계 (Medium Priority)

v1.2.0에서 적용할 예정:

1. **코드 중복 제거**
   - 공통 유틸 함수 추출
   - 토글 핸들러 추상화

2. **JSDoc 타입 주석**
   - 모든 public 함수에 타입 정보
   - IDE 자동완성 지원

3. **정규식 개선**
   - 엣지 케이스 추가 처리
   - 성능 최적화

4. **매직 넘버 상수화**
   - `1300`, `500` 등을 상수로 분리
   - 설정 파일 생성 고려

---

## 🎓 배운 교훈

### Git 버전 관리의 중요성

- **변경 추적**: 언제 무엇이 변경되었는지 명확히 파악
- **롤백 가능**: 문제 발생 시 이전 버전으로 쉽게 복원
- **협업 용이**: 여러 개발자가 동시에 작업 가능

### 문서화의 가치

- **CHANGELOG.md**: 사용자가 변경 사항을 쉽게 이해
- **CONTRIBUTING.md**: 새 개발자 온보딩 시간 단축
- **주석**: 코드 유지보수 용이성 향상

### 체계적인 개선 프로세스

1. 코드 리뷰로 문제점 발견
2. 우선순위 설정 (High/Medium/Low)
3. 계획 수립 (implementation_plan.md)
4. 단계별 실행 및 테스트
5. 문서화 및 버전 태그

---

## 📞 문의 및 이슈

- **Discord**: [커뮤니티](https://discord.gg/5msPwkj2J5)
- **GitHub Issues**: 버그 리포트 및 기능 요청
- **이메일**: developer@krwmaster.local

---

**작성자**: AI Code Reviewer  
**작성일**: 2026-01-18  
**버전**: v1.1.0

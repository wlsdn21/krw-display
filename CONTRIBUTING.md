# 개발 가이드라인

원화표시기 Chrome 확장 프로그램 개발에 참여해주셔서 감사합니다.

## 📋 목차

1. [변경 시 주의사항](#변경-시-주의사항)
2. [코드 스타일](#코드-스타일)
3. [커밋 메시지 규칙](#커밋-메시지-규칙)
4. [테스트 가이드](#테스트-가이드)
5. [개발 워크플로우](#개발-워크플로우)

---

## 🚫 변경 시 주의사항

### 절대 변경 금지 영역

다음 영역은 **매우 신중하게 검토 후에만** 변경해야 합니다:

#### 1. 정규식 패턴 (`content.js` 라인 35-36)

```javascript
const DOLLAR_REGEX = /(-?)\$\s?([\\d,]+(?:\\.\\d+)?)\s?([kKmMbBtT만억조](?:n|N)?)?(?:\\s*\\(₩[^)]+\\))?/g;
const SUFFIX_REGEX = /(-?)([\\d,]+(?:\\.\\d+)?)\\s?([kKmMbBtT만억조](?:n|N)?)?\\s?(USD|USDT|USDC)(?![A-Za-z])(?:\\s*\\(₩[^)]+\\))?/gi;
```

**이유:**
- 수많은 엣지 케이스를 처리하도록 최적화됨
- 다양한 형식의 금액 표기를 인식 ($100, $1,234.56, $100k, 100만원 등)
- 이미 변환된 텍스트 재변환 방지

**변경 시 필수 테스트:**
- [ ] `$100`, `$1,234.56`, `$1.5m` 형식
- [ ] `100 USD`, `50 USDT`, `200 USDC` 형식
- [ ] 음수 금액: `-$100`, `$-50`
- [ ] 한국어 단위: `100만`, `50억`, `1조`
- [ ] 영어 단위: `100k`, `50m`, `1b`, `5t`
- [ ] 이미 변환된 텍스트: `$100 (₩130,000)` → 재변환 안 됨

---

#### 2. 환율 변환 로직 (`content.js` 라인 78-98)

```javascript
function convertToKRW(match, sign, numStr, unit, currency) {
  // 핵심 비즈니스 로직
}
```

**이유:**
- 핵심 비즈니스 로직
- 모든 단위 변환 및 음수 처리 포함

**변경 시 필수 테스트:**
- [ ] 모든 영어 단위 (k, m, b, t, kn, mn, bn, tn)
- [ ] 모든 한국어 단위 (만, 억, 조)
- [ ] 음수 금액 정확한 표시
- [ ] 큰 숫자 정확성 (JavaScript Number 정밀도 한계)

---

#### 3. MutationObserver 설정 (`content.js` 라인 207-224)

```javascript
obs = new MutationObserver(mutations => {
  if (!isEnabled) return;
  pendingMutations.push(...mutations);
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(processPendingMutations);
  }
});

obs.observe(document.body, { 
  subtree: true, 
  childList: true, 
  characterData: true 
});
```

**이유:**
- 성능에 직접적 영향
- 메모리 사용량 및 CPU 사용률 결정
- RAF(RequestAnimationFrame)와 조합으로 최적화됨

**변경 시 필수 확인:**
- [ ] 메모리 사용량 (Chrome DevTools Performance)
- [ ] CPU 사용률 (장시간 실행)
- [ ] DOM 업데이트 속도 (큰 페이지에서)

---

#### 4. API 폴백 순서 (`background.js` 라인 169-204)

```javascript
async function fetchUsdKrwRate(startIndex = 0) {
  for (let i = 0; i < FX_APIS.length; i++) {
    const apiIndex = (startIndex + i) % FX_APIS.length;
    // ...
  }
}
```

**이유:**
- 안정성을 위한 신중한 설계
- 마지막 성공 API부터 시도하여 효율성 향상
- API 실패 시 순차적 폴백

**변경 시 필수 테스트:**
- [ ] 첫 번째 API 실패 시 두 번째 API 시도
- [ ] 모든 API 실패 시 캐시된 환율 사용
- [ ] 마지막 성공 API부터 시작 확인

---

### ⚠️ 주의해서 변경해야 하는 부분

#### 1. CSS 애니메이션 (`popup.css`)

**변경 전:**
- 성능 프로파일링 실행 (60fps 유지 확인)
- `will-change` 속성 신중히 사용 (메모리 사용량 증가)

**권장 속성:**
- `transform`, `opacity` (GPU 가속)
- `transition` duration: 0.3s 이하

**비권장 속성:**
- `width`, `height`, `top`, `left` (리플로우 유발)

---

#### 2. Storage 키 이름

**현재 사용 중인 키:**
```javascript
{
  usdkrw,              // 현재 환율
  rateSource,          // 환율 소스 ('usd_krw', 'upbit_usdt', 'upbit_usdc', 'custom')
  customRateValue,     // 사용자 지정 환율
  isEnabled,           // 변환 기능 활성화 여부
  showBillionUnit,     // 억 단위 표시
  showTrillionUnit,    // 조 단위 표시
  decimalPlaces,       // 소수점 자릿수
  applyToAllSites,     // 모든 사이트 적용 여부
  enabledSites,        // 활성화된 사이트 목록
  lastFetchTime,       // 마지막 환율 갱신 시간
  lastFetchStatus,     // 마지막 갱신 상태 ('success', 'failed')
  standardRate,        // 표준 환율 (김치 프리미엄 계산용)
  currentApiIndex      // 마지막 성공 API 인덱스
}
```

**변경 시:**
- 하위 호환성 고려 (기존 사용자 데이터 마이그레이션)
- 기본값 설정 필수
- CHANGELOG에 명시

---

#### 3. Manifest 권한

**현재 권한:**
- `storage`: 설정 저장
- `alarms`: 주기적 환율 갱신

**추가 시:**
- 최소 권한 원칙 유지
- 사용자 프라이버시 고려
- 필요성 문서화

---

#### 4. DOM 업데이트 로직 (`content.js` 라인 135-145)

```javascript
const processNode = (node) => {
  if (node.nodeType === 3) {
    const original = node.nodeValue;
    if (!original || original.length > MAX_TEXT_LENGTH) return;
    
    const transformed = transform(original);
    if (original !== transformed) {
      node.nodeValue = transformed;
    }
  }
};
```

**변경 시 주의:**
- `MAX_TEXT_LENGTH` (500) 변경 시 성능 영향 고려
- `nodeValue` 직접 수정 (무한 루프 방지)

---

## 🎨 코드 스타일

### JavaScript

```javascript
// ✅ Good
function formatKRW(value) {
  const isNegative = value < 0;
  const abs = Math.abs(value);
  // ...
}

// ❌ Bad
function formatKRW(v){
  if(v<0){
    // ...
  }
}
```

**규칙:**
- **들여쓰기:** 2 spaces
- **세미콜론:** 사용
- **따옴표:** 작은따옴표 (`'`)
- **함수명:** camelCase
- **상수명:** UPPER_SNAKE_CASE
- **화살표 함수:** 간단한 콜백에 사용

---

### 주석

```javascript
/**
 * USD를 KRW로 변환
 * @param {number} usd - USD 금액
 * @returns {string} 포맷된 KRW 문자열
 */
function convertToKRW(usd) {
  // ...
}
```

**규칙:**
- JSDoc 스타일 사용
- 파라미터 타입 명시
- 복잡한 로직에는 인라인 주석

---

## 📝 커밋 메시지 규칙

### 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 스타일 (포맷팅, 세미콜론 등)
- `refactor`: 리팩토링
- `perf`: 성능 개선
- `test`: 테스트 추가/수정
- `chore`: 빌드, 설정 변경

### Scope

- `content`: content.js
- `background`: background.js
- `popup`: popup.js, popup.html, popup.css
- `manifest`: manifest.json
- `docs`: 문서

### 예시

```
feat(popup): add error notification UI

- Add error message display area
- Show API failure details to user
- Improve UX when rate fetch fails

Closes #5
```

---

## 🧪 테스트 가이드

### 수동 테스트 체크리스트

#### 기본 기능
- [ ] Binance.com에서 USD 변환 확인
- [ ] Hyperliquid.xyz에서 USDT 변환 확인
- [ ] 음수 금액 표시 확인 (`-$100`)
- [ ] 억/조 단위 표시 확인

#### 설정 변경
- [ ] 환율 소스 변경 (USD/KRW, Upbit USDT, Upbit USDC, 사용자 지정)
- [ ] 억/조 단위 토글
- [ ] 소수점 자릿수 변경 (0-4)
- [ ] 환율 변환 ON/OFF

#### 사이트 관리
- [ ] 새 사이트 추가
- [ ] 사이트 제거
- [ ] 모든 사이트 모드로 전환

#### 성능
- [ ] 큰 페이지에서 지연 없음 확인
- [ ] 메모리 누수 확인 (장시간 실행)
- [ ] CPU 사용률 정상 범위

#### 에러 처리
- [ ] 네트워크 차단 시 동작 확인
- [ ] 잘못된 사이트 입력 처리

---

## 🔄 개발 워크플로우

### 1. 브랜치 생성

```bash
git checkout -b feature/new-feature
# or
git checkout -b fix/bug-description
```

### 2. 코드 작성 및 테스트

```bash
# 코드 작성
# 테스트 실행
# Chrome에서 확장 프로그램 재로드 및 확인
```

### 3. 커밋

```bash
git add .
git commit -m "feat(scope): description"
```

### 4. CHANGELOG 업데이트

```markdown
## [Unreleased]

### Added
- 새로운 기능 설명
```

### 5. 버전 태그 (릴리스 시)

```bash
# package 버전 업데이트
# manifest.json 버전 업데이트
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

---

## 💡 유용한 팁

### Chrome 확장 프로그램 디버깅

1. **콘솔 접근:**
   - Content Script: 웹 페이지 개발자 도구
   - Background: `chrome://extensions/` → "서비스 워커 검사"
   - Popup: 팝업 우클릭 → "검사"

2. **에러 확인:**
   - `chrome://extensions/` → "오류" 탭

3. **Storage 확인:**
   ```javascript
   chrome.storage.local.get(null, console.log);
   ```

### 성능 모니터링

```javascript
const start = performance.now();
// 코드 실행
const end = performance.now();
console.log(`Execution time: ${end - start}ms`);
```

---

## 📚 참고 자료

- [Chrome Extension 공식 문서](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 가이드](https://developer.chrome.com/docs/extensions/mv3/)
- [JavaScript Best Practices](https://github.com/airbnb/javascript)
- [Semantic Versioning](https://semver.org/lang/ko/)

---

## 🆘 도움이 필요하신가요?

- **Discord**: [커뮤니티 참여](https://discord.gg/5msPwkj2J5)
- **이슈**: GitHub Issues로 버그 리포트 및 기능 요청

---

**감사합니다! 🙏**

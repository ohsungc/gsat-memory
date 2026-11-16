# GSAT 단순암기 — v1.8 모듈형 + 모바일 숫자 키패드

**v1.7 분리형 구조를 유지하고 알파벳 문제풀이(일반/FEVER/오답 복습)에 0–9 자체 키패드를 추가한 정적 웹앱입니다.** Node.js, 빌드 툴, Git, 서버 프로그램 설치 없이 GitHub Pages로 배포할 수 있습니다.

## 폴더 구조

```text
index.html              # HTML 구조 · 외부 파일 연결만 담당
css/
  base.css              # 기본 UI
  keypad.css            # 모바일 알파벳 숫자 키패드
  table.css             # 표 탐색·모바일 표
  logic.css             # 집합/다이어그램 화면
  fever.css             # FEVER 효과/타이머 UI
  progress.css          # 연산·오답 모니터
js/
  core/
    state.js            # 저장·설정·문제 등록 API
    views.js            # 홈·암기·설정 화면
    progress.js         # 오답 기록·복습
    fever.js            # FEVER 규칙·점수·타이머
    session.js          # 문제 진행·정답·채점
    effects.js          # 효과음·폭죽
  games/
    alphabet.js         # 알파벳 + 모바일 숫자 키패드
    fractions.js        # 분수 비율·응용
    arithmetic.js       # 나누기·백분율 역산·분수 크기 비교
    table.js            # 표 탐색
    diagrams.js         # 벤 다이어그램
    reasoning.js        # 명제 추론
  main.js               # 앱 시작·서비스워커 등록
icons/                  # 홈 화면 아이콘
manifest.webmanifest    # PWA 설정
sw.js                   # 오프라인 캐시
.nojekyll               # GitHub Pages 용도
```

## GitHub Pages 업로드: PC 설치 없음

1. ZIP을 다운로드해 압축을 풉니다. GitHub에 공유하는 PC 폴더가 아니라, 업로드할 파일을 모아 두는 일반 폴더입니다.
2. 저장소의 **Code → Add file → Upload files**에서 `index.html`, `css` 폴더, `js` 폴더, `icons` 폴더, `sw.js`, `manifest.webmanifest`, `.nojekyll`을 업로드합니다. **폴더 구조를 유지**하세요. `index.html`이 저장소 루트에 있어야 합니다.
3. **Commit changes** → **Settings → Pages → Deploy from a branch → main / (root)**.
4. 게임 주소: `https://ohsungc.github.io/gsat-memory/`.
5. 구버전이 보이면 Ctrl+Shift+R 새로고침. PWA 설치했다면 오래된 서비스워커가 활성화될 수 있으므로 사이트 데이터가 아닌 서비스워커 업데이트를 우선 확인하세요.

## 기존 사이트에서 교체할 때

**예전 `index.html`(합본형)은 이번 `index.html`로 교체해야 합니다.** 새 `index.html`은 `css/`와 `js/` 파일을 읽습니다. 둘 중 하나라도 없거나 잘못된 경로에 있으면 게임 대신 제목만 보일 수 있습니다. `css` 폴더와 `js` 폴더 내부까지 전체 업로드한 것을 확인하세요.

## 소스 확장 방법

이 버전은 **빌드 툴 없는 순서 지정 classic script 구성**입니다. 기존 v1.6에서 사용하던 최상위 함수와 상태를 동일하게 유지하기 위해 JS 파일들이 브라우저의 공통 최상위 스코프를 공유합니다. `index.html`의 `<script defer>` 로드 순서를 변경하지 마세요.

게임 하나를 추가하려면 `js/games/new-game.js`를 만들고 아래 형태의 코드를 작성합니다.

```js
'use strict';
registerMode({
  key: 'new-game',
  title: '새 훈련',
  subtitle: '연습 설명',
  tag: 'NEW GAME',
  art: '42',
  makeQuestion: () => ({answer:42,answerText:'42'}),
  render: () => '<section class="question-card"><h2>정답은?</h2><button data-ans="42">42</button></section>',
  mount: (q,{root,submit}) => root.querySelector('[data-ans]').addEventListener('click',e=>submit(42,e.currentTarget)),
  checkAnswer: (q,answer) => answer===q.answer
});
```

`index.html`에서 `js/games/reasoning.js` **뒤**, `js/main.js` **앞**에 `<script src="./js/games/new-game.js" defer></script>`를 추가합니다. 오프라인 지원을 위해 `sw.js`의 `FILES`에도 경로를 넣고 `CACHE` 버전을 변경합니다. 향후 규모가 커지면 ES Modules + 번들러로 이전할 수도 있습니다.

## 확인 및 제한

- 기존 localStorage 키 `gsat-speed-lab-v1`은 그대로 사용하며 오답노트/FEVER 기록 형식을 유지합니다.
- 인터넷에서 정적 웹 호스팅을 사용할 때 PWA 오프라인 캐시가 동작합니다. 로컬 파일(`file://`) 실행 시 서비스워커만 비활성화됩니다.
- 실제 시험 문제를 복제한 공식 앱이 아니라 비공식 훈련용 게임입니다.
- 게임 데이터는 별도 계정이나 서버로 전송하지 않고 현재 브라우저 localStorage에 저장합니다.

## v1.8 모바일 키패드

- 알파벳 번호 풀이 화면(화면 폭 720px 이하)에 1–9 / 지우기·0·확인 키패드를 표시합니다.
- 휴대폰에서는 기본 소프트 키보드가 나타나지 않습니다. PC에서는 기존처럼 숫자 입력과 Enter 제출이 가능합니다.
- 두 자리 입력 후 다른 숫자를 누르면 새 숫자로 교체됩니다. 오답노트/FEVER의 점수 계산과 저장 형식은 바뀌지 않았습니다.
- 업데이트 시 `index.html`, `css/keypad.css`, `js/games/alphabet.js`, `js/core/state.js`, `sw.js`를 포함해 전체 파일 구조를 유지해야 합니다.

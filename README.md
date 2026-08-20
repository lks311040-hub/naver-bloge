# 네이버 블로그 자동화 대시보드

로컬 PC에서 실행되는 반자동 네이버 블로그 홍보글 작성/발행 도구입니다.
AI가 본문을 쓰고, 사람이 검토·승인하면, 네이버 스마트에디터 화면에 자동으로 채워 넣습니다.
**로그인과 최종 발행 버튼만큼은 항상 사람이 직접 누릅니다.**

## 사전 준비

- **Node.js** (v20 이상 권장, 이 프로젝트는 v24로 개발/테스트함)
- **Microsoft Edge** — Windows에 기본 설치되어 있으면 됨 (경로: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`)
- **클로드 코드(Claude Code) 로그인** — 이 PC의 터미널에서 `claude` 명령으로 구독 로그인이 되어 있어야 AI 본문 생성이 동작합니다. `ANTHROPIC_API_KEY` 환경변수는 **설정하지 마세요** — 설정돼 있으면 과금 API로 전환되어 이 프로그램의 설계 의도와 어긋납니다.

## 설치

```bash
npm install
```

설치 중 아래 메시지가 뜰 수 있습니다 (native 모듈 postinstall 스크립트 승인 절차, npm 11+):

```
npm warn allow-scripts N packages have install scripts not yet covered by allowScripts
```

`npm approve-scripts --allow-scripts-pending`로 확인 후, 필요한 것만 승인하면 됩니다. 이 프로젝트에서는:
- **esbuild**: 승인 필요 (플랫폼 바이너리를 연결하는 스크립트라 실제로 필요함)
- **better-sqlite3**: 승인 **불필요** — 최신 버전은 미리 빌드된 바이너리(prebuild)를 내장하고 있어서, npm이 기본적으로 시도하는 `node-gyp rebuild`(Python 필요) 없이도 바로 동작합니다. `npm deny-scripts better-sqlite3`로 꺼두면 Python 없는 환경에서도 설치가 매끄럽습니다.
- **playwright**: 이 패키지 자체는 postinstall 스크립트가 없습니다 (브라우저 다운로드는 `npx playwright install`을 직접 실행해야만 일어남 — 이 프로젝트는 시스템에 이미 설치된 Edge(`channel: 'msedge'`)를 그대로 쓰기 때문에 **이 명령을 실행할 필요가 없습니다**. 실행하지 마세요, 불필요한 다운로드입니다.

## 실행

```bash
npm run dev
```

`server`(Express, :4000)와 `web`(Vite, :5173)이 동시에 뜹니다. 브라우저에서 **http://localhost:5173** 접속.

이미 다른 곳에서 앱을 켜둔 채로(예: git worktree에서 새 기능을 비교해볼 때) 하나 더 띄우려면 포트를 바꿔 실행합니다. `PORT`는 Express 포트, `API_PORT`는 Vite가 프록시할 대상 포트라 **둘을 같은 값으로** 줘야 합니다 (Vite 자신은 5173이 막혀 있으면 알아서 다음 포트를 잡습니다):

```bash
PORT=4001 API_PORT=4001 npm run dev
```

> **Windows 참고**: 처음에는 `concurrently` 패키지로 세 프로세스(shared/server/web)를 띄웠는데, 이 개발 환경에서 `concurrently`가 `tsx watch`(server) 자식 프로세스의 stdout을 파이프로 가로채는 과정에서 간헐적으로 완전히 멈춰버리는 문제가 있었습니다 (shared/web은 항상 정상 출력됐지만 server만 응답이 없었고, 포트도 끝내 열리지 않았습니다). 그래서 `concurrently`를 걷어내고 [`scripts/dev.mjs`](scripts/dev.mjs)라는 자체 오케스트레이터로 교체했습니다 — `node`로 세 프로세스를 직접 `stdio: 'inherit'`로 실행해 파이프 캡처 자체를 없앴습니다. 로그가 프리픽스 없이 섞여 나오는 대신, 안정적으로 매번 뜹니다.

## 사용 흐름

1. **홈 화면 → 업체 정보 등록**: 업체명/주소/강점/인사말/톡톡 URL/예약 URL/주소 링크/해시태그를 한 번만 입력 (이후 모든 글에 자동 재사용). 같은 화면의 **"글 종류별 첨부 요소"** 표에서 톡톡·예약·주소 링크를 홍보성/정보성 각각 붙일지 정합니다 (기본값: 홍보성은 톡톡+예약, 정보성은 없음). 켜도 해당 URL이 비어 있으면 붙지 않습니다.
2. **네이버 로그인**: "네이버 로그인" 버튼 → 실제로 보이는 Edge 창이 뜸 → **그 창에서 직접** 로그인 (이 프로그램은 아이디/비밀번호를 절대 대신 입력하지 않음) → 세션이 저장되어 다음부터는 로그인 불필요.
3. **새 홍보글 작성**: 제목/키워드/강조 내용을 입력 → AI 초안 생성 (보통 3~9분 소요, 실시간 로그 표시).
4. **초안 검토** (`초안` 메뉴): 블록별로 미리보기, 사진/영상 자리에 실제 파일 업로드, 톡톡/예약/관련글 링크 문구 수정 → **승인**.
5. **자동입력**: 승인된 글에서 "네이버 에디터에 자동입력" 클릭 → 실제 네이버 글쓰기 화면이 열리고 제목/본문/서식/사진/영상/장소위젯까지 자동으로 채워짐. **발행 버튼은 이 프로그램이 절대 누르지 않습니다.**
6. **직접 발행**: 열려 있는 그 창에서 내용을 확인하고 자유롭게 더 고친 뒤, 직접 발행 버튼 클릭.
7. **발행완료로 표시**: 대시보드로 돌아와 실제 발행된 글 주소를 입력하면 "발행 이력"에 기록되고, 다음 글의 "관련글" 자동 연결에 쓰입니다.

**예약(스케줄)**: cron 표현식으로 등록하면 지정 시각에 초안 생성까지만 자동으로 실행되고 "검토 대기" 상태로 쌓입니다. 스케줄러 코드는 자동화(Playwright) 모듈을 아예 import하지 않도록 구조적으로 막혀 있어 (`.dependency-cruiser.cjs`, `npm run depcheck`), 자동 발행이 코드 구조상 불가능합니다.

## 트러블슈팅

### PowerShell에서 매번 node/npm PATH가 안 잡힘
영구 PATH 등록을 권장하지만, 급하면 세션마다:
```powershell
$env:Path += ";C:\Program Files\nodejs"
```

### 네이버가 화면을 바꿔서 자동입력이 깨질 때
[server/scripts/inspect-editor.mjs](server/scripts/inspect-editor.mjs)를 이용해 실제 로그인 세션으로 라이브 DOM을 확인하고 셀렉터를 갱신하세요:
```bash
cd server
node scripts/inspect-editor.mjs <blogId>
```
스크린샷/HTML 덤프가 `tmp-inspect/`(프로젝트 루트, git에 안 잡힘)에 저장됩니다. 셀렉터는 [server/src/modules/automation/selectors.ts](server/src/modules/automation/selectors.ts) 한 곳에 모여 있습니다 — 이 파일만 고치면 됩니다. **이건 일회성이 아니라 네이버가 UI를 바꿀 때마다 반복해야 하는 유지보수 작업입니다.**

### AI 본문 생성이 매번 실패함
- `claude` 명령으로 이 PC가 로그인돼 있는지 확인 (`claude` 실행 후 상태 확인)
- 서버 프로세스 환경에 `ANTHROPIC_API_KEY`가 설정돼 있지 않은지 확인 (설정돼 있으면 과금 API로 강제 전환되어 이 프로그램의 설계와 맞지 않습니다 — 제거 후 서버 재시작)

### better-sqlite3 설치/로드 오류
```bash
npm rebuild better-sqlite3
```
그래도 안 되면 Node 버전이 better-sqlite3의 prebuild 지원 범위를 벗어났을 수 있습니다 — [better-sqlite3 릴리스](https://github.com/WiseLibs/better-sqlite3/releases)에서 현재 Node 버전 지원 여부 확인.

## 구조 요약

```
shared/    타입/zod 스키마 (Block 모델, 업체 프로필, 글 요청, 예약) — 서버·프론트 공통
server/
  modules/
    ai/            Claude Agent SDK 연동 (구독 재사용, JSON 스키마 구조화 출력, 자가검증 재시도)
    posts/         글 CRUD, 템플릿 조립(assemble.ts), 초안 검토용 블록 편집
    naver-session/ 로그인 세션 정보 저장/조회
    automation/    Playwright — 로그인/자동입력/장소위젯. 발행 버튼 클릭 코드가 어디에도 없음.
    scheduler/     cron 예약 — automation을 import하지 않음 (구조적으로 강제됨, 아래 참고)
    sse/           실시간 진행 로그 스트리밍
web/       React 대시보드 (업체 등록/새 글 작성/초안 검토/네이버 로그인/예약/발행 이력)
```

**scheduler → automation import 금지가 구조적으로 강제되는 이유**: 코드 리뷰나 컨벤션에 기대지 않고, `.dependency-cruiser.cjs`가 실제 import 그래프를 정적 분석해서 `npm run depcheck`(= `npm run verify`에 포함)가 이 규칙을 어기면 빌드를 실패시킵니다. 즉 누군가 실수로든 의도적으로든 스케줄러 코드에 automation import를 추가하면, 코드 리뷰 전에 이미 빌드 단계에서 걸립니다.

## 주요 npm 스크립트 (루트에서 실행)

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 전체 실행 |
| `npm run build` | 전체 빌드 (shared → server → web 순) |
| `npm run migrate` | DB 마이그레이션만 실행 |
| `npm run verify` | 전체 typecheck + depcheck (구조 규칙 검증 포함) |
| `npm run depcheck` | dependency-cruiser 구조 규칙만 검사 |

서버 워크스페이스 전용:
```bash
npm run test:ai -w server -- 3   # AI 본문 생성 3회 반복 검증 (실제 Claude 구독 호출)
```

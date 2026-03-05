# 나의 일정 관리 웹페이지 (myschedule)

개인용 할 일/일정 관리를 위한 아주 간단한 웹페이지입니다.  
데이터는 GitHub 리포지토리의 `data/todos.json` 파일과 각 브라우저의 `localStorage`에 저장됩니다.

## 구성 파일

- `index.html` – 메인 화면 (입력 폼, 목록, 필터, 비밀번호 영역)
- `style.css` – 다크 모드 기반 UI 스타일
- `app.js` – 할 일 로직 (추가/수정/삭제/정렬/필터/비밀번호/JSON 내보내기)
- `data/todos.json` – 실제 일정 데이터(JSON 배열)

## 사용 방법

1. 이 리포지토리를 로컬에 클론합니다.
2. `index.html` 파일을 브라우저(Chrome 등)에서 직접 열어 사용하거나, 간단한 정적 서버를 띄워 접속합니다.
3. 상단의 **편집 비밀번호**에 올바른 비밀번호를 입력하고 _“잠금 해제”_ 버튼을 눌러야  
   할 일 **추가/수정/삭제**가 가능합니다.

> 비밀번호는 `app.js` 상단의 `EDIT_PASSWORD` 상수에 하드코딩되어 있습니다.  
> 개인용 프로젝트이므로 코드 안에 둔 단순한 보호 방식입니다.

## 비밀번호 변경

`app.js` 파일 맨 위의 다음 부분을 원하는 값으로 수정합니다.

```js
const EDIT_PASSWORD = "myschedule123";
```

이 값을 바꾸고 저장하면, 새 비밀번호로 잠금 해제가 가능합니다.

## 할 일 데이터 구조

`data/todos.json` 파일은 다음과 같은 배열 구조를 가집니다.

```json
[
  {
    "id": 1,
    "title": "할 일 제목",
    "deadline": "2026-03-10",
    "priority": 2,
    "done": false
  }
]
```

- `id`: 숫자형 고유 ID
- `title`: 할 일 제목
- `deadline`: `"YYYY-MM-DD"` 형태의 마감일
- `priority`: 우선순위 숫자 (1이 가장 중요)
- `done`: 완료 여부

## 정렬 및 필터 규칙

- **정렬**
  - 마감일이 빠른 순으로 우선 정렬
  - 마감일이 같으면 `priority`(숫자 낮을수록 중요) 기준으로 정렬
- **필터**
  - 전체: 모든 할 일
  - 오늘: 오늘 마감이며 `done=false`인 할 일
  - 미완료만: `done=false`인 모든 할 일
  - 완료만: `done=true`인 할 일

## 브라우저 저장(localStorage)과 GitHub 파일 동기화

1. 브라우저에서 할 일을 추가/수정/삭제하면, 우선 해당 브라우저의 `localStorage`에 자동 저장됩니다.
2. 우측 상단의 **“JSON 내보내기”** 버튼을 누르면, 현재 화면의 할 일 목록이 `todos.json` 파일로 다운로드됩니다.
3. 다운로드된 `todos.json` 파일의 내용을 리포지토리의 `data/todos.json`에 덮어씁니다.
4. Git으로 `git add`, `git commit`, `git push`를 실행해 GitHub에 업로드합니다.
5. 다른 컴퓨터에서는 리포지토리를 `git pull` 한 뒤 `index.html`을 열면 최신 할 일 목록을 볼 수 있습니다.

> **중요 규칙**  
> - 편집을 시작하기 전에 항상 `git pull`로 최신 상태를 가져오세요.  
> - 편집이 끝난 후에는 `JSON 내보내기` → `data/todos.json` 갱신 → `git commit` + `git push` 순서로 진행하세요.

## GitHub Pages 배포 (선택 사항)

1. GitHub 리포지토리의 **Settings → Pages** 로 이동합니다.
2. Branch를 `main`(또는 `master`) + `/ (root)`로 설정합니다.
3. 저장 후 몇 분 기다리면, GitHub가 제공하는 URL이 활성화됩니다.
   - 예: `https://USERNAME.github.io/myschedule/`
4. 이 URL로 접속하면 어디서나 웹페이지를 볼 수 있습니다.
5. 여전히 데이터는 `data/todos.json` 파일을 통해 관리되므로,
   - 한 컴퓨터에서 **JSON 내보내기 → data/todos.json 반영 → 커밋/푸시**  
   - 다른 컴퓨터에서 **pull 후 접속**  
   패턴으로 사용하면 됩니다.

## 여러 컴퓨터에서 사용하는 흐름 예시

1. A 컴퓨터
   - 리포지토리를 클론 또는 `git pull`
   - `index.html`을 열어 할 일을 편집
   - `JSON 내보내기`로 JSON 다운로드
   - `data/todos.json`에 덮어쓰기
   - `git add`, `git commit`, `git push`
2. B 컴퓨터
   - `git pull`로 최신 `data/todos.json` 가져오기
   - `index.html`을 열어 확인/편집
   - 동일한 방식으로 다시 `JSON 내보내기` → 커밋/푸시

이 과정을 지키면, GitHub를 통해 항상 최신 일정이 동기화됩니다.


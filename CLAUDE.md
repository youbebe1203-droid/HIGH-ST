# HIGH.ST

고등학생 학습 커뮤니티 웹앱. 단일 HTML 파일, CDN 기반 React.

## 스택
- **Frontend**: React 18 (CDN) + Babel (JSX) + Tailwind CSS (CDN)
- **Backend**: Firebase Auth / Firestore / Storage
- **배포**: GitHub Pages (GitHub Actions 자동 배포)
- **빌드 도구**: 없음 (npm 불필요)

## 핵심 원칙
- 모든 코드는 `index.html` 한 파일 안에 있다. 파일을 분리하지 않는다.
- npm / webpack / Vite 등 빌드 도구를 도입하지 않는다.
- Firebase SDK는 CDN compat 버전(`firebase-xxx-compat.js`)을 사용한다.

## 인증 방식
사용자가 입력한 ID를 `{id}@highst.app` 형식의 이메일로 변환하여 Firebase Auth에 전달한다.
사용자 화면에는 ID / 비밀번호만 표시되며, 이메일은 내부적으로만 사용된다.

비밀번호는 Firebase Auth가 관리하며 클라이언트에 노출되지 않는다.

## Firestore 구조

```
users/{uid}
  ├── id           string   사용자가 설정한 ID (예: "hongildong")
  ├── name         string
  ├── school       string
  ├── role         string   "학생" | "선생님" | "관리자"
  ├── theme        string   "light" | "dark" | "midnight"
  ├── studyTime    number   누적 공부 시간(초)
  ├── studyDate    string   마지막으로 studyTime을 저장한 날짜 (YYYY-MM-DD)
  ├── suneungDate  string   목표 수능일 (YYYY-MM-DD)
  ├── todos/{todoId}
  │     text: string, completed: boolean, date: string
  └── inbox/{msgId}
        from: string, to: string, text: string, time: string

announcements/{id}
  title, content, date, authorUid

events/{id}
  day, month, year, text, color

resources/{id}
  title, subject, authorUid, authorName,
  fileName, storagePath, downloadURL, createdAt(Timestamp)

userIds/{chosenId}        ← ID → UID 매핑 (DM 주소 조회 전용)
  uid: string
```

**Firebase Storage 경로**: `resources/{uid}/{timestamp}_{filename}`

## Firebase 설정

`index.html` 상단의 `firebaseConfig` 객체에 Firebase 콘솔 값을 채운다.

```javascript
// ⚠️ TODO: 아래 값을 Firebase 콘솔 > 프로젝트 설정 > 웹 앱에서 복사
const firebaseConfig = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId:             "YOUR_APP_ID"
};
```

이 값은 Firebase 웹 SDK의 표준 패턴으로 클라이언트에 노출되어도 무방하다.
서버 시크릿(Service Account 키 등)은 절대 이 파일에 넣지 않는다.

## Firestore 보안 규칙

Firebase 콘솔 → Firestore → Rules 탭에서 직접 설정한다 (파일 없음).

**핵심 규칙 요약:**
- `users/{uid}/todos` — 본인만 읽기/쓰기
- `users/{uid}/inbox` — 본인만 읽기, 로그인한 사용자 누구나 create (DM 수신)
- `announcements`, `events` — 읽기: 로그인 사용자 전체, 쓰기: 선생님/관리자만
- `resources` — 읽기: 로그인 사용자 전체, 쓰기: 본인
- `userIds` — 읽기: 로그인 사용자 전체, 쓰기: 본인만

## 배포

`main` 브랜치에 push → GitHub Actions (`.github/workflows/deploy.yml`)가 자동 배포.

**초기 설정 1회:**
1. 저장소 Settings → Pages → Source: **GitHub Actions**로 변경
2. 첫 push 후 Actions 탭에서 배포 확인

라이브 URL: `https://{username}.github.io/{reponame}/`

## 로컬 테스트

```bash
# 방법 1: HTML 파일 직접 열기 (대부분의 경우 동작)
start index.html

# 방법 2: 로컬 HTTP 서버 (CORS 이슈 발생 시)
npx serve .
```

## 역할 시스템

| 역할 | 권한 |
|------|------|
| 학생 | 기본 기능 전체 (플래너, 자료실, 메시지 등) |
| 선생님 | 공지사항 등록, 달력 이벤트 추가 |
| 관리자 | 선생님과 동일 |

> **TODO**: 현재 역할은 설정 화면에서 자가 설정 가능하다. 추후 보안 규칙을 강화하여 관리자만 역할을 변경할 수 있도록 제한할 것.

## 주의사항

- **studyTime은 타이머 정지 시에만 Firestore에 저장한다.**  
  매초 저장하면 Firestore 쓰기 비용이 폭증하므로 절대 변경하지 않는다.
- **userIds 컬렉션 문서는 삭제하지 않는다.**  
  ID → UID 매핑이 없어지면 DM 전송이 불가능해진다.
- **실시간 리스너(onSnapshot)는 공용 데이터에만 적용된다.**  
  개인 todos/inbox는 로그인 시 1회 읽기로 충분하다.

## 코드 구조 (index.html 내부)

### FS — Firebase 서비스 레이어
모든 Firestore/Storage 호출은 `FS` 네임스페이스를 통해서만 한다. 컴포넌트 내에서 `db.collection()` 직접 호출 금지.

```javascript
// 예시
await FS.addPost({ title, content, authorUid });
await FS.updateUser(uid, { theme: 'dark' });
const unsub = FS.listenPosts(snap => setPosts(...), err => ...);
```

### S — 공통 인라인 스타일 상수
반복되는 인라인 스타일은 `S` 객체를 사용한다.

```javascript
// 예시
<div style={{...S.glassCard, padding:'24px'}}>
<button style={S.btnPrimary}>확인</button>
```

### Context
- `AuthContext` — currentUser, userRole, theme
- `DataContext` — todos, posts, resources, announcements, rooms, studyGroups, calendarGroup, calendarEvents
- `StudyContext` — studyTime, suneungDate, selectedDate

## 새 기능 추가 방법

1. Firestore에 새 컬렉션 추가
2. Firebase 콘솔 → Firestore → Rules에서 읽기/쓰기 규칙 추가
3. `FS` 객체에 해당 컬렉션 헬퍼 함수 추가
4. `index.html`의 `App` 컴포넌트에 상태 및 핸들러 함수 추가
5. `loadData` 함수에 초기 로드 로직 추가 (onSnapshot 또는 .get())
6. 새 뷰 컴포넌트 작성 후 사이드바 네비게이션에 연결

## Android 앱 빌드

### PWA (Android 홈화면 설치 — 현재 지원)
`manifest.json` + `service-worker.js` 이미 포함됨.  
Android Chrome → 주소창 메뉴 → **"홈 화면에 추가"** 또는 설치 배너 탭

Chrome DevTools → Lighthouse → PWA 점수로 상태 확인 가능.

### TWA (Play Store 등록 — 선택사항)
PWA가 안정화된 후 Bubblewrap CLI로 APK 빌드.

**사전 요건:**
- Node.js 설치
- Java JDK 11+
- Android SDK (또는 Android Studio)

**빌드 절차:**
```bash
npm install -g @bubblewrap/cli
mkdir highst-android && cd highst-android
bubblewrap init --manifest https://{username}.github.io/HIGH-ST/manifest.json
# 설정 입력: package=com.highst.app, host={username}.github.io
bubblewrap build
# → app-release-signed.apk 생성
```

Play Store 등록: Google Play Console → 앱 만들기 → APK 업로드 → 개인정보처리방침 URL 필요.

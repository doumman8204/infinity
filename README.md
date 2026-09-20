# INFINITY Program 크루즈 승무원 홍보·상담 웹앱

## 폴더 구조 (무엇이 어디에 있나요?)

```
Cruise/
├── index.html          ← 방문자가 보는 메인 화면 (2단계에서 만듦)
├── mypage.html         ← 내 신청 확인 화면 (9단계)
├── admin.html          ← 관리자 화면: 신청 목록·답변·상태, 알림 이메일 설정 (10단계)
│                          (메인 화면에 링크 없음 → 주소를 즐겨찾기해서 사용)
├── css/                ← 디자인(색상·글꼴·배치) 파일
├── js/                 ← 동작(버튼·신청서 전송 등) 파일
├── images/
│   ├── photos/         ← PDF에서 꺼낸 사진 (webp 형식, 용량 압축됨)
│   └── qr/             ← 메신저 QR 코드 (카카오·위챗·WhatsApp)
├── apps-script/        ← 구글 Apps Script에 붙여넣을 코드 (8단계)
└── docs/               ← 개발 중 확인용 자료 (실제 앱에는 쓰이지 않음)
```

## 사진 이름 규칙

| 앞글자 | 뜻 | 쓰이는 섹션 |
|---|---|---|
| `logo-` | 로고 | 상단·하단 |
| `ship-`, `ocean-`, `city-` | 크루즈·바다 풍경 | 첫 화면, 배경 |
| `cruise-` | 크루즈 정보 (파트너사, 크기, 직업) | 국제 크루즈란? |
| `center-` | 인피니티 교육센터 | 교육센터 소개 |
| `hotel-` | 5성급 인턴십 호텔 | 호텔 인턴십 |
| `interview-`, `crew-` | 면접·합격·승무원 | 합격 과정 |
| `bcu-`, `arrival-`, `orientation-` | 버밍험 Diploma | 버밍험 특별관 |
| `house-a-` / `house-b-` | 숙소 A형(Vipod) / B형(One-Stop) | 숙소 안내 |

## 연결 정보

- 구글 시트 ID: `1sKLlJe5T7gCkvBVkIC_8uvIRGELhzCajqZW2Ehm0kHI`
- Apps Script 주소: `https://script.google.com/macros/s/AKfycbyth25NRtozjkXZirlrAGepL7ppIpoyJQZ9sSBh3cqNi61I3fz6j3MDCxGRej_W8uHieA/exec`
- 카카오 오픈채팅: https://open.kakao.com/o/sdRMEuIi (ID: edgarleeyt)
- 위챗 ID: edgarleech
- WhatsApp: https://wa.me/qr/HMQUC5RYMIVKO1 (+60 11-5392-1378)
- 한국 전화: 010-4374-8204

## 언어 (12단계)

앱은 🇬🇧 영어 · 🇰🇷 한국어 · 🇨🇳 중국어 세 가지로 보입니다.
화면 위쪽 국기를 누르면 바로 바뀌고, 다음 방문에도 고른 언어가 기억됩니다.

처음 들어온 사람에게는 **브라우저에 설정된 언어**로 보여 줍니다.
한국어 설정이면 한국어, 중국어 설정이면 중국어, 그 밖에는 모두 영어입니다.

### 번역문 고치는 법

| 파일 | 무엇이 들어 있나 |
|---|---|
| `js/lang-en.js` | 영어 번역문 (여기만 고치면 영어 화면이 바뀝니다) |
| `js/lang-zh.js` | 중국어 번역문 |
| `js/lang-ko.js` | 버튼을 눌러야 나타나는 한국어 문구 (예: "보내는 중…") |
| `js/i18n.js` | 언어 전환 장치 — 평소에는 건드릴 일이 없습니다 |

화면에 처음부터 보이는 **한국어 글은 `index.html` 안에 그대로** 있습니다.
한국어를 고칠 때는 `index.html`을, 영어·중국어를 고칠 때는 `lang-en.js`·`lang-zh.js`를 고치면 됩니다.

```
'hero.btnApply' : '📝 Request a free consultation',
  ↑ 번호표(그대로 두기)   ↑ 이 글자만 고치면 버튼 글자가 바뀝니다
```

번호표는 HTML의 `data-i18n="..."` 과 짝입니다.

### 언어별로 다른 점

- **상담 버튼 링크**: 한국어 → 카카오톡 / 영어 → WhatsApp / 중국어 → 위챗 QR 칸
- **관리자에게 저장되는 값**: 화면 언어와 상관없이 **항상 한국어**로 시트에 들어갑니다
  (`<option value="크루즈 면접">` 의 value 는 번역하지 않습니다)

### 일본어를 추가하려면

1. `js/lang-ja.js` 를 만들고 (`lang-en.js` 를 복사해서 일본어로 번역)
2. `index.html` · `mypage.html` 에 `<script src="js/lang-ja.js" defer></script>` 추가
3. `js/i18n.js` 맨 위의 `var SUPPORTED = ['en', 'ko', 'zh'];` 에 `'ja'` 추가

일장기 그림은 `js/i18n.js` 에 이미 들어 있습니다.

### 금액 표시와 환율

원화(KRW)가 **기준 금액**이고, 영어·중국어 화면에서는 그 아래에 작은 글씨로 환산 금액이 붙습니다.

| 화면 | 표시 |
|---|---|
| 🇰🇷 한국어 | `총 960만원` (환산 금액·환율 안내문 없음) |
| 🇬🇧 영어 | `KRW 9,600,000` + `≈ US$6,921` |
| 🇨🇳 중국어 | `960万韩元` + `≈ 46,602元` |

적용 환율 (2026년 9월 20일 기준): **1 USD = 1,387원 / 1 CNY = 206원**

각 가격표 아래에 "환율에 따라 달라질 수 있고 원화 금액이 실제 가격"이라는 안내문이 자동으로 붙습니다.
(한국어 화면에서는 비어 있어 보이지 않습니다 — `fx.note`)

#### 환율이 많이 변해서 다시 계산하고 싶을 때

`js/lang-en.js`·`js/lang-zh.js` 안에서 `≈ US$` / `≈ ` 로 시작하는 작은 글씨와,
`fx.note` 안내문의 날짜·환율 숫자를 고쳐 주세요. 원화 금액은 건드리지 않습니다.

```
'pg.v.960' : 'KRW 9,600,000<em class="fx">≈ US$6,921</em>',
                                              ↑ 여기와 fx.note 의 날짜·환율만 고치면 됩니다
```

환율이 1~2% 움직이는 정도면 "≈(약)" 표시가 있으니 굳이 고치지 않아도 됩니다.
10% 이상 움직였을 때 한 번씩 손보시길 권합니다.

### 사진 안에 박혀 있는 글자

사진 파일 자체에 한글이 들어가 있는 것은 **2장**뿐이고, 사진을 고치지 않고
그 자리에 번역된 글자를 덮어 얹는 방식으로 처리했습니다.

| 사진 | 원래 글자 | 번호표 |
|---|---|---|
| `cruise-partners.webp` | 35개사 크루즈 취업가능 | `cr.img2.cap` |
| `center-map.webp` | 도보 5분 | `ct.img8.cap` |

HTML 에서는 `<figure class="img-overlay">` 안에 사진과 `<span class="img-cap">` 이 함께 들어갑니다.
위치·색·크기는 `css/style.css` 의 `.cap-partners` / `.cap-map` 에 % 로 잡혀 있어서,
휴대폰이든 PC든 사진 크기에 맞춰 따라 움직입니다. (`cqw` = 사진 폭의 1%)

문구를 바꾸려면 다른 번역과 똑같이 `lang-en.js` · `lang-zh.js` 만 고치면 됩니다.
언어마다 글자 길이가 달라서 글자 크기는 CSS 에서 따로 정해 두었습니다.

```css
.cap-partners                      { font-size: 4.5cqw; }  /* 한국어 */
html[lang="en"]      .cap-partners { font-size: 4cqw; }    /* 영어 */
html[lang="zh-Hans"] .cap-partners { font-size: 3.7cqw; }  /* 중국어 */
```

문구를 많이 길게 바꾸면 글자가 옆으로 삐져나올 수 있으니, 바꾼 뒤 화면을 한 번 확인해 주세요.

**나머지 사진 34장은 글자가 영어이거나 글자가 없어서 그대로 씁니다.**

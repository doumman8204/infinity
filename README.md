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

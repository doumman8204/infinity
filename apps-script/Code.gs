/* =========================================================
   INFINITY Program — 구글 Apps Script (8단계)
   ---------------------------------------------------------
   하는 일
   1) 앱의 상담 신청서를 받아서 구글 시트 "신청목록"에 한 줄씩 저장
   2) "설정" 시트에 적힌 이메일 주소들(쉼표로 구분)에 새 신청 알림 메일 발송
   3) 신청자에게 "접수 확인" 메일 발송 (설정에서 끌 수 있음)
   4) (9단계) 내 신청 확인: 이메일 + 연락처 뒷자리 4개로 본인 신청 조회
      - 5번 틀리면 30분 동안 잠금
      - 조회 후 추가 질문을 남기면 시트에 저장 + 관리자에게 알림 메일
   5) (10단계) 관리자 화면(admin.html)
      - 비밀번호로 로그인 → 2시간 동안 사용 (10번 틀리면 30분 잠금 + 관리자에게 경고 메일)
      - 신청 목록 보기, 상태·담당자답변·메모 저장, 답변을 신청자에게 메일로 보내기
      - 알림 받을 이메일(여러 명) · 신청자 확인메일 · 상태 목록 설정

   처음 한 번만 할 일
   - 위쪽 함수 선택 칸에서 setup 을 고르고 ▶실행 → 권한 허용
     (시트 탭 "신청목록"·"설정"이 자동으로 만들어집니다)
   - 관리자 비밀번호 정하기: 왼쪽 ⚙(프로젝트 설정) → 맨 아래 "스크립트 속성"
     → 속성 추가 → 속성: ADMIN_PASSWORD / 값: 원하는 비밀번호(8자 이상) → 저장
   ========================================================= */

const SHEET_ID = '1sKLlJe5T7gCkvBVkIC_8uvIRGELhzCajqZW2Ehm0kHI';
const APPLY_SHEET = '신청목록';
const SETTINGS_SHEET = '설정';
const TIMEZONE = 'Asia/Seoul';

// 내 신청 확인(9단계) 보안 설정
const LOOKUP_MAX_FAIL = 5;          // 이 횟수만큼 틀리면
const LOOKUP_LOCK_MIN = 30;         // 이 시간(분) 동안 조회 잠금
const SESSION_MIN = 30;             // 조회 성공 후 추가 질문을 보낼 수 있는 시간(분)
const QUESTION_MAX_LEN = 500;       // 추가 질문 최대 글자 수
const QUESTION_MAX_PER_SESSION = 5; // 한 번 조회한 뒤 보낼 수 있는 질문 수 (도배 방지)
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

// 관리자 화면(10단계) 보안 설정
const ADMIN_MAX_FAIL = 10;          // 비밀번호를 이 횟수만큼 틀리면
const ADMIN_LOCK_MIN = 30;          // 이 시간(분) 동안 관리자 로그인 잠금
const ADMIN_SESSION_MIN = 120;      // 로그인 유지 시간(분). 화면을 쓰는 동안은 계속 연장됩니다
const REPLY_MAX_LEN = 2000;         // 담당자답변 최대 글자 수
const MEMO_MAX_LEN = 1000;          // 메모 최대 글자 수

// 신청목록 시트의 칸 이름 (칸은 "이름"으로 찾으므로 시트에서 순서를 바꿔도 됩니다)
// 기존 시트에 없는 칸(예: 10단계의 답변일시)은 자동으로 맨 오른쪽에 추가됩니다.
const HEADERS = [
  '신청번호', '접수일시', '성명', '연락처', '이메일',
  '영어회화수준', '가능언어', '관심프로그램', '개인정보동의', '유입경로',
  '상태', '담당자답변', '신청자추가질문', '메모', '답변일시',
];

// 설정 시트의 기본값 (setup 실행 시 비어 있는 항목만 채웁니다)
const DEFAULT_SETTINGS = [
  ['알림받을이메일', 'doumman8204@gmail.com', '새 신청 알림을 받을 주소. 여러 명이면 쉼표(,)로 구분'],
  ['신청자확인메일', '예', '신청자에게 접수 확인 메일을 보낼지 (예 / 아니오)'],
  ['상태목록', '신규, 상담중, 등록완료, 과정진행중, 면접준비, 합격, 보류, 취소', '관리자 화면에서 고를 수 있는 진행 상태. 쉼표(,)로 구분, "신규"는 꼭 포함'],
];

/* ---------- 1. 앱이 보낸 신청서를 받는 곳 ---------- */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = body.action || 'apply';
    if (action === 'apply') return json_(handleApply_(body));
    if (action === 'lookup') return json_(handleLookup_(body));
    if (action === 'ask') return json_(handleAsk_(body));
    if (action === 'adminLogin') return json_(handleAdminLogin_(body));
    if (action.indexOf('admin') === 0) {
      // 로그인 말고 다른 관리자 요청은 모두 "입장권"부터 확인
      if (!checkAdmin_(body.token)) {
        return json_({ ok: false, expired: true, message: '로그인 시간이 지났습니다. 비밀번호를 다시 입력해 주세요.' });
      }
      if (action === 'adminData') return json_(handleAdminData_());
      if (action === 'adminSave') return json_(handleAdminSave_(body));
      if (action === 'adminSettings') return json_(handleAdminSettings_(body));
      if (action === 'adminLogout') return json_(handleAdminLogout_(body));
    }
    return json_({ ok: false, message: '알 수 없는 요청입니다.' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, message: '서버에서 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.' });
  }
}

/* 주소를 브라우저에서 열었을 때: 서버가 살아 있는지 확인용 */
function doGet() {
  return json_({ ok: true, service: 'INFINITY Program API', step: 10 });
}

/* ---------- 2. 신청서 처리 ---------- */
function handleApply_(body) {
  // (1) 스팸 로봇 걸러내기: 사람 눈에 안 보이는 칸(website)에 값이 있으면 로봇
  if (body.website) return { ok: true, id: 'INF-000000-000' };

  // (2) 앱에서 이미 검사했지만, 서버에서도 한 번 더 검사
  const data = {
    name: clean_(body.name, 40),
    phone: clean_(body.phone, 20),
    email: clean_(body.email, 100).toLowerCase(),
    englishLevel: clean_(body.englishLevel, 60),
    languages: clean_(body.languages, 100),
    program: clean_(body.program, 60),
    source: clean_(body.source, 100),
  };
  const problem = validate_(data, body.agree === true);
  if (problem) return { ok: false, message: problem };

  // (3) 같은 사람이 버튼을 연달아 눌렀으면(10분 안) 새로 저장하지 않고 같은 신청번호를 돌려줌
  const cache = CacheService.getScriptCache();
  const dupKey = 'dup_' + data.email + '_' + data.phone.replace(/\D/g, '');
  const dupId = cache.get(dupKey);
  if (dupId) return { ok: true, id: dupId, duplicate: true };

  // (4) 동시에 여러 명이 신청해도 줄이 꼬이지 않게 잠금
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let id, row;
  try {
    const sheet = getSheet_(APPLY_SHEET, HEADERS);
    id = nextId_();
    const rec = {
      '신청번호': id,
      '접수일시': Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      '성명': data.name,
      '연락처': "'" + data.phone,     // 앞의 ' 는 "글자로 저장"하라는 뜻 (+60, 010 의 0이 사라지지 않게)
      '이메일': data.email,
      '영어회화수준': data.englishLevel,
      '가능언어': data.languages,
      '관심프로그램': data.program || '미선택',
      '개인정보동의': '동의',
      '유입경로': data.source,
      '상태': '신규',
    };
    // 시트의 칸 이름 순서대로 한 줄을 만듦 (없는 칸은 빈칸)
    row = headerRow_(sheet).map((h) => (h in rec ? safeCell_(rec[h]) : ''));
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  cache.put(dupKey, id, 600);

  // (5) 메일 발송 — 실패해도 신청 저장은 이미 끝났으므로 신청자에게는 성공으로 알림
  const settings = getSettings_();
  const memo = [];
  try {
    notifyAdmins_(id, data, settings);
  } catch (err) {
    console.error('관리자 알림 실패', err);
    memo.push('관리자 알림메일 실패: ' + err.message);
  }
  let confirmSent = false;
  if (settings['신청자확인메일'] !== '아니오') {
    try {
      confirmApplicant_(id, data, settings);
      confirmSent = true;
    } catch (err) {
      console.error('신청자 확인메일 실패', err);
      memo.push('신청자 확인메일 실패: ' + err.message);
    }
  }
  if (memo.length) writeMemo_(id, memo.join(' / '));

  return { ok: true, id: id, confirmSent: confirmSent };
}

function validate_(d, agreed) {
  if (d.name.length < 2) return '성명을 2글자 이상 입력해 주세요.';
  const digits = d.phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return '연락처를 정확히 입력해 주세요.';
  if (!EMAIL_RE.test(d.email)) return '이메일 주소 형식이 올바르지 않습니다.';
  if (!agreed) return '개인정보 수집·이용에 동의해 주셔야 신청할 수 있습니다.';
  return '';
}

/* ---------- 2-1. 내 신청 확인 (9단계) ----------
   조회에 성공하면 "입장권(token)"을 하나 발급합니다.
   추가 질문을 보낼 때는 이메일·번호 대신 이 입장권을 보여 주면 되고,
   입장권은 30분 뒤 저절로 사라집니다. (서버의 임시 저장소 CacheService에 보관) */
function handleLookup_(body) {
  const email = clean_(body.email, 100).toLowerCase();
  const last4 = String(body.phone4 == null ? '' : body.phone4).trim();
  if (!EMAIL_RE.test(email) || !/^\d{4}$/.test(last4)) {
    return { ok: false, message: '이메일과 연락처 뒷자리 숫자 4개를 정확히 입력해 주세요.' };
  }

  // (1) 이 이메일로 이미 5번 틀렸으면 잠금
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + email;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= LOOKUP_MAX_FAIL) return lockedResult_();

  // (2) 시트에서 이메일과 번호 뒷자리가 모두 맞는 신청 찾기
  const mine = findMine_(email, last4);
  if (!mine.length) {
    const count = fails + 1;
    cache.put(failKey, String(count), LOOKUP_LOCK_MIN * 60);
    const left = LOOKUP_MAX_FAIL - count;
    if (left <= 0) return lockedResult_();
    // 이메일이 틀렸는지 번호가 틀렸는지는 일부러 알려 주지 않습니다 (남의 정보 추측 방지)
    return { ok: false, remaining: left, message: '일치하는 신청 내역이 없습니다. 이메일과 번호를 다시 확인해 주세요. (남은 시도 ' + left + '번)' };
  }

  // (3) 성공: 틀린 횟수 초기화 + 입장권 발급
  cache.remove(failKey);
  const token = Utilities.getUuid();
  cache.put('tok_' + token, JSON.stringify({ email: email, last4: last4, asked: 0 }), SESSION_MIN * 60);
  return { ok: true, token: token, sessionMinutes: SESSION_MIN, items: mine.map(publicView_) };
}

function lockedResult_() {
  return {
    ok: false, locked: true,
    message: '조회를 ' + LOOKUP_MAX_FAIL + '번 잘못 시도하셔서 ' + LOOKUP_LOCK_MIN +
      '분 동안 잠겼습니다. 잠시 후 다시 시도하시거나 카카오톡으로 문의해 주세요.',
  };
}

// 추가 질문 저장: "신청자추가질문" 칸에 [날짜 시간] 질문 을 한 줄씩 쌓습니다
function handleAsk_(body) {
  const cache = CacheService.getScriptCache();
  const tokenKey = 'tok_' + clean_(body.token, 60);
  const session = JSON.parse(cache.get(tokenKey) || 'null');
  if (!session) {
    return { ok: false, expired: true, message: '확인한 지 ' + SESSION_MIN + '분이 지났습니다. 이메일과 번호를 다시 입력해 주세요.' };
  }
  const question = clean_(body.question, QUESTION_MAX_LEN);
  if (question.length < 2) return { ok: false, message: '질문 내용을 2글자 이상 입력해 주세요.' };
  if (session.asked >= QUESTION_MAX_PER_SESSION) {
    return { ok: false, message: '질문은 한 번에 ' + QUESTION_MAX_PER_SESSION + '개까지 보낼 수 있습니다. 급한 내용은 카카오톡으로 문의해 주세요.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let rec;
  try {
    // 입장권 주인의 신청 중에서만 찾음 → 남의 신청번호를 넣어도 질문을 달 수 없음
    rec = findMine_(session.email, session.last4).find((r) => r['신청번호'] === body.id);
    if (!rec) return { ok: false, message: '신청 내역을 찾을 수 없습니다. 다시 조회해 주세요.' };

    const line = '[' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm') + '] ' + question;
    const before = String(rec['신청자추가질문'] || '').trim();
    rec['신청자추가질문'] = before ? before + '\n' + line : line;
    const sheet = getSheet_(APPLY_SHEET, HEADERS);
    const col = headerIndex_(sheet, '신청자추가질문') + 1;
    sheet.getRange(rec._row, col).setValue(safeCell_(rec['신청자추가질문']));
  } finally {
    lock.releaseLock();
  }

  session.asked += 1;
  cache.put(tokenKey, JSON.stringify(session), SESSION_MIN * 60); // 질문하면 입장권 시간 연장

  try {
    notifyQuestion_(rec, question, getSettings_());
  } catch (err) {
    console.error('추가질문 알림 실패', err); // 질문은 이미 시트에 저장됐으므로 신청자에게는 성공으로 알림
  }
  return { ok: true, item: publicView_(rec) };
}

// 시트 전체를 읽어서 {칸이름: 값} 모양으로 바꿈 (_row = 시트의 줄 번호)
// 칸 순서가 아니라 "칸 이름"으로 찾으므로, 시트에서 칸을 옮겨도 동작합니다.
function readApplications_() {
  const values = getSheet_(APPLY_SHEET, HEADERS).getDataRange().getValues();
  const head = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row, i) => {
    const rec = { _row: i + 2 };
    head.forEach((h, c) => { if (h) rec[h] = row[c]; });
    return rec;
  });
}

function findMine_(email, last4) {
  return readApplications_()
    .filter((r) => r['신청번호'] &&
      String(r['이메일'] || '').trim().toLowerCase() === email &&
      String(r['연락처'] || '').replace(/\D/g, '').slice(-4) === last4)
    .reverse(); // 최근 신청이 위로
}

function headerRow_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((h) => String(h).trim());
}

function headerIndex_(sheet, name) {
  const i = headerRow_(sheet).indexOf(name);
  if (i < 0) throw new Error('시트에 "' + name + '" 칸이 없습니다');
  return i;
}

// 신청자 화면에 보낼 내용: 개인정보는 가려서(마스킹) 보냅니다
function publicView_(r) {
  return {
    id: String(r['신청번호']),
    date: dateText_(r['접수일시']),
    status: String(r['상태'] || '신규').trim(),
    program: String(r['관심프로그램'] || '미선택'),
    englishLevel: String(r['영어회화수준'] || ''),
    languages: String(r['가능언어'] || ''),
    name: maskName_(r['성명']),
    phone: maskPhone_(r['연락처']),
    email: maskEmail_(r['이메일']),
    reply: String(r['담당자답변'] || '').trim(),
    questions: parseQuestions_(r['신청자추가질문']),
  };
}

// "[2026-09-19 14:05] 질문" 줄들 → [{at, text}, ...]
function parseQuestions_(v) {
  return String(v || '').split('\n').map((s) => s.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    return m ? { at: m[1], text: m[2] } : { at: '', text: line };
  });
}

// 홍길동 → 홍*동, 홍길 → 홍*, 남궁길동 → 남**동
function maskName_(v) {
  const s = String(v || '').trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + '*';
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}

// 010-1234-5678 → 010-****-5678 (앞 3자리와 뒤 4자리만 보여 줌)
function maskPhone_(v) {
  const s = String(v || '').trim();
  const total = s.replace(/\D/g, '').length;
  let seen = 0;
  return s.replace(/\d/g, (d) => {
    seen += 1;
    return seen <= 3 || seen > total - 4 ? d : '*';
  });
}

// abcdef@gmail.com → ab****@gmail.com
function maskEmail_(v) {
  const s = String(v || '').trim();
  const at = s.indexOf('@');
  if (at < 1) return s;
  const id = s.slice(0, at);
  const keep = id.length <= 2 ? 1 : 2;
  return id.slice(0, keep) + '*'.repeat(Math.max(id.length - keep, 2)) + s.slice(at);
}

// 시트가 날짜 글자를 "날짜"로 바꿔 저장하는 경우가 있어, 둘 다 처리
function dateText_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd HH:mm');
  return String(v || '').slice(0, 16);
}

/* ---------- 2-2. 관리자 화면 (10단계) ----------
   비밀번호는 코드나 시트가 아니라 "스크립트 속성" ADMIN_PASSWORD 에 보관합니다.
   (이 코드를 보거나 시트를 공유받은 사람도 비밀번호는 알 수 없게)
   로그인하면 입장권(token)을 발급하고, 화면을 쓸 때마다 2시간씩 연장됩니다. */
function handleAdminLogin_(body) {
  const saved = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || '';
  if (saved.length < 8) {
    return {
      ok: false,
      message: '관리자 비밀번호가 아직 설정되지 않았거나 8자보다 짧습니다. ' +
        'Apps Script 편집기 ⚙프로젝트 설정 → 스크립트 속성에서 ADMIN_PASSWORD 를 8자 이상으로 정해 주세요.',
    };
  }
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('admin_fail') || 0);
  if (fails >= ADMIN_MAX_FAIL) return adminLockedResult_();

  if (String(body.password == null ? '' : body.password) !== saved) {
    const count = fails + 1;
    cache.put('admin_fail', String(count), ADMIN_LOCK_MIN * 60);
    if (count >= ADMIN_MAX_FAIL) {
      try {
        warnAdminLock_();
      } catch (err) {
        console.error('잠금 경고메일 실패', err);
      }
      return adminLockedResult_();
    }
    return { ok: false, message: '비밀번호가 맞지 않습니다. (남은 시도 ' + (ADMIN_MAX_FAIL - count) + '번)' };
  }

  cache.remove('admin_fail');
  const token = Utilities.getUuid();
  cache.put('adm_' + token, '1', ADMIN_SESSION_MIN * 60);
  return { ok: true, token: token, sessionMinutes: ADMIN_SESSION_MIN };
}

function adminLockedResult_() {
  return {
    ok: false, locked: true,
    message: '비밀번호를 ' + ADMIN_MAX_FAIL + '번 틀려서 ' + ADMIN_LOCK_MIN + '분 동안 잠겼습니다. ' +
      '잠시 후 다시 시도해 주세요. (그동안에도 구글 시트에서 직접 신청 목록을 볼 수 있어요)',
  };
}

// 입장권이 살아 있으면 true + 시간 연장
function checkAdmin_(token) {
  const key = 'adm_' + clean_(token, 60);
  const cache = CacheService.getScriptCache();
  if (!cache.get(key)) return false;
  cache.put(key, '1', ADMIN_SESSION_MIN * 60);
  return true;
}

function handleAdminLogout_(body) {
  CacheService.getScriptCache().remove('adm_' + clean_(body.token, 60));
  return { ok: true };
}

// 전체 신청 목록(최근 것이 위로) + 설정값
function handleAdminData_() {
  const items = readApplications_().filter((r) => r['신청번호']).reverse().map(adminView_);
  return {
    ok: true,
    items: items,
    settings: settingsView_(getSettings_()),
    mailQuota: MailApp.getRemainingDailyQuota(), // 오늘 더 보낼 수 있는 메일 수 (무료 계정은 하루 100통)
    sheetUrl: 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit',
  };
}

// 관리자에게 보여 줄 내용: 가리지 않은 원래 정보 + 메모
function adminView_(r) {
  return {
    id: String(r['신청번호']),
    date: dateText_(r['접수일시']),
    name: String(r['성명'] || ''),
    phone: String(r['연락처'] || ''),
    email: String(r['이메일'] || ''),
    englishLevel: String(r['영어회화수준'] || ''),
    languages: String(r['가능언어'] || ''),
    program: String(r['관심프로그램'] || '미선택'),
    source: String(r['유입경로'] || ''),
    status: String(r['상태'] || '신규').trim(),
    reply: String(r['담당자답변'] || '').trim(),
    repliedAt: dateText_(r['답변일시']),
    questions: parseQuestions_(r['신청자추가질문']),
    memo: String(r['메모'] || '').trim(),
  };
}

function settingsView_(s) {
  return {
    emails: parseEmails_(s['알림받을이메일']),
    confirmMail: s['신청자확인메일'] !== '아니오',
    statuses: getStatuses_(s),
  };
}

function getStatuses_(s) {
  const def = DEFAULT_SETTINGS.find((r) => r[0] === '상태목록')[1];
  const list = parseList_(s['상태목록'] || def);
  if (list.indexOf('신규') < 0) list.unshift('신규');
  return list;
}

// 신청 한 건의 상태·담당자답변·메모 저장
// 앱은 "바뀐 칸만" 보냅니다 → 그 사이 시트에서 직접 고친 다른 칸을 덮어쓰지 않음
function handleAdminSave_(body) {
  const id = clean_(body.id, 20);
  const changes = {};
  if (body.status != null) {
    const st = clean_(body.status, 20);
    if (getStatuses_(getSettings_()).indexOf(st) < 0) return { ok: false, message: '상태 목록에 없는 상태입니다: ' + st };
    changes['상태'] = st;
  }
  if (body.reply != null) changes['담당자답변'] = cleanText_(body.reply, REPLY_MAX_LEN);
  if (body.memo != null) changes['메모'] = cleanText_(body.memo, MEMO_MAX_LEN);
  if (!Object.keys(changes).length) return { ok: false, message: '바뀐 내용이 없습니다.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let rec;
  let replyChanged = false;
  try {
    rec = readApplications_().find((r) => String(r['신청번호']) === id);
    if (!rec) return { ok: false, message: '신청번호 ' + id + ' 을(를) 시트에서 찾을 수 없습니다. (시트에서 지워졌을 수 있어요)' };

    if ('담당자답변' in changes && changes['담당자답변'] !== String(rec['담당자답변'] || '').trim()) {
      replyChanged = true;
      changes['답변일시'] = changes['담당자답변'] ? Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm') : '';
    }

    const sheet = getSheet_(APPLY_SHEET, HEADERS);
    const head = headerRow_(sheet);
    Object.keys(changes).forEach((k) => {
      const col = head.indexOf(k);
      if (col < 0) throw new Error('시트에 "' + k + '" 칸이 없습니다');
      sheet.getRange(rec._row, col + 1).setValue(safeCell_(changes[k]));
      rec[k] = changes[k];
    });
  } finally {
    lock.releaseLock();
  }

  // 답변이 새로 바뀌었고 "신청자에게 메일 보내기"를 체크했으면 발송
  let mailed = false;
  let mailError = '';
  if (body.notify === true && replyChanged && rec['담당자답변']) {
    try {
      notifyReply_(rec, getSettings_(), body.mypageUrl);
      mailed = true;
    } catch (err) {
      console.error('답변 메일 실패', err);
      mailError = '저장은 됐지만 신청자에게 메일을 보내지 못했습니다. (' + err.message + ')';
    }
  }
  return { ok: true, item: adminView_(rec), mailed: mailed, mailError: mailError };
}

// 알림 받을 이메일 · 신청자 확인메일 · 상태 목록 저장
function handleAdminSettings_(body) {
  const parts = String(body.emails == null ? '' : body.emails)
    .split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const bad = parts.filter((s) => !EMAIL_RE.test(s));
  if (bad.length) return { ok: false, message: '이메일 형식이 올바르지 않습니다: ' + bad.join(', ') };
  const emails = parts.filter((s, i) => parts.indexOf(s) === i);
  if (!emails.length) return { ok: false, message: '알림 받을 이메일을 1개 이상 입력해 주세요.' };
  if (emails.length > 20) return { ok: false, message: '알림 받을 이메일은 20개까지 넣을 수 있습니다.' };

  const statuses = parseList_(body.statuses);
  const tooLong = statuses.filter((s) => s.length > 12);
  if (tooLong.length) return { ok: false, message: '상태 이름은 12글자까지 가능합니다: ' + tooLong.join(', ') };
  if (statuses.indexOf('신규') < 0) statuses.unshift('신규');
  if (statuses.length < 2) return { ok: false, message: '상태를 "신규" 말고 1개 이상 더 넣어 주세요.' };
  if (statuses.length > 15) return { ok: false, message: '상태는 15개까지 넣을 수 있습니다.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    setSetting_('알림받을이메일', emails.join(', '));
    setSetting_('신청자확인메일', body.confirmMail === false ? '아니오' : '예');
    setSetting_('상태목록', statuses.join(', '));
  } finally {
    lock.releaseLock();
  }
  return { ok: true, settings: settingsView_(getSettings_()) };
}

function setSetting_(key, value) {
  const sheet = getSheet_(SETTINGS_SHEET);
  const keys = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();
  for (let i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(safeCell_(value));
      return;
    }
  }
  const def = DEFAULT_SETTINGS.find((r) => r[0] === key);
  sheet.appendRow([key, safeCell_(value), def ? def[2] : '']);
}

/* ---------- 3. 메일 ---------- */
function notifyAdmins_(id, d, settings) {
  const to = parseEmails_(settings['알림받을이메일']);
  if (!to.length) throw new Error('알림받을이메일이 비어 있음');

  const rows = [
    ['신청번호', id], ['성명', d.name], ['연락처', d.phone], ['이메일', d.email],
    ['영어회화수준', d.englishLevel || '-'], ['가능언어', d.languages || '-'],
    ['관심프로그램', d.program || '미선택'], ['유입경로', d.source || '-'],
  ];
  const table = rows.map((r) =>
    '<tr><th style="text-align:left;padding:6px 12px;background:#f2f5fa;white-space:nowrap">' + esc_(r[0]) +
    '</th><td style="padding:6px 12px">' + esc_(r[1]) + '</td></tr>').join('');
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit';

  MailApp.sendEmail({
    to: to.join(','),
    replyTo: d.email, // 이 메일에서 "답장"을 누르면 신청자에게 바로 갑니다
    name: 'INFINITY Program 신청 알림',
    subject: '[INFINITY 신규상담] ' + d.name + ' · ' + (d.program || '프로그램 미선택'),
    htmlBody:
      '<div style="font-family:sans-serif;color:#1b2a41">' +
      '<h2 style="margin:0 0 12px">새 상담 신청이 들어왔습니다</h2>' +
      '<table style="border-collapse:collapse;border:1px solid #dde3ec">' + table + '</table>' +
      '<p style="margin-top:16px"><a href="' + sheetUrl + '">구글 시트에서 전체 신청 목록 보기</a></p>' +
      '<p style="color:#667;font-size:13px">이 메일에 답장하면 신청자(' + esc_(d.email) + ')에게 바로 전달됩니다.</p>' +
      '</div>',
  });
}

function confirmApplicant_(id, d, settings) {
  const admins = parseEmails_(settings['알림받을이메일']);
  const options = {
    to: d.email,
    name: 'INFINITY Program',
    subject: '[INFINITY Program] 상담 신청이 접수되었습니다 (신청번호 ' + id + ')',
    htmlBody:
      '<div style="font-family:sans-serif;color:#1b2a41;line-height:1.7">' +
      '<h2 style="margin:0 0 12px">' + esc_(d.name) + '님, 신청해 주셔서 감사합니다.</h2>' +
      '<p>상담 신청이 정상적으로 접수되었습니다. 담당자가 확인 후 곧 연락드리겠습니다.</p>' +
      '<p><b>신청번호:</b> ' + id + '<br><b>관심 프로그램:</b> ' + esc_(d.program || '미선택') + '</p>' +
      '<p>빠른 상담을 원하시면 아래로 연락 주세요.<br>' +
      '· 카카오톡 오픈채팅: <a href="https://open.kakao.com/o/sdRMEuIi">바로가기</a> (ID: edgarleeyt)<br>' +
      '· 한국 전화: 010-4374-8204<br>' +
      '· WhatsApp(말레이시아): +60 11-5392-1378</p>' +
      '<p style="color:#667;font-size:13px">본인이 신청하지 않으셨다면 이 메일에 답장으로 알려 주세요. 즉시 삭제해 드립니다.</p>' +
      '</div>',
  };
  if (admins.length) options.replyTo = admins[0];
  MailApp.sendEmail(options);
}

// (9단계) 신청자가 "내 신청 확인"에서 추가 질문을 남기면 관리자에게 알림
function notifyQuestion_(rec, question, settings) {
  const to = parseEmails_(settings['알림받을이메일']);
  if (!to.length) throw new Error('알림받을이메일이 비어 있음');
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit';
  const options = {
    to: to.join(','),
    name: 'INFINITY Program 신청 알림',
    subject: '[INFINITY 추가질문] ' + rec['성명'] + ' · ' + rec['신청번호'],
    htmlBody:
      '<div style="font-family:sans-serif;color:#1b2a41;line-height:1.7">' +
      '<h2 style="margin:0 0 12px">신청자가 추가 질문을 남겼습니다</h2>' +
      '<p><b>신청번호:</b> ' + esc_(rec['신청번호']) + '<br><b>성명:</b> ' + esc_(rec['성명']) +
      '<br><b>연락처:</b> ' + esc_(rec['연락처']) + '<br><b>이메일:</b> ' + esc_(rec['이메일']) + '</p>' +
      '<blockquote style="margin:0;padding:12px 16px;background:#f2f5fa;border-left:4px solid #1a8fd8">' +
      esc_(question) + '</blockquote>' +
      '<p style="margin-top:16px">답변은 시트의 <b>담당자답변</b> 칸에 적으면 신청자가 "내 신청 확인" 화면에서 볼 수 있습니다.<br>' +
      '<a href="' + sheetUrl + '">구글 시트 열기</a></p>' +
      '<p style="color:#667;font-size:13px">이 메일에 답장하면 신청자에게 바로 전달됩니다.</p>' +
      '</div>',
  };
  if (EMAIL_RE.test(String(rec['이메일']))) options.replyTo = String(rec['이메일']);
  MailApp.sendEmail(options);
}

// (10단계) 관리자가 답변을 저장하면서 "신청자에게 메일 보내기"를 체크했을 때
function notifyReply_(rec, settings, mypageUrl) {
  const to = String(rec['이메일'] || '').trim();
  if (!EMAIL_RE.test(to)) throw new Error('신청자 이메일 주소가 올바르지 않음');
  const admins = parseEmails_(settings['알림받을이메일']);
  // "내 신청 확인" 주소는 관리자 화면이 알려 줌. https://…/mypage.html 모양일 때만 링크로 넣음
  const link = /^https:\/\/[^\s"'<>]+\/mypage\.html$/.test(String(mypageUrl || '')) ? String(mypageUrl) : '';
  const options = {
    to: to,
    name: 'INFINITY Program',
    subject: '[INFINITY Program] 문의하신 내용에 답변드립니다 (신청번호 ' + rec['신청번호'] + ')',
    htmlBody:
      '<div style="font-family:sans-serif;color:#1b2a41;line-height:1.7">' +
      '<h2 style="margin:0 0 12px">' + esc_(rec['성명']) + '님, 담당자 답변이 도착했습니다.</h2>' +
      '<p style="color:#667;font-size:13px;margin:0 0 8px">신청번호 ' + esc_(rec['신청번호']) + '</p>' +
      '<div style="padding:14px 16px;background:#e6f3fc;border-left:4px solid #1a8fd8">' +
      esc_(rec['담당자답변']).replace(/\n/g, '<br>') + '</div>' +
      (link
        ? '<p style="margin-top:16px"><a href="' + esc_(link) + '">내 신청 확인</a> 화면에서 진행 상황을 보고 추가 질문도 남길 수 있어요.<br>' +
          '(신청할 때 입력한 이메일 + 연락처 뒷자리 4개로 조회)</p>'
        : '') +
      '<p>빠른 상담은 카카오톡 오픈채팅으로: <a href="https://open.kakao.com/o/sdRMEuIi">바로가기</a> (ID: edgarleeyt)</p>' +
      '</div>',
  };
  if (admins.length) options.replyTo = admins[0];
  MailApp.sendEmail(options);
}

// (10단계) 관리자 비밀번호가 연속으로 틀려 잠겼을 때 관리자들에게 경고
function warnAdminLock_() {
  const to = parseEmails_(getSettings_()['알림받을이메일']);
  if (!to.length) return;
  MailApp.sendEmail({
    to: to.join(','),
    name: 'INFINITY Program 보안 알림',
    subject: '[INFINITY 보안] 관리자 비밀번호가 ' + ADMIN_MAX_FAIL + '번 틀렸습니다',
    htmlBody:
      '<div style="font-family:sans-serif;color:#1b2a41;line-height:1.7">' +
      '<p>관리자 화면에서 비밀번호가 연속으로 ' + ADMIN_MAX_FAIL + '번 틀려서 ' + ADMIN_LOCK_MIN + '분 동안 로그인을 잠갔습니다.</p>' +
      '<p>직접 틀린 게 아니라면, Apps Script 편집기 ⚙프로젝트 설정 → 스크립트 속성에서 <b>ADMIN_PASSWORD</b> 를 바꿔 주세요.<br>' +
      '바로 다시 들어가야 하면 편집기에서 <b>unlockAdmin</b> 함수를 실행하면 잠금이 풀립니다.</p>' +
      '</div>',
  });
}

/* ---------- 4. 시트 도우미 ---------- */
function getSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (headers && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#0b2545').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else if (headers) {
    // 새 버전에서 생긴 칸이 기존 시트에 없으면 맨 오른쪽에 붙여 줌
    const have = headerRow_(sheet);
    const missing = headers.filter((h) => have.indexOf(h) < 0);
    if (missing.length) {
      sheet.getRange(1, have.length + 1, 1, missing.length).setValues([missing])
        .setFontWeight('bold').setBackground('#0b2545').setFontColor('#ffffff');
    }
  }
  return sheet;
}

function getSettings_() {
  const sheet = getSheet_(SETTINGS_SHEET);
  const values = sheet.getDataRange().getValues();
  const settings = {};
  values.forEach((r) => { if (r[0]) settings[String(r[0]).trim()] = String(r[1]).trim(); });
  return settings;
}

// 신청번호: INF-날짜-그날의 순번  예) INF-260919-001
function nextId_() {
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyMMdd');
  const props = PropertiesService.getScriptProperties();
  const key = 'seq_' + today;
  const n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return 'INF-' + today + '-' + String(n).padStart(3, '0');
}

function writeMemo_(id, text) {
  const sheet = getSheet_(APPLY_SHEET, HEADERS);
  const idCol = headerIndex_(sheet, '신청번호') + 1;
  const ids = sheet.getRange(1, idCol, sheet.getLastRow(), 1).getValues();
  for (let i = ids.length - 1; i >= 1; i--) {
    if (ids[i][0] === id) {
      sheet.getRange(i + 1, headerIndex_(sheet, '메모') + 1).setValue(safeCell_(text));
      return;
    }
  }
}

/* ---------- 5. 작은 도우미들 ---------- */
function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\x00-\x1f]/g, ' ').trim().slice(0, max);
}

// 여러 줄 글(답변·메모)용: 줄바꿈은 살리고 나머지 제어문자만 지움
function cleanText_(v, max) {
  return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ').trim().slice(0, max);
}

// "가, 나, 다" → ['가', '나', '다'] (빈칸·중복 제거)
function parseList_(v) {
  const list = String(v == null ? '' : v).split(',').map((s) => clean_(s, 40)).filter(Boolean);
  return list.filter((s, i) => list.indexOf(s) === i);
}

// =, +, -, @ 로 시작하는 값은 시트가 "수식"으로 실행할 수 있어 위험 → 앞에 ' 를 붙여 글자로 저장
function safeCell_(v) {
  const s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function parseEmails_(text) {
  return String(text || '').split(/[,;\s]+/).map((s) => s.trim()).filter((s) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s));
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   ▶ 편집기에서 직접 실행하는 함수
   ========================================================= */

// 처음 한 번 실행: 시트 탭 만들기 + 권한 허용
function setup() {
  const apply = getSheet_(APPLY_SHEET, HEADERS);
  apply.setColumnWidths(1, HEADERS.length, 120);
  apply.setColumnWidth(HEADERS.indexOf('관심프로그램') + 1, 260);
  apply.setColumnWidth(HEADERS.indexOf('담당자답변') + 1, 260);

  const settings = getSheet_(SETTINGS_SHEET, ['항목', '값', '설명']);
  const have = getSettings_();
  DEFAULT_SETTINGS.forEach((r) => { if (!(r[0] in have)) settings.appendRow(r); });
  settings.setColumnWidth(1, 140);
  settings.setColumnWidth(2, 320);
  settings.setColumnWidth(3, 380);

  console.log('준비 완료! 오늘 남은 메일 발송 가능 수: ' + MailApp.getRemainingDailyQuota());
}

// 테스트: 가짜 신청 1건을 넣어 봅니다 (시트에 한 줄 + 메일 도착 확인 후, 그 줄은 지워 주세요)
function testApply() {
  const result = handleApply_({
    name: '테스트', phone: '010-0000-0000', email: Session.getEffectiveUser().getEmail(),
    englishLevel: '중급 (일상 대화 가능)', languages: '없음', program: '크루즈 면접',
    source: '편집기 테스트', agree: true,
  });
  console.log(JSON.stringify(result));
}

// 테스트(9단계): testApply 로 넣은 신청을 "내 신청 확인" 방식으로 조회해 봅니다
function testLookup() {
  const result = handleLookup_({ email: Session.getEffectiveUser().getEmail(), phone4: '0000' });
  console.log(JSON.stringify(result, null, 2));
}

// 테스트(10단계): 관리자 비밀번호가 정해졌는지, 관리자 화면이 읽을 목록·설정이 제대로 나오는지 확인
function testAdmin() {
  const pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || '';
  console.log(pw.length >= 8
    ? '✅ 관리자 비밀번호 설정됨 (' + pw.length + '글자)'
    : '⚠ ADMIN_PASSWORD 가 없거나 8글자보다 짧습니다. ⚙프로젝트 설정 → 스크립트 속성에서 정해 주세요.');
  const data = handleAdminData_();
  console.log('신청 ' + data.items.length + '건 · 오늘 남은 메일 ' + data.mailQuota + '통');
  console.log('설정: ' + JSON.stringify(data.settings));
}

// 관리자 로그인이 잠겼을 때(10번 틀림) 바로 풀기
function unlockAdmin() {
  CacheService.getScriptCache().remove('admin_fail');
  console.log('관리자 로그인 잠금을 풀었습니다.');
}

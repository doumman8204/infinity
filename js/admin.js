/* =========================================================
   관리자 화면 (10단계, admin.html)
   1) 비밀번호로 로그인 → 서버가 "입장권(token)"을 줌 (2시간, 쓰는 동안 계속 연장)
      입장권은 이 탭에만 보관(sessionStorage) → 탭을 닫으면 자동 로그아웃
   2) 신청 목록: 검색, 상태별 보기, "답변 필요"(답변 뒤에 새 질문이 온 신청) 모아 보기
   3) 카드를 누르면 펼쳐져서 상태·담당자답변·메모를 고치고 저장
      - 바뀐 칸만 서버로 보냄 (시트에서 직접 고친 다른 칸을 덮어쓰지 않게)
      - "신청자에게 답변 메일 보내기"를 체크하면 답변이 바뀌었을 때 메일 발송
   4) 알림·설정: 알림 받을 이메일(쉼표로 여러 명), 신청자 확인메일, 상태 목록
   - 서버에서 온 글자는 모두 textContent 로 넣습니다. (신청자가 이상한 코드를 적어도 실행되지 않게)
   ========================================================= */
(function () {
  const TOKEN_KEY = 'infinityAdminToken';
  const PAGE_SIZE = 20;          // 한 번에 보여 줄 카드 수 ("더 보기"로 추가)
  const REPLY_MAX = 2000;
  const MEMO_MAX = 1000;
  const MYPAGE_URL = new URL('mypage.html', location.href).href; // 답변 메일에 넣을 "내 신청 확인" 주소

  const $ = (id) => document.getElementById(id);
  const loginSection = $('adm-login');
  const mainSection = $('adm-main');
  const loginForm = $('login-form');
  const loginStatus = $('login-status');
  const logoutBtn = $('adm-logout');
  const listBox = $('adm-list');
  const emptyMsg = $('adm-empty');
  const moreBtn = $('adm-more');
  const searchBox = $('adm-search');
  const filterBox = $('adm-filters');
  const metaLine = $('adm-meta');
  const refreshBtn = $('adm-refresh');
  const settingsForm = $('settings-form');
  const settingsStatus = $('settings-status');

  let token = storage('get') || '';
  let items = [];                // 서버에서 받은 전체 신청 (최근 것이 위)
  let settings = { emails: [], confirmMail: true, statuses: ['신규'] };
  let filter = 'all';            // 'all' | 'reply' | 상태 이름
  let shown = PAGE_SIZE;
  let loadedAt = '';
  let mailQuota = null;
  const cards = new Map();       // 신청번호 → 이미 만든 카드 (검색·필터를 바꿔도 쓰던 내용이 남게)

  /* ---------- 1. 로그인 / 로그아웃 ---------- */
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pw = loginForm.elements.password;
    if (!pw.value) {
      setMsg(loginStatus, 'error', '비밀번호를 입력해 주세요.');
      pw.focus();
      return;
    }
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '확인 중…';
    try {
      const result = await window.INFINITY.post('adminLogin', { password: pw.value });
      token = result.token;
      storage('set', token);
      loginForm.reset();
      loginStatus.hidden = true;
      // 로그인 시간이 지나서 다시 들어온 경우엔 쓰던 화면 그대로 (저장 안 한 글이 사라지지 않게)
      if (items.length) showMain();
      else await loadData();
    } catch (err) {
      console.error('[로그인 실패]', err);
      setMsg(loginStatus, 'error', err.userMessage || '연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      btn.disabled = false;
      btn.textContent = '로그인';
    }
  });

  logoutBtn.addEventListener('click', () => {
    if (dirtyCount() && !confirm('저장하지 않은 내용이 있어요. 그래도 로그아웃할까요?')) return;
    window.INFINITY.post('adminLogout', { token: token }).catch(() => {});
    token = '';
    storage('remove');
    items = [];
    cards.clear();
    listBox.replaceChildren();
    showLogin();
  });

  function showLogin(message) {
    mainSection.hidden = true;
    logoutBtn.hidden = true;
    loginSection.hidden = false;
    if (message) setMsg(loginStatus, 'error', message);
    window.scrollTo({ top: 0 });
    loginForm.elements.password.focus();
  }

  function showMain() {
    loginSection.hidden = true;
    mainSection.hidden = false;
    logoutBtn.hidden = false;
  }

  // 서버 요청 공통: 입장권을 붙이고, 로그인 시간이 지났으면 로그인 화면으로
  async function call(action, data) {
    try {
      return await window.INFINITY.post(action, { ...data, token: token });
    } catch (err) {
      if (err.result && err.result.expired) {
        token = '';
        storage('remove');
        showLogin(err.userMessage);
      }
      throw err;
    }
  }

  /* ---------- 2. 목록 불러오기 ---------- */
  async function loadData() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '불러오는 중…';
    try {
      const result = await call('adminData', {});
      items = result.items;
      mailQuota = result.mailQuota;
      loadedAt = new Date().toTimeString().slice(0, 5);
      if (result.sheetUrl) $('sheet-link').href = result.sheetUrl;
      applySettings(result.settings, !settingsDirty());
      // 쓰던 중인 카드는 남기고, 나머지는 새 내용으로 다시 만듦
      for (const [id, card] of cards) if (!isDirty(card)) cards.delete(id);
      showMain();
      renderAll();
    } catch (err) {
      console.error('[목록 불러오기 실패]', err);
      if (!(err.result && err.result.expired)) {
        toast(err.userMessage || '목록을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
      }
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '↻ 새로고침';
    }
  }

  refreshBtn.addEventListener('click', loadData);

  /* ---------- 3. 검색·상태별 보기 ---------- */
  searchBox.addEventListener('input', () => {
    shown = PAGE_SIZE;
    renderList();
  });

  moreBtn.addEventListener('click', () => {
    shown += PAGE_SIZE;
    renderList();
  });

  function renderAll() {
    renderFilters();
    renderList();
  }

  // 답변한 뒤에(또는 답변이 없는데) 신청자 질문이 있으면 "답변 필요"
  function needsReply(item) {
    if (!item.questions.length) return false;
    const last = item.questions[item.questions.length - 1].at;
    return !item.repliedAt || last > item.repliedAt;
  }

  function renderFilters() {
    const count = (fn) => items.filter(fn).length;
    // 설정의 상태 목록 + 시트에만 있는 상태(예전 이름 등)도 버튼으로
    const statuses = settings.statuses.slice();
    items.forEach((it) => { if (statuses.indexOf(it.status) < 0) statuses.push(it.status); });

    const chips = [
      { key: 'all', label: '전체', n: items.length },
      { key: 'reply', label: '❓ 답변 필요', n: count(needsReply), alert: true },
    ].concat(statuses.map((s) => ({ key: s, label: s, n: count((it) => it.status === s) })));

    if (!chips.some((c) => c.key === filter)) filter = 'all';
    filterBox.replaceChildren(...chips.map((c) => {
      const b = el('button', 'adm-chip' + (c.alert && c.n ? ' is-alert' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(c.key === filter));
      b.append(c.label, el('b', '', String(c.n)));
      b.addEventListener('click', () => {
        filter = c.key;
        shown = PAGE_SIZE;
        renderFilters();
        renderList();
      });
      return b;
    }));

    const waiting = count((it) => it.status === '신규');
    metaLine.textContent = [
      loadedAt && loadedAt + ' 기준',
      waiting ? '확인 전 신규 ' + waiting + '건' : '',
      mailQuota != null ? '오늘 보낼 수 있는 메일 ' + mailQuota + '통' : '',
    ].filter(Boolean).join(' · ');
  }

  function matches(item) {
    if (filter === 'reply' && !needsReply(item)) return false;
    if (filter !== 'all' && filter !== 'reply' && item.status !== filter) return false;
    const q = searchBox.value.trim().toLowerCase();
    if (!q) return true;
    const digits = q.replace(/\D/g, '');
    const text = [item.id, item.name, item.email, item.program, item.memo].join(' ').toLowerCase();
    return text.includes(q) || (digits.length >= 3 && item.phone.replace(/\D/g, '').includes(digits));
  }

  function renderList() {
    const list = items.filter(matches);
    const page = list.slice(0, shown);
    listBox.replaceChildren(...page.map((item) => {
      if (!cards.has(item.id)) cards.set(item.id, renderCard(item));
      return cards.get(item.id);
    }));
    emptyMsg.hidden = list.length > 0;
    emptyMsg.textContent = items.length ? '조건에 맞는 신청이 없습니다.' : '아직 들어온 신청이 없습니다.';
    moreBtn.hidden = list.length <= shown;
    moreBtn.textContent = '더 보기 (' + (list.length - shown) + '건 더)';
  }

  /* ---------- 4. 신청 카드 한 장 ---------- */
  function renderCard(item) {
    const card = el('details', 'card adm-app');
    card.dataset.id = item.id;

    // 접혀 있을 때 보이는 줄
    const sum = el('summary');
    const top = el('div', 'adm-app-top');
    top.append(el('span', 'adm-name', item.name || '(이름 없음)'));
    const st = statusTone(item.status);
    top.append(el('span', 'my-status is-' + st, item.status));
    if (needsReply(item)) top.append(el('span', 'adm-flag', '❓ 답변 필요'));
    sum.append(top);
    sum.append(el('span', 'adm-sub', item.program + ' · ' + item.date.slice(0, 10) + ' · ' + item.id));
    card.append(sum);

    const body = el('div', 'adm-app-body');

    // 바로 연락하기
    const contact = el('div', 'adm-contact');
    const tel = item.phone.replace(/[^\d+]/g, '');
    if (tel) contact.append(link('📞 전화', 'tel:' + tel));
    if (item.email) contact.append(link('✉️ 메일', 'mailto:' + item.email));
    if (/^\+/.test(tel)) contact.append(link('💬 WhatsApp', 'https://wa.me/' + tel.slice(1), true));
    body.append(contact);

    // 신청 내용 (가리지 않은 원래 정보)
    const info = el('dl', 'my-info');
    [
      ['신청번호', item.id],
      ['접수일시', item.date],
      ['연락처', item.phone],
      ['이메일', item.email],
      ['관심 프로그램', item.program],
      ['영어 회화', item.englishLevel],
      ['가능 언어', item.languages],
      ['유입 경로', item.source],
    ].forEach(([label, value]) => {
      if (value) info.append(el('dt', '', label), el('dd', '', value));
    });
    body.append(info);

    // 신청자가 보낸 추가 질문 (마지막 답변 뒤에 온 것은 빨간 테두리)
    if (item.questions.length) {
      const box = el('div', 'my-questions');
      box.append(el('h4', '', '신청자 추가 질문 (' + item.questions.length + ')'));
      const ul = el('ul');
      item.questions.forEach((q) => {
        const isNew = !item.repliedAt || q.at > item.repliedAt;
        const li = el('li', isNew ? 'is-new' : '');
        const time = el('time', '', q.at);
        if (isNew) time.append(el('span', 'adm-new', '새 질문'));
        li.append(time, el('p', '', q.text));
        ul.append(li);
      });
      box.append(ul);
      body.append(box);
    }

    body.append(editForm(item, card));
    card.append(body);
    return card;
  }

  // 상태 → 색 (신청자 화면 mypage.js 와 같은 규칙)
  function statusTone(value) {
    if (value === '신규') return 'new';
    if (/보류|취소/.test(value)) return 'stop';
    if (/완료|등록|합격/.test(value)) return 'done';
    return 'doing';
  }

  /* ---------- 5. 상태·답변·메모 고치기 ---------- */
  function editForm(item, card) {
    const f = el('form', 'adm-edit');
    f.noValidate = true;

    // 진행 상태
    const stLabel = el('label', '', '진행 상태');
    const select = el('select');
    select.name = 'status';
    const options = settings.statuses.slice();
    if (options.indexOf(item.status) < 0) options.push(item.status); // 목록에서 빠진 예전 상태도 유지
    options.forEach((s) => {
      const o = el('option', '', s);
      o.value = s;
      select.append(o);
    });
    select.value = item.status;
    stLabel.append(select);

    // 담당자 답변
    const replyLabel = el('label', '', '담당자 답변');
    replyLabel.append(el('small', 'hint', '신청자가 "내 신청 확인" 화면에서 봅니다.'));
    const reply = el('textarea');
    reply.name = 'reply';
    reply.rows = 4;
    reply.maxLength = REPLY_MAX;
    reply.value = item.reply;
    reply.placeholder = '예) 안녕하세요, INFINITY입니다. 10월 출국 가능합니다. 카카오톡으로 연락드릴게요.';
    replyLabel.append(reply);
    const replyInfo = el('small', 'ask-count',
      (item.repliedAt ? '마지막 답변 ' + item.repliedAt + ' · ' : '') + item.reply.length + ' / ' + REPLY_MAX);

    const notifyLabel = el('label', 'agree adm-notify');
    const notify = el('input');
    notify.type = 'checkbox';
    notify.name = 'notify';
    notify.checked = true;
    notifyLabel.append(notify, el('span', '', '답변이 바뀌면 신청자에게 메일로도 보내기'));

    // 내부 메모
    const memoLabel = el('label', '', '내부 메모');
    memoLabel.append(el('small', 'hint', '🔒 관리자만 봅니다. 신청자에게는 보이지 않아요.'));
    const memo = el('textarea');
    memo.name = 'memo';
    memo.rows = 2;
    memo.maxLength = MEMO_MAX;
    memo.value = item.memo;
    memoLabel.append(memo);

    const btn = el('button', 'btn btn-navy btn-block', '변경 사항 없음');
    btn.type = 'submit';
    btn.disabled = true;
    const msg = el('p', 'form-status');
    msg.hidden = true;
    msg.setAttribute('role', 'status');

    f.append(stLabel, replyLabel, replyInfo, notifyLabel, memoLabel, btn, msg);

    // 원래 값과 달라진 칸만 모음
    function changes() {
      const c = {};
      if (select.value !== item.status) c.status = select.value;
      if (reply.value.trim() !== item.reply) c.reply = reply.value;
      if (memo.value.trim() !== item.memo) c.memo = memo.value;
      return c;
    }
    function update() {
      const n = Object.keys(changes()).length;
      card.classList.toggle('is-dirty', n > 0);
      btn.disabled = n === 0;
      btn.textContent = n ? '💾 저장하기' : '변경 사항 없음';
      replyInfo.textContent = (item.repliedAt ? '마지막 답변 ' + item.repliedAt + ' · ' : '') +
        reply.value.length + ' / ' + REPLY_MAX;
      notifyLabel.classList.toggle('is-off', !('reply' in changes()) || !reply.value.trim());
      if (msg.classList.contains('is-error')) msg.hidden = true;
    }
    [select, reply, memo].forEach((input) => input.addEventListener('input', update));
    select.addEventListener('change', update);
    update();

    f.addEventListener('submit', async (event) => {
      event.preventDefault();
      const c = changes();
      if (!Object.keys(c).length) return;
      btn.disabled = true;
      btn.textContent = '저장 중…';
      try {
        const result = await call('adminSave', {
          id: item.id, ...c, notify: notify.checked, mypageUrl: MYPAGE_URL,
        });
        // 최신 내용으로 목록 데이터와 카드를 바꿈 (카드는 펼친 채로)
        const i = items.findIndex((it) => it.id === item.id);
        if (i >= 0) items[i] = result.item;
        const fresh = renderCard(result.item);
        fresh.open = true;
        cards.set(item.id, fresh);
        card.replaceWith(fresh);
        renderFilters();
        const note = result.mailError ? '' : result.mailed ? ' · 신청자에게 답변 메일을 보냈어요' : '';
        const freshMsg = fresh.querySelector('.adm-edit .form-status');
        if (result.mailError) setMsg(freshMsg, 'error', '⚠ ' + result.mailError);
        else setMsg(freshMsg, 'success', '✅ 저장했습니다' + note);
        toast('저장했습니다' + note);
      } catch (err) {
        console.error('[저장 실패]', err);
        if (err.result && err.result.expired) return; // 로그인 화면으로 이동함 (다시 로그인하면 쓰던 내용 그대로)
        setMsg(msg, 'error', err.userMessage || '저장 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
        update();
      }
    });
    return f;
  }

  function isDirty(card) {
    return card.classList.contains('is-dirty');
  }
  function dirtyCount() {
    return [...cards.values()].filter(isDirty).length + (settingsDirty() ? 1 : 0);
  }

  // 저장 안 한 내용이 있는데 탭을 닫거나 새로고침하면 브라우저가 한 번 물어봄
  window.addEventListener('beforeunload', (event) => {
    if (dirtyCount()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  /* ---------- 6. 탭 (신청 목록 / 알림·설정) ---------- */
  document.querySelectorAll('.adm-tabs [role="tab"]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.adm-tabs [role="tab"]').forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        $(t.getAttribute('aria-controls')).hidden = !on;
      });
    });
  });

  /* ---------- 7. 알림·설정 ---------- */
  const emailsInput = settingsForm.elements.emails;
  const statusesInput = settingsForm.elements.statuses;
  const confirmInput = settingsForm.elements.confirmMail;
  let savedForm = '';

  function formSnapshot() {
    return [emailsInput.value, statusesInput.value, confirmInput.checked].join('|');
  }
  function settingsDirty() {
    return savedForm !== '' && formSnapshot() !== savedForm;
  }

  function applySettings(s, fillForm) {
    settings = s;
    if (!fillForm) return;
    emailsInput.value = s.emails.join(', ');
    statusesInput.value = s.statuses.join(', ');
    confirmInput.checked = s.confirmMail;
    savedForm = formSnapshot();
    previewSettings();
  }

  // 입력하는 동안 이메일·상태를 칩으로 미리 보여 줌 (형식이 틀린 이메일은 빨간색)
  function previewSettings() {
    const emails = emailsInput.value.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    const emailChips = emails.map((e) => {
      const good = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e);
      return el('span', 'adm-tag' + (good ? '' : ' is-bad'), (good ? '✓ ' : '⚠ ') + e);
    });
    if (!emails.length) emailChips.push(el('span', 'adm-tag is-bad', '⚠ 최소 1개는 있어야 알림을 받을 수 있어요'));
    $('email-chips').replaceChildren(...emailChips);

    const list = statusesInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    const unique = list.filter((s, i) => list.indexOf(s) === i);
    if (unique.indexOf('신규') < 0) unique.unshift('신규');
    $('status-chips').replaceChildren(...unique.map((s) => el('span', 'my-status is-' + statusTone(s), s)));
  }

  [emailsInput, statusesInput].forEach((input) => input.addEventListener('input', () => {
    previewSettings();
    settingsStatus.hidden = true;
  }));
  confirmInput.addEventListener('change', () => { settingsStatus.hidden = true; });

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const bad = emailsInput.value.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
      .filter((e) => !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e));
    if (bad.length) {
      setMsg(settingsStatus, 'error', '이메일 형식을 확인해 주세요: ' + bad.join(', '));
      emailsInput.focus();
      return;
    }
    const btn = settingsForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '저장 중…';
    try {
      const result = await call('adminSettings', {
        emails: emailsInput.value,
        confirmMail: confirmInput.checked,
        statuses: statusesInput.value,
      });
      applySettings(result.settings, true);
      // 상태 목록이 바뀌었을 수 있으니, 쓰던 중이 아닌 카드는 새로 만듦
      for (const [id, card] of cards) if (!isDirty(card)) cards.delete(id);
      renderAll();
      setMsg(settingsStatus, 'success', '✅ 저장했습니다. 다음 신청부터 ' + result.settings.emails.length + '명에게 알림이 갑니다.');
    } catch (err) {
      console.error('[설정 저장 실패]', err);
      if (!(err.result && err.result.expired)) {
        setMsg(settingsStatus, 'error', err.userMessage || '저장 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '설정 저장';
    }
  });

  /* ---------- 8. 작은 도우미 ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function link(text, href, newTab) {
    const a = el('a', 'btn btn-outline adm-small', text);
    a.href = href;
    if (newTab) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    return a;
  }
  function setMsg(node, type, text) {
    node.textContent = text;
    node.className = 'form-status is-' + type;
    node.hidden = false;
  }
  let toastTimer;
  function toast(message) {
    const box = $('toast');
    box.textContent = message;
    box.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('is-show'), 3200);
  }
  // 사생활 보호 모드 등에서 sessionStorage 가 막혀 있어도 화면은 동작하게
  function storage(op, value) {
    try {
      if (op === 'get') return sessionStorage.getItem(TOKEN_KEY);
      if (op === 'set') sessionStorage.setItem(TOKEN_KEY, value);
      if (op === 'remove') sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
    return null;
  }

  /* ---------- 9. 시작 ---------- */
  // 이 탭에서 이미 로그인했으면 바로 목록을 불러옴 (새로고침해도 로그인 유지)
  if (token) loadData();
  else loginForm.elements.password.focus();
})();

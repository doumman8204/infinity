/* =========================================================
   내 신청 확인 화면 (9단계)
   1) 이메일 + 연락처 뒷자리 4개로 조회 → 서버가 "입장권(token)"과 신청 내역을 돌려줌
   2) 신청마다 카드로 보여 줌: 진행 상태, 담당자 답변, 내가 보낸 추가 질문
   3) 카드 아래 칸에서 추가 질문을 보내면 서버가 시트에 저장하고 관리자에게 메일을 보냄
   - 입장권은 이 화면(메모리)에만 들고 있고 어디에도 저장하지 않습니다.
     새로고침하거나 30분이 지나면 다시 조회해야 합니다. (다른 사람이 같은 폰을 써도 안전하게)
   - 서버에서 온 글자는 모두 textContent 로 넣습니다. (답변에 이상한 코드가 들어 있어도 실행되지 않게)
   ========================================================= */
(function () {
  const lookupSection = document.getElementById('lookup');
  const resultSection = document.getElementById('result');
  const form = document.getElementById('lookup-form');
  const status = document.getElementById('lookup-status');
  const list = document.getElementById('my-list');
  const title = document.getElementById('result-title');
  const submitBtn = form.querySelector('button[type="submit"]');
  const QUESTION_MAX = 500;

  let token = '';

  // 시트의 "상태" 칸 값 → 신청자에게 보여 줄 말과 색
  const STATUS = {
    '신규': { key: 'my.new', tone: 'new' },
  };
  // 색 규칙은 관리자 화면(admin.js)과 같음: 보류·취소 회색 / 완료·등록·합격 초록 / 나머지 노랑
  function statusView(value) {
    if (STATUS[value]) return { text: T(STATUS[value].key), tone: STATUS[value].tone };
    if (/보류|취소/.test(value)) return { text: value, tone: 'stop' };
    if (/완료|등록|합격/.test(value)) return { text: value, tone: 'done' };
    return { text: value, tone: 'doing' };
  }

  /* ---------- 1. 연락처 뒷자리: 숫자만 입력되게 ---------- */
  form.elements.phone4.addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (digits !== e.target.value) e.target.value = digits;
    hideStatus();
  });
  form.elements.email.addEventListener('input', hideStatus);

  /* ---------- 2. 조회하기 ---------- */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim().toLowerCase();
    const phone4 = form.elements.phone4.value.trim();

    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
      showStatus('error', T('my.email.bad'));
      form.elements.email.focus();
      return;
    }
    if (!/^\d{4}$/.test(phone4)) {
      showStatus('error', T('my.phone4.bad'));
      form.elements.phone4.focus();
      return;
    }

    submitBtn.disabled = true;
    const lookupLabel = submitBtn.textContent;
    submitBtn.textContent = T('my.checking');
    try {
      const result = await window.INFINITY.post('lookup', { email: email, phone4: phone4 });
      token = result.token;
      form.reset();
      hideStatus(true);
      showResult(result.items);
    } catch (err) {
      console.error('[조회 실패]', err);
      showStatus('error', err.userMessage || T('my.lookupFail'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = lookupLabel;
    }
  });

  /* ---------- 3. 결과 화면 ---------- */
  function showResult(items) {
    title.textContent = items.length > 1 ? T('my.titleN', { n: items.length }) : T('my.title');
    list.replaceChildren(...items.map(renderCard));
    lookupSection.hidden = true;
    resultSection.hidden = false;
    window.scrollTo({ top: 0 });
  }

  // 처음 화면으로 돌아가기 (입장권도 버림)
  function backToLookup(message) {
    token = '';
    list.replaceChildren();
    resultSection.hidden = true;
    lookupSection.hidden = false;
    if (message) showStatus('error', message);
    window.scrollTo({ top: 0 });
    form.elements.email.focus();
  }
  document.getElementById('logout').addEventListener('click', () => backToLookup());

  /* ---------- 4. 신청 카드 한 장 만들기 ---------- */
  function renderCard(item) {
    const card = el('article', 'card my-app');
    card.dataset.id = item.id;

    // 머리: 신청번호 + 상태
    const head = el('div', 'my-app-head');
    head.append(el('span', 'my-id', item.id));
    const st = statusView(item.status);
    head.append(el('span', 'my-status is-' + st.tone, st.text));
    card.append(head);
    card.append(el('p', 'my-date', T('my.applied', { date: item.date })));

    // 신청 내용 (가려진 개인정보)
    const info = el('dl', 'my-info');
    [
      [T('my.f.name'), item.name],
      [T('my.f.phone'), item.phone],
      [T('my.f.email'), item.email],
      [T('my.f.program'), item.program],
      [T('my.f.english'), item.englishLevel],
      [T('my.f.langs'), item.languages],
    ].forEach(([label, value]) => {
      if (!value) return;
      info.append(el('dt', '', label), el('dd', '', value));
    });
    card.append(info);

    // 담당자 답변
    const reply = el('div', 'my-reply' + (item.reply ? '' : ' is-empty'));
    reply.append(el('h4', '', T('my.reply')));
    reply.append(el('p', '', item.reply || T('my.reply.none')));
    card.append(reply);

    // 내가 보낸 추가 질문
    if (item.questions.length) {
      const box = el('div', 'my-questions');
      box.append(el('h4', '', T('my.q.mine')));
      const ul = el('ul');
      item.questions.forEach((q) => {
        const li = el('li');
        if (q.at) li.append(el('time', '', q.at));
        li.append(el('p', '', q.text));
        ul.append(li);
      });
      box.append(ul);
      card.append(box);
    }

    card.append(askForm(item.id));
    return card;
  }

  /* ---------- 5. 추가 질문 보내기 ---------- */
  function askForm(id) {
    const f = el('form', 'ask-form');
    f.noValidate = true;
    const label = el('label', '', T('my.q.label'));
    const box = el('textarea');
    box.name = 'question';
    box.rows = 3;
    box.maxLength = QUESTION_MAX;
    box.placeholder = T('my.q.ph');
    label.append(box);
    const counter = el('small', 'ask-count', '0 / ' + QUESTION_MAX);
    const btn = el('button', 'btn btn-navy btn-block', T('my.q.send'));
    btn.type = 'submit';
    const msg = el('p', 'form-status');
    msg.hidden = true;
    msg.setAttribute('role', 'status');
    f.append(label, counter, btn, msg);

    box.addEventListener('input', () => {
      counter.textContent = box.value.length + ' / ' + QUESTION_MAX;
      if (msg.classList.contains('is-error')) msg.hidden = true;
    });

    f.addEventListener('submit', async (event) => {
      event.preventDefault();
      const question = box.value.trim();
      if (question.length < 2) {
        setMsg(msg, 'error', T('my.q.short'));
        box.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = T('my.q.sending');
      try {
        const result = await window.INFINITY.post('ask', { token: token, id: id, question: question });
        // 저장된 최신 내용으로 카드를 새로 그림
        const fresh = renderCard(result.item);
        f.closest('.my-app').replaceWith(fresh);
        setMsg(fresh.querySelector('.ask-form .form-status'), 'success', T('my.q.ok'));
      } catch (err) {
        console.error('[질문 전송 실패]', err);
        if (err.result && err.result.expired) {
          backToLookup(err.userMessage);
          return;
        }
        setMsg(msg, 'error', err.userMessage || T('my.q.fail'));
        btn.disabled = false;
        btn.textContent = T('my.q.send');
      }
    });
    return f;
  }

  /* ---------- 6. 작은 도우미 ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function setMsg(node, type, text) {
    node.textContent = text;
    node.className = 'form-status is-' + type;
    node.hidden = false;
  }
  function showStatus(type, message) {
    setMsg(status, type, message);
  }
  function hideStatus(force) {
    if (force || status.classList.contains('is-error')) status.hidden = true;
  }
})();

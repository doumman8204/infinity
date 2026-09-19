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
    '신규': { text: '접수 완료 · 담당자 확인 전', tone: 'new' },
  };
  // 색 규칙은 관리자 화면(admin.js)과 같음: 보류·취소 회색 / 완료·등록·합격 초록 / 나머지 노랑
  function statusView(value) {
    if (STATUS[value]) return STATUS[value];
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
      showStatus('error', '이메일 주소를 정확히 입력해 주세요.');
      form.elements.email.focus();
      return;
    }
    if (!/^\d{4}$/.test(phone4)) {
      showStatus('error', '연락처 뒷자리 숫자 4개를 입력해 주세요.');
      form.elements.phone4.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '확인 중…';
    try {
      const result = await window.INFINITY.post('lookup', { email: email, phone4: phone4 });
      token = result.token;
      form.reset();
      hideStatus(true);
      showResult(result.items);
    } catch (err) {
      console.error('[조회 실패]', err);
      showStatus('error', err.userMessage || '연결에 문제가 생겼습니다. 잠시 후 다시 시도하시거나 카카오톡으로 문의해 주세요.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '조회하기';
    }
  });

  /* ---------- 3. 결과 화면 ---------- */
  function showResult(items) {
    title.textContent = items.length > 1 ? '내 신청 내역 (' + items.length + '건)' : '내 신청 내역';
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
    card.append(el('p', 'my-date', item.date + ' 신청'));

    // 신청 내용 (가려진 개인정보)
    const info = el('dl', 'my-info');
    [
      ['성명', item.name],
      ['연락처', item.phone],
      ['이메일', item.email],
      ['관심 프로그램', item.program],
      ['영어 회화', item.englishLevel],
      ['가능 언어', item.languages],
    ].forEach(([label, value]) => {
      if (!value) return;
      info.append(el('dt', '', label), el('dd', '', value));
    });
    card.append(info);

    // 담당자 답변
    const reply = el('div', 'my-reply' + (item.reply ? '' : ' is-empty'));
    reply.append(el('h4', '', '💬 담당자 답변'));
    reply.append(el('p', '', item.reply ||
      '아직 답변이 없습니다. 담당자가 확인 후 연락드리거나 여기에 답변을 남겨 드려요.'));
    card.append(reply);

    // 내가 보낸 추가 질문
    if (item.questions.length) {
      const box = el('div', 'my-questions');
      box.append(el('h4', '', '내가 보낸 추가 질문'));
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
    const label = el('label', '', '추가로 궁금한 점이 있나요?');
    const box = el('textarea');
    box.name = 'question';
    box.rows = 3;
    box.maxLength = QUESTION_MAX;
    box.placeholder = '예) 10월 출국도 가능한가요?';
    label.append(box);
    const counter = el('small', 'ask-count', '0 / ' + QUESTION_MAX);
    const btn = el('button', 'btn btn-navy btn-block', '질문 보내기');
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
        setMsg(msg, 'error', '질문 내용을 2글자 이상 입력해 주세요.');
        box.focus();
        return;
      }
      btn.disabled = true;
      btn.textContent = '보내는 중…';
      try {
        const result = await window.INFINITY.post('ask', { token: token, id: id, question: question });
        // 저장된 최신 내용으로 카드를 새로 그림
        const fresh = renderCard(result.item);
        f.closest('.my-app').replaceWith(fresh);
        setMsg(fresh.querySelector('.ask-form .form-status'), 'success',
          '✅ 질문을 보냈습니다. 담당자가 확인 후 답변드릴게요.');
      } catch (err) {
        console.error('[질문 전송 실패]', err);
        if (err.result && err.result.expired) {
          backToLookup(err.userMessage);
          return;
        }
        setMsg(msg, 'error', err.userMessage || '전송 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
        btn.disabled = false;
        btn.textContent = '질문 보내기';
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

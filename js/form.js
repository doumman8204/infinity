/* =========================================================
   상담 신청서 입력 검사 (5단계)
   - 필수 칸(성명·연락처·이메일·개인정보 동의)이 올바른지 확인합니다.
   - 틀린 칸은 빨간 테두리 + 아래에 한국어 안내 문구를 보여 줍니다.
   - 한국 휴대폰 번호는 입력하는 동안 자동으로 "-"를 넣어 줍니다.
   - 이메일 주소의 흔한 오타(gmial.com 등)는 고치기 버튼을 보여 줍니다.
   - 검사를 통과하면 sendApplication()이 구글 Apps Script로 보냅니다. (8단계)
   ========================================================= */
(function () {
  const form = document.getElementById('apply-form');
  if (!form) return;

  const status = document.getElementById('form-status');
  const submitBtn = form.querySelector('button[type="submit"]');
  const fields = {
    name: form.elements.name,
    phone: form.elements.phone,
    email: form.elements.email,
    agree: form.elements.agree,
  };

  /* ---------- 1. 칸마다 "올바른가?"를 검사하는 규칙 ----------
     문제가 있으면 안내 문구를, 없으면 빈 글자('')를 돌려줍니다. */
  const rules = {
    name(value) {
      const v = value.trim();
      if (!v) return T('msg.name.empty');
      if (v.length < 2) return T('msg.name.short');
      if (/[0-9]/.test(v)) return T('msg.name.digit');
      return '';
    },
    phone(value) {
      const v = value.trim();
      const digits = v.replace(/\D/g, '');
      if (!v) return T('msg.phone.empty');
      if (v.startsWith('+')) {
        // 해외 번호: +국가번호 포함 숫자 8~15개
        if (digits.length < 8 || digits.length > 15) return T('msg.phone.intl');
        return '';
      }
      // 한국 휴대폰: 010·011·016·017·018·019로 시작, 숫자 10~11개
      if (!/^01[016789]\d{7,8}$/.test(digits)) return T('msg.phone.kr');
      return '';
    },
    email(value) {
      const v = value.trim();
      if (!v) return T('msg.email.empty');
      if (/\s/.test(v)) return T('msg.email.space');
      if (!/^[^@]+@[^@]+\.[a-z]{2,}$/i.test(v)) return T('msg.email.form');
      return '';
    },
    agree(_, input) {
      return input.checked ? '' : T('msg.agree');
    },
  };

  /* ---------- 2. 자주 틀리는 이메일 주소 → 올바른 주소 ---------- */
  const emailTypos = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com',
    'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gnail.com': 'gmail.com',
    'naver.co': 'naver.com', 'naver.con': 'naver.com', 'nave.com': 'naver.com', 'naver.cm': 'naver.com',
    'hanmail.ent': 'hanmail.net', 'hanmail.com': 'hanmail.net', 'hanmail.nte': 'hanmail.net',
    'daum.ent': 'daum.net', 'daum.com': 'daum.net',
    'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com',
    'nate.con': 'nate.com', 'kakao.con': 'kakao.com',
  };

  /* ---------- 3. 안내 문구를 넣을 자리 만들기 ---------- */
  function errorBox(name) {
    const input = fields[name];
    // 동의 체크박스는 label 바깥(아래)에, 나머지는 입력칸이 들어 있는 label 안 맨 끝에
    const holder = input.closest('label');
    let box = document.getElementById('err-' + name);
    if (!box) {
      box = document.createElement('p');
      box.id = 'err-' + name;
      box.className = 'field-error';
      box.hidden = true;
      if (name === 'agree') holder.after(box);
      else holder.appendChild(box);
      input.setAttribute('aria-describedby', box.id);
    }
    return box;
  }

  /* ---------- 4. 한 칸 검사해서 화면에 표시 ---------- */
  function check(name) {
    const input = fields[name];
    const message = rules[name](input.value, input);
    const box = errorBox(name);
    const target = name === 'agree' ? input.closest('label') : input;

    box.textContent = message;
    box.hidden = !message;
    target.classList.toggle('is-invalid', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (name !== 'agree') input.classList.toggle('is-valid', !message);
    return !message;
  }

  /* ---------- 5. 이메일 오타 추천 ---------- */
  function suggestEmail() {
    const input = fields.email;
    const old = document.getElementById('email-suggest');
    if (old) old.remove();

    const v = input.value.trim();
    const at = v.lastIndexOf('@');
    if (at < 1) return;
    const domain = v.slice(at + 1).toLowerCase();
    const fixed = emailTypos[domain];
    if (!fixed) return;

    const suggestion = v.slice(0, at + 1) + fixed;
    const p = document.createElement('p');
    p.id = 'email-suggest';
    p.className = 'field-suggest';
    p.textContent = T('msg.emailTypo', { addr: suggestion });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = T('msg.emailFix');
    btn.addEventListener('click', () => {
      input.value = suggestion;
      p.remove();
      check('email');
      input.focus();
    });
    p.appendChild(btn);
    input.closest('label').after(p);
  }

  /* ---------- 6. 한국 휴대폰 번호 자동 "-" 넣기 ---------- */
  function formatPhone(value) {
    if (value.trim().startsWith('+')) return value;      // 해외 번호는 손대지 않음
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (!d.startsWith('01')) return value;               // 휴대폰 번호가 아니면 그대로
    if (d.length <= 3) return d;
    if (d.length <= 7) return d.slice(0, 3) + '-' + d.slice(3);
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  }

  /* ---------- 7. 언제 검사할까? ----------
     - 칸을 벗어날 때(blur) 처음 검사
     - 한 번 빨갛게 표시된 칸은, 고치는 즉시 다시 검사해서 빨간색을 지워 줌 */
  const touched = {};
  ['name', 'phone', 'email'].forEach((name) => {
    const input = fields[name];
    input.addEventListener('blur', () => {
      if (!input.value.trim() && !touched[name]) return; // 그냥 지나친 빈 칸은 아직 혼내지 않기
      touched[name] = true;
      check(name);
      if (name === 'email') suggestEmail();
    });
    input.addEventListener('input', () => {
      if (name === 'phone') {
        const formatted = formatPhone(input.value);
        if (formatted !== input.value) input.value = formatted;
      }
      if (touched[name]) check(name);
      hideStatus();
    });
  });
  fields.agree.addEventListener('change', () => { check('agree'); hideStatus(); });

  /* ---------- 8. 신청 버튼을 눌렀을 때 ---------- */
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // 페이지가 새로고침되지 않게 막기

    const order = ['name', 'phone', 'email', 'agree'];
    const bad = order.filter((name) => {
      touched[name] = true;
      return !check(name);
    });
    suggestEmail();

    if (bad.length) {
      showStatus('error', T('msg.badFields', { n: bad.length }));
      fields[bad[0]].focus();
      fields[bad[0]].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 모든 검사 통과 → 보낼 내용 모으기 (앞뒤 빈칸 제거)
    const data = {
      name: fields.name.value.trim(),
      phone: fields.phone.value.trim(),
      email: fields.email.value.trim().toLowerCase(),
      englishLevel: form.elements.englishLevel.value,
      languages: form.elements.languages.value.trim(),
      program: form.elements.program.value,
      agree: true,
      source: whereFrom(),
      website: form.elements.website.value, // 스팸 로봇 확인용 (사람은 항상 빈칸)
    };

    // 두 번 눌러서 두 번 접수되는 것을 막기
    submitBtn.disabled = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = T('msg.sending');

    try {
      const result = await sendApplication(data);
      showStatus('success', T('msg.ok'),
        T('msg.okId', { id: result.id }) + (result.confirmSent ? T('msg.okMail') : ''));
      // 진행 상황·담당자 답변은 "내 신청 확인" 화면에서 볼 수 있다고 안내 (9단계)
      const link = document.createElement('a');
      link.href = 'mypage.html';
      link.textContent = T('msg.mypage');
      status.appendChild(link);
      form.reset();
      form.querySelectorAll('.is-valid').forEach((el) => el.classList.remove('is-valid'));
      Object.keys(touched).forEach((k) => delete touched[k]);
    } catch (err) {
      console.error('[신청 전송 실패]', err);
      showStatus('error', err.userMessage || T('msg.fail'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });

  /* ---------- 9. 실제 전송: 구글 Apps Script로 보내기 (8단계) ----------
     - 실제로 보내는 일은 js/api.js 의 INFINITY.post 가 합니다. (주소는 js/config.js)
     - 서버가 거절하면 그 이유(예: 이메일 형식)가 err.userMessage 에 담겨 옵니다. */
  function sendApplication(data) {
    return window.INFINITY.post('apply', data);
  }

  /* 방문자가 어디서 왔는지 (광고 링크의 ?utm_source=instagram 또는 이전 사이트 주소) */
  function whereFrom() {
    const utm = new URLSearchParams(location.search).get('utm_source');
    if (utm) return utm;
    try {
      return document.referrer ? new URL(document.referrer).hostname : T('msg.direct');
    } catch (_) {
      return '';
    }
  }

  function showStatus(type, message, detail) {
    status.textContent = message;
    if (detail) {
      const small = document.createElement('small');
      small.textContent = detail;
      status.appendChild(small);
    }
    status.className = 'form-status is-' + type;
    status.hidden = false;
  }
  function hideStatus() {
    if (status.classList.contains('is-error')) status.hidden = true;
  }
})();

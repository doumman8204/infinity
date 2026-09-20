/* =========================================================
   나에게 맞는 프로그램 찾기 (6단계: 추천 기능)
   - 질문 2개(영어 회화 / 호텔 경력)의 답을 보고 A~D 중 하나를 추천합니다.
       영어 O + 경력 O → A   영어 O + 경력 X → B
       영어 X + 경력 O → C   영어 X + 경력 X → D
   - "가격 자세히 보기"를 누르면 그 프로그램 카드로 이동하고 테두리로 강조합니다.
   - "이 프로그램으로 상담 신청"을 누르면 신청서의 관심 프로그램 칸이
     자동으로 채워집니다.
   ========================================================= */
(function () {
  const section = document.getElementById('finder');
  const result = document.getElementById('finder-result');
  if (!section || !result) return;

  /* ---------- 1. 추천 결과 내용 ----------
     option: 신청서 "관심 프로그램" 칸의 글자와 똑같아야 자동 선택됩니다. */
  const programs = {
    a: { option: '크루즈 면접' },
    b: { option: '인턴십(6개월) + 크루즈 면접' },
    c: { option: '영어연수(12주) + 크루즈 면접' },
    d: { option: '영어연수(12주) + 인턴십(6개월) + 크루즈 면접' },
  };
  // option 은 신청서 "관심 프로그램" 칸의 value 와 똑같아야 자동 선택됩니다.
  // (value 는 화면 언어와 상관없이 항상 한국어 → 관리자 시트에도 한국어로 저장됩니다)
  // 제목·추천 이유·가격 같은 "보이는 글자"는 js/lang-*.js 사전에서 가져옵니다. (12단계)

  let last = null;   // 지금 보여 주고 있는 추천 결과 (언어를 바꾸면 다시 그리기 위해)

  function pick(english, career) {
    if (english === 'yes') return career === 'yes' ? 'a' : 'b';
    return career === 'yes' ? 'c' : 'd';
  }

  /* ---------- 2. 답을 고를 때마다 결과 다시 보여 주기 ---------- */
  section.addEventListener('change', (e) => {
    if (e.target.type !== 'radio') return;
    const english = section.querySelector('input[name="q-english"]:checked');
    const career = section.querySelector('input[name="q-career"]:checked');

    // 한 질문에만 답했을 때: 남은 질문 안내
    if (!english || !career) {
      result.className = '';
      last = null;
      result.textContent = !english ? T('fd.need1') : T('fd.need2');
      return;
    }

    const key = pick(english.value, career.value);
    last = { key: key, birmingham: career.value === 'no' };
    showResult(last.key, last.birmingham);
  });

  // 국기를 눌러 언어를 바꾸면 추천 결과도 그 언어로 다시 그립니다
  document.addEventListener('i18n:change', () => {
    if (last) showResult(last.key, last.birmingham, true);   // true = 화면을 움직이지 않음
  });

  function showResult(key, showBirmingham, keepScroll) {
    result.className = 'is-done';
    result.innerHTML = `
      <span class="finder-badge">${T('fd.badge')}</span>
      <h3 class="finder-title">${T('fd.' + key + '.title')}</h3>
      <p class="finder-reason">${T('fd.' + key + '.reason')}</p>
      <p class="finder-price"><small>${T('fd.total')}</small>${T('fd.' + key + '.price')}</p>
      <p class="note fx-note">${T('fx.note')}</p>
      <div class="finder-actions">
        <a href="#apply" class="btn btn-primary btn-block" data-apply="${key}">${T('fd.apply')}</a>
        <a href="#program-${key}" class="btn btn-outline btn-block" data-detail="${key}">${T('fd.detail')}</a>
      </div>
      ${showBirmingham ? `
      <a href="#birmingham" class="finder-extra">
        <b>${T('fd.extra1')}</b>
        ${T('fd.extra2')}
      </a>` : ''}
      <button type="button" class="finder-reset">${T('fd.reset')}</button>
    `;
    // 결과가 화면 아래로 가려져 있으면 보이는 곳까지 살짝 내려 주기
    // (언어만 바꾼 경우에는 화면을 움직이지 않습니다)
    if (!keepScroll) result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- 3. 결과 안의 버튼 동작 ---------- */
  result.addEventListener('click', (e) => {
    const applyBtn = e.target.closest('[data-apply]');
    const detailBtn = e.target.closest('[data-detail]');
    const resetBtn = e.target.closest('.finder-reset');

    // 신청서의 "관심 프로그램" 칸 자동 선택 (이동은 링크가 알아서 함)
    if (applyBtn) {
      const select = document.querySelector('#apply-form select[name="program"]');
      if (select) select.value = programs[applyBtn.dataset.apply].option;
    }

    // 추천된 프로그램 카드만 테두리로 강조
    if (detailBtn) {
      document.querySelectorAll('.program.is-picked').forEach((el) => el.classList.remove('is-picked'));
      const card = document.getElementById('program-' + detailBtn.dataset.detail);
      if (card) card.classList.add('is-picked');
    }

    // 처음 상태로 되돌리기
    if (resetBtn) {
      section.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = false; });
      document.querySelectorAll('.program.is-picked').forEach((el) => el.classList.remove('is-picked'));
      last = null;
      result.className = '';
      result.textContent = T('fd.empty');
      section.querySelector('fieldset').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
})();

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
    a: {
      title: 'A. 크루즈 면접',
      price: '100만원',
      reason: '영어 회화와 호텔 경력을 모두 갖추셨네요! 바로 크루즈 면접에 도전하시면 됩니다.',
      option: '크루즈 면접',
    },
    b: {
      title: 'B. 인턴십(6개월) + 크루즈 면접',
      price: '520만원',
      reason: '영어는 준비되셨으니, 5성급 호텔 유급 인턴십으로 경력 1년을 인정받고 면접을 보시면 됩니다.',
      option: '인턴십(6개월) + 크루즈 면접',
    },
    c: {
      title: 'C. 영어연수(12주) + 크루즈 면접',
      price: '525만원',
      reason: '호텔 경력은 충분하니, 12주 영어연수로 면접 영어만 준비하시면 됩니다.',
      option: '영어연수(12주) + 크루즈 면접',
    },
    d: {
      title: 'D. 영어연수(12주) + 인턴십(6개월) + 크루즈 면접',
      price: '960만원',
      reason: '괜찮습니다. 처음 시작하는 분이 가장 많이 선택하는 과정입니다. 영어와 경력을 한 번에 채워 드립니다.',
      option: '영어연수(12주) + 인턴십(6개월) + 크루즈 면접',
    },
  };

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
      result.textContent = !english ? '👆 Q1에도 답해 주세요.' : '👇 Q2에도 답해 주세요.';
      return;
    }

    const key = pick(english.value, career.value);
    showResult(key, career.value === 'no');
  });

  function showResult(key, showBirmingham) {
    const p = programs[key];
    result.className = 'is-done';
    result.innerHTML = `
      <span class="finder-badge">🎯 추천 프로그램</span>
      <h3 class="finder-title">${p.title}</h3>
      <p class="finder-reason">${p.reason}</p>
      <p class="finder-price"><small>총</small>${p.price}</p>
      <div class="finder-actions">
        <a href="#apply" class="btn btn-primary btn-block" data-apply="${key}">📝 이 프로그램으로 상담 신청</a>
        <a href="#program-${key}" class="btn btn-outline btn-block" data-detail="${key}">가격 자세히 보기</a>
      </div>
      ${showBirmingham ? `
      <a href="#birmingham" class="finder-extra">
        <b>🎓 영국 대학 졸업장도 함께 받고 싶다면?</b>
        E. 버밍험 Diploma (12개월, 인턴십 포함) 보기 →
      </a>` : ''}
      <button type="button" class="finder-reset">↺ 다시 하기</button>
    `;
    // 결과가 화면 아래로 가려져 있으면 보이는 곳까지 살짝 내려 주기
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      result.className = '';
      result.textContent = '두 질문에 모두 답하면 추천 결과가 나타납니다.';
      section.querySelector('fieldset').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
})();

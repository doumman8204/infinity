/* =========================================================
   연락처·메신저 버튼 (7단계)
   - data-copy="글자" 가 붙은 버튼을 누르면 그 글자를 복사하고
     화면 아래에 "복사했어요" 알림을 띄웁니다.
   - QR 코드를 누르면 크게 보는 창이 열립니다. (PC로 보는 분이 휴대폰으로 찍기 쉽게)
   - "QR 이미지 저장"이 안 되는 휴대폰(아이폰 등)에서는
     QR 창을 열고 "이미지를 길게 눌러 저장" 안내를 보여 줍니다.
   ========================================================= */
(function () {
  const toast = document.getElementById('toast');
  let toastTimer;

  /* ---------- 1. 짧은 알림 띄우기 ---------- */
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), 3200);
  }

  /* ---------- 2. 글자 복사 ----------
     최신 방식(navigator.clipboard)이 막힌 환경(오래된 브라우저, 카톡 안 브라우저 등)에서는
     예전 방식(숨긴 입력칸에 넣고 복사)으로 한 번 더 시도합니다. */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    return new Promise((resolve, reject) => {
      const box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      box.setSelectionRange(0, text.length); // 아이폰용
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      box.remove();
      ok ? resolve() : reject();
    });
  }

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const label = btn.textContent;   // 언어가 바뀌어도 맞는 글자로 되돌아가게
      const text = btn.dataset.copy;
      copyText(text)
        .then(() => {
          showToast(btn.dataset.copyMsg || T('ui.copied'));
          btn.textContent = T('ui.copiedBtn');
          btn.classList.add('is-copied');
          setTimeout(() => {
            btn.textContent = label;
            btn.classList.remove('is-copied');
          }, 2000);
        })
        .catch(() => {
          // 복사가 끝내 안 되면 직접 보고 적을 수 있게 알려 줍니다.
          showToast(T('ui.copyFail', { text: text }));
        });
    });
  });

  /* ---------- 3. QR 크게 보기 ---------- */
  const dialog = document.getElementById('qr-dialog');
  const dialogImg = dialog && dialog.querySelector('img');
  const dialogTitle = dialog && dialog.querySelector('h4');
  const dialogNote = dialog && dialog.querySelector('.note');
  function defaultNote() { return dialogNote ? dialogNote.textContent : ''; }

  function openQr(src, title, note) {
    if (!dialog || typeof dialog.showModal !== 'function') {
      window.open(src, '_blank'); // 창 기능이 없는 아주 오래된 브라우저
      return;
    }
    dialogImg.src = src;
    dialogImg.alt = title;
    dialogTitle.textContent = title;
    dialogNote.textContent = note || defaultNote();
    dialog.showModal();
  }

  document.querySelectorAll('[data-qr]').forEach((btn) => {
    btn.addEventListener('click', () => openQr(btn.dataset.qr, btn.dataset.qrTitle));
  });

  // 창 바깥(어두운 부분)을 눌러도 닫히게
  if (dialog) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  /* ---------- 4. QR 이미지 저장 ----------
     아이폰·카톡 안 브라우저는 "다운로드"가 안 되거나 새 창으로 열리기만 해서,
     그런 환경에서는 QR 창을 띄우고 길게 눌러 저장하라고 안내합니다. */
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(navigator.userAgent);

  document.querySelectorAll('[data-save-qr]').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (!isIOS && !isInApp) return; // 안드로이드 크롬·PC는 그대로 다운로드
      e.preventDefault();
      openQr(link.getAttribute('href'), T('ctc.wc.qr'), T('ui.saveHint'));
    });
  });
})();

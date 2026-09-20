/* =========================================================
   언어 전환 (12단계)

   [작동 방식]
   - index.html 에 원래 쓰여 있는 글은 "한국어"입니다. 그대로 둡니다.
   - 화면을 열 때 한국어 원문을 기억해 둔 뒤,
     선택한 언어의 번역문(js/lang-en.js, js/lang-zh.js)으로 바꿔 끼웁니다.
   - 번역이 아직 없는 항목은 한국어가 그대로 보입니다 (화면이 깨지지 않게).

   [글에 번호표 붙이는 법]
   - 글자    : <h2 data-i18n="hero.h1">...</h2>
   - 설명글  : <img data-i18n-alt="hero.bgAlt">       (alt 속성)
   - 입력칸  : <input data-i18n-ph="form.name.ph">    (placeholder 속성)
   - 링크주소: <a data-i18n-href="hero.chat.href">    (언어별로 링크를 다르게)
   - 그 외   : data-i18n-title / data-i18n-aria / data-i18n-content
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 1. 기본 설정 ---------- */
  var SUPPORTED = ['en', 'ko', 'zh'];   // 일본어가 준비되면 'ja' 를 여기에 추가하세요
  var FALLBACK  = 'en';                 // 어느 나라인지 모를 때 보여 줄 기본 언어
  var STORE_KEY = 'infinity-lang';      // 선택한 언어를 브라우저에 기억시킬 이름

  var LABEL     = { ko: '한국어', en: 'English', zh: '中文', ja: '日本語' };
  var HTML_LANG = { ko: 'ko', en: 'en', zh: 'zh-Hans', ja: 'ja' };

  // 번역 사전 (js/lang-en.js, js/lang-zh.js 가 채워 넣습니다)
  var DICT = window.INFINITY_TEXT || {};

  // HTML 에 원래 있던 한국어 원문을 담아 둘 곳
  var ORIGINAL = {};

  // 글자 말고 "속성"을 번역할 때 쓰는 표
  var ATTRS = [
    { data: 'data-i18n-alt',     attr: 'alt' },
    { data: 'data-i18n-ph',      attr: 'placeholder' },
    { data: 'data-i18n-title',   attr: 'title' },
    { data: 'data-i18n-aria',    attr: 'aria-label' },
    { data: 'data-i18n-href',    attr: 'href' },
    { data: 'data-i18n-content', attr: 'content' },
    { data: 'data-i18n-qrtitle', attr: 'data-qr-title' },   // QR 크게 보기 창 제목
    { data: 'data-i18n-copymsg', attr: 'data-copy-msg' }    // "복사했어요" 알림 문구
  ];

  /* ---------- 2. 국기 그림 ---------- */
  /* 그림 파일을 따로 올리지 않아도 되도록 코드로 직접 그립니다 (외부 인터넷 연결 불필요). */

  function star(cx, cy, r, deg) {            // 오각별 하나
    var pts = [], i, a;
    for (i = 0; i < 5; i++) {
      a = (deg - 90 + i * 72) * Math.PI / 180;
      pts.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
    }
    return '<polygon points="' + [pts[0], pts[2], pts[4], pts[1], pts[3]].join(' ') +
           '" fill="#FFDE00"/>';
  }

  function trigram(bars, x, y, rot) {        // 태극기 네 귀퉁이의 검은 막대 (건·곤·감·리)
    var out = '<g transform="translate(' + x + ',' + y + ') rotate(' + rot + ')">', i, top;
    for (i = 0; i < 3; i++) {
      top = (i - 1) * 3.4 - 1.1;
      out += bars[i]
        ? '<rect x="-7" y="' + top + '" width="14" height="2.2"/>'
        : '<rect x="-7" y="' + top + '" width="5.9" height="2.2"/>' +
          '<rect x="1.1" y="' + top + '" width="5.9" height="2.2"/>';
    }
    return out + '</g>';
  }

  var FLAG = {
    // 영국 (영어)
    en: '<svg viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<rect width="60" height="40" fill="#012169"/>' +
        '<path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="8"/>' +
        '<path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="4"/>' +
        '<path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="13"/>' +
        '<path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="8"/></svg>',

    // 대한민국 (한국어)
    ko: '<svg viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<rect width="60" height="40" fill="#fff"/>' +
        '<g transform="translate(30,20) rotate(-33.69)">' +
        '<circle r="9.5" fill="#0047A0"/>' +
        '<path d="M-9.5,0 A9.5,9.5 0 0,1 9.5,0 A4.75,4.75 0 0,1 0,0 A4.75,4.75 0 0,0 -9.5,0" fill="#CD2E3A"/>' +
        '</g><g fill="#000">' +
        trigram([1, 1, 1], 12, 8, -56.3) +    // 건
        trigram([0, 1, 0], 48, 8, 56.3) +     // 감
        trigram([1, 0, 1], 12, 32, 56.3) +    // 리
        trigram([0, 0, 0], 48, 32, -56.3) +   // 곤
        '</g></svg>',

    // 중국 (중국어)
    zh: '<svg viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<rect width="60" height="40" fill="#EE1C25"/>' +
        star(11, 10.5, 6.4, 0) +
        star(21.5, 4, 2.2, 23) + star(25.5, 8.5, 2.2, 45) +
        star(25.5, 14.5, 2.2, 70) + star(21.5, 19, 2.2, 22) + '</svg>',

    // 일본 (일본어) — 번역이 준비되면 위 SUPPORTED 에 'ja' 를 추가하세요
    ja: '<svg viewBox="0 0 60 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<rect width="60" height="40" fill="#fff"/>' +
        '<circle cx="30" cy="20" r="12" fill="#BC002D"/></svg>'
  };

  /* ---------- 3. 어떤 언어로 보여 줄까? ---------- */
  function detect() {
    // (1) 전에 국기를 눌러 고른 적이 있으면 그 언어
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (SUPPORTED.indexOf(saved) !== -1) return saved;

    // (2) 없으면 방문자 브라우저에 설정된 언어를 봅니다
    var list = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var tag = String(list[i]).toLowerCase();
      var guess = tag.indexOf('ko') === 0 ? 'ko'
                : tag.indexOf('zh') === 0 ? 'zh'
                : tag.indexOf('ja') === 0 ? 'ja'
                : tag.indexOf('en') === 0 ? 'en' : null;
      if (guess && SUPPORTED.indexOf(guess) !== -1) return guess;
    }

    // (3) 그래도 모르면 기본 언어(영어)
    return FALLBACK;
  }

  /* ---------- 4. 한국어 원문 기억해 두기 ---------- */
  function remember() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      ORIGINAL[el.getAttribute('data-i18n')] = el.innerHTML;
    });
    ATTRS.forEach(function (rule) {
      document.querySelectorAll('[' + rule.data + ']').forEach(function (el) {
        ORIGINAL[el.getAttribute(rule.data)] = el.getAttribute(rule.attr) || '';
      });
    });
  }

  /* ---------- 5. 화면 글자 바꿔 끼우기 ---------- */
  function apply(lang) {
    var pack = (lang === 'ko') ? {} : (DICT[lang] || {});
    var get = function (key) {
      return (pack[key] != null) ? pack[key] : ORIGINAL[key];   // 번역 없으면 한국어 유지
    };

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = get(el.getAttribute('data-i18n'));
      if (v != null) el.innerHTML = v;
    });

    ATTRS.forEach(function (rule) {
      document.querySelectorAll('[' + rule.data + ']').forEach(function (el) {
        var v = get(el.getAttribute(rule.data));
        if (v != null) el.setAttribute(rule.attr, v);
      });
    });

    document.documentElement.setAttribute('lang', HTML_LANG[lang] || lang);
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}

    // 국기 버튼에 "지금 이 언어" 표시
    document.querySelectorAll('#lang-switch button').forEach(function (b) {
      b.setAttribute('aria-current', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });

    window.INFINITY_LANG = lang;
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } }));
  }

  /* ---------- 6. 국기 버튼 만들기 ---------- */
  function buildSwitch() {
    var box = document.getElementById('lang-switch');
    if (!box) return;
    box.innerHTML = SUPPORTED.map(function (lang) {
      return '<button type="button" data-lang="' + lang + '" lang="' + HTML_LANG[lang] + '"' +
             ' title="' + LABEL[lang] + '" aria-label="' + LABEL[lang] + '">' +
             FLAG[lang] + '</button>';
    }).join('');
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-lang]');
      if (btn) apply(btn.getAttribute('data-lang'));
    });
  }

  /* ---------- 7. 시작 ---------- */
  remember();
  buildSwitch();
  apply(detect());

  /* ---------- 8. 자바스크립트 안에서 쓰는 글자 가져오기 ----------
     예) T('msg.sending')            → "보내는 중…"
         T('msg.badFields', {n: 2})  → "빨간색으로 표시된 2개 항목을 확인해 주세요."
     한국어 원문은 js/lang-ko.js 에 들어 있습니다. */
  function t(key, vars) {
    var pack = DICT[window.INFINITY_LANG] || {};
    var ko = DICT.ko || {};
    var text = (pack[key] != null) ? pack[key]
             : (ORIGINAL[key] != null) ? ORIGINAL[key]
             : (ko[key] != null) ? ko[key] : key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        text = text.split('{' + k + '}').join(vars[k]);
      });
    }
    return text;
  }

  // 다른 파일(신청서 안내문 등)에서도 쓸 수 있게 열어 둡니다
  window.INFINITY_I18N = { apply: apply, t: t };
  window.T = t;
})();

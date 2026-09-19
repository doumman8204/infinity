/* =========================================================
   구글 Apps Script와 주고받는 공용 도우미 (8·9단계)
   - INFINITY.post('apply', {...}) 처럼 부르면 서버의 답(JSON)을 돌려줍니다.
   - Content-Type을 text/plain 으로 보내는 이유: 구글 서버가 다른 사이트(GitHub Pages)에서 온
     요청을 거절하지 않게 하는 요령입니다. 내용물은 JSON 그대로입니다.
   - 20초 안에 답이 없으면 포기하고 오류로 처리합니다.
   - 서버가 ok:false 로 답하면 오류로 처리하고, 서버가 알려 준 이유를
     err.userMessage 에, 답 전체를 err.result 에 담아 줍니다.
   ========================================================= */
window.INFINITY.post = async function (action, data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(window.INFINITY.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...data, action: action }),
      signal: controller.signal,
    });
    const result = await res.json();
    if (!result.ok) {
      const err = new Error(result.message || 'server error');
      err.userMessage = result.message;
      err.result = result;
      throw err;
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
};

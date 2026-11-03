import { useCallback, useRef, useState } from 'react';

let scriptPromise;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable'));
      script.onerror = () => reject(new Error('Turnstile unavailable'));
      document.head.appendChild(script);
    }).catch(error => { scriptPromise = null; throw error; });
  }
  return scriptPromise;
}

// callback refによってマウント・アンマウントと非同期読み込みを管理する。
export default function RankingTurnstile({ onToken }) {
  const widgetRef = useRef(null);
  const generation = useRef(0);
  const [error, setError] = useState('');
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const attach = useCallback(node => {
    const current = ++generation.current;
    if (!node) {
      if (widgetRef.current != null) window.turnstile?.remove(widgetRef.current);
      widgetRef.current = null;
      return;
    }
    if (!sitekey) { setError('本人確認の設定がありません。管理者にお問い合わせください。'); return; }
    loadTurnstile().then(api => {
      if (generation.current !== current) return;
      widgetRef.current = api.render(node, {
        sitekey, action: 'ranking_submit', size: 'compact',
        callback: token => { setError(''); onToken(token); },
        'expired-callback': () => onToken(''),
        'error-callback': () => { onToken(''); setError('本人確認に失敗しました。ページを再読み込みしてください。'); },
      });
    }).catch(() => { if (generation.current === current) setError('本人確認を読み込めません。通信を確認してください。'); });
  }, [onToken, sitekey]);
  return <div><div ref={attach} />{error && <p role="alert">{error}</p>}</div>;
}

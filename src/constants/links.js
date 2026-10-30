// =========================================================
// 学祭（ソ祭）展示用 アンケートURL・公開ゲームURL 定数定義
// URLを変更する場合はこのファイルを書き換えるだけで全体に反映されます
// =========================================================

// アンケート用 GoogleフォームのURL（ソ祭実施アンケート）
export const SURVEY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfyIAGBjC_SPzy76TqUZ7wMFNXtVwukyxxgU7wIbqMswhYl2A/viewform?usp=publish-editor';

// スマホから自宅でも遊べるゲームの公開URL（初期値は現在アクセス中のオリジン）
export const GAME_PUBLIC_URL =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://taikotyping.example.com';

// 指定したURLのQRコード画像URLを生成するヘルパー
export function getQrCodeImageUrl(targetUrl, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(
    targetUrl
  )}`;
}

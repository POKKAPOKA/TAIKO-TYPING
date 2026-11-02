import { supabase } from '../lib/supabase';

// 直前のプレイにだけ対応する。送信中の処理はこのオブジェクトへの参照を保持する。
let currentSession = null;

export function startRankedSession(playId, songId) {
  const session = { playId, songId, deviceId: null, promise: null };
  currentSession = session;
  // プレイ開始を通信の完了待ちで止めない。失敗も値として保持し、結果画面で通知する。
  session.promise = Promise.resolve().then(async () => {
    const { data, error } = await supabase.rpc('start_ranked_play', { p_song_id: songId });
    if (error) throw error;
    if (!data || typeof data.session_id !== 'string' || !data.session_id) throw new Error('Invalid ranking session');
    return { sessionId: data.session_id };
  }).catch(error => ({ error }));
}

export function getRankedSession(playId, songId) {
  return currentSession?.playId === playId && currentSession?.songId === songId ? currentSession : null;
}

export function rankingSessionError(message) {
  const error = new Error(message);
  error.code = 'RANKING_SESSION_ERROR';
  return error;
}

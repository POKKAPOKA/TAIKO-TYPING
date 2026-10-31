import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

const DEVICE_LIKES_STORAGE_KEY = 'taiko_song_device_likes';
const TOTAL_LIKES_CACHE_KEY = 'taiko_song_total_likes_cache';
export const LIKE_SONG_ID_PREFIX = '__like__:';

export function normalizeSongId(songIdOrFile) {
  if (!songIdOrFile) return '';
  return String(songIdOrFile).trim().replace(/\.json$/i, '');
}

function readJsonStorage(key) {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 保存不可時は無視 */ }
}

const count = value => Math.max(0, Math.round(Number(value) || 0));

export function getDeviceSongLikesMap() {
  return readJsonStorage(DEVICE_LIKES_STORAGE_KEY);
}

// 同期に失敗しても最後に取得した集計を表示する。
export function getLocalSongLikesMap() {
  return readJsonStorage(TOTAL_LIKES_CACHE_KEY);
}

// 集計値だけを取得し、他端末の識別子はブラウザに渡さない。
export async function fetchGlobalSongLikes() {
  try {
    const { data, error } = await supabase.rpc('get_song_like_totals');
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return getLocalSongLikesMap();
    const totals = Object.fromEntries(Object.entries(data).map(([songId, value]) => [songId, count(value)]));
    writeJsonStorage(TOTAL_LIKES_CACHE_KEY, totals);
    return totals;
  } catch {
    return getLocalSongLikesMap();
  }
}

// 端末単位の状態だけをRPCで問い合わせる。
export async function getSongLikeStatus(songIdOrFile) {
  const songId = normalizeSongId(songIdOrFile);
  if (!songId) throw new Error('曲IDがありません');
  const { data, error } = await supabase.rpc('get_song_like_status', {
    p_song_id: songId,
    p_device_id: getDeviceId(),
  });
  if (error) throw error;
  return data;
}

// 同じリザルト画面では追加・取消し、別プレイでは再度追加できる。
export async function updateSongLikeCount(songIdOrFile, isAdding) {
  const songId = normalizeSongId(songIdOrFile);
  if (!songId) return getLocalSongLikesMap();
  const { data, error } = await supabase.rpc('update_song_like', {
    p_song_id: songId,
    p_device_id: getDeviceId(),
    p_delta: isAdding ? 1 : -1,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object' || !Number.isFinite(Number(data.total_count)) || !Number.isFinite(Number(data.device_count))) {
    throw new Error('いいねの応答が不正です');
  }
  const totals = { ...getLocalSongLikesMap(), [songId]: count(data.total_count) };
  const devices = { ...getDeviceSongLikesMap(), [songId]: count(data.device_count) };
  writeJsonStorage(TOTAL_LIKES_CACHE_KEY, totals);
  writeJsonStorage(DEVICE_LIKES_STORAGE_KEY, devices);
  return totals;
}

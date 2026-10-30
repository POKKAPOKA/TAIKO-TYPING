import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

const DEVICE_LIKES_STORAGE_KEY = 'taiko_song_device_likes';
const TOTAL_LIKES_CACHE_KEY = 'taiko_song_total_likes_cache';
export const LIKE_SONG_ID_PREFIX = '__like__:';

/**
 * 曲IDまたは譜面ファイル名を正規化する
 * @param {string} songIdOrFile
 * @returns {string}
 */
export function normalizeSongId(songIdOrFile) {
  if (!songIdOrFile) return '';
  return String(songIdOrFile).trim().replace(/\.json$/i, '');
}

function readJsonStorage(key) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage 保存不可時は無視
  }
}

/**
 * この端末で各曲に送った累計いいね数を取得する
 * @returns {Record<string, number>}
 */
export function getDeviceSongLikesMap() {
  return readJsonStorage(DEVICE_LIKES_STORAGE_KEY);
}

/**
 * ローカルキャッシュと端末いいね数を統合した最新のいいね数マップを同期的に取得する
 * @returns {Record<string, number>}
 */
export function getLocalSongLikesMap() {
  const deviceMap = readJsonStorage(DEVICE_LIKES_STORAGE_KEY);
  const totalCache = readJsonStorage(TOTAL_LIKES_CACHE_KEY);
  const merged = { ...totalCache };

  Object.entries(deviceMap).forEach(([songId, count]) => {
    const num = Math.max(0, Math.round(Number(count) || 0));
    merged[songId] = Math.max(Number(merged[songId]) || 0, num);
  });

  return merged;
}

/**
 * Supabase から全端末のいいね数を取得して集計し、ローカルキャッシュを更新する
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchGlobalSongLikes() {
  const deviceId = getDeviceId();
  const deviceMap = readJsonStorage(DEVICE_LIKES_STORAGE_KEY);
  const currentTotalCache = readJsonStorage(TOTAL_LIKES_CACHE_KEY);

  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('song_id, device_id, score')
      .like('song_id', `${LIKE_SONG_ID_PREFIX}%`)
      .limit(2000);

    if (error || !Array.isArray(data)) {
      return getLocalSongLikesMap();
    }

    const remoteSumBySong = {};
    const seenCurrentDeviceForSong = new Set();

    data.forEach((row) => {
      const rawSongId = String(row.song_id || '');
      if (!rawSongId.startsWith(LIKE_SONG_ID_PREFIX)) return;
      const songId = rawSongId.slice(LIKE_SONG_ID_PREFIX.length);
      if (!songId) return;

      const remoteCount = Math.max(0, Math.round(Number(row.score) || 0));
      if (row.device_id === deviceId) {
        seenCurrentDeviceForSong.add(songId);
        const localDeviceCount = Math.max(0, Math.round(Number(deviceMap[songId]) || 0));
        const effectiveDeviceCount = Math.max(remoteCount, localDeviceCount);
        if (effectiveDeviceCount > localDeviceCount) {
          deviceMap[songId] = effectiveDeviceCount;
        }
        remoteSumBySong[songId] = (remoteSumBySong[songId] || 0) + effectiveDeviceCount;
      } else {
        remoteSumBySong[songId] = (remoteSumBySong[songId] || 0) + remoteCount;
      }
    });

    // まだSupabaseに未送信のローカルいいね分も加算する
    Object.entries(deviceMap).forEach(([songId, count]) => {
      const localCount = Math.max(0, Math.round(Number(count) || 0));
      if (localCount > 0 && !seenCurrentDeviceForSong.has(songId)) {
        remoteSumBySong[songId] = (remoteSumBySong[songId] || 0) + localCount;
      }
    });

    const nextTotalCache = {
      ...currentTotalCache,
      ...remoteSumBySong,
    };

    writeJsonStorage(DEVICE_LIKES_STORAGE_KEY, deviceMap);
    writeJsonStorage(TOTAL_LIKES_CACHE_KEY, nextTotalCache);
    return nextTotalCache;
  } catch {
    return getLocalSongLikesMap();
  }
}

/**
 * リザルト画面での「いいね！」トグル処理（ローカル即時反映 ＋ Supabase非同期同期）
 * @param {string} songIdOrFile
 * @param {boolean} isAdding true: いいね追加(+1), false: いいね取り消し(-1)
 * @returns {Promise<Record<string, number>>}
 */
export async function updateSongLikeCount(songIdOrFile, isAdding) {
  const songId = normalizeSongId(songIdOrFile);
  if (!songId) return getLocalSongLikesMap();

  const delta = isAdding ? 1 : -1;
  const deviceMap = readJsonStorage(DEVICE_LIKES_STORAGE_KEY);
  const totalCache = getLocalSongLikesMap();

  const prevDeviceLikes = Math.max(0, Math.round(Number(deviceMap[songId]) || 0));
  const nextDeviceLikes = Math.max(0, prevDeviceLikes + delta);
  deviceMap[songId] = nextDeviceLikes;

  const prevTotalLikes = Math.max(0, Math.round(Number(totalCache[songId]) || 0));
  const nextTotalLikes = Math.max(nextDeviceLikes, Math.max(0, prevTotalLikes + delta));
  totalCache[songId] = nextTotalLikes;

  writeJsonStorage(DEVICE_LIKES_STORAGE_KEY, deviceMap);
  writeJsonStorage(TOTAL_LIKES_CACHE_KEY, totalCache);

  // Supabaseへ非同期で同期
  try {
    const deviceId = getDeviceId();
    const likeSongKey = `${LIKE_SONG_ID_PREFIX}${songId}`;

    const { data: existingData } = await supabase
      .from('rankings')
      .select('id')
      .eq('song_id', likeSongKey)
      .eq('device_id', deviceId)
      .maybeSingle();

    const upsertRow = {
      ...(existingData?.id ? { id: existingData.id } : {}),
      song_id: likeSongKey,
      device_id: deviceId,
      player_name: 'LIKE',
      score: nextDeviceLikes,
      max_combo: 0,
      peak_kps: 0,
      perfect_count: 0,
      good_count: 0,
      miss_count: 0,
    };

    await supabase
      .from('rankings')
      .upsert(upsertRow, { onConflict: 'song_id,device_id' });
  } catch (err) {
    console.warn('Failed to sync song like to Supabase:', err);
  }

  return totalCache;
}

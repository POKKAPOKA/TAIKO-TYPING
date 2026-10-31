import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

// 自動送信と手動送信が重なった場合に順番に処理するための直列化キュー
let submitQueue = Promise.resolve();

/**
 * 指定した楽曲のランキング上位10件を取得する
 * @param {string} songId
 * @returns {Promise<Array>}
 */
export const fetchRankings = async (songId) => {
  try {
    // リザルト画面遷移直後の自動スコア送信が進行中の場合は完了を待ってから取得する
    await submitQueue.catch(() => {});

    const { data, error } = await supabase
      .from('rankings')
      .select('id, song_id, player_name, score, max_combo, peak_kps, perfect_count, good_count, miss_count, created_at')
      .eq('song_id', songId)
      .order('score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Failed to fetch rankings:', error);
      throw error;
    }

    // SupabaseのNUMERIC型は文字列で返る場合があるため数値に変換する
    // 順位(rank)とキャメルケースへのマッピングもここで行う
    return (data || []).map((entry, index) => ({
      ...entry,
      rank: index + 1,
      playerName: entry.player_name,
      score: Number(entry.score) || 0,
      maxCombo: Number(entry.max_combo) || 0,
      maxKps: Number(entry.peak_kps) || 0,
      perfectCount: Number(entry.perfect_count) || 0,
      goodCount: Number(entry.good_count) || 0,
      missCount: Number(entry.miss_count) || 0
    }));
  } catch (error) {
    console.error('Supabase fetch error:', error);
    throw error; // 呼び出し側でエラー表示できるよう再スローする
  }
};

/**
 * ランキング取得（結果をエラー込みの値として返す版。Reactのuse()フックと組み合わせて使う）
 * @param {string} songId
 * @returns {Promise<{rankings: Array, error: string|null}>}
 */
export const fetchRankingsResult = (songId) =>
  fetchRankings(songId)
    .then((rankings) => ({ rankings, error: null }))
    .catch(() => ({ rankings: [], error: 'ランキングの読み込みに失敗しました' }));

/**
 * プレイ結果（スコア）をランキングに送信する内部実装
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
const executeSubmitScore = async (payload) => {
  try {
    const {
      songId,
      playerName,
      score,
      maxCombo,
      maxKps,
      perfectCount,
      goodCount,
      missCount,
      deviceId = getDeviceId()
    } = payload;

    // 名前のバリデーション（1〜20文字制限に合わせる）
    const trimmedName = (playerName && playerName.trim()) ? playerName.trim() : 'Guest';
    const finalPlayerName = trimmedName.slice(0, 20);

    // データベース関数と同じ範囲に正規化する。
    const normalizedScore = Math.min(1010000, Math.max(0, Math.round(Number(score) || 0)));
    const normalizedMaxCombo = Math.min(10000, Math.max(0, Math.round(Number(maxCombo) || 0)));
    const normalizedMaxKps = Math.min(30, Math.max(0, Number((Number(maxKps) || 0).toFixed(2))));
    const normalizedPerfect = Math.max(0, Math.round(Number(perfectCount) || 0));
    const normalizedGood = Math.max(0, Math.round(Number(goodCount) || 0));
    const normalizedMiss = Math.max(0, Math.round(Number(missCount) || 0));

    const { data, error } = await supabase.rpc('submit_ranking_score', {
      p_song_id: songId,
      p_device_id: deviceId,
      p_player_name: finalPlayerName,
      p_score: normalizedScore,
      p_max_combo: normalizedMaxCombo,
      p_max_kps: normalizedMaxKps,
      p_perfect_count: normalizedPerfect,
      p_good_count: normalizedGood,
      p_miss_count: normalizedMiss,
    });

    if (error) {
      console.error('Failed to submit score:', error);
      throw error;
    }

    if (!data || typeof data !== 'object') throw new Error('ランキング登録の応答が不正です');
    const updated = Boolean(data.updated);
    const isNewBest = Boolean(data.is_new_best);
    return {
      success: true,
      updated,
      isNewBest,
      entry: data,
      message: isNewBest ? 'ベストスコアを更新してランキングに登録しました' : updated ? 'プレイヤー名をランキングに反映しました（自己ベスト維持）' : '自己ベスト未更新（過去ベスト登録済み）'
    };
  } catch (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }
};

/**
 * プレイ結果（スコア）をランキングに送信する（直列化キュー経由）
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const submitScore = (payload) => {
  const next = submitQueue.then(() => executeSubmitScore(payload));
  submitQueue = next.catch(() => {});
  return next;
};


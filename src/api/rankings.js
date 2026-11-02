import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

// 自動送信と手動送信が重なった場合に順番に処理するための直列化キュー
let submitQueue = Promise.resolve();

function noteLimitError(message) {
  const error = new Error(message);
  error.code = 'RANKING_INVALID_NOTE_COUNT';
  return error;
}

function invalidKpsError(message = '警告：最大コンボが1以上なのにMAX KPSが0のため、ランキングに登録できません。') {
  const error = new Error(message);
  error.code = 'RANKING_INVALID_KPS';
  return error;
}

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
      .or('max_combo.lt.1,peak_kps.neq.0')
      .order('score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Failed to fetch rankings:', error);
      throw error;
    }

    // SupabaseのNUMERIC型は文字列で返る場合があるため数値に変換する
    // 順位(rank)とキャメルケースへのマッピングもここで行う
    return (data || []).filter(entry => !(Number(entry.max_combo) >= 1 && Number(entry.peak_kps) === 0)).map((entry, index) => ({
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
      totalNotes,
      deviceId = getDeviceId()
    } = payload;

    // 曲一覧の古い表示値ではなく、実際に演奏した譜面のノーツ数を上限にする。
    const limit = Number(totalNotes);
    const counts = [maxCombo, perfectCount, goodCount, missCount].map(value => Number(value ?? 0));
    if (!Number.isInteger(limit) || limit <= 0 || counts.some(value => !Number.isInteger(value) || value < 0) ||
        counts[0] > limit || counts[1] + counts[2] + counts[3] > limit) {
      throw noteLimitError(Number.isInteger(limit) && limit > 0
        ? `警告：最大コンボまたは判定数が譜面のノーツ数（${limit}）を超えているか、記録が不正なためランキングに登録できません。`
        : '警告：譜面のノーツ数を確認できないためランキングに登録できません。');
    }

    // 名前のバリデーション（1〜20文字制限に合わせる）
    const trimmedName = (playerName && playerName.trim()) ? playerName.trim() : 'Guest';
    const finalPlayerName = trimmedName.slice(0, 20);

    // データベース関数と同じ範囲に正規化する。
    const normalizedScore = Math.min(1010000, Math.max(0, Math.round(Number(score) || 0)));
    const normalizedMaxCombo = Math.min(10000, Math.max(0, Math.round(Number(maxCombo) || 0)));
    const normalizedMaxKps = Math.min(30, Math.max(0, Number((Number(maxKps) || 0).toFixed(2))));
    if (normalizedMaxCombo >= 1 && normalizedMaxKps === 0) throw invalidKpsError();
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
      if (error.message?.includes('RANKING_ZERO_KPS_WITH_COMBO')) {
        throw invalidKpsError('警告：最大コンボが1以上でMAX KPSが0の記録は登録できません。同じ端末の過去ベストがこの条件に当てはまる場合も更新できません。');
      }
      if (error.message?.includes('RANKING_NOTE_LIMIT_EXCEEDED')) {
        throw noteLimitError('警告：最大コンボまたは判定数がデータベースに登録された譜面のノーツ数を超えています。既存の自己ベストが上限を超えている場合も更新できません。');
      }
      if (error.message?.includes('RANKING_SONG_LIMIT_NOT_CONFIGURED')) {
        throw noteLimitError('警告：この曲のノーツ数上限がデータベースに設定されていないためランキングに登録できません。');
      }
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


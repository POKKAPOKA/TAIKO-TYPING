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
    const { data, error } = await supabase
      .from('rankings')
      .select('*')
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
      isAuto = false
    } = payload;

    const deviceId = getDeviceId();

    // 名前のバリデーション（1〜20文字制限に合わせる）
    const trimmedName = (playerName && playerName.trim()) ? playerName.trim() : 'Guest';
    const finalPlayerName = trimmedName.slice(0, 20);

    // Supabase側のCHECK制約（score: 0..10000000, max_combo: 0..10000, peak_kps: 0..30）に合わせて正規化
    const normalizedScore = Math.min(10000000, Math.max(0, Math.round(Number(score) || 0)));
    const normalizedMaxCombo = Math.min(10000, Math.max(0, Math.round(Number(maxCombo) || 0)));
    const normalizedMaxKps = Math.min(30, Math.max(0, Number((Number(maxKps) || 0).toFixed(2))));
    const normalizedPerfect = Math.max(0, Math.round(Number(perfectCount) || 0));
    const normalizedGood = Math.max(0, Math.round(Number(goodCount) || 0));
    const normalizedMiss = Math.max(0, Math.round(Number(missCount) || 0));

    // 既存スコアの確認
    const { data: existingData, error: fetchError } = await supabase
      .from('rankings')
      .select('id, score, player_name')
      .eq('song_id', songId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch existing score:', fetchError);
      throw fetchError;
    }

    const prevScore = existingData ? Math.round(Number(existingData.score) || 0) : -1;

    if (existingData) {
      if (isAuto) {
        // 自動登録時：既存の自己ベスト以下なら上書きしない
        if (normalizedScore <= prevScore) {
          return {
            success: true,
            updated: false,
            isNewBest: false,
            message: '自己ベスト未更新（過去ベスト登録済み）'
          };
        }
      } else {
        // 手動登録（「登録する」ボタン押下）時：
        // 今回のスコアが過去ベスト未満の場合、スコア自体は上書きしないが、
        // プレイヤー名が変更されていれば既存ベスト記録の名前だけを更新する
        if (normalizedScore < prevScore) {
          if (existingData.player_name !== finalPlayerName) {
            const { data: nameUpdatedData, error: nameUpdateError } = await supabase
              .from('rankings')
              .update({ player_name: finalPlayerName })
              .eq('id', existingData.id)
              .select();

            if (nameUpdateError) {
              console.error('Failed to update player name:', nameUpdateError);
              throw nameUpdateError;
            }

            return {
              success: true,
              updated: true,
              nameOnlyUpdated: true,
              entry: nameUpdatedData?.[0],
              message: 'プレイヤー名をランキングに反映しました（自己ベスト維持）'
            };
          }
          return {
            success: true,
            updated: false,
            isNewBest: false,
            message: 'ベストスコア未更新のため登録されませんでした'
          };
        }
      }
    }

    // upsertで新規登録または自己ベスト上書き（自動登録直後の同スコアでの名前変更もここで上書き可能）
    const upsertRow = {
      ...(existingData?.id ? { id: existingData.id } : {}),
      song_id: songId,
      device_id: deviceId,
      player_name: finalPlayerName,
      score: normalizedScore,
      max_combo: normalizedMaxCombo,
      peak_kps: normalizedMaxKps,
      perfect_count: normalizedPerfect,
      good_count: normalizedGood,
      miss_count: normalizedMiss
    };

    const { data, error } = await supabase
      .from('rankings')
      .upsert(upsertRow, { onConflict: 'song_id,device_id' })
      .select();

    if (error) {
      console.error('Failed to submit score:', error);
      throw error;
    }

    return {
      success: true,
      updated: true,
      isNewBest: normalizedScore > prevScore,
      entry: data?.[0],
      message: 'ベストスコアを更新してランキングに登録しました'
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


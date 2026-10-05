import { supabase } from '../lib/supabase';

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
      maxKps: Number(entry.peak_kps) || 0
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
 * プレイ結果（スコア）をランキングに送信する
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const submitScore = async (payload) => {
  try {
    const { songId, playerName, score, maxCombo, maxKps } = payload;
    const { getDeviceId } = await import('../lib/deviceId');
    const deviceId = getDeviceId();
    
    // 名前のバリデーション
    const finalPlayerName = (playerName && playerName.trim()) ? playerName.trim() : 'Guest';

    // 既存スコアの確認
    const { data: existingData, error: fetchError } = await supabase
      .from('rankings')
      .select('score, id')
      .eq('song_id', songId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch existing score:', fetchError);
      throw fetchError;
    }

    // 既存スコアが存在し、今回のスコアがそれ以下なら更新しない
    if (existingData && existingData.score >= score) {
      return { success: true, updated: false, message: '自己ベスト未更新' };
    }

    // upsertで登録・上書き
    const { data, error } = await supabase
      .from('rankings')
      .upsert({
        id: existingData?.id,
        song_id: songId,
        device_id: deviceId,
        player_name: finalPlayerName,
        score,
        max_combo: maxCombo,
        peak_kps: maxKps
      }, { onConflict: 'song_id,device_id' })
      .select();

    if (error) {
      console.error('Failed to submit score:', error);
      throw error;
    }

    return { success: true, updated: true, entry: data[0] };
  } catch (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }
};

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

    // 順位(rank)とキャメルケースへのマッピングを付与して返す
    return (data || []).map((entry, index) => ({
      ...entry,
      rank: index + 1,
      playerName: entry.player_name,
      maxCombo: entry.max_combo,
      maxKps: entry.peak_kps
    }));
  } catch (error) {
    console.error('Supabase fetch error:', error);
    return []; // エラー時は空配列を返す
  }
};

/**
 * プレイ結果（スコア）をランキングに送信する
 * @param {Object} payload 
 * @returns {Promise<Object>}
 */
export const submitScore = async (payload) => {
  try {
    const { songId, playerName, score, maxCombo, maxKps } = payload;
    
    // 名前のバリデーション
    const finalPlayerName = (playerName && playerName.trim()) ? playerName.trim() : 'Anonymous';

    const { data, error } = await supabase
      .from('rankings')
      .insert([
        {
          song_id: songId,
          player_name: finalPlayerName,
          score,
          max_combo: maxCombo,
          peak_kps: maxKps
        }
      ])
      .select();

    if (error) {
      console.error('Failed to submit score:', error);
      throw error;
    }

    return { success: true, entry: data[0] };
  } catch (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }
};

// =========================================================
// プレイ記録（Play Logs）自動保存 ＆ レベル妥当性検証CSV出力ユーティリティ
// Excelで文字化けしないよう UTF-8 BOM (\uFEFF) 付きで出力します
// =========================================================
import { supabase } from '../lib/supabase';
import { loadSongs } from '../api/songList';

export const PLAY_LOGS_STORAGE_KEY = 'taiko_typing_play_logs';
export const PLAY_LOGS_CLEARED_AT_KEY = 'taiko_typing_play_logs_cleared_at';

/**
 * 保存済みのプレイ記録ログをすべてクリアし、クリア日時を記録する
 * （クリア日時以前のSupabaseランキング記録もCSV集計対象から除外されるようにする）
 */
export function clearPlayLogs() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PLAY_LOGS_STORAGE_KEY);
    localStorage.setItem(PLAY_LOGS_CLEARED_AT_KEY, new Date().toISOString());
  } catch (err) {
    console.warn('Failed to clear play logs:', err);
  }
}

/**
 * ログクリア日時（ミリ秒）を取得する
 * @returns {number}
 */
function getClearedAtTimestamp() {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(PLAY_LOGS_CLEARED_AT_KEY);
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

/**
 * 日時を "YYYY-MM-DD HH:mm:ss" 形式にフォーマットする
 * @param {Date|string|number} dateInput
 * @returns {string}
 */
export function formatDateTime(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/**
 * ファイル名用の日付文字列 "YYYYMMDD" を返す
 * @param {Date} d
 * @returns {string}
 */
export function formatDateYmd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * localStorage から保存済みプレイ記録配列を読み込む
 * @returns {Array<Object>}
 */
export function getLocalPlayLogs() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PLAY_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 1プレイ分の結果データを localStorage に自動保存する
 * @param {Object} params
 * @returns {Object} 保存されたログエントリ
 */
export function savePlayLogToLocal(params) {
  const {
    songId,
    songTitle,
    creator,
    definedLevel,
    totalNotes,
    isMobileMode,
    score,
    perfectCount,
    goodCount,
    missCount,
    maxCombo,
    peakKps,
    worstKeys = [],
    mistakeLog = [],
  } = params;

  const now = new Date();
  const roundedScore = Math.round(Number(score) || 0);
  const perf = Math.max(0, Math.round(Number(perfectCount) || 0));
  const good = Math.max(0, Math.round(Number(goodCount) || 0));
  const miss = Math.max(0, Math.round(Number(missCount) || 0));
  const notesTotal = Math.max(
    1,
    Math.round(Number(totalNotes) || perf + good + miss || 1)
  );

  // ミスが多かったキーおよびミスしたノーツの上位を文字列化
  const topKeyStr = Array.isArray(worstKeys) && worstKeys.length > 0
    ? worstKeys
        .slice(0, 5)
        .map((w) => `${w.char}(${w.count}回)`)
        .join(' / ')
    : '';

  const missedNotesMap = {};
  if (Array.isArray(mistakeLog)) {
    mistakeLog.forEach((m) => {
      if (m && m.note) {
        missedNotesMap[m.note] = (missedNotesMap[m.note] || 0) + 1;
      }
    });
  }
  const topMissedNotesStr = Object.entries(missedNotesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([note, count]) => `${note}(${count})`)
    .join(', ');

  const topMissCombined = [
    topKeyStr ? `キー: ${topKeyStr}` : '',
    topMissedNotesStr ? `語句: ${topMissedNotesStr}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const entry = {
    id: `${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    played_at: formatDateTime(now),
    song_id: String(songId || 'unknown').replace(/\.json$/i, ''),
    song_title: String(songTitle || songId || '不明な楽曲'),
    creator: String(creator || '不明'),
    defined_level: Math.min(10, Math.max(1, Number(definedLevel) || 1)),
    total_notes: notesTotal,
    input_mode: isMobileMode ? 'モバイル/フリック' : 'PC',
    score: roundedScore,
    is_clear: roundedScore >= 700000 ? 'CLEAR' : 'FAILED',
    perfect_count: perf,
    good_count: good,
    miss_count: miss,
    max_combo: Math.max(0, Math.round(Number(maxCombo) || 0)),
    peak_kps: Number((Number(peakKps) || 0).toFixed(2)),
    top_miss_keys: topMissCombined || 'なし',
    source: 'local',
  };

  try {
    const existing = getLocalPlayLogs();
    existing.push(entry);
    localStorage.setItem(PLAY_LOGS_STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Failed to save play log to localStorage:', err);
  }

  return entry;
}

/**
 * localStorage のプレイ記録と Supabase の rankings テーブルの全記録を取得・統合する
 * @returns {Promise<{logs: Array<Object>, songsMap: Map<string, Object>, localCount: number, remoteCount: number}>}
 */
export async function fetchMergedPlayLogs() {
  const clearedAtTime = getClearedAtTimestamp();

  // 1. 曲メタデータ一覧（songs/index.json）を取得して辞書化
  const songsMap = new Map();
  try {
    const { songs } = await loadSongs();
    if (Array.isArray(songs)) {
      songs.forEach((s) => {
        if (s && s.id) {
          songsMap.set(String(s.id), s);
        }
      });
    }
  } catch {
    // 曲リスト取得失敗時は既存のログ情報のみ使用
  }

  // 2. ローカル保存済みプレイログを取得し、不足している曲情報があれば補完
  const localLogs = getLocalPlayLogs().map((log) => {
    const cleanId = String(log.song_id || '').replace(/\.json$/i, '');
    const meta = songsMap.get(cleanId);
    return {
      ...log,
      song_id: cleanId || 'unknown',
      song_title:
        meta?.title ||
        (log.song_title && log.song_title !== cleanId ? log.song_title : cleanId || '不明'),
      creator:
        log.creator && log.creator !== '不明' && log.creator !== '公式譜面'
          ? log.creator
          : meta?.creator || log.creator || '不明',
      defined_level: Number(log.defined_level || meta?.difficulty) || 1,
      total_notes:
        Number(log.total_notes || meta?.notesCount) ||
        (Number(log.perfect_count) || 0) +
          (Number(log.good_count) || 0) +
          (Number(log.miss_count) || 0) ||
        1,
    };
  });

  // ローカルログとの重複判定用シグネチャセット
  const seenSignatures = new Set(
    localLogs.map(
      (l) =>
        `${l.song_id}|${l.score}|${l.max_combo}|${l.perfect_count}|${l.good_count}|${l.miss_count}`
    )
  );

  // 3. Supabase の rankings テーブルから全プレイヤーの記録を取得して統合
  let remoteLogs = [];
  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        if (String(row.song_id || '').startsWith('__like__:')) {
          return;
        }
        // ログクリア操作が行われている場合、クリア日時以前のオンライン記録は集計対象から除外
        if (clearedAtTime > 0) {
          const rowTime = new Date(row.updated_at || row.created_at || 0).getTime();
          if (!rowTime || Number.isNaN(rowTime) || rowTime <= clearedAtTime) {
            return;
          }
        }

        const cleanId = String(row.song_id || 'unknown').replace(/\.json$/i, '');
        const score = Math.round(Number(row.score) || 0);
        const maxCombo = Math.round(Number(row.max_combo) || 0);
        const perf = Math.round(Number(row.perfect_count) || 0);
        const good = Math.round(Number(row.good_count) || 0);
        const miss = Math.round(Number(row.miss_count) || 0);
        const sig = `${cleanId}|${score}|${maxCombo}|${perf}|${good}|${miss}`;

        if (seenSignatures.has(sig)) {
          return;
        }
        seenSignatures.add(sig);

        const meta = songsMap.get(cleanId);
        const totalNotes =
          Number(meta?.notesCount) || Math.max(1, perf + good + miss);

        remoteLogs.push({
          id: `supabase_${row.id || Math.random().toString(36).slice(2, 8)}`,
          played_at: formatDateTime(row.updated_at || row.created_at || new Date()),
          song_id: cleanId,
          song_title: meta?.title || cleanId,
          creator: meta?.creator || '不明',
          defined_level: Number(meta?.difficulty) || 1,
          total_notes: totalNotes,
          input_mode: row.input_mode || 'PC/オンライン記録',
          score,
          is_clear: score >= 700000 ? 'CLEAR' : 'FAILED',
          perfect_count: perf,
          good_count: good,
          miss_count: miss,
          max_combo: maxCombo,
          peak_kps: Number((Number(row.peak_kps) || 0).toFixed(2)),
          top_miss_keys: row.player_name ? `Player: ${row.player_name}` : 'なし',
          source: 'supabase',
        });
      });
    }
  } catch (err) {
    console.warn('Supabase rankings fetch skipped for CSV:', err);
  }

  const merged = [...localLogs, ...remoteLogs].sort((a, b) =>
    String(b.played_at).localeCompare(String(a.played_at))
  );

  return {
    logs: merged,
    songsMap,
    localCount: localLogs.length,
    remoteCount: remoteLogs.length,
  };
}

/**
 * CSVの1セルをエスケープする
 * @param {any} val
 * @returns {string}
 */
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * 2次元配列をBOM付きUTF-8 CSVファイルとしてブラウザからダウンロードさせる
 * @param {Array<string>} headers
 * @param {Array<Array<any>>} rows
 * @param {string} filename
 */
function triggerCsvDownload(headers, rows, filename) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  // Excelで直接開いても日本語が文字化けしないよう先頭にUTF-8 BOM (\uFEFF) を付与
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 同レベル帯の基準・クリア率・平均スコアからレベル妥当性の目安判定を返す
 * @param {number} definedLevel ☆1〜10
 * @param {number} playCount
 * @param {number} clearRatePercent 0〜100
 * @param {number} avgScore 0〜1010000
 * @returns {string}
 */
export function evaluateLevelValidity(definedLevel, playCount, clearRatePercent, avgScore) {
  if (!playCount || playCount <= 0) {
    return 'データ不足（未プレイ）';
  }

  // レベル帯に応じた基準補正（低難易度ほど期待クリア率・期待平均スコアが高め）
  const level = Math.min(10, Math.max(1, Number(definedLevel) || 1));
  const lowClearThreshold = level <= 3 ? 50 : level <= 6 ? 35 : 25;
  const lowScoreThreshold = level <= 3 ? 700000 : level <= 6 ? 660000 : 620000;

  // クリア率が極端に低い、または平均スコアが70万点を大きく下回る場合
  if (clearRatePercent < lowClearThreshold || avgScore < lowScoreThreshold) {
    return '難しめ（要レベル引き上げ検討）';
  }

  // 平均スコアが95万点以上でクリア率100%に近い場合（高難易度☆7以上では93万点以上＆クリア率95%以上でも易しめ判定）
  const highScoreThreshold = level >= 7 ? 930000 : 950000;
  const highClearThreshold = level >= 7 ? 95 : 98;
  if (avgScore >= highScoreThreshold && clearRatePercent >= highClearThreshold && level < 10) {
    return '易しめ（要レベル引き下げ検討）';
  }

  return '適正範囲';
}

/**
 * ①「全プレイ履歴（ローデータ）CSV」（play_logs_YYYYMMDD.csv）を生成・ダウンロードする
 * @returns {Promise<{count: number, filename: string}>}
 */
export async function exportPlayLogsCsv() {
  const { logs } = await fetchMergedPlayLogs();
  const filename = `play_logs_${formatDateYmd()}.csv`;

  const headers = [
    'played_at (プレイ日時)',
    'song_id (楽曲ID)',
    'song_title (楽曲名)',
    'creator (譜面制作者)',
    'defined_level (設定レベル☆)',
    'total_notes (総ノーツ数)',
    'input_mode (入力モード)',
    'score (最終スコア)',
    'is_clear (クリア判定)',
    'perfect_count (PERFECT数)',
    'good_count (GOOD数)',
    'miss_count (MISS数)',
    'perfect_rate_pct (PERFECT率%)',
    'miss_rate_pct (ミス率%)',
    'max_combo (最大コンボ数)',
    'peak_kps (PEAK KPS)',
    'top_miss_keys (上位ミス文字・ノーツ)',
  ];

  const rows = logs.map((log) => {
    const totalNotes = Math.max(
      1,
      Number(log.total_notes) ||
        (Number(log.perfect_count) || 0) +
          (Number(log.good_count) || 0) +
          (Number(log.miss_count) || 0) ||
        1
    );
    const perfectRate = (((Number(log.perfect_count) || 0) / totalNotes) * 100).toFixed(2);
    const missRate = (((Number(log.miss_count) || 0) / totalNotes) * 100).toFixed(2);

    return [
      log.played_at,
      log.song_id,
      log.song_title,
      log.creator,
      log.defined_level,
      totalNotes,
      log.input_mode,
      log.score,
      log.is_clear,
      log.perfect_count,
      log.good_count,
      log.miss_count,
      perfectRate,
      missRate,
      log.max_combo,
      Number(log.peak_kps || 0).toFixed(2),
      log.top_miss_keys || 'なし',
    ];
  });

  triggerCsvDownload(headers, rows, filename);
  return { count: logs.length, filename };
}

/**
 * レベル検証集計における最小有効スコア基準値
 * （スコア0や20万点未満の放置・途中放棄データは集計から除外する）
 */
export const MIN_VALID_SCORE_FOR_SUMMARY = 200000;

/**
 * 楽曲グループのプレイ記録から、スコア0や低すぎる外れ値を除外する
 * ※高スコア側は外れ値とせずすべて計算に反映する（片側下限フィルタ）
 * @param {Array<Object>} records
 * @returns {{ validRecords: Array<Object>, excludedCount: number }}
 */
export function filterValidRecordsForSummary(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { validRecords: [], excludedCount: 0 };
  }

  // 1. スコア0または極端に低い記録（放置・途中放棄とみなせる200,000点未満）を除外
  const floorFiltered = records.filter((r) => {
    const s = Number(r?.score) || 0;
    return s >= MIN_VALID_SCORE_FOR_SUMMARY;
  });

  if (floorFiltered.length <= 1) {
    return {
      validRecords: floorFiltered,
      excludedCount: records.length - floorFiltered.length,
    };
  }

  // 2. 統計的な下側外れ値の除外（高スコア側は上限を設けず100%反映する）
  const sortedScores = floorFiltered
    .map((r) => Number(r.score) || 0)
    .sort((a, b) => a - b);

  const n = sortedScores.length;
  const maxScore = sortedScores[n - 1];

  // 2件のみの場合：最高スコアの55%未満かつ50万点未満の極端に低い記録のみ外れ値として除外
  if (n === 2) {
    const lowerBound2 = Math.min(500000, maxScore * 0.55);
    const valid2 = floorFiltered.filter((r) => (Number(r.score) || 0) >= lowerBound2);
    return {
      validRecords: valid2,
      excludedCount: records.length - valid2.length,
    };
  }

  // 3件以上の場合：四分位範囲（IQR）による下側フェンス（Q1 - 1.5 * IQR）および中央値の55%を下限基準とする
  // ただし通常の有効プレイ（50万点以上）が過剰に弾かれないよう下限閾値の上限を500,000点に制限する
  const getPercentile = (arr, p) => {
    const idx = (arr.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return arr[lo];
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  };

  const q1 = getPercentile(sortedScores, 0.25);
  const median = getPercentile(sortedScores, 0.5);
  const q3 = getPercentile(sortedScores, 0.75);
  const iqr = q3 - q1;

  const iqrLowerFence = q1 - 1.5 * iqr;
  const medianLowerFence = median * 0.55;
  const statisticalLowerCutoff = Math.min(
    500000,
    Math.max(iqrLowerFence, medianLowerFence)
  );
  const lowerCutoff = Math.max(MIN_VALID_SCORE_FOR_SUMMARY, statisticalLowerCutoff);

  const validRecords = floorFiltered.filter((r) => (Number(r.score) || 0) >= lowerCutoff);

  return {
    validRecords,
    excludedCount: records.length - validRecords.length,
  };
}

/**
 * ②「楽曲別レベル妥当性サマリーCSV」（level_validation_summary_YYYYMMDD.csv）を生成・ダウンロードする
 * @returns {Promise<{count: number, validCount: number, excludedCount: number, groupCount: number, filename: string}>}
 */
export async function exportLevelValidationSummaryCsv() {
  const { logs, songsMap } = await fetchMergedPlayLogs();
  const filename = `level_validation_summary_${formatDateYmd()}.csv`;

  // 楽曲 × 入力モード ごとにグループ化して集計
  const groups = new Map();

  logs.forEach((log) => {
    const songId = log.song_id || 'unknown';
    const mode = log.input_mode || 'PC';
    const key = `${songId}__${mode}`;

    if (!groups.has(key)) {
      const meta = songsMap.get(songId);
      groups.set(key, {
        song_id: songId,
        song_title: meta?.title || log.song_title || songId,
        creator: meta?.creator || log.creator || '不明',
        defined_level: Number(meta?.difficulty ?? log.defined_level) || 1,
        total_notes: Number(meta?.notesCount ?? log.total_notes) || 0,
        input_mode: mode,
        records: [],
      });
    }
    groups.get(key).records.push(log);
  });

  // まだ1度もプレイ記録がない公式楽曲も一覧で確認できるよう追加
  songsMap.forEach((meta, songId) => {
    const hasAnyRecord = Array.from(groups.values()).some((g) => g.song_id === songId);
    if (!hasAnyRecord) {
      groups.set(`${songId}__未プレイ`, {
        song_id: songId,
        song_title: meta.title || songId,
        creator: meta.creator || '不明',
        defined_level: Number(meta.difficulty) || 1,
        total_notes: Number(meta.notesCount) || 0,
        input_mode: '-',
        records: [],
      });
    }
  });

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.defined_level !== b.defined_level) return a.defined_level - b.defined_level;
    return String(a.song_title).localeCompare(String(b.song_title), 'ja');
  });

  const headers = [
    '楽曲名',
    '譜面制作者',
    '設定レベル（☆）',
    '総ノーツ数',
    '入力モード',
    '総プレイ回数',
    'クリア回数',
    'クリア率（%）',
    '平均スコア',
    '最高スコア',
    '最低スコア',
    '平均MISS数',
    '平均PEAK KPS',
    'レベル妥当性の目安判定',
  ];

  let totalValidCount = 0;
  let totalExcludedCount = 0;

  const rows = sortedGroups.map((g) => {
    const { validRecords, excludedCount } = filterValidRecordsForSummary(g.records);
    totalValidCount += validRecords.length;
    totalExcludedCount += excludedCount;

    const playCount = validRecords.length;
    if (playCount === 0) {
      return [
        g.song_title,
        g.creator,
        g.defined_level,
        g.total_notes,
        g.input_mode,
        0,
        0,
        '0.00',
        0,
        0,
        0,
        '0.0',
        '0.00',
        excludedCount > 0 ? 'データ不足（外れ値除外により有効記録なし）' : 'データ不足（未プレイ）',
      ];
    }

    const scores = validRecords.map((r) => Number(r.score) || 0);
    const clearCount = validRecords.filter(
      (r) => r.is_clear === 'CLEAR' || (Number(r.score) || 0) >= 700000
    ).length;
    const clearRate = (clearCount / playCount) * 100;
    const sumScore = scores.reduce((acc, s) => acc + s, 0);
    const avgScore = Math.round(sumScore / playCount);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    const avgMiss =
      validRecords.reduce((acc, r) => acc + (Number(r.miss_count) || 0), 0) / playCount;
    const avgPeakKps =
      validRecords.reduce((acc, r) => acc + (Number(r.peak_kps) || 0), 0) / playCount;

    const validityLabel = evaluateLevelValidity(
      g.defined_level,
      playCount,
      clearRate,
      avgScore
    );

    return [
      g.song_title,
      g.creator,
      g.defined_level,
      g.total_notes,
      g.input_mode,
      playCount,
      clearCount,
      clearRate.toFixed(2),
      avgScore,
      maxScore,
      minScore,
      avgMiss.toFixed(1),
      avgPeakKps.toFixed(2),
      validityLabel,
    ];
  });

  triggerCsvDownload(headers, rows, filename);
  return {
    count: totalValidCount,
    validCount: totalValidCount,
    excludedCount: totalExcludedCount,
    groupCount: rows.length,
    filename,
  };
}

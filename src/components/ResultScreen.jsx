import { useCallback, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { fetchRankingsResult } from '../api/rankings';
import { useSystemSE } from '../hooks/useSystemSE';
import { getAchievementRank } from '../utils/achievementRank';
import HeaderLogo from './HeaderLogo';
import RankingTurnstile from './RankingTurnstile';
import { classifyRankingTiming } from '../lib/rankingTiming';
import resultPage1 from '../assets/result_page1.png';
import resultPage2 from '../assets/result_page2.png';
import resultBg from '../assets/result_bg.png';
import './ResultScreen.css';

const percent = (value, total) => total > 0 ? (value / total * 100).toFixed(1) : '0.0';

function ResultRow({ label, value, top, children, className = '' }) {
  return (
    <div className={`result-row ${className}`} style={{ '--result-top': top }}>
      <span className="result-row__label">{label}</span>
      <div className="result-row__content"><span className="result-number">{value}</span>{children}</div>
    </div>
  );
}

function MistakeHistory({ entries }) {
  return (
    <div className="result-history" aria-label="ミス履歴">
      <h2 className="result-history__heading">ミス履歴</h2>
      <div className="result-history__scroll" tabIndex={0} aria-label="ミス履歴一覧">
        {entries.length === 0 ? (
          <p className="result-history__empty">ミスはありません！完璧な演奏です！</p>
        ) : entries.map((entry, index) => {
          const type = entry.type === 'mistype' || entry.type === 'typo' ? 'mistype' : entry.type === 'timing' || entry.type === 'miss' ? 'timing' : 'untyped';
          const label = type === 'mistype' ? `ミスタイプ（誤入力: ${entry.typedChar?.toUpperCase() || '不明'}）` : type === 'timing' ? 'タイミングMISS' : entry.partial ? '入力抜け（打ち残し）' : '入力抜け（時間切れ）';
          return (
            <div className="result-history__item" key={index}>
              <time className="result-number result-history__time">{Number(entry.time || 0).toFixed(2)}s</time>
              <span className="result-history__note">{entry.note || '—'}{(entry.targetChar || entry.char) && <small>対象: {entry.targetChar || entry.char}</small>}</span>
              <span className={`result-history__badge result-history__badge--${type}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultScreen({ onRetry, onBack, onHome, isLocalPlay, scoreFileName, playerName, handleNameChange, handleScoreSubmit, isSubmitting, submitSuccessMessage, setLeaderboardData }) {
  const [page, setPage] = useState(1);
  const [verificationToken, setVerificationToken] = useState('');
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const mountRef = useRef(false);
  const { playDecide } = useSystemSE();
  const score = useGameStore(state => state.score);
  const perfectCount = useGameStore(state => state.perfectCount);
  const goodCount = useGameStore(state => state.goodCount);
  const missCount = useGameStore(state => state.missCount);
  const droppedCount = useGameStore(state => state.droppedCount);
  const typoCount = useGameStore(state => state.typoCount);
  const completedCount = useGameStore(state => state.completedCount);
  const maxKps = useGameStore(state => state.maxKps);
  const loadedScore = useGameStore(state => state.loadedScore);
  const statsData = useGameStore(state => state.statsData);
  const songLikesMap = useGameStore(state => state.songLikesMap);
  const hasLikedCurrentResult = useGameStore(state => state.hasLikedCurrentResult);
  const isLikingSong = useGameStore(state => state.isLikingSong);
  const playRhythmMode = useGameStore(state => state.playRhythmMode);
  const toggleCurrentSongLike = useGameStore(state => state.toggleCurrentSongLike);
  const setShowSurveyModal = useGameStore(state => state.setShowSurveyModal);

  const setResultRef = useCallback(node => {
    if (node && !mountRef.current) {
      mountRef.current = true;
      useGameStore.getState().recordCurrentPlayLog();
      useGameStore.getState().refreshSongLikes();
    } else if (!node) {
      mountRef.current = false;
    }
  }, []);

  const songId = scoreFileName ? scoreFileName.replace(/\.json$/i, '') : loadedScore?.id || '';
  const likeCount = songId ? songLikesMap?.[songId] || 0 : 0;
  const achievement = getAchievementRank({ score, perfectCount, goodCount, missCount, droppedCount, completedCount, statsData });
  const rankLabel = { FAILED: 'FAILED', CLEAR: 'CLEAR', FULL_COMBO: 'FULL COMBO', ALL_PERFECT: 'ALL PERFECT' }[achievement];
  const scoreGrade = achievement === 'ALL_PERFECT' ? 'S+' : achievement === 'CLEAR' ? (score >= 900000 ? 'S' : score >= 800000 ? 'A' : 'B') : null;
  const fast = statsData?.stats?.fastCount ?? 0;
  const late = statsData?.stats?.lateCount ?? 0;
  const judged = perfectCount + goodCount;
  const timed = fast + late;
  const timingStatus = classifyRankingTiming(statsData?.stats);
  const submitResult = async () => {
    try { await handleScoreSubmit(verificationToken); } finally { setVerificationToken(''); setVerificationAttempt(value => value + 1); }
  };
  const trend = timed === 0 ? '判定データなし' : Math.abs(fast - late) / timed < 0.2 ? 'バランス良好' : fast > late ? 'やや早め（FAST傾向）' : 'やや遅め（LATE傾向）';
  const totalNotes = statsData?.stats?.totalNotes ?? loadedScore?.notes?.length ?? 0;
  const worstKeys = statsData?.worstKeys || [];
  const history = statsData?.missHistory || statsData?.mistakeLog || [];

  const openLeaderboard = () => {
    if (!songId) return;
    setLeaderboardData({ songTitle: loadedScore?.title || songId, promise: fetchRankingsResult(songId) });
  };
  const handleLike = () => { playDecide(); toggleCurrentSongLike(); };

  return (
    <div ref={setResultRef} className="result-screen" style={{ '--result-page-bg': `url(${page === 1 ? resultPage1 : resultPage2})`, '--result-mobile-bg': `url(${resultBg})` }}>
      <main className={`result-board result-board--page${page}`}>
        <header className="result-header">
        <HeaderLogo onHome={onHome} />
        <span className="result-header__title">RESULT</span>
        <nav className="result-tabs" aria-label="リザルトのページ">
          <button type="button" aria-current={page === 1 ? 'page' : undefined} onClick={() => setPage(1)}>スコア (1/2)</button>
          <button type="button" aria-current={page === 2 ? 'page' : undefined} onClick={() => setPage(2)}>詳細分析 (2/2)</button>
        </nav>
        </header>
        {page === 1 ? (
          <>
            <div className="result-score">
              <span className="result-row__label">SCORE</span>
              <div className="result-score__content"><strong className="result-number result-score__number">{Math.round(score)}</strong><span className={`result-rank result-rank--${achievement.toLowerCase()}`}>{rankLabel}</span>{scoreGrade && <span className="result-rank result-rank--grade">RANK {scoreGrade}</span>}</div>
            </div>
            <ResultRow label="PERFECT" value={perfectCount} top="29.5%" />
            <ResultRow label="GOOD" value={goodCount} top="40.1%" />
            <ResultRow label="MISS" value={missCount} top="50.7%" />
            <ResultRow label="入力抜け" value={droppedCount} top="61.4%" />
            <ResultRow label="ミスタイプ" value={typoCount} top="72%" className="result-row--typos">
              <span className="result-worst" aria-label="ミスの多いキー上位3件">
                {worstKeys.length ? worstKeys.slice(0, 3).map(({ char, count }) => <span className="result-key" key={char}>{char.toUpperCase()} <span className="result-number">({count}回)</span></span>) : <span className="result-worst__empty">なし</span>}
              </span>
            </ResultRow>
            <aside className={`result-actions${timingStatus === 'verification' ? ' result-actions--verification' : ''}`} aria-label="スコアの操作">
              <button type="button" className="result-button result-button--primary" onClick={() => setPage(2)}>詳細データ・精度分析を見る (2/2) ▶</button>
              {playRhythmMode ? <p className="result-local-message">リズムモードの記録はランキングに登録されません</p> : !isLocalPlay && scoreFileName ? (
                <div className="result-register">
                  <label htmlFor="result-player-name">ランキング登録</label>
                  <div className="result-register__row">
                    <input id="result-player-name" type="text" placeholder="Guest" value={playerName} onChange={handleNameChange} maxLength={20} />
                    <button type="button" className="result-button result-button--cyan" onClick={submitResult} disabled={isSubmitting || timingStatus === 'ineligible' || timingStatus === 'unavailable' || (timingStatus === 'verification' && !verificationToken)}>{isSubmitting ? '送信中...' : '登録する'}</button>
                  </div>
                  {timingStatus === 'verification' && <><p>ランキング登録前に本人確認が必要です。</p><RankingTurnstile key={verificationAttempt} onToken={setVerificationToken} /></>}
                  {(timingStatus === 'ineligible' || timingStatus === 'unavailable') && <p>内部精度が記録されていないため、ランキングに登録できません。</p>}
                  {submitSuccessMessage && <p className="result-register__message" role="status">{submitSuccessMessage}</p>}
                </div>
              ) : isLocalPlay ? <p className="result-local-message">創作譜面の記録はランキングに送信されません</p> : null}
              {!isLocalPlay && songId && <button type="button" className="result-button result-button--like" disabled={isLikingSong} aria-pressed={hasLikedCurrentResult} onClick={handleLike}><Heart size={17} fill={hasLikedCurrentResult ? 'currentColor' : 'none'} /> {hasLikedCurrentResult ? 'いいね！済み' : 'いいね'} <span className="result-number">♥ {likeCount}</span></button>}
              <div className="result-action-grid">
                <button type="button" className="result-button result-button--amber" onClick={onRetry}>リトライ</button>
                {!isLocalPlay && scoreFileName && <button type="button" className="result-button" onClick={openLeaderboard}>ランキング一覧</button>}
                <button type="button" className="result-button" onClick={onBack}>{isLocalPlay ? 'セットアップに戻る' : '曲一覧に戻る'}</button>
                <button type="button" className="result-button" onClick={() => setShowSurveyModal(true)}>📝 アンケート</button>
              </div>
            </aside>
          </>
        ) : (
          <>
            <ResultRow label="内部精度 (FAST)" value={fast} top="22.3%" className="result-row--timing result-row--fast">
              <span className="result-row__percent result-number">({percent(fast, judged)}%)</span><span className="result-bar" aria-hidden="true"><span style={{ width: `${judged ? fast / judged * 100 : 0}%` }} /></span>
            </ResultRow>
            <ResultRow label="内部精度 (LATE)" value={late} top="32.9%" className="result-row--timing result-row--late">
              <span className="result-row__percent result-number">({percent(late, judged)}%)</span><span className="result-bar" aria-hidden="true"><span style={{ width: `${judged ? late / judged * 100 : 0}%` }} /></span>
            </ResultRow>
            <ResultRow label="入力完了" value={`${completedCount} / ${totalNotes}`} top="43.6%" className="result-row--detail" />
            <ResultRow label="最高KPS" value={playRhythmMode ? '—' : Number(maxKps || 0).toFixed(2)} top="54.2%" className="result-row--detail">{!playRhythmMode && <span className="result-row__unit">key/s</span>}</ResultRow>
            <div className="result-trend"><span>全体の傾向</span><strong>{trend}</strong><div className="result-trend__bar" aria-label={`FAST ${fast}回、LATE ${late}回`}><i style={{ width: `${timed ? fast / timed * 100 : 50}%` }} /><i style={{ width: `${timed ? late / timed * 100 : 50}%` }} /></div><small>PERFECT・GOODの初打鍵（中央ちょうどはFAST／LATEに含めません）</small></div>
            <MistakeHistory entries={history} />
            <aside className="result-detail-actions" aria-label="詳細ページの操作">
              <button type="button" className="result-button result-button--primary" onClick={() => setPage(1)}>◀ 基本スコアに戻る (1/2)</button>
              <button type="button" className="result-button result-button--amber" onClick={onRetry}>リトライ</button>
              <button type="button" className="result-button" onClick={onBack}>{isLocalPlay ? 'セットアップに戻る' : '曲一覧に戻る'}</button>
            </aside>
          </>
        )}
      </main>
    </div>
  );
}

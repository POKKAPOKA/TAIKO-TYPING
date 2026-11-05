let integrityEnforced = false;
let activeSession = null;
const sealedSessions = new Map();

function normalizeSongId(songId) {
  return typeof songId === 'string' ? songId.trim().replace(/\.json$/i, '') : '';
}

export function setPlayIntegrityEnforced(enforced) {
  integrityEnforced = Boolean(enforced);
}

export function isPlayIntegrityEnforced() {
  return integrityEnforced;
}

export function beginPlayIntegritySession({ playSessionId, songId, totalNotes }) {
  if (!playSessionId) {
    activeSession = null;
    return;
  }
  integrityEnforced = true;
  activeSession = {
    playSessionId: String(playSessionId),
    songId: normalizeSongId(songId),
    totalNotes: Math.max(0, Math.round(Number(totalNotes) || 0)),
    trustedInputCount: 0,
    judgedHitCount: 0,
    untrustedDetected: false,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
    fastCount: 0,
    lateCount: 0,
  };
}

export function recordTrustedPlayInput(event) {
  if (!activeSession) return false;
  if (event && typeof event === 'object' && 'isTrusted' in event && event.isTrusted !== true) {
    activeSession.untrustedDetected = true;
    return false;
  }
  activeSession.trustedInputCount += 1;
  return true;
}

export function recordPlayJudgment(judgment, timingOffset = null) {
  if (!activeSession) return;
  if (judgment === 'PERFECT' || judgment === 'GOOD') {
    if (activeSession.trustedInputCount <= activeSession.judgedHitCount) {
      activeSession.untrustedDetected = true;
    }
    activeSession.judgedHitCount += 1;
    if (judgment === 'PERFECT') {
      activeSession.perfectCount += 1;
    } else {
      activeSession.goodCount += 1;
    }
    if (timingOffset != null) {
      if (timingOffset < 0) activeSession.fastCount += 1;
      else if (timingOffset > 0) activeSession.lateCount += 1;
    }
  } else if (judgment === 'MISS') {
    activeSession.missCount += 1;
  }
}

export function recordPlayUnjudgedMisses(count) {
  if (!activeSession) return;
  const n = Math.max(0, Math.round(Number(count) || 0));
  activeSession.missCount += n;
}

export function sealPlayIntegritySession(playSessionId, finalSnapshot = {}) {
  if (!playSessionId || !activeSession || activeSession.playSessionId !== String(playSessionId)) {
    activeSession = null;
    return false;
  }
  const session = activeSession;
  activeSession = null;

  const score = Math.min(1010000, Math.max(0, Math.round(Number(finalSnapshot.score) || 0)));
  const maxCombo = Math.min(10000, Math.max(0, Math.round(Number(finalSnapshot.maxCombo) || 0)));
  const maxKps = Math.min(30, Math.max(0, Number((Number(finalSnapshot.maxKps) || 0).toFixed(2))));
  const perfectCount = Math.max(0, Math.round(Number(finalSnapshot.perfectCount) || 0));
  const goodCount = Math.max(0, Math.round(Number(finalSnapshot.goodCount) || 0));
  const missCount = Math.max(0, Math.round(Number(finalSnapshot.missCount) || 0));
  const totalNotes = Math.max(0, Math.round(Number(finalSnapshot.totalNotes) || 0));
  const fastCount = Math.max(0, Math.round(Number(finalSnapshot.fastCount) || 0));
  const lateCount = Math.max(0, Math.round(Number(finalSnapshot.lateCount) || 0));
  const hitCount = session.perfectCount + session.goodCount;

  const valid = Boolean(
    !session.untrustedDetected &&
    session.totalNotes > 0 &&
    session.totalNotes === totalNotes &&
    session.perfectCount === perfectCount &&
    session.goodCount === goodCount &&
    session.missCount === missCount &&
    session.fastCount === fastCount &&
    session.lateCount === lateCount &&
    session.perfectCount + session.goodCount + session.missCount === session.totalNotes &&
    session.judgedHitCount === hitCount &&
    session.trustedInputCount >= hitCount &&
    maxCombo <= hitCount &&
    (score < 1010000 || (perfectCount === totalNotes && goodCount === 0 && missCount === 0 && maxCombo === totalNotes))
  );

  if (sealedSessions.size >= 20) {
    const oldestKey = sealedSessions.keys().next().value;
    if (oldestKey !== undefined) sealedSessions.delete(oldestKey);
  }

  sealedSessions.set(String(playSessionId), Object.freeze({
    playSessionId: String(playSessionId),
    songId: session.songId,
    score,
    maxCombo,
    maxKps,
    perfectCount,
    goodCount,
    missCount,
    totalNotes,
    fastCount,
    lateCount,
    valid,
  }));
  return valid;
}

export function verifyPlayIntegrity(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.playIntegrityVerified === false) return false;
  if (!integrityEnforced) return true;

  const sealed = sealedSessions.get(String(payload.playSessionId || ''));
  if (!sealed || !sealed.valid) return false;

  const normalizedScore = Math.min(1010000, Math.max(0, Math.round(Number(payload.score) || 0)));
  const normalizedMaxCombo = Math.min(10000, Math.max(0, Math.round(Number(payload.maxCombo) || 0)));
  const normalizedMaxKps = Math.min(30, Math.max(0, Number((Number(payload.maxKps) || 0).toFixed(2))));
  const normalizedPerfect = Math.max(0, Math.round(Number(payload.perfectCount) || 0));
  const normalizedGood = Math.max(0, Math.round(Number(payload.goodCount) || 0));
  const normalizedMiss = Math.max(0, Math.round(Number(payload.missCount) || 0));
  const normalizedTotal = Math.max(0, Math.round(Number(payload.totalNotes) || 0));
  const normalizedFast = Math.max(0, Math.round(Number(payload.fastCount) || 0));
  const normalizedLate = Math.max(0, Math.round(Number(payload.lateCount) || 0));

  return (
    sealed.songId === normalizeSongId(payload.songId) &&
    sealed.score === normalizedScore &&
    sealed.maxCombo === normalizedMaxCombo &&
    sealed.maxKps === normalizedMaxKps &&
    sealed.perfectCount === normalizedPerfect &&
    sealed.goodCount === normalizedGood &&
    sealed.missCount === normalizedMiss &&
    sealed.totalNotes === normalizedTotal &&
    sealed.fastCount === normalizedFast &&
    sealed.lateCount === normalizedLate
  );
}

export function resetPlayIntegrityForTests() {
  integrityEnforced = false;
  activeSession = null;
  sealedSessions.clear();
}

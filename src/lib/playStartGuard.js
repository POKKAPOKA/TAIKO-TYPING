// 遊ぶボタンまたはランダム選曲ボタンをホバーしてからプレーを開始しているか監視するガードモジュール

const HOVER_VALID_WINDOW_MS = 60_000;

let guardEnforced = false;
let lastHover = null; // { buttonType: 'play' | 'random' | 'retry', songId: string | null, timestamp: number }
let authorizedSongId = null;
let pendingStartTicket = false;

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function normalizeGuardSongId(rawSongId) {
  if (typeof rawSongId !== 'string') return '';
  return rawSongId.trim().replace(/\.json$/i, '');
}

export function setPlayStartGuardEnforced(enforced) {
  guardEnforced = Boolean(enforced);
  if (!guardEnforced) {
    lastHover = null;
    authorizedSongId = null;
    pendingStartTicket = false;
  }
}

export function isPlayStartGuardEnforced() {
  return guardEnforced;
}

export function recordPlayStartHover(buttonType, songId, event) {
  if (!event || event.isTrusted !== true) return false;
  if (buttonType !== 'play' && buttonType !== 'random' && buttonType !== 'retry') return false;
  const normalizedSongId = buttonType === 'random' ? null : normalizeGuardSongId(songId);
  if (buttonType === 'play' && !normalizedSongId) return false;
  lastHover = {
    buttonType,
    songId: normalizedSongId,
    timestamp: nowMs(),
  };
  return true;
}

export function hasActivePlayStartHover(buttonType, songId) {
  if (!lastHover) return false;
  const elapsed = nowMs() - lastHover.timestamp;
  if (elapsed < 0 || elapsed > HOVER_VALID_WINDOW_MS) return false;
  if (buttonType === 'random') return lastHover.buttonType === 'random';
  if (buttonType === 'play') {
    const normalizedSongId = normalizeGuardSongId(songId);
    return Boolean(normalizedSongId && lastHover.buttonType === 'play' && lastHover.songId === normalizedSongId);
  }
  if (buttonType === 'retry') {
    const normalizedSongId = normalizeGuardSongId(songId);
    return Boolean(normalizedSongId && lastHover.buttonType === 'retry' && (!lastHover.songId || lastHover.songId === normalizedSongId));
  }
  return false;
}

export function authorizePlayStart(buttonType, songId, clickEvent) {
  const normalizedSongId = normalizeGuardSongId(songId);
  if (!normalizedSongId) {
    pendingStartTicket = false;
    return false;
  }
  if (!clickEvent || clickEvent.isTrusted !== true) {
    pendingStartTicket = false;
    authorizedSongId = null;
    return false;
  }
  if (!hasActivePlayStartHover(buttonType, normalizedSongId)) {
    lastHover = null;
    pendingStartTicket = false;
    authorizedSongId = null;
    return false;
  }

  lastHover = null;
  authorizedSongId = normalizedSongId;
  pendingStartTicket = true;
  return true;
}

export function authorizeVerifiedRetry(songId, clickEvent) {
  const normalizedSongId = normalizeGuardSongId(songId);
  if (!normalizedSongId || authorizedSongId !== normalizedSongId) {
    pendingStartTicket = false;
    return false;
  }
  if (clickEvent && clickEvent.isTrusted !== true) {
    pendingStartTicket = false;
    authorizedSongId = null;
    return false;
  }
  lastHover = null;
  pendingStartTicket = true;
  return true;
}

export function consumePlayStartTicket(songId) {
  if (!guardEnforced) return true;
  const normalizedSongId = normalizeGuardSongId(songId);
  if (!normalizedSongId || !pendingStartTicket || authorizedSongId !== normalizedSongId) {
    pendingStartTicket = false;
    return false;
  }
  pendingStartTicket = false;
  return true;
}

export function clearPlayStartAuthorization() {
  lastHover = null;
  authorizedSongId = null;
  pendingStartTicket = false;
}

export function getPlayStartGuardState() {
  return {
    guardEnforced,
    hasHover: Boolean(lastHover),
    hoverButtonType: lastHover?.buttonType || null,
    hoverSongId: lastHover?.songId || null,
    authorizedSongId,
    pendingStartTicket,
  };
}

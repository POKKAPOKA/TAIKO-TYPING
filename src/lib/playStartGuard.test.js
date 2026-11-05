import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setPlayStartGuardEnforced,
  recordPlayStartHover,
  hasActivePlayStartHover,
  authorizePlayStart,
  authorizeVerifiedRetry,
  consumePlayStartTicket,
  clearPlayStartAuthorization,
  getPlayStartGuardState,
} from './playStartGuard';
import { canSubmitRanking } from './rankingEligibility';

describe('遊ぶボタン・ランダム選曲ボタンのホバー開始監視 (playStartGuard)', () => {
  beforeEach(() => {
    setPlayStartGuardEnforced(true);
    clearPlayStartAuthorization();
  });

  afterEach(() => {
    setPlayStartGuardEnforced(false);
    vi.restoreAllMocks();
  });

  it('遊ぶボタンをホバー(isTrusted: true)してからクリックすると該当曲のみ1回だけ開始を許可する', () => {
    expect(recordPlayStartHover('play', 'sakura', { isTrusted: true })).toBe(true);
    expect(hasActivePlayStartHover('play', 'sakura')).toBe(true);
    expect(hasActivePlayStartHover('play', 'kimigayo')).toBe(false);

    expect(authorizePlayStart('play', 'sakura.json', { isTrusted: true })).toBe(true);
    expect(getPlayStartGuardState()).toMatchObject({
      guardEnforced: true,
      hasHover: false,
      authorizedSongId: 'sakura',
      pendingStartTicket: true,
    });

    // 1回目のGameEngine.start()でチケットを消費
    expect(consumePlayStartTicket('sakura')).toBe(true);
    // 2回目をホバーなしで直接呼んでも拒否される
    expect(consumePlayStartTicket('sakura')).toBe(false);
  });

  it('ランダム選曲ボタンをホバー(isTrusted: true)してからクリックすると抽選された曲の開始を許可する', () => {
    expect(recordPlayStartHover('random', null, { isTrusted: true })).toBe(true);
    expect(hasActivePlayStartHover('random')).toBe(true);

    expect(authorizePlayStart('random', 'taipatime_rhythm', { isTrusted: true })).toBe(true);
    expect(consumePlayStartTicket('taipatime_rhythm')).toBe(true);
  });

  it('ホバーなしでクリックした場合や別曲の遊ぶボタンをクリックした場合は開始を拒否する', () => {
    expect(authorizePlayStart('play', 'sakura', { isTrusted: true })).toBe(false);
    expect(consumePlayStartTicket('sakura')).toBe(false);

    // sakuraをホバーしたのにkimigayoをクリックした場合
    expect(recordPlayStartHover('play', 'sakura', { isTrusted: true })).toBe(true);
    expect(authorizePlayStart('play', 'kimigayo', { isTrusted: true })).toBe(false);
    expect(consumePlayStartTicket('kimigayo')).toBe(false);
  });

  it('スクリプトによる合成イベント(isTrusted: false)のホバーやクリックは拒否する', () => {
    expect(recordPlayStartHover('play', 'sakura', { isTrusted: false })).toBe(false);
    expect(hasActivePlayStartHover('play', 'sakura')).toBe(false);

    expect(recordPlayStartHover('play', 'sakura', { isTrusted: true })).toBe(true);
    expect(authorizePlayStart('play', 'sakura', { isTrusted: false })).toBe(false);
    expect(consumePlayStartTicket('sakura')).toBe(false);
  });

  it('正規の手順で開始した曲のみリトライを許可し、未認証曲や合成クリックのリトライは拒否する', () => {
    // 未認証状態でのリトライは不可
    expect(authorizeVerifiedRetry('sakura', { isTrusted: true })).toBe(false);

    // 正規手順で開始
    recordPlayStartHover('play', 'sakura', { isTrusted: true });
    authorizePlayStart('play', 'sakura', { isTrusted: true });
    expect(consumePlayStartTicket('sakura')).toBe(true);

    // 合成イベントでのリトライは拒否し、認証も失効させる
    expect(authorizeVerifiedRetry('sakura', { isTrusted: false })).toBe(false);
    expect(consumePlayStartTicket('sakura')).toBe(false);

    // 再度正規手順で開始後、正規クリックでのリトライは許可
    recordPlayStartHover('play', 'sakura', { isTrusted: true });
    authorizePlayStart('play', 'sakura', { isTrusted: true });
    expect(consumePlayStartTicket('sakura')).toBe(true);
    expect(authorizeVerifiedRetry('sakura', { isTrusted: true })).toBe(true);
    expect(consumePlayStartTicket('sakura')).toBe(true);
  });

  it('playStartVerified が false の場合はランキング送信対象外になる', () => {
    expect(canSubmitRanking({
      isLocalPlay: false,
      playRhythmMode: false,
      scoreFileName: 'sakura.json',
      playStartVerified: false,
    })).toBe(false);

    expect(canSubmitRanking({
      isLocalPlay: false,
      playRhythmMode: false,
      scoreFileName: 'sakura.json',
      playStartVerified: true,
    })).toBe(true);
  });
});

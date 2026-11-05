import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginPlayIntegritySession,
  recordTrustedPlayInput,
  recordPlayJudgment,
  recordPlayUnjudgedMisses,
  sealPlayIntegritySession,
  verifyPlayIntegrity,
  resetPlayIntegrityForTests
} from './playIntegrity';

describe('playIntegrity', () => {
  beforeEach(() => {
    resetPlayIntegrityForTests();
  });

  it('信頼された入力と一致するプレイ結果のみを承認する', () => {
    beginPlayIntegritySession({ playSessionId: 'session-1', songId: 'kimigayo', totalNotes: 3 });
    recordTrustedPlayInput({ isTrusted: true });
    recordPlayJudgment('PERFECT', -12);
    recordTrustedPlayInput({ isTrusted: true });
    recordPlayJudgment('GOOD', 18);
    recordPlayUnjudgedMisses(1);

    const snapshot = {
      songId: 'kimigayo',
      score: 500000,
      maxCombo: 2,
      maxKps: 2.67,
      perfectCount: 1,
      goodCount: 1,
      missCount: 1,
      totalNotes: 3,
      fastCount: 1,
      lateCount: 1
    };
    expect(sealPlayIntegritySession('session-1', snapshot)).toBe(true);
    expect(verifyPlayIntegrity({ playSessionId: 'session-1', ...snapshot })).toBe(true);
  });

  it('リザルト画面でストアのスコアやPERFECT数が改ざんされた場合は拒否する', () => {
    beginPlayIntegritySession({ playSessionId: 'session-2', songId: 'kimigayo', totalNotes: 3 });
    recordTrustedPlayInput({ isTrusted: true });
    recordPlayJudgment('PERFECT', -10);
    recordPlayUnjudgedMisses(2);

    const snapshot = {
      songId: 'kimigayo',
      score: 336666,
      maxCombo: 1,
      maxKps: 2.67,
      perfectCount: 1,
      goodCount: 0,
      missCount: 2,
      totalNotes: 3,
      fastCount: 1,
      lateCount: 0
    };
    expect(sealPlayIntegritySession('session-2', snapshot)).toBe(true);
    expect(verifyPlayIntegrity({ playSessionId: 'session-2', ...snapshot, score: 1010000 })).toBe(false);
    expect(verifyPlayIntegrity({ playSessionId: 'session-2', ...snapshot, perfectCount: 3, missCount: 0 })).toBe(false);
  });

  it('isTrusted=falseの合成イベントや入力なしの直接PERFECT判定を拒否する', () => {
    beginPlayIntegritySession({ playSessionId: 'session-3', songId: 'kimigayo', totalNotes: 2 });
    recordTrustedPlayInput({ isTrusted: false });
    recordPlayJudgment('PERFECT', -5);
    recordPlayJudgment('PERFECT', 5);

    const snapshot = {
      songId: 'kimigayo',
      score: 1010000,
      maxCombo: 2,
      maxKps: 2.67,
      perfectCount: 2,
      goodCount: 0,
      missCount: 0,
      totalNotes: 2,
      fastCount: 1,
      lateCount: 1
    };
    expect(sealPlayIntegritySession('session-3', snapshot)).toBe(false);
    expect(verifyPlayIntegrity({ playSessionId: 'session-3', ...snapshot })).toBe(false);
  });
});

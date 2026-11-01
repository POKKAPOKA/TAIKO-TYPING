import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/csvExport', () => ({
  getLocalPlayLogs: () => [], savePlayLogToLocal: vi.fn(), fetchMergedPlayLogs: vi.fn(), clearPlayLogs: vi.fn(),
}));
vi.mock('../api/likes', () => ({
  getLocalSongLikesMap: () => ({}), fetchGlobalSongLikes: vi.fn(), updateSongLikeCount: vi.fn(), normalizeSongId: vi.fn(),
}));

let doc;
let browser;
let handlers;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  handlers = {};
  doc = {
    documentElement: {}, fullscreenElement: null, webkitFullscreenElement: null,
    addEventListener: (name, handler) => { handlers[name] = handler; },
  };
  browser = {
    innerWidth: 1200,
    navigator: { standalone: false, userAgent: 'test browser' },
    matchMedia: query => ({ matches: query === '(display-mode: fullscreen)' && Boolean(doc.fullscreenElement || doc.webkitFullscreenElement) }),
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', browser);
  vi.stubGlobal('navigator', browser.navigator);
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('全画面表示の切り替え', () => {
  it.each([false, true])('PC・Android相当（スマホモード: %s）で通常表示に戻せる', async (isMobileMode) => {
    const { useGameStore } = await import('./gameStore');
    useGameStore.setState({ isMobileMode });
    doc.fullscreenElement = doc.documentElement;
    doc.exitFullscreen = vi.fn(function () {
      expect(this).toBe(doc);
      return Promise.resolve();
    });
    handlers.fullscreenchange();
    expect(useGameStore.getState().isFullscreen).toBe(true);

    useGameStore.getState().toggleFullscreen();
    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
    expect(useGameStore.getState().showPwaGuideModal).toBe(false);
    expect(useGameStore.getState().toastMessage).toBeNull();
    doc.fullscreenElement = null;
    handlers.fullscreenchange();
    expect(useGameStore.getState().isFullscreen).toBe(false);
  });

  it('webkit の全画面表示も終了する', async () => {
    const { useGameStore } = await import('./gameStore');
    doc.webkitFullscreenElement = doc.documentElement;
    doc.webkitExitFullscreen = vi.fn(() => Promise.resolve());
    useGameStore.getState().toggleFullscreen();
    expect(doc.webkitExitFullscreen).toHaveBeenCalledOnce();
    doc.webkitFullscreenElement = null;
    handlers.webkitfullscreenchange();
    expect(useGameStore.getState().isFullscreen).toBe(false);
  });

  it('通常画面から全画面表示を開始できる', async () => {
    const { useGameStore } = await import('./gameStore');
    doc.documentElement.requestFullscreen = vi.fn(() => Promise.resolve());
    useGameStore.getState().toggleFullscreen();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledOnce();
  });

  it('iPhone のホーム画面アプリでは既存の案内を維持する', async () => {
    browser.navigator.standalone = true;
    const { useGameStore } = await import('./gameStore');
    doc.documentElement.requestFullscreen = vi.fn();
    useGameStore.getState().toggleFullscreen();
    expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
    expect(useGameStore.getState().toastMessage).toContain('ホーム画面アプリ');
    expect(useGameStore.getState().showPwaGuideModal).toBe(false);
  });

  it('終了に失敗した場合は失敗を通知し、誤った状態にしない', async () => {
    const { useGameStore } = await import('./gameStore');
    doc.fullscreenElement = doc.documentElement;
    doc.exitFullscreen = vi.fn(() => Promise.reject(new Error('denied')));
    handlers.fullscreenchange();
    useGameStore.getState().toggleFullscreen();
    await Promise.resolve();
    expect(useGameStore.getState().toastMessage).toBe('縮小表示に失敗しました');
    expect(useGameStore.getState().isFullscreen).toBe(true);
  });
});

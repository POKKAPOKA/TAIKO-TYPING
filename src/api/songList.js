// 曲リストの読み込み。
// useEffectでのマウント時フェッチではなく、イベントハンドラ（ボタン押下）から呼び出し、
// PromiseをキャッシュしてReactのuse()フックで読み取る方式にする。

let songsPromise = null;

export function loadSongs() {
  if (!songsPromise) {
    songsPromise = fetch('./songs/index.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load song list');
        return res.json();
      })
      .then((songs) => ({ songs, error: null }))
      .catch(() => ({ songs: [], error: '曲リストの読み込みに失敗しました。' }));
  }
  return songsPromise;
}

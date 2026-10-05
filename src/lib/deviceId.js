// ブラウザごとに一意のIDを発行してlocalStorageに保持する。
// ランキングで「同じ人の自己ベストのみ上書きする」ために使う
// （サーバー側は song_id + device_id の組をユニークにしてupsertを受け付ける）。
export function getDeviceId() {
  const key = "taiko_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(key, id);
  }
  return id;
}

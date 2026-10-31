// ボーカリストキャラクター定義ファイル
// サークルメンバーの本番イラスト（透過PNG等）が揃った際は、
// chibi / sprites のパスを差し替えるか、配列にキャラクターを追加するだけで反映されます。

export const CHARACTERS = [
  {
    id: 'shinpei',
    name: '朱音 ツキ (あかね つき)',
    description: '編み笠と狐耳、背に大太刀を携えた和風ボーカリスト。桜紋の羽織をなびかせ、力強い歌声でステージを熱狂させる。draw by ナオキ',
    chibi: './assets/characters/shinpei/chibi.png',
    sprites: {
      sing_1: './assets/characters/shinpei/sing_1.png',
      sing_2: './assets/characters/shinpei/sing_2.png',
      miss: './assets/characters/shinpei/miss.png',
    },
  },
  {
    id: 'char_test',
    name: '桜音 ネオン (テスト用)',
    description: '和風サイバーライブステージのテスト用ボーカリスト。軽快な歌声とネオン振袖でステージを彩る。',
    chibi: './assets/characters/char_test/chibi.svg',
    sprites: {
      sing_1: './assets/characters/char_test/sing_1.svg',
      sing_2: './assets/characters/char_test/sing_2.svg',
      miss: './assets/characters/char_test/miss.svg',
    },
  },
];

export const DEFAULT_CHARACTER_ID = 'shinpei';

export function getCharacterById(characterId) {
  return CHARACTERS.find((c) => c.id === characterId) || CHARACTERS.find((c) => c.id === DEFAULT_CHARACTER_ID);
}

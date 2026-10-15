import { CART, MAPLE, terrainHeight, VILLAGE, type Point3 } from './terrain';

export type ViewId = 'overview' | 'path' | 'village' | 'carriage' | 'leaves';
export type View = {
  id: ViewId;
  text: string;
  label: string;
  english: string;
  description: string;
  position: Point3;
  target: Point3;
  minDistance: number;
  maxDistance: number;
  maxPolarAngle: number;
};

const cartGround = terrainHeight(CART.x, CART.z);
const mapleGround = terrainHeight(MAPLE.x, MAPLE.z);

export const poem = {
  title: '山行',
  author: '杜牧',
  dynasty: '唐',
  source: {
    label: '香港教育局《山行》',
    url: 'https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/recommended-passages/KS2_14.pdf',
    variant: '「生处」一作「深处」，本页采用「生处」。',
  },
};

export const overview: View = {
  id: 'overview',
  text: '一座山，四重秋意。',
  label: '寒山秋色',
  english: 'AN AUTUMN JOURNEY',
  description: '石径向远处伸去，白云绕过山居。循着四句诗，在枫色里停留片刻。',
  position: [105, 81, 134],
  target: [0, 18, -4],
  minDistance: 30,
  maxDistance: 235,
  maxPolarAngle: Math.PI * 0.51,
};

export const verses: readonly View[] = [
  {
    id: 'path',
    text: '远上寒山石径斜，',
    label: '循径入山',
    english: 'THE STONE PATH',
    description: '一条石径弯进深秋的山色。目光沿路向上，远山便有了可以抵达的方向。',
    position: [4, 18, 79],
    target: [-22, 16, 19],
    minDistance: 12,
    maxDistance: 100,
    maxPolarAngle: Math.PI * 0.57,
  },
  {
    id: 'village',
    text: '白云生处有人家。',
    label: '云起人家',
    english: 'HOMES IN THE CLOUDS',
    description: '白云从山坳间生起，几户人家藏在高处。幽深的山林里，也有日常的温暖。',
    position: [52, 50, -11],
    target: [VILLAGE.x, VILLAGE.y + 3, VILLAGE.z],
    minDistance: 10,
    maxDistance: 90,
    maxPolarAngle: Math.PI * 0.57,
  },
  {
    id: 'carriage',
    text: '停车坐爱枫林晚，',
    label: '为秋色停留',
    english: 'A MOMENT TO LINGER',
    description: '停下木车，是因为爱这暮色中的枫林。「坐」意为「因为」，此刻只想多看一会儿。',
    position: [-4, cartGround + 11, 61],
    target: [CART.x, cartGround + 2.4, CART.z],
    minDistance: 8,
    maxDistance: 70,
    maxPolarAngle: Math.PI * 0.56,
  },
  {
    id: 'leaves',
    text: '霜叶红于二月花。',
    label: '霜染的红',
    english: 'RED BEYOND SPRING',
    description: '靠近一树霜叶，看红色在晚照里亮起来。诗中的春花是一场比拟，眼前仍是深秋。',
    position: [35, mapleGround + 18, 55],
    target: [MAPLE.x, mapleGround + 11, MAPLE.z],
    minDistance: 8,
    maxDistance: 75,
    maxPolarAngle: Math.PI * 0.62,
  },
];

export const views: readonly View[] = [overview, ...verses];

export function getView(id: ViewId): View {
  return views.find((view) => view.id === id) ?? overview;
}

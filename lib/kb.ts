import kbJson from '@/data/kb.json';
import type { Kb } from './types';

export type { Kb, KbItem } from './types';

export const kb = kbJson as Kb;

export const IMAGE_BASE = 'https://images.epa.uz/storage/images/';

export const productUrl = (slug: string) => `https://epa.uz/uz/product/${slug}`;

export const imageUrl = (path: string) => `${IMAGE_BASE}${path}`;

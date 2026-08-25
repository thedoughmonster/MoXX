import { queryPreorderBootstrap } from '../../lib/api';
import { preorderDataMode } from '../../lib/config';
import { adaptBootstrap } from './bootstrapAdapter';
import { preorderFixture } from './fixture';
import { type PreorderFixture } from './model';

export async function loadPreorder(): Promise<PreorderFixture> {
  if (preorderDataMode === 'fixture') return preorderFixture;
  return adaptBootstrap(await queryPreorderBootstrap());
}

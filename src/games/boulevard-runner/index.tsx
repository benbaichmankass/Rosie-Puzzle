import React from 'react';
import type { GameProps } from '../../shared/types';
import { ComingSoon } from '../../shared/ComingSoon';
import { meta } from './meta';

/** Placeholder. The Jerusalem Boulevard Runner lane replaces this file with the real game. */
export default function Game({ onExit }: GameProps) {
  return <ComingSoon meta={meta} onExit={onExit} />;
}

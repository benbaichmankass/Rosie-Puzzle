import React from 'react';
import type { GameProps } from '../../shared/types';
import BedPuzzle from './BedPuzzle';

export default function Game({ onExit }: GameProps) {
  return <BedPuzzle onExit={onExit} />;
}

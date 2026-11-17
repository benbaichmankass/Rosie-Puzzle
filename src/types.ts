export type CellCoord = {
  r: number; // row
  c: number; // col
};

export type CharacterType = 'boyfriend' | 'girlfriend' | 'dog';

export type BodyPartType = 'head' | 'torso' | 'arm' | 'leg' | 'feet' | 'paw' | 'tail';

export interface PieceCell extends CellCoord {
  part?: BodyPartType;
}

export type ObstacleType =
  | 'toy_duck'
  | 'toy_bone'
  | 'toy_ball'
  | 'treat_bone'
  | 'treat_bacon'
  | 'phone'
  | 'squeaky_dildo'
  | 'tissues'
  | 'pee_puddle';

export interface Obstacle {
  id: string;
  type: ObstacleType;
  r: number;
  c: number;
}

export interface DogCell extends CellCoord {
  part?: 'head' | 'body' | 'paw' | 'tail';
}

export interface DogState {
  cells: DogCell[]; // cells occupied by the dog
  grumpiness: number; // 0: happy/sleeping, 1: grumble, 2: growling warning, 3: bites!
  maxGrumpiness: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  poseName?: string;
}

export interface PlayerPiece {
  id: 'boyfriend' | 'girlfriend';
  name: string;
  cells: PieceCell[]; // relative coordinates from (0,0) with limb parts
  color: string;
  avatarColor: string;
  rotation: number; // 0, 90, 180, 270
  isFlipped: boolean;
  placedPos: CellCoord | null; // top-left placement on grid or null if in tray
  poseId?: string;
}

export interface SleepingPose {
  id: string;
  name: string;
  description: string;
  cells: PieceCell[];
}

export interface LevelScore {
  timeSeconds: number;
  baseScore?: number;
  basePoints: number;
  speedBonus: number;
  cuddleBonus: number;
  penaltyPoints: number;
  totalScore?: number;
  totalPoints: number;
  stars?: number;
}

export interface LevelConfig {
  id: number;
  title: string;
  subtitle: string;
  storyNote: string;
  rows: number;
  cols: number;
  dogCells: DogCell[];
  dogPose: 'ball' | 'curled' | 'loaf' | 'starfish' | 'sprawl' | 'superman' | 'corner' | 'diagonal';
  obstacles: Obstacle[];
  boyfriendDefaultCells: PieceCell[]; // default relative cells with limbs
  girlfriendDefaultCells: PieceCell[];
  allowDogNudge: boolean;
  startingGrumpiness?: number;
  targetZenSeconds?: number;
}

export interface AvatarProfiles {
  boyfriendName: string;
  girlfriendName: string;
  dogName: string;
  boyfriendPhoto: string | null; // data URL or null
  girlfriendPhoto: string | null;
  dogPhoto: string | null;
  dogBreed: 'golden' | 'corgi' | 'poodle' | 'frenchie' | 'beagle';
}

export interface BedCellData {
  r: number;
  c: number;
  occupiedBy: 'empty' | 'dog' | 'obstacle' | 'boyfriend' | 'girlfriend';
  characterPart?: BodyPartType;
  obstacle?: Obstacle;
}


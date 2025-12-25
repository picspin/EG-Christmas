import { Vector3 } from 'three';

export enum AppMode {
  SCATTER = 'SCATTER',
  FEATURE = 'FEATURE',
  FOCUS = 'FOCUS',
}

export enum FeatureShape {
  TREE = 'TREE',
  SANTA = 'SANTA',
  SOCK = 'SOCK',
  ELK = 'ELK',
}

export interface PhotoData {
  id: string;
  url: string;
  position: Vector3;
  rotation: Vector3;
}

export interface HandState {
  x: number; // Normalized -1 to 1 (Scene rotation control)
  y: number; // Normalized -1 to 1
  pinchX: number; // Normalized -1 to 1 (Screen position for cursor)
  pinchY: number; // Normalized -1 to 1
  isPinching: boolean;
  gesture: string;
  active: boolean;
}

export const MAX_PHOTOS = 8;
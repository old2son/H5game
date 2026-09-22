import boardBackgroundUrl from './assets/eye-png/eye.png'
import corneaPieceUrl from './assets/eye-png/cornea-cutout.png'
import irisPieceUrl from './assets/eye-png/iris-cutout.png'
import lensPieceUrl from './assets/eye-png/lens-cutout.png'
import opticNervePieceUrl from './assets/eye-png/optic-nerve-cutout.png'
import retinaPieceUrl from './assets/eye-png/retina-cutout.png'
import type { PartKind } from './gameData'

export const boardBackgroundAsset = boardBackgroundUrl

export const partPieceAssets: Record<PartKind, string> = {
  cornea: corneaPieceUrl,
  iris: irisPieceUrl,
  lens: lensPieceUrl,
  retina: retinaPieceUrl,
  'optic-nerve': opticNervePieceUrl,
}

export const partSlotAssets: Record<PartKind, string> = {
  cornea: corneaPieceUrl,
  iris: irisPieceUrl,
  lens: lensPieceUrl,
  retina: retinaPieceUrl,
  'optic-nerve': opticNervePieceUrl,
}

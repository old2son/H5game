/** 差异命中框（逻辑坐标，基于 400x400 画布） */
export interface DiffBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

/** 单处差异：名称 + 命中框 + 两种状态的绘制函数 */
export interface Diff {
  name: string
  bbox: DiffBox
  bottomBox?: DiffBox
  paint?: (ctx: CanvasRenderingContext2D, variant: number) => void
}

/** 一个关卡场景 */
export interface Scene {
  name: string
  desc: string
  tip: string
  diffs: Diff[]
  render: (ctx: CanvasRenderingContext2D, variant: number) => void
  boardMode?: 'dual' | 'stacked'
  boardSize?: {
    width: number
    height: number
  }
  mapTapPoint?: (point: Point) => Point | null
  getTapBox?: (diff: Diff, point: Point) => DiffBox
  getMarkerPoints?: (diff: Diff) => Point[]
  getDebugBoxes?: (diff: Diff) => DiffBox[]
}

/** 逻辑画布尺寸 */
export const S = 400

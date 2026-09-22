export type PartKind = 'cornea' | 'iris' | 'lens' | 'retina' | 'optic-nerve'

export interface AnatomyPartConfig {
  id: string
  kind: PartKind
  name: string
  shortName: string
  description: string
  funFact: string
  detail: string
  target: { x: number; y: number }
  scatter: { x: number; y: number }
  size: { w: number; h: number }
  zIndex: number
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
}

export const anatomyParts: AnatomyPartConfig[] = [
  {
    id: 'cornea',
    kind: 'cornea',
    name: '角膜',
    shortName: '角膜',
    description: '位于眼球最前方的透明组织，是光线进入眼内的第一站。',
    funFact: '角膜没有血管，却拥有非常丰富的神经末梢，所以轻微异物感也会很明显。',
    detail: '它和晶状体一起承担主要屈光功能，帮助光线正确聚焦。',
    target: { x: 11.5, y: 44.2 },
    scatter: { x: 11, y: 14 },
    size: { w: 14, h: 59 },
    zIndex: 5,
  },
  {
    id: 'iris',
    kind: 'iris',
    name: '虹膜',
    shortName: '虹膜',
    description: '虹膜像一个可调节光圈，控制瞳孔大小，让进入眼内的光线更合适。',
    funFact: '我们常说的“眼睛颜色”主要就是虹膜的颜色，不同人差异很大。',
    detail: '在强光下，虹膜会让瞳孔缩小；在暗处，它会帮助瞳孔放大。',
    target: { x: 18.7, y: 44.2 },
    scatter: { x: 82, y: 16 },
    size: { w: 9.5, h: 56 },
    zIndex: 4,
  },
  {
    id: 'lens',
    kind: 'lens',
    name: '晶状体',
    shortName: '晶状体',
    description: '晶状体像会变焦的小透镜，帮助我们看清远近不同的物体。',
    funFact: '随着年龄增长，晶状体会逐渐变硬，调焦能力下降，这也是老花常见的原因之一。',
    detail: '它依靠睫状肌改变厚薄，完成精细聚焦。',
    target: { x: 27.6, y: 44.4 },
    scatter: { x: 18, y: 84 },
    size: { w: 13.5, h: 51 },
    zIndex: 3,
  },
  {
    id: 'retina',
    kind: 'retina',
    name: '视网膜',
    shortName: '视网膜',
    description: '视网膜像铺在眼底的感光屏幕，把光信号转成神经信号。',
    funFact: '视网膜中的视锥细胞更擅长分辨颜色，视杆细胞更擅长在昏暗环境中工作。',
    detail: '它并不是简单“接收图像”，而是在进入大脑前就开始进行信息处理。',
    target: { x: 44.6, y: 49.4 },
    scatter: { x: 79, y: 83 },
    size: { w: 66, h: 82 },
    zIndex: 2,
  },
  {
    id: 'optic-nerve',
    kind: 'optic-nerve',
    name: '视神经',
    shortName: '视神经',
    description: '视神经负责把视网膜处理后的信息送往大脑，是视觉传输通道。',
    funFact: '真正“看见”并不是在眼球里完成的，而是眼球和大脑共同协作的结果。',
    detail: '如果传导链路受损，即使眼前有光，也可能影响视觉形成。',
    target: { x: 83.2, y: 72.4 },
    scatter: { x: 50, y: 17 },
    size: { w: 31, h: 31 },
    zIndex: 1,
  },
]

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: '哪一个结构最先接触进入眼内的光线？',
    options: ['视网膜', '角膜', '视神经', '晶状体'],
    answer: 1,
    explanation: '角膜位于最前端，是光线进入眼内后的第一道透明屈光结构。',
  },
  {
    id: 'q2',
    prompt: '帮助我们看清远近物体、像会变焦透镜一样工作的结构是？',
    options: ['晶状体', '虹膜', '角膜', '视神经'],
    answer: 0,
    explanation: '晶状体可通过改变形态来微调焦点，是清晰成像的重要部件。',
  },
  {
    id: 'q3',
    prompt: '把光信号转换为神经信号、相当于感光屏幕的是哪一部分？',
    options: ['虹膜', '角膜', '视网膜', '视神经'],
    answer: 2,
    explanation: '视网膜中的感光细胞负责接收光刺激并启动神经信号传递。',
  },
  {
    id: 'q4',
    prompt: '把眼部视觉信息继续传送到大脑的通路是？',
    options: ['视神经', '晶状体', '虹膜', '角膜'],
    answer: 0,
    explanation: '视神经承担的是“传输”任务，负责把信息送往大脑视觉中枢。',
  },
]

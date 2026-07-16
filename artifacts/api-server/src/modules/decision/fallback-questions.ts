export interface FallbackQuestion {
  id: number;
  question: string;
  type: 'boolean' | 'number';
  field: string;
}

export const FALLBACK_QUESTIONS: FallbackQuestion[] = [
  {
    id: 1,
    question: 'هل بنية السوق متوافقة مع اتجاه الصفقة؟',
    type: 'boolean',
    field: 'marketStructure',
  },
  {
    id: 2,
    question: 'هل توجد فجوة القيمة العادلة (FVG) واضحة؟',
    type: 'boolean',
    field: 'fairValueGap',
  },
  {
    id: 3,
    question: 'هل يوجد كتلة أوامر (Order Block) محتملة؟',
    type: 'boolean',
    field: 'orderBlock',
  },
  {
    id: 4,
    question: 'هل تم كسر سيولة واضح (Liquidity Sweep)؟',
    type: 'boolean',
    field: 'liquiditySweep',
  },
  {
    id: 5,
    question: 'هل نحن ضمن منطقة القتل (Killzone)؟',
    type: 'boolean',
    field: 'killzoneActive',
  },
  {
    id: 6,
    question: 'هل توجد إشارة إعادة توازن فورية (Immediate Rebalance)؟',
    type: 'boolean',
    field: 'immediateRebalance',
  },
];
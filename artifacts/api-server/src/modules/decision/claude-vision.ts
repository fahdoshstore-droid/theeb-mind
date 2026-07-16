import { env } from '../../config/env.js';
import type { DecisionType } from '../../shared/types.js';

export interface VisionAnalysisResult {
  type: DecisionType;
  instrument: string;
  timeframe: string;
  marketStructure: boolean;
  fairValueGap: boolean;
  orderBlock: boolean;
  liquiditySweep: boolean;
  immediateRebalance: boolean;
  rrr: number;
  stopLoss: number | null;
  takeProfit: number | null;
  entry: number | null;
  analysis: string;
  confidence: number;
}

export async function analyzeChartWithVision(
  imageBase64: string,
  instrument: string,
  timeframe: string
): Promise<VisionAnalysisResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `أنت محلل شارت خبير. حلل هذا الشارت للأداة ${instrument} على الإطار الزمني ${timeframe}.

أعد النتيجة كـ JSON بالتنسيق التالي فقط (بدون أي نص إضافي):
{
  "type": "long" أو "short" أو "no_trade",
  "instrument": "${instrument}",
  "timeframe": "${timeframe}",
  "marketStructure": true/false,
  "fairValueGap": true/false,
  "orderBlock": true/false,
  "liquiditySweep": true/false,
  "immediateRebalance": true/false,
  "rrr": number (نسبة المخاطرة للعائد),
  "stopLoss": number أو null,
  "takeProfit": number أو null,
  "entry": number أو null,
  "analysis": "تحليل مفصل بالعربية",
  "confidence": number من 0 إلى 100
}

حدد العناصر التالية:
- بنية السوق: هل هناك اتجاه واضح؟
- فجوة القيمة العادلة (FVG): هل توجد فجوة سعرية؟
- كتلة الأوامر (OB): هل يوجد مستوى كتلة أوامر؟
- كسر السيولة: هل تم كسر قمم/قيعان واضحة؟
- إعادة التوازن: هل يوجد إشارة إعادة توازن فورية؟`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as any;
  const textBlock = data.content?.find((b: any) => b.type === 'text');
  if (!textBlock) {
    throw new Error('No text response from Claude API');
  }

  const jsonStr = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed: VisionAnalysisResult = JSON.parse(jsonStr);

  if (!['long', 'short', 'no_trade'].includes(parsed.type)) {
    parsed.type = 'no_trade';
  }

  return parsed;
}
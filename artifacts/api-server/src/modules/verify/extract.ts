import { env } from '../../config/env.js';
import type { Claim } from '../../shared/types.js';

export interface ExtractResult {
  claims: Claim[];
  rawText: string;
}

export async function extractClaims(content: string, source?: string): Promise<ExtractResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `حلل النص التالي واستخرج جميع الادعاءات المالية أو التحليلية فيه.

النص:
"""
${content}
"""

أعد النتيجة كـ JSON فقط (بدون أي نص إضافي):
{
  "claims": [
    {
      "text": "نص الادعاء",
      "category": "price_action" أو "pattern" أو "fundamental" أو "sentiment" أو "manipulation",
      "confidence": number من 0 إلى 100
    }
  ]
}

قواعد التصنيف:
- price_action: ادعاءات عن حركة السعر الحالية
- pattern: ادعاءات عن أنماط فنية (نماذج شارت)
- fundamental: ادعاءات عن بيانات أساسية أو اقتصادية
- sentiment: ادعاءات عن مشاعر السوق
- manipulation: ادعاءات عن تلاعب محتمل بالسوق`,
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
  const parsed = JSON.parse(jsonStr);

  const claims: Claim[] = (parsed.claims || []).map((c: any) => ({
    text: c.text || '',
    category: ['price_action', 'pattern', 'fundamental', 'sentiment', 'manipulation'].includes(c.category)
      ? c.category
      : 'sentiment',
    confidence: typeof c.confidence === 'number' ? Math.min(100, Math.max(0, c.confidence)) : 50,
  }));

  return { claims, rawText: content };
}
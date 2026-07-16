import { z } from 'zod';

// userId in request body/query is optional in validators — route handlers always
// override it with the immutable auth-context userId set by authMiddleware.
export const analyzeRequestSchema = z.object({
  userId: z.string().min(1).optional(),
  imageBase64: z.string().min(1, 'صورة الشارت مطلوبة'),
  instrument: z.string().min(1, 'نوع الأداة مطلوب'),
  timeframe: z.string().min(1, 'الإطار الزمني مطلوب'),
  riskAmount: z.number().positive().optional(),
});

export const fallbackRequestSchema = z.object({
  userId: z.string().min(1).optional(),
  instrument: z.string().min(1),
  timeframe: z.string().min(1),
  marketStructure: z.boolean(),
  fairValueGap: z.boolean(),
  orderBlock: z.boolean(),
  liquiditySweep: z.boolean(),
  immediateRebalance: z.boolean(),
  killzoneActive: z.boolean(),
  riskAmount: z.number().positive().optional(),
});

export const gateAnswersSchema = z.object({
  userId: z.string().min(1).optional(),
  answers: z.array(z.object({
    questionId: z.number().int().min(1),
    selectedOption: z.number().int().min(0),
  })),
});

export const verifyRequestSchema = z.object({
  userId: z.string().min(1).optional(),
  content: z.string().min(1, 'المحتوى مطلوب'),
  source: z.string().optional(),
});

export const outcomeRequestSchema = z.object({
  outcome: z.enum(['win', 'loss', 'breakeven', 'cancelled']),
  pnl: z.number().optional(),
  notes: z.string().optional(),
});

export const analyticsRequestSchema = z.object({
  // userId comes from the path param / auth context — tolerate it in query too for back-compat
  userId: z.string().min(1).optional(),
  period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type FallbackRequest = z.infer<typeof fallbackRequestSchema>;
export type GateAnswersRequest = z.infer<typeof gateAnswersSchema>;
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;
export type OutcomeRequest = z.infer<typeof outcomeRequestSchema>;
export type AnalyticsRequest = z.infer<typeof analyticsRequestSchema>;
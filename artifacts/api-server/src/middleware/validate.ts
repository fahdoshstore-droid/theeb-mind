import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { createError } from './error-handler.js';

export function validate(schema: ZodSchema, location: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = location === 'query' ? req.query : req.body;
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      next(createError(`خطأ في التحقق: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`, 400, 'VALIDATION_ERROR'));
      return;
    }

    if (location === 'body') {
      req.body = result.data;
    }

    next();
  };
}
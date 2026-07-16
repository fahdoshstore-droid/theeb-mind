import { CONFIG } from '../../config/constants.js';

export interface ManipulationCheck {
  text: string;
  matches: string[];
  count: number;
}

export function checkManipulationPatterns(text: string): ManipulationCheck {
  const lower = text.toLowerCase();
  const matches: string[] = [];

  for (const pattern of CONFIG.MANIPULATION_PATTERNS) {
    if (lower.includes(pattern)) {
      matches.push(pattern);
    }
  }

  return {
    text,
    matches,
    count: matches.length,
  };
}
import type { VerificationResult } from '../../shared/types.js';
import { extractClaims } from './extract.js';
import { checkClaims } from './check.js';
import { checkManipulationPatterns } from './patterns.js';
import { generateVerdict } from './verdict.js';
import { db } from '../../db/db.js';

export interface VerifyInput {
  userId: string;
  content: string;
  source?: string;
}

export async function verifyContent(input: VerifyInput): Promise<VerificationResult> {
  // Extract claims using Claude API — fall back to empty claims if key missing or API fails
  let claims: Awaited<ReturnType<typeof extractClaims>>['claims'] = [];
  try {
    const extracted = await extractClaims(input.content, input.source);
    claims = extracted.claims;
  } catch {
    // Claude unavailable — pattern-only analysis continues below
  }

  // Check each claim against rule engine
  const checkedClaims = checkClaims(claims);

  // Check for manipulation patterns
  const manipulationCheck = checkManipulationPatterns(input.content);

  // Calculate aggregate scores
  const verifiedClaims = checkedClaims.filter((c) => c.verified).length;
  const rejectedClaims = checkedClaims.filter((c) => !c.verified).length;

  let totalScore = 0;
  if (claims.length > 0) {
    const verifiedRatio = verifiedClaims / claims.length;
    const manipulationPenalty = Math.min(manipulationCheck.count * 15, 50);
    totalScore = Math.round(verifiedRatio * 100 - manipulationPenalty);
    totalScore = Math.max(0, Math.min(100, totalScore));
  }

  // Generate verdict
  const result = generateVerdict({
    totalScore,
    verifiedClaims,
    rejectedClaims,
    manipulationFlags: manipulationCheck.matches,
    claimsCount: claims.length,
  });

  // Attach the extracted claims to the result
  result.claims = claims;

  // Store verification
  db.stmt('insertVerification').run(
    input.userId,
    input.content,
    input.source || null,
    result.credibility,
    result.credibilityScore,
    result.claimsCount,
    result.verifiedClaims,
    result.rejectedClaims,
    JSON.stringify(result.manipulationFlags),
    result.verdict
  );

  return result;
}
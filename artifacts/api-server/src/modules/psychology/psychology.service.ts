import type { GateAnswer, GateVerdict, PsychologySnapshot } from '../../shared/types.js';
import { GATE_QUESTIONS } from './gate-questions.js';
import { CONFIG } from '../../config/constants.js';
import { db } from '../../db/db.js';

export interface GateEvaluation {
  answers: GateAnswer[];
  verdict: GateVerdict;
  snapshot: PsychologySnapshot;
}

export function evaluateGate(
  userId: string,
  answerInputs: { questionId: number; selectedOption: number }[]
): GateEvaluation {
  const answers: GateAnswer[] = [];
  let totalScore = 0;
  let maxScore = 0;
  const blockers: number[] = [];

  for (const input of answerInputs) {
    const question = GATE_QUESTIONS.find((q) => q.id === input.questionId);
    if (!question) continue;

    const option = question.options[input.selectedOption];
    if (!option) continue;

    const answer: GateAnswer = {
      questionId: question.id,
      question: question.question,
      selectedOption: input.selectedOption,
      score: option.score,
      isBlocker: option.isBlocker,
    };

    answers.push(answer);
    totalScore += option.score;
    maxScore += Math.max(...question.options.map((o) => o.score));

    if (option.isBlocker) {
      blockers.push(question.id);
    }
  }

  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const behavioralLock = checkBehavioralLock(userId);
  const verdict = calculateVerdict(percentage, blockers, behavioralLock);

  const snapshot: PsychologySnapshot = {
    phase: determinePhase(answers),
    score: totalScore,
    maxScore,
    percentage: Math.round(percentage),
    verdict: verdict.pass ? 'pass' : verdict.behavioralLock ? 'fail' : 'warning',
    answers,
    behavioralLock: verdict.behavioralLock,
    lockReason: verdict.lockReason,
  };

  db.stmt('insertPsychologyState').run(
    userId,
    null,
    snapshot.phase,
    snapshot.score,
    snapshot.maxScore,
    snapshot.verdict,
    snapshot.behavioralLock ? 1 : 0,
    snapshot.lockReason
  );

  return { answers, verdict, snapshot };
}

export function checkBehavioralLock(userId: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  const recentDecisions = db.raw.prepare(
    `SELECT type, outcome FROM decisions
     WHERE user_id = ? AND date(created_at) = ?
     ORDER BY created_at DESC`
  ).all(userId, today) as { type: string; outcome: string | null }[];

  const losses = recentDecisions.filter((d) => d.outcome === 'loss').length;
  if (losses >= CONFIG.CONSEC_LOSS_LIMIT) return true;

  const dayOfWeek = new Date().getDay();
  if (CONFIG.NO_TRADE_DAYS.includes(dayOfWeek as any)) return true;

  return false;
}

export function calculateVerdict(
  percentage: number,
  blockers: number[],
  behavioralLock: boolean
): GateVerdict {
  const lockReason: string | null = behavioralLock
    ? 'تم تفعيل القفل السلوكي — لا تتداول اليوم'
    : blockers.length > 0
      ? `أسئلة حاجزة: ${blockers.join(', ')} — يجب المراجعة`
      : null;

  const pass = percentage >= 70 && blockers.length === 0 && !behavioralLock;

  return {
    pass,
    score: Math.round(percentage),
    maxScore: 100,
    percentage: Math.round(percentage),
    phase: determinePhaseFromScore(percentage),
    blockers,
    behavioralLock,
    lockReason,
  };
}

function determinePhase(answers: GateAnswer[]): string {
  if (answers.length === 0) return 'unknown';
  const avgScore = answers.reduce((s, a) => s + a.score, 0) / answers.length;
  if (avgScore >= 2.5) return 'disciplined';
  if (avgScore >= 1.5) return 'cautious';
  return 'reckless';
}

function determinePhaseFromScore(percentage: number): string {
  if (percentage >= 85) return 'disciplined';
  if (percentage >= 60) return 'cautious';
  return 'reckless';
}
import type { Grade, Credibility } from './types.js';

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function formatDateArabic(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function formatGrade(grade: Grade): string {
  const gradeLabels: Record<Grade, string> = {
    'A+': 'ممتاز',
    'A': 'جيد جداً',
    'B': 'مقبول',
    'C': 'ضعيف',
  };
  return `${grade} (${gradeLabels[grade]})`;
}

export function formatCredibility(credibility: Credibility): string {
  const labels: Record<Credibility, string> = {
    credible: 'موثوق',
    suspicious: 'مشبوه',
    rejected: 'مرفوض',
  };
  return labels[credibility];
}
import type { Grade } from '../../shared/types.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CoachingTemplate {
  id: string;
  name: string;
  messages: CoachingMessage[];
}

interface CoachingMessage {
  trigger: Grade | 'always';
  condition: 'high_confidence' | 'low_confidence' | 'always';
  message: string;
}

const templateCache = new Map<string, CoachingTemplate>();

async function loadTemplate(name: string): Promise<CoachingTemplate> {
  if (templateCache.has(name)) {
    return templateCache.get(name)!;
  }
  const filePath = join(__dirname, 'templates', `${name}.json`);
  const content = await readFile(filePath, 'utf-8');
  const template: CoachingTemplate = JSON.parse(content);
  templateCache.set(name, template);
  return template;
}

const TEMPLATE_ROTATION = ['raschke', 'carter', 'wieland'] as const;

function selectTemplate(): string {
  const hour = new Date().getHours();
  return TEMPLATE_ROTATION[hour % TEMPLATE_ROTATION.length];
}

export function generateMessage(qualityGrade: Grade, confluenceGrade: Grade, instrument: string): string {
  const templateName = selectTemplate();

  let template: CoachingTemplate;
  try {
    // Synchronous attempt — if not cached, use fallback
    const cached = templateCache.get(templateName);
    if (!cached) {
      // Load synchronously won't work, so we use a default message
      return generateFallbackMessage(qualityGrade, confluenceGrade, instrument);
    }
    template = cached;
  } catch {
    return generateFallbackMessage(qualityGrade, confluenceGrade, instrument);
  }

  const condition = qualityGrade === 'A+' || qualityGrade === 'A' ? 'high_confidence' : 'low_confidence';

  const matching = template.messages.filter(
    (m) => (m.trigger === qualityGrade || m.trigger === 'always') &&
           (m.condition === condition || m.condition === 'always')
  );

  if (matching.length > 0) {
    const msg = matching[Math.floor(Math.random() * matching.length)];
    return msg.message.replace(/\{instrument\}/g, instrument);
  }

  return generateFallbackMessage(qualityGrade, confluenceGrade, instrument);
}

export async function generateMessageAsync(qualityGrade: Grade, confluenceGrade: Grade, instrument: string): Promise<string> {
  const templateName = selectTemplate();

  let template: CoachingTemplate;
  try {
    template = await loadTemplate(templateName);
  } catch {
    return generateFallbackMessage(qualityGrade, confluenceGrade, instrument);
  }

  const condition = qualityGrade === 'A+' || qualityGrade === 'A' ? 'high_confidence' : 'low_confidence';

  const matching = template.messages.filter(
    (m) => (m.trigger === qualityGrade || m.trigger === 'always') &&
           (m.condition === condition || m.condition === 'always')
  );

  if (matching.length > 0) {
    const msg = matching[Math.floor(Math.random() * matching.length)];
    return msg.message.replace(/\{instrument\}/g, instrument);
  }

  return generateFallbackMessage(qualityGrade, confluenceGrade, instrument);
}

function generateFallbackMessage(qualityGrade: Grade, confluenceGrade: Grade, instrument: string): string {
  const gradeMessages: Record<Grade, string> = {
    'A+': `إشارة ممتازة على ${instrument} — التوافق قوي والتوقيت مثالي. ثق بخطتك وانتظر التنفيذ بضبط.`,
    'A': `إشارة جيدة على ${instrument} — التوافق واضح. تأكد من إدارة المخاطر ونفذ بثقة.`,
    'B': `إشارة متوسطة على ${instrument} — التوافق مقبول لكن ليس الأقوى. كن حذراً وقلل حجم المركز.`,
    'C': `إشارة ضعيفة على ${instrument} — التوافق غير كافٍ. الأفضل الانتظار لفرصة أوضح.`,
  };
  return gradeMessages[qualityGrade] || `لا تتداول ${instrument} الآن — الظروف غير ملائمة.`;
}
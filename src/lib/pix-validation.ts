import type { PixType } from '@/types';

/** Validate CPF checksum (11 digits) */
function isValidCpfChecksum(digits: string): boolean {
  if (digits.length !== 11) return false;
  // All same digits is invalid
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

/** Validate PIX key format based on type */
export function validatePixKey(type: PixType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Chave PIX é obrigatória.';

  switch (type) {
    case 'cpf': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 11) return 'CPF deve ter 11 dígitos.';
      if (!isValidCpfChecksum(digits)) return 'CPF inválido (dígito verificador incorreto).';
      return null;
    }
    case 'cnpj': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 14) return 'CNPJ deve ter 14 dígitos.';
      return null;
    }
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) return 'Email inválido.';
      return null;
    }
    case 'phone': {
      // Strip everything except digits; also strip leading +55 or 55
      let digits = trimmed.replace(/\D/g, '');
      if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        digits = digits.slice(2);
      }
      if (digits.length !== 10 && digits.length !== 11) {
        return 'Telefone deve ter DDD + número (10 ou 11 dígitos). Ex: 73981962774';
      }
      return null;
    }
    case 'random': {
      // UUID v4 format: 8-4-4-4-12 hex chars
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(trimmed)) return 'Chave aleatória deve estar no formato UUID (ex: 123e4567-e89b-12d3-a456-426614174000).';
      return null;
    }
    default:
      return 'Tipo de chave inválido.';
  }
}

/** Normalize phone to just digits (DDD+number, no country code) for comparison */
function normalizePhoneDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  return digits.length >= 10 ? digits : null;
}

export interface PixContextWarning {
  level: 'info' | 'critical';
  type: 'phone' | 'cpf';
  message: string;
  detail: string;
  winnerValue: string;
  pixValue: string;
}

/** Get contextual warnings comparing PIX key with winner data. Non-blocking. */
export function getPixContextWarnings(
  type: PixType,
  key: string,
  winner: { cpf?: string | null; phone?: string | null },
): PixContextWarning[] {
  const warnings: PixContextWarning[] = [];
  const trimmed = key.trim();

  if (type === 'cpf' && winner.cpf) {
    const keyDigits = trimmed.replace(/\D/g, '');
    const winnerDigits = winner.cpf.replace(/\D/g, '');
    if (keyDigits && winnerDigits && keyDigits !== winnerDigits) {
      warnings.push({
        level: 'critical',
        type: 'cpf',
        message: 'ATENÇÃO: o CPF informado como chave PIX é diferente do CPF do ganhador.',
        detail: 'O pagamento deve preferencialmente ser feito para uma chave PIX em nome do próprio ganhador. Utilize outra chave apenas se houver autorização para pagamento a terceiro.',
        winnerValue: winnerDigits,
        pixValue: keyDigits,
      });
    }
  }

  if (type === 'phone' && winner.phone) {
    const keyNorm = normalizePhoneDigits(trimmed);
    const winnerNorm = normalizePhoneDigits(winner.phone);
    if (keyNorm && winnerNorm && keyNorm !== winnerNorm) {
      warnings.push({
        level: 'info',
        type: 'phone',
        message: 'Atenção: o telefone informado como chave PIX é diferente do telefone cadastrado do ganhador.',
        detail: '',
        winnerValue: winnerNorm,
        pixValue: keyNorm,
      });
    }
  }

  return warnings;
}

export interface PixDetectionResult {
  type: PixType | null;
  ambiguous: boolean;
  candidates: PixType[];
}

/** Auto-detect PIX key type from value, using winner data to resolve ambiguity */
export function detectPixType(
  value: string,
  winner?: { cpf?: string | null; phone?: string | null },
): PixDetectionResult {
  const trimmed = value.trim();
  if (!trimmed) return { type: null, ambiguous: false, candidates: [] };

  // UUID — unambiguous
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return { type: 'random', ambiguous: false, candidates: [] };
  }

  // Email — unambiguous
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { type: 'email', ambiguous: false, candidates: [] };
  }

  const digits = trimmed.replace(/\D/g, '');

  // CNPJ — unambiguous
  if (digits.length === 14) return { type: 'cnpj', ambiguous: false, candidates: [] };

  // 10 digits — only phone
  if (digits.length === 10) return { type: 'phone', ambiguous: false, candidates: [] };

  // 12/13 with country code — only phone
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return { type: 'phone', ambiguous: false, candidates: [] };
  }

  // 11 digits — could be CPF or phone
  if (digits.length === 11) {
    const validCpf = isValidCpfChecksum(digits);

    // Use winner data to resolve: if matches winner CPF exactly → CPF
    if (winner?.cpf) {
      const winnerCpfDigits = winner.cpf.replace(/\D/g, '');
      if (digits === winnerCpfDigits) return { type: 'cpf', ambiguous: false, candidates: [] };
    }
    // If matches winner phone exactly → phone
    if (winner?.phone) {
      const winnerPhoneNorm = normalizePhoneDigits(winner.phone);
      if (winnerPhoneNorm && digits === winnerPhoneNorm) return { type: 'phone', ambiguous: false, candidates: [] };
    }

    // If NOT a valid CPF checksum → phone
    if (!validCpf) return { type: 'phone', ambiguous: false, candidates: [] };

    // Valid CPF checksum AND 11 digits (could also be phone) → ambiguous
    return { type: null, ambiguous: true, candidates: ['cpf', 'phone'] };
  }

  return { type: null, ambiguous: false, candidates: [] };
}

/** Mask a PIX key for display */
export function maskPixKey(type: PixType | string | undefined, key: string | undefined): string {
  if (!key || !type) return '—';
  const trimmed = key.trim();
  if (trimmed.length <= 4) return trimmed;

  switch (type) {
    case 'cpf':
    case 'cnpj': {
      const digits = trimmed.replace(/\D/g, '');
      return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
    }
    case 'email': {
      const [local, domain] = trimmed.split('@');
      if (!domain) return trimmed;
      return `${local.slice(0, 2)}***@${domain}`;
    }
    case 'phone': {
      const digits = trimmed.replace(/\D/g, '');
      return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
    }
    case 'random':
      return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
    default:
      return `${trimmed.slice(0, 4)}***`;
  }
}

/** Get PIX status for visual display */
export function getPixStatus(winner: { pixKey?: string; pixType?: string; pixValidatedAt?: string }): 'none' | 'filled' | 'validated' {
  if (!winner.pixKey || !winner.pixType) return 'none';
  if (winner.pixValidatedAt) return 'validated';
  return 'filled';
}

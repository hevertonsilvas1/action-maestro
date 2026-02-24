import type { PixType } from '@/types';

/** Validate PIX key format based on type */
export function validatePixKey(type: PixType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Chave PIX é obrigatória.';

  switch (type) {
    case 'cpf': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 11) return 'CPF deve ter 11 dígitos.';
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
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) return 'Telefone deve ter 10 ou 11 dígitos.';
      return null;
    }
    case 'random': {
      if (trimmed.length < 32) return 'Chave aleatória deve ter no mínimo 32 caracteres.';
      return null;
    }
    default:
      return 'Tipo de chave inválido.';
  }
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

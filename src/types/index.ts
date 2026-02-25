export interface Action {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled' | 'archived';
  previousStatus?: string | null;
  quotaCount: number;
  quotaValue: number;
  startDate?: string | null;
  endDate?: string | null;
  taxPercent: number;
  expectedRevenue: number;
  totalPrizes: number;
  totalOperational: number;
  totalTaxes: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
  realPaid: number;
  winnersCount: number;
  paidCount: number;
  pendingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Winner {
  id: string;
  actionId: string;
  name: string;
  prizeType: string;
  prizeTitle: string;
  value: number;
  status: WinnerStatus;
  pixKey?: string;
  pixType?: PixType;
  fullName?: string;
  receiptUrl?: string;
  receiptFilename?: string;
  receiptAttachedAt?: string;
  receiptAttachedBy?: string;
  receiptSentAt?: string;
  receiptVersion: number;
  cpf?: string;
  phone?: string;
  prizeDatetime?: string;
  lastPixRequestAt?: string;
  lastPixError?: string;
  lastPixRequestedBy?: string;
  pixHolderName?: string;
  pixHolderDoc?: string;
  pixObservation?: string;
  pixRegisteredBy?: string;
  pixRegisteredAt?: string;
  pixValidatedBy?: string;
  pixValidatedAt?: string;
  batchId?: string;
  paymentMethod?: PaymentMethod;
  ultimaInteracaoWhatsapp?: string;
  lastOutboundAt?: string;
  createdAt: string;
}

export type PixType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
export type PaymentMethod = 'lote_pix' | 'manual';

export const PIX_TYPE_LABELS: Record<PixType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'Email',
  phone: 'Telefone',
  random: 'Chave Aleatória',
};

/** Status that require PIX data to transition to */
export const PIX_REQUIRED_STATUSES: WinnerStatus[] = ['pix_received', 'sent_to_batch', 'receipt_attached', 'receipt_sent'];

/** Status that block PIX editing (unless admin with reason) */
export const PIX_LOCKED_STATUSES: WinnerStatus[] = ['receipt_attached', 'receipt_sent'];

export type WinnerStatus =
  | 'imported'
  | 'pix_requested'
  | 'awaiting_pix'
  | 'pix_received'
  | 'ready_to_pay'
  | 'sent_to_batch'
  | 'awaiting_receipt'
  | 'paid'
  | 'receipt_sent'
  | 'pix_refused'
  | 'receipt_attached'
  | 'numero_inexistente'
  | 'cliente_nao_responde';

export const WINNER_STATUS_LABELS: Record<WinnerStatus, string> = {
  imported: 'Importado',
  pix_requested: 'Pix Solicitado',
  awaiting_pix: 'Aguardando Pix',
  pix_received: 'Pix Recebido / Validado',
  ready_to_pay: 'Pronto para Pagar',
  sent_to_batch: 'Enviado para Lote',
  awaiting_receipt: 'Aguardando Comprovante',
  paid: 'Pago',
  receipt_sent: 'Comprovante Enviado',
  pix_refused: 'Pix Recusado',
  receipt_attached: 'Comprovante Anexado',
  numero_inexistente: 'Número Inexistente',
  cliente_nao_responde: 'Cliente Não Responde',
};

export const WINNER_STATUS_COLORS: Record<WinnerStatus, string> = {
  imported: 'bg-muted text-muted-foreground',
  pix_requested: 'bg-info/15 text-info',
  awaiting_pix: 'bg-info/15 text-info',
  pix_received: 'bg-purple/15 text-purple',
  ready_to_pay: 'bg-purple/15 text-purple',
  sent_to_batch: 'bg-accent/15 text-accent',
  awaiting_receipt: 'bg-warning/15 text-warning',
  paid: 'bg-success/15 text-success',
  receipt_sent: 'bg-success/15 text-success',
  pix_refused: 'bg-destructive/15 text-destructive',
  receipt_attached: 'bg-warning/15 text-warning',
  numero_inexistente: 'bg-destructive/15 text-destructive',
  cliente_nao_responde: 'bg-destructive/15 text-destructive',
};

export const ACTION_STATUS_LABELS: Record<Action['status'], string> = {
  planning: 'Planejamento',
  active: 'Ativa',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  archived: 'Arquivada',
};

export const ACTION_STATUS_COLORS: Record<Action['status'], string> = {
  planning: 'bg-warning/15 text-warning',
  active: 'bg-success/15 text-success',
  completed: 'bg-primary/15 text-primary',
  cancelled: 'bg-destructive/15 text-destructive',
  archived: 'bg-muted text-muted-foreground',
};

export interface Prize {
  id: string;
  actionId: string;
  prizeTypeConfigId?: string | null;
  type: 'main' | 'instant' | 'spin' | 'quota' | 'blessed_hour' | 'bonus';
  title: string;
  description?: string | null;
  quantity: number;
  unitValue: number;
  totalValue: number;
}

export interface Cost {
  id: string;
  actionId: string;
  costTypeConfigId?: string | null;
  category: 'marketing' | 'delivery' | 'taxes' | 'legalization' | 'other';
  description: string;
  quantity: number;
  unitValue: number;
  value: number;
}

export type UserRole = 'admin' | 'support';

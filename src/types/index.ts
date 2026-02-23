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
  pixType?: string;
  fullName?: string;
  receiptUrl?: string;
  cpf?: string;
  phone?: string;
  prizeDatetime?: string;
  createdAt: string;
}

export type WinnerStatus =
  | 'imported'
  | 'pix_requested'
  | 'awaiting_pix'
  | 'pix_received'
  | 'ready_to_pay'
  | 'sent_to_batch'
  | 'awaiting_receipt'
  | 'paid'
  | 'receipt_sent';

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

export const WINNER_STATUS_LABELS: Record<WinnerStatus, string> = {
  imported: 'Importado',
  pix_requested: 'Pix Solicitado',
  awaiting_pix: 'Aguardando Pix',
  pix_received: 'Pix Recebido',
  ready_to_pay: 'Pronto para Pagar',
  sent_to_batch: 'Enviado para Lote',
  awaiting_receipt: 'Aguardando Comprovante',
  paid: 'Pago',
  receipt_sent: 'Comprovante Enviado',
};

export const WINNER_STATUS_COLORS: Record<WinnerStatus, string> = {
  imported: 'bg-muted text-muted-foreground',
  pix_requested: 'bg-info/15 text-info',
  awaiting_pix: 'bg-warning/15 text-warning',
  pix_received: 'bg-primary/15 text-primary',
  ready_to_pay: 'bg-accent/15 text-accent',
  sent_to_batch: 'bg-info/15 text-info',
  awaiting_receipt: 'bg-warning/15 text-warning',
  paid: 'bg-success/15 text-success',
  receipt_sent: 'bg-success/15 text-success',
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

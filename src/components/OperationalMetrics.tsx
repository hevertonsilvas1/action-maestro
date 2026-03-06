import { Link } from 'react-router-dom';
import { Winner, WinnerStatus, WINNER_STATUS_LABELS, WINNER_STATUS_COLORS } from '@/types';
import { isWindowOpen } from '@/lib/time';
import { cn } from '@/lib/utils';
import {
  LucideIcon, Upload, Send, CheckCircle2, FileText, XCircle, Phone,
  UserX, Paperclip, MessageSquare, Clock, AlertTriangle,
} from 'lucide-react';

const STATUS_ICONS: Record<string, LucideIcon> = {
  imported: Upload,
  pix_requested: Send,
  pix_received: CheckCircle2,
  sent_to_batch: FileText,
  pix_refused: XCircle,
  numero_inexistente: Phone,
  cliente_nao_responde: UserX,
  receipt_attached: Paperclip,
  receipt_sent: CheckCircle2,
};

const DISPLAY_STATUSES: WinnerStatus[] = [
  'imported', 'pix_requested', 'pix_received', 'sent_to_batch',
  'pix_refused', 'numero_inexistente', 'cliente_nao_responde',
  'receipt_attached', 'receipt_sent',
];

function StatusCard({ status, count }: { status: WinnerStatus; count: number }) {
  const Icon = STATUS_ICONS[status] || FileText;
  const label = WINNER_STATUS_LABELS[status];
  const colorClass = WINNER_STATUS_COLORS[status];

  return (
    <Link
      to={`/winners?status=${status}`}
      className="rounded-xl border bg-card p-3 lg:p-4 transition-all hover:shadow-card-hover hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3"
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', colorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl lg:text-2xl font-bold leading-none">{count}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{label}</p>
      </div>
    </Link>
  );
}

function CriticalCard({ label, count, icon: Icon, href, variant }: {
  label: string; count: number; icon: LucideIcon; href: string; variant: 'destructive' | 'warning';
}) {
  const styles = {
    destructive: 'border-destructive/30 bg-destructive/5',
    warning: 'border-warning/30 bg-warning/5',
  };
  const iconStyles = { destructive: 'text-destructive', warning: 'text-warning' };

  return (
    <Link
      to={href}
      className={cn(
        'rounded-xl border p-3 transition-all hover:shadow-card-hover hover:scale-[1.02] active:scale-[0.98]',
        styles[variant],
      )}
    >
      <Icon className={cn('h-5 w-5 mb-1.5', iconStyles[variant])} />
      <p className="text-xl font-bold">{count}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </Link>
  );
}

function MetricCard({ label, value, icon: Icon, variant, subtitle }: {
  label: string; value: number; icon: LucideIcon; variant: 'success' | 'destructive' | 'warning'; subtitle?: string;
}) {
  const styles = {
    success: 'border-success/20 bg-success/5',
    destructive: 'border-destructive/20 bg-destructive/5',
    warning: 'border-warning/20 bg-warning/5',
  };
  const iconStyles = { success: 'text-success', destructive: 'text-destructive', warning: 'text-warning' };

  return (
    <div className={cn('rounded-xl border p-3 lg:p-4', styles[variant])}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', iconStyles[variant])} />
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function OperationalMetrics({ winners }: { winners: Winner[] }) {
  const statusCounts = DISPLAY_STATUSES.reduce((acc, s) => {
    acc[s] = winners.filter(w => w.status === s).length;
    return acc;
  }, {} as Record<WinnerStatus, number>);

  const windowOpenCount = winners.filter(w => isWindowOpen(w.lastInboundAt)).length;
  const windowClosedCount = winners.filter(w =>
    w.lastInboundAt && !isWindowOpen(w.lastInboundAt),
  ).length;

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const pixRequestedStale24h = winners.filter(w =>
    w.status === 'pix_requested' && w.lastPixRequestAt &&
    (now - new Date(w.lastPixRequestAt).getTime()) > 24 * 3600000,
  ).length;
  const pixRequestedStale48h = winners.filter(w =>
    w.status === 'pix_requested' && w.lastPixRequestAt &&
    (now - new Date(w.lastPixRequestAt).getTime()) > 48 * 3600000,
  ).length;
  const receiptPendingStale = winners.filter(w =>
    w.status === 'receipt_attached' && w.receiptAttachedAt &&
    (now - new Date(w.receiptAttachedAt).getTime()) > 24 * 3600000,
  ).length;

  // Inbound metrics
  const inboundToday = winners.filter(w =>
    w.lastInboundAt && new Date(w.lastInboundAt).getTime() >= todayMs,
  ).length;

  // Average response time: diff between last_outbound_at and last_inbound_at for winners with both
  const responseTimes = winners
    .filter(w => w.lastInboundAt && w.lastOutboundAt)
    .map(w => {
      const inbound = new Date(w.lastInboundAt!).getTime();
      const outbound = new Date(w.lastOutboundAt!).getTime();
      return Math.abs(outbound - inbound);
    })
    .filter(d => d > 0 && d < 7 * 24 * 3600000); // ignore outliers > 7d
  const avgResponseMs = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;
  const avgResponseMinutes = Math.round(avgResponseMs / 60000);
  const avgResponseLabel = avgResponseMinutes < 60
    ? `${avgResponseMinutes}min`
    : avgResponseMinutes < 1440
      ? `${Math.round(avgResponseMinutes / 60)}h ${avgResponseMinutes % 60}min`
      : `${Math.round(avgResponseMinutes / 1440)}d`;

  // Auto-send receipt rate: receipt_sent vs total that had receipt_attached or receipt_sent
  const receiptEligible = winners.filter(w =>
    ['receipt_attached', 'receipt_sent'].includes(w.status) || w.receiptSentAt,
  ).length;
  const receiptAutoSent = winners.filter(w => w.receiptSentAt).length;
  const autoSendRate = receiptEligible > 0
    ? Math.round((receiptAutoSent / receiptEligible) * 100)
    : 0;

  const criticalCount =
    (statusCounts.pix_refused || 0) +
    (statusCounts.numero_inexistente || 0) +
    (statusCounts.cliente_nao_responde || 0) +
    (statusCounts.receipt_attached || 0) +
    windowClosedCount;

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Fila por Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {DISPLAY_STATUSES.map(s => (
            <StatusCard key={s} status={s} count={statusCounts[s] || 0} />
          ))}
        </div>
      </div>

      {/* Critical Pendencies */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Pendências Críticas
          {criticalCount > 0 && (
            <span className="text-xs font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">
              {criticalCount}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CriticalCard label="Pix Recusado" count={statusCounts.pix_refused || 0} icon={XCircle} href="/winners?status=pix_refused" variant="destructive" />
          <CriticalCard label="Nº Inexistente" count={statusCounts.numero_inexistente || 0} icon={Phone} href="/winners?status=numero_inexistente" variant="destructive" />
          <CriticalCard label="Não Responde" count={statusCounts.cliente_nao_responde || 0} icon={UserX} href="/winners?status=cliente_nao_responde" variant="destructive" />
          <CriticalCard label="Comp. Pendente" count={statusCounts.receipt_attached || 0} icon={Paperclip} href="/winners?status=receipt_attached" variant="warning" />
          <CriticalCard label="Janela Fechada" count={windowClosedCount} icon={MessageSquare} href="/winners?whatsappWindow=closed" variant="destructive" />
        </div>
      </div>

      {/* Metrics */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Métricas Operacionais</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Janela Aberta" value={windowOpenCount} icon={MessageSquare} variant="success" />
          <MetricCard label="Janela Fechada" value={windowClosedCount} icon={MessageSquare} variant="destructive" />
          <MetricCard label="Pix Sol. >24h" value={pixRequestedStale24h} icon={Clock} variant="warning" subtitle={`${pixRequestedStale48h} há +48h`} />
          <MetricCard label="Comp. Pend. >24h" value={receiptPendingStale} icon={Paperclip} variant="warning" />
        </div>
      </div>

      {/* Inbound Metrics */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          Métricas de Inbound
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Mensagens Hoje"
            value={inboundToday}
            icon={MessageSquare}
            variant="success"
            subtitle="Recebidas hoje"
          />
          <MetricCard
            label="Tempo Médio Resposta"
            value={avgResponseMinutes}
            icon={Clock}
            variant={avgResponseMinutes > 120 ? 'warning' : 'success'}
            subtitle={avgResponseLabel}
          />
          <MetricCard
            label="Taxa Auto-Envio"
            value={autoSendRate}
            icon={Send}
            variant={autoSendRate >= 70 ? 'success' : autoSendRate >= 40 ? 'warning' : 'destructive'}
            subtitle={`${receiptAutoSent}/${receiptEligible} comprovantes`}
          />
        </div>
      </div>
    </div>
  );
}

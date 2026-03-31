import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';
import { checkPrizeLimitsFromDB } from '@/hooks/usePrizeLimits';

export interface ParsedWinner {
  name: string;
  cpf: string | null;
  phone: string | null;
  value: number;
  prize_datetime: string | null;
  prize_type: string;
  title?: string;
  // Dedup status
  isDuplicate?: boolean;
  duplicateReason?: string;
  isInvalid?: boolean;
  invalidReason?: string;
  isOverLimit?: boolean;
}

interface ImportStats {
  totalFound: number;
  totalNew: number;
  totalDuplicates: number;
  totalInvalid: number;
  totalOverLimit: number;
}

// Map prize type text to DB enum
const PRIZE_TYPE_MAP: Record<string, string> = {
  'giro abençoado': 'spin',
  'hora abençoada': 'blessed_hour',
  'horário abençoado': 'blessed_hour',
  'bônus': 'bonus',
  'bonus': 'bonus',
  'principal': 'main',
  'premio principal': 'main',
  'instantâneo': 'instant',
  'instantaneo': 'instant',
  'cota': 'quota',
  'cota premiada': 'quota',
  'cota super': 'quota',
  'maior cota': 'quota',
  'menor cota': 'quota',
  'caixa surpresa': 'bonus',
  'spin': 'spin',
  'main': 'main',
  'instant': 'instant',
  'quota': 'quota',
  'blessed_hour': 'blessed_hour',
};

function normalizePrizeType(type: string): string {
  const lower = type.toLowerCase().trim();
  return PRIZE_TYPE_MAP[lower] || 'bonus';
}

function normalizeCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  return cpf.replace(/\D/g, '') || null;
}

function excelSerialToISO(serial: any): string | null {
  if (serial == null || serial === '') return null;
  const num = typeof serial === 'number' ? serial : parseFloat(String(serial));
  if (isNaN(num) || num < 1) {
    // Already a string date, return as-is
    return typeof serial === 'string' ? serial : null;
  }
  // Excel serial: days since 1899-12-30
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = epoch.getTime() + num * 86400000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, '') || null;
}

function normalizeValue(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle BRL format "1.234,56"
    const cleaned = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function normalizeNameForDedup(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const SAO_PAULO_MINUTE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

function normalizeDatetimeForDedup(prizeDatetime: string | null): string {
  if (!prizeDatetime) return '';

  const raw = String(prizeDatetime).trim();
  if (!raw) return '';

  // DD/MM/YYYY HH:mm(:ss)
  const brMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (brMatch) {
    const [, dd, mm, yyyy, hh = '00', min = '00'] = brMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min}`;
  }

  // YYYY-MM-DDTHH:mm(:ss)
  const isoLikeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (isoLikeMatch) {
    const [, yyyy, mm, dd, hh, min] = isoLikeMatch;
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  const date = new Date(raw);
  if (isNaN(date.getTime())) {
    return raw;
  }

  const parts = SAO_PAULO_MINUTE_FORMATTER.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function validateWinner(w: ParsedWinner): { valid: boolean; reason?: string } {
  if (!w.name || w.name.trim().length === 0) return { valid: false, reason: 'Nome ausente' };
  if (w.value <= 0) return { valid: false, reason: 'Valor inválido' };
  if (!w.prize_type || w.prize_type.trim().length === 0) return { valid: false, reason: 'Tipo de premiação ausente' };
  return { valid: true };
}

export function useImportWinners(actionId: string, actionName: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const queryClient = useQueryClient();

  const parsePdf = async (file: File): Promise<ParsedWinner[]> => {
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke('parse-winners-pdf', {
        body: { pdfBase64: base64, fileName: file.name },
      });

      if (error) {
        let message = 'Falha ao processar o PDF.';
        try {
          const details = await (error as any)?.context?.json?.();
          message = details?.error || details?.details || message;
        } catch {
          message = error.message || message;
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);

      const winners: ParsedWinner[] = (data?.winners || []).map((w: any) => ({
        name: w.name || '',
        cpf: normalizeCpf(w.cpf),
        phone: normalizePhone(w.phone),
        value: normalizeValue(w.value),
        prize_datetime: w.prize_datetime || null,
        prize_type: '',
        title: typeof w.title === 'string' ? w.title.trim() || undefined : undefined,
      }));

      return winners;
    } finally {
      setIsParsing(false);
    }
  };

  const parseExcel = async (file: File): Promise<ParsedWinner[]> => {
    setIsParsing(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) return [];

      return rows.map((row) => ({
        name: String(row.Ganhador || row.ganhador || row.Nome || row.nome || row.NAME || '').trim(),
        cpf: normalizeCpf(String(row.CPF || row.cpf || row.Cpf || '')),
        phone: normalizePhone(String(row.Telefone || row.telefone || row.Phone || row.phone || row.TELEFONE || '')),
        value: normalizeValue(row['Prêmio'] || row.Premio || row.Valor || row.valor || row.Value || row.value || row.VALOR || 0),
        prize_datetime: excelSerialToISO(row['Associado em'] || row.Data || row.data || row['Data/Hora'] || row.date || null),
        prize_type: String(row['Tipo de Premiação'] || row['Tipo'] || row.tipo || row.Status || row.status || row['Premio'] || row.prize_type || '').trim(),
        title: String(row['Título'] || row.Titulo || row.titulo || row.title || '').trim() || undefined,
      }));
    } finally {
      setIsParsing(false);
    }
  };

  const checkDuplicatesAndValidate = async (
    winners: ParsedWinner[],
    columnMapping?: Record<string, string>
  ): Promise<{ winners: ParsedWinner[]; stats: ImportStats }> => {
    // Apply column mapping if provided
    let mapped = winners;
    if (columnMapping) {
      mapped = winners.map((w) => {
        const result = { ...w };
        // columnMapping maps our field names to the source column values
        return result;
      });
    }

    // Normalize all
    const normalized = mapped.map((w) => ({
      ...w,
      cpf: normalizeCpf(w.cpf),
      phone: normalizePhone(w.phone),
      value: normalizeValue(w.value),
      prize_type: w.prize_type,
    }));

    // Validate
    const validated = normalized.map((w) => {
      const { valid, reason } = validateWinner(w);
      if (!valid) return { ...w, isInvalid: true, invalidReason: reason };
      return w;
    });

    // Check duplicates against DB using import rule:
    // action + name + value + prize_datetime (minute precision)
    // Paginate to handle >1000 winners
    let existingWinners: { name: string; prize_datetime: string | null; value: number }[] = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('winners')
        .select('name, prize_datetime, value')
        .eq('action_id', actionId)
        .is('deleted_at', null)
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error('Erro ao buscar ganhadores existentes para dedup:', error);
        break;
      }
      if (!data || data.length === 0) break;
      existingWinners = existingWinners.concat(data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    console.log(`[Dedup] Encontrados ${existingWinners.length} ganhadores existentes na ação ${actionId}`);

    function buildDuplicateKey(name: string, prizeDatetime: string | null, value: number): string {
      const normalizedName = normalizeNameForDedup(name);
      const normalizedDatetime = normalizeDatetimeForDedup(prizeDatetime);
      const normalizedValue = Number(Number(value).toFixed(2)).toFixed(2);
      return `${normalizedDatetime}|${normalizedValue}|${normalizedName}`;
    }

    const existingKeys = new Set(
      existingWinners.map((w) =>
        buildDuplicateKey(w.name, w.prize_datetime, Number(w.value))
      )
    );

    // Debug: log sample keys
    if (existingWinners.length > 0) {
      const sampleExisting = existingWinners.slice(0, 3).map((w) =>
        buildDuplicateKey(w.name, w.prize_datetime, Number(w.value))
      );
      const sampleNew = validated.slice(0, 3).map((w) =>
        buildDuplicateKey(w.name, w.prize_datetime, w.value)
      );
      console.log('[Dedup] Sample existing keys:', sampleExisting);
      console.log('[Dedup] Sample new keys:', sampleNew);
    }

    const result = validated.map((w) => {
      if (w.isInvalid) return w;

      const key = buildDuplicateKey(w.name, w.prize_datetime, w.value);
      if (existingKeys.has(key)) {
        return { ...w, isDuplicate: true, duplicateReason: 'Duplicado encontrado na ação (nome + valor + data/hora)' };
      }

      return w;
    });

    // Also check for duplicates within the batch itself
    const seenKeys = new Set<string>();
    const afterDedupe = result.map((w) => {
      if (w.isInvalid || w.isDuplicate) return w;

      const key = buildDuplicateKey(w.name, w.prize_datetime, w.value);

      if (seenKeys.has(key)) {
        return { ...w, isDuplicate: true, duplicateReason: 'Duplicado dentro do arquivo importado (nome + valor + data/hora)' };
      }

      seenKeys.add(key);
      return w;
    });

    // Check prize limits
    const prizeLimits = await checkPrizeLimitsFromDB(actionId);
    const remainingSlots = new Map<string, number>();
    prizeLimits.forEach((info, type) => {
      remainingSlots.set(type, info.remaining);
    });

    const finalResult = afterDedupe.map((w) => {
      if (w.isInvalid || w.isDuplicate || w.isOverLimit) return w;
      const normalizedType = normalizePrizeType(w.prize_type);
      const remaining = remainingSlots.get(normalizedType);
      if (remaining !== undefined) {
        if (remaining <= 0) {
          return { ...w, isOverLimit: true, isInvalid: true, invalidReason: 'Limite de premiação atingido' };
        }
        remainingSlots.set(normalizedType, remaining - 1);
      }
      return w;
    });

    const stats: ImportStats = {
      totalFound: finalResult.length,
      totalNew: finalResult.filter((w) => !w.isDuplicate && !w.isInvalid && !w.isOverLimit).length,
      totalDuplicates: finalResult.filter((w) => w.isDuplicate).length,
      totalInvalid: finalResult.filter((w) => w.isInvalid && !w.isOverLimit).length,
      totalOverLimit: finalResult.filter((w) => w.isOverLimit).length,
    };

    return { winners: finalResult, stats };
  };

  const importWinners = async (
    winners: ParsedWinner[],
    fileType: string,
    fileName: string,
    includeDuplicates: boolean = false
  ) => {
    setIsLoading(true);
    try {
      const newWinners = winners.filter((w) => {
        if (w.isInvalid || w.isOverLimit) return false;
        if (w.isDuplicate && !includeDuplicates) return false;
        return true;
      });

      if (newWinners.length === 0) {
        toast.info('Nenhum novo ganhador para importar.');
        return;
      }

      const rows = newWinners.map((w) => {
        const normalizedPhone = normalizePhone(w.phone);
        const digits = normalizedPhone ? normalizedPhone.replace(/\D/g, '') : null;
        let phoneE164: string | null = null;
        if (digits) {
          if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
            phoneE164 = `+${digits}`;
          } else if (digits.length === 10 || digits.length === 11) {
            phoneE164 = `+55${digits}`;
          }
        }
        return {
          action_id: actionId,
          name: w.name,
          full_name: w.name,
          cpf: normalizeCpf(w.cpf),
          phone: normalizedPhone,
          phone_e164: phoneE164,
          value: w.value,
          prize_type: normalizePrizeType(w.prize_type) as any,
          prize_title: w.title || w.prize_type,
          prize_datetime: w.prize_datetime || null,
          status: 'imported' as const,
        };
      });

      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from('winners').insert(batch);
        if (error) throw error;
      }

      // Update action winners count
      const { data: countData } = await supabase
        .from('winners')
        .select('id', { count: 'exact', head: true })
        .eq('action_id', actionId);

      // Log import
      await supabase.from('import_logs').insert({
        action_id: actionId,
        file_type: fileType,
        file_name: fileName,
        total_found: winners.length,
        total_imported: newWinners.length,
        total_duplicates: winners.filter((w) => w.isDuplicate).length,
        total_invalid: winners.filter((w) => w.isInvalid).length,
      });

      // Audit log
      await insertAuditLog({
        actionId,
        actionName,
        tableName: 'winners',
        operation: 'import',
        changes: {
          file_type: fileType,
          file_name: fileName,
          imported: newWinners.length,
          duplicates_skipped: winners.filter((w) => w.isDuplicate).length,
          invalid_skipped: winners.filter((w) => w.isInvalid).length,
        },
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['winners', actionId] });
      queryClient.invalidateQueries({ queryKey: ['action', actionId] });
      queryClient.invalidateQueries({ queryKey: ['actions'] });

      toast.success(`${newWinners.length} ganhador(es) importado(s) com sucesso!`);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    parsePdf,
    parseExcel,
    checkDuplicatesAndValidate,
    importWinners,
    isLoading,
    isParsing,
  };
}

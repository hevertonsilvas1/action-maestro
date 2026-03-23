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
  'bônus': 'bonus',
  'bonus': 'bonus',
  'principal': 'main',
  'instantâneo': 'instant',
  'instantaneo': 'instant',
  'cota': 'quota',
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

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const winners: ParsedWinner[] = (data?.winners || []).map((w: any) => ({
        name: w.name || '',
        cpf: normalizeCpf(w.cpf),
        phone: normalizePhone(w.phone),
        value: normalizeValue(w.value),
        prize_datetime: w.prize_datetime || null,
        prize_type: w.prize_type || '',
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

    // Check duplicates against DB using the new composite key:
    // action + prize_datetime + prize_type + value + name + phone/cpf
    const { data: existingWinners } = await supabase
      .from('winners')
      .select('name, cpf, phone, prize_type, prize_datetime, value')
      .eq('action_id', actionId)
      .is('deleted_at', null);

    function buildDuplicateKey(name: string, cpf: string | null, phone: string | null, prizeType: string, prizeDatetime: string | null, value: number): string {
      const normalizedName = (name || '').trim().toLowerCase();
      const normalizedCpf = cpf ? cpf.replace(/\D/g, '') : '';
      const normalizedPhone = phone ? phone.replace(/\D/g, '') : '';
      const normalizedType = normalizePrizeType(prizeType);
      // Normalize datetime to minute precision to handle slight variations
      let normalizedDatetime = '';
      if (prizeDatetime) {
        try {
          const d = new Date(prizeDatetime);
          if (!isNaN(d.getTime())) {
            normalizedDatetime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          }
        } catch { /* keep empty */ }
      }
      return `${normalizedType}|${normalizedDatetime}|${value}|${normalizedName}|${normalizedCpf}|${normalizedPhone}`;
    }

    // Build DB-level dedup key matching idx_winners_dedup: (action_id, prize_type, cpf, prize_datetime, value)
    // Only applies when cpf IS NOT NULL AND prize_datetime IS NOT NULL
    function buildDbDedupKey(cpf: string | null, prizeType: string, prizeDatetime: string | null, value: number): string | null {
      const normalizedCpf = cpf ? cpf.replace(/\D/g, '') : null;
      if (!normalizedCpf || !prizeDatetime) return null;
      const normalizedType = normalizePrizeType(prizeType);
      return `${normalizedType}|${normalizedCpf}|${prizeDatetime}|${value}`;
    }

    const existingKeys = new Set(
      (existingWinners || []).map((w) =>
        buildDuplicateKey(w.name, w.cpf, w.phone, w.prize_type, w.prize_datetime, Number(w.value))
      )
    );

    const existingDbKeys = new Set(
      (existingWinners || []).map((w) =>
        buildDbDedupKey(w.cpf, w.prize_type, w.prize_datetime, Number(w.value))
      ).filter(Boolean)
    );

    const result = validated.map((w) => {
      if (w.isInvalid) return w;
      // Check against the app-level composite key
      const key = buildDuplicateKey(w.name, w.cpf, w.phone, normalizePrizeType(w.prize_type), w.prize_datetime, w.value);
      if (existingKeys.has(key)) {
        return { ...w, isDuplicate: true };
      }
      // Also check against the DB unique index to prevent constraint violations
      const dbKey = buildDbDedupKey(w.cpf, normalizePrizeType(w.prize_type), w.prize_datetime, w.value);
      if (dbKey && existingDbKeys.has(dbKey)) {
        return { ...w, isDuplicate: true };
      }
      return w;
    });

    // Also check for duplicates within the batch itself (both app-level and DB-level)
    const seenKeys = new Set<string>();
    const seenDbKeys = new Set<string>();
    const afterDedupe = result.map((w) => {
      if (w.isInvalid || w.isDuplicate) return w;
      const key = buildDuplicateKey(w.name, w.cpf, w.phone, normalizePrizeType(w.prize_type), w.prize_datetime, w.value);
      const dbKey = buildDbDedupKey(w.cpf, normalizePrizeType(w.prize_type), w.prize_datetime, w.value);
      if (seenKeys.has(key) || (dbKey && seenDbKeys.has(dbKey))) {
        return { ...w, isDuplicate: true };
      }
      seenKeys.add(key);
      if (dbKey) seenDbKeys.add(dbKey);
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

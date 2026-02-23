import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { insertAuditLog } from '@/hooks/useAuditLogger';

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
}

interface ImportStats {
  totalFound: number;
  totalNew: number;
  totalDuplicates: number;
  totalInvalid: number;
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
        name: String(row.Nome || row.nome || row.NAME || '').trim(),
        cpf: normalizeCpf(String(row.CPF || row.cpf || row.Cpf || '')),
        phone: normalizePhone(String(row.Telefone || row.telefone || row.Phone || row.phone || row.TELEFONE || '')),
        value: normalizeValue(row.Valor || row.valor || row.Value || row.value || row.VALOR || 0),
        prize_datetime: row.Data || row.data || row['Data/Hora'] || row.date || null,
        prize_type: String(row['Tipo de Premiação'] || row['Tipo'] || row.tipo || row['Premio'] || row.prize_type || '').trim(),
        title: String(row['Título'] || row.titulo || row.title || '').trim() || undefined,
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

    // Check duplicates against DB
    const { data: existingWinners } = await supabase
      .from('winners')
      .select('cpf, prize_type, prize_datetime, value')
      .eq('action_id', actionId);

    const existingKeys = new Set(
      (existingWinners || [])
        .filter((w) => w.cpf && w.prize_datetime)
        .map((w) => `${w.prize_type}|${w.cpf}|${w.prize_datetime}|${w.value}`)
    );

    const result = validated.map((w) => {
      if (w.isInvalid) return w;
      if (w.cpf && w.prize_datetime) {
        const key = `${normalizePrizeType(w.prize_type)}|${w.cpf}|${w.prize_datetime}|${w.value}`;
        if (existingKeys.has(key)) {
          return { ...w, isDuplicate: true };
        }
      }
      return w;
    });

    // Also check for duplicates within the batch itself
    const seenKeys = new Set<string>();
    const finalResult = result.map((w) => {
      if (w.isInvalid || w.isDuplicate) return w;
      if (w.cpf && w.prize_datetime) {
        const key = `${normalizePrizeType(w.prize_type)}|${w.cpf}|${w.prize_datetime}|${w.value}`;
        if (seenKeys.has(key)) {
          return { ...w, isDuplicate: true };
        }
        seenKeys.add(key);
      }
      return w;
    });

    const stats: ImportStats = {
      totalFound: finalResult.length,
      totalNew: finalResult.filter((w) => !w.isDuplicate && !w.isInvalid).length,
      totalDuplicates: finalResult.filter((w) => w.isDuplicate).length,
      totalInvalid: finalResult.filter((w) => w.isInvalid).length,
    };

    return { winners: finalResult, stats };
  };

  const importWinners = async (
    winners: ParsedWinner[],
    fileType: string,
    fileName: string
  ) => {
    setIsLoading(true);
    try {
      const newWinners = winners.filter((w) => !w.isDuplicate && !w.isInvalid);

      if (newWinners.length === 0) {
        toast.info('Nenhum novo ganhador para importar.');
        return;
      }

      const rows = newWinners.map((w) => ({
        action_id: actionId,
        name: w.name,
        full_name: w.name,
        cpf: normalizeCpf(w.cpf),
        phone: normalizePhone(w.phone),
        value: w.value,
        prize_type: normalizePrizeType(w.prize_type) as any,
        prize_title: w.title || w.prize_type,
        prize_datetime: w.prize_datetime || null,
        status: 'imported' as const,
      }));

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

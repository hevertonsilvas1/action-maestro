import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText, FileSpreadsheet, Upload, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Users, ArrowRight, RefreshCcw,
} from 'lucide-react';
import { useImportWinners, ParsedWinner } from '@/hooks/useImportWinners';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

interface ImportWinnersModalProps {
  open: boolean;
  onClose: () => void;
  actionId: string;
  actionName: string;
}

type ImportStep = 'choose' | 'mapping' | 'preview' | 'done';

const EXPECTED_COLUMNS = [
  { key: 'name', label: 'Ganhador / Nome', required: true },
  { key: 'phone', label: 'Telefone', required: false },
  { key: 'title', label: 'Título', required: false },
  { key: 'prize_type', label: 'Status / Tipo de Premiação', required: true },
  { key: 'value', label: 'Prêmio / Valor', required: true },
  { key: 'prize_datetime', label: 'Associado em / Data', required: false },
  { key: 'cpf', label: 'CPF', required: false },
];

export function ImportWinnersModal({ open, onClose, actionId, actionName }: ImportWinnersModalProps) {
  const [tab, setTab] = useState<'pdf' | 'excel'>('pdf');
  const [step, setStep] = useState<ImportStep>('choose');
  const [parsedWinners, setParsedWinners] = useState<ParsedWinner[]>([]);
  const [stats, setStats] = useState<{ totalFound: number; totalNew: number; totalDuplicates: number; totalInvalid: number; totalOverLimit: number } | null>(null);
  const [fileName, setFileName] = useState('');
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawExcelRows, setRawExcelRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { parsePdf, parseExcel, checkDuplicatesAndValidate, importWinners, isLoading, isParsing } = useImportWinners(actionId, actionName);

  const reset = useCallback(() => {
    setStep('choose');
    setParsedWinners([]);
    setStats(null);
    setFileName('');
    setExcelColumns([]);
    setColumnMapping({});
    setRawExcelRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      if (tab === 'pdf') {
        const winners = await parsePdf(file);
        const result = await checkDuplicatesAndValidate(winners);
        setParsedWinners(result.winners);
        setStats(result.stats);
        setStep('preview');
      } else {
        const winners = await parseExcel(file);
        if (winners.length > 0) {
          // Check if auto-mapping worked
          const firstRow = winners[0];
          const hasName = firstRow.name && firstRow.name.length > 0;
          const hasValue = firstRow.value > 0;

          if (hasName && hasValue) {
            // Auto-mapped successfully, go to preview
            const result = await checkDuplicatesAndValidate(winners);
            setParsedWinners(result.winners);
            setStats(result.stats);
            setStep('preview');
          } else {
            // Need manual mapping — re-read raw rows and store in state
            const XLSX = await import('xlsx');
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (rawRows.length > 0) {
              setExcelColumns(Object.keys(rawRows[0]));
              setRawExcelRows(rawRows);
            }
            setParsedWinners(winners);
            setStep('mapping');
          }
        } else {
          setParsedWinners([]);
          setStats({ totalFound: 0, totalNew: 0, totalDuplicates: 0, totalInvalid: 0, totalOverLimit: 0 });
          setStep('preview');
        }
      }
    } catch (error: any) {
      console.error('Import error:', error);
      setParsedWinners([]);
      setStats({ totalFound: 0, totalNew: 0, totalDuplicates: 0, totalInvalid: 0, totalOverLimit: 0 });
      setStep('preview');
    }
  };

  const handleApplyMapping = async () => {
    if (rawExcelRows.length === 0) {
      toast.error('Dados da planilha não encontrados. Por favor, selecione o arquivo novamente.');
      reset();
      return;
    }

    try {
      const col = (key: string): string | undefined => {
        const v = columnMapping[key];
        return v && v !== '__none__' ? v : undefined;
      };

      const mapped: ParsedWinner[] = rawExcelRows.map((row) => ({
        name: String(col('name') ? row[col('name')!] : '').trim(),
        cpf: String(col('cpf') ? row[col('cpf')!] : '').trim() || null,
        phone: String(col('phone') ? row[col('phone')!] : '').trim() || null,
        value: col('value') ? row[col('value')!] : 0,
        prize_type: String(col('prize_type') ? row[col('prize_type')!] : '').trim(),
        title: col('title') ? String(row[col('title')!] || '').trim() : undefined,
        prize_datetime: col('prize_datetime') ? convertExcelDate(row[col('prize_datetime')!]) : null,
      }));

      const result = await checkDuplicatesAndValidate(mapped);
      setParsedWinners(result.winners);
      setStats(result.stats);
      setStep('preview');
    } catch (error: any) {
      console.error('Mapping error:', error);
      toast.error('Erro ao processar mapeamento: ' + (error?.message || 'Erro desconhecido'));
    }
  };

  const handleConfirmImport = async () => {
    try {
      await importWinners(parsedWinners, tab === 'pdf' ? 'pdf' : fileName.endsWith('.csv') ? 'csv' : 'xlsx', fileName);
      setStep('done');
    } catch (error: any) {
      console.error('Import failed:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar Ganhadores
          </DialogTitle>
        </DialogHeader>

        {step === 'choose' && (
          <div className="space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'pdf' | 'excel')}>
              <TabsList className="w-full">
                <TabsTrigger value="pdf" className="flex-1 text-xs">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Importar via PDF
                </TabsTrigger>
                <TabsTrigger value="excel" className="flex-1 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                  Importar via Excel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pdf" className="mt-4">
                <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-3 hover:border-primary/50 transition-colors">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-sm font-medium">Relatório acumulado em PDF</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O sistema usa IA para extrair os dados automaticamente.
                      <br />
                      Registros duplicados serão identificados e ignorados.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsing}
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando PDF com IA...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar PDF
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="excel" className="mt-4">
                <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-3 hover:border-primary/50 transition-colors">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-sm font-medium">Planilha Excel ou CSV</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Colunas esperadas: Nome, CPF, Telefone, Valor, Tipo de Premiação
                      <br />
                      Colunas opcionais: Título, Data
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsing}
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando planilha...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Arquivo
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span>Mapeie as colunas do arquivo para os campos do sistema:</span>
            </div>

            <div className="space-y-3">
              {EXPECTED_COLUMNS.map((col) => (
                <div key={col.key} className="flex items-center gap-3">
                  <span className="text-sm w-40 flex-shrink-0">
                    {col.label}
                    {col.required && <span className="text-destructive ml-0.5">*</span>}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={columnMapping[col.key] || ''}
                    onValueChange={(v) => setColumnMapping((prev) => ({ ...prev, [col.key]: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nenhuma —</SelectItem>
                      {excelColumns.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={reset}>Voltar</Button>
              <Button
                size="sm"
                onClick={handleApplyMapping}
                disabled={!columnMapping.name || !columnMapping.value || !columnMapping.prize_type}
              >
                Aplicar Mapeamento
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && stats && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Stats summary */}
            <div className={`grid gap-3 ${stats.totalOverLimit > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <div className="rounded-lg border p-3 text-center">
                <Users className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold">{stats.totalFound}</p>
                <p className="text-[10px] text-muted-foreground">Encontrados</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <CheckCircle2 className="h-4 w-4 text-success mx-auto mb-1" />
                <p className="text-lg font-bold text-success">{stats.totalNew}</p>
                <p className="text-[10px] text-muted-foreground">Novos</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <RefreshCcw className="h-4 w-4 text-warning mx-auto mb-1" />
                <p className="text-lg font-bold text-warning">{stats.totalDuplicates}</p>
                <p className="text-[10px] text-muted-foreground">Duplicados</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <XCircle className="h-4 w-4 text-destructive mx-auto mb-1" />
                <p className="text-lg font-bold text-destructive">{stats.totalInvalid}</p>
                <p className="text-[10px] text-muted-foreground">Inválidos</p>
              </div>
              {stats.totalOverLimit > 0 && (
                <div className="rounded-lg border border-destructive/30 p-3 text-center">
                  <AlertTriangle className="h-4 w-4 text-destructive mx-auto mb-1" />
                  <p className="text-lg font-bold text-destructive">{stats.totalOverLimit}</p>
                  <p className="text-[10px] text-muted-foreground">Excede Limite</p>
                </div>
              )}
            </div>

            {stats.totalNew > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Progress value={(stats.totalNew / stats.totalFound) * 100} className="h-1.5 flex-1" />
                <span>{((stats.totalNew / stats.totalFound) * 100).toFixed(0)}% novos</span>
              </div>
            )}

            {/* Winners table preview */}
            <ScrollArea className="flex-1 border rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Nome</th>
                    <th className="text-left px-3 py-2 font-medium">CPF</th>
                    <th className="text-right px-3 py-2 font-medium">Valor</th>
                    <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedWinners.map((w, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-1.5">
                        {w.isOverLimit ? (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Excede Limite</Badge>
                        ) : w.isDuplicate ? (
                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">Duplicado</Badge>
                        ) : w.isInvalid ? (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">{w.invalidReason}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Novo</Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5">{w.name}</td>
                      <td className="px-3 py-1.5 font-mono">{w.cpf ? w.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</td>
                      <td className="px-3 py-1.5 text-right">{formatCurrency(w.value)}</td>
                      <td className="px-3 py-1.5">{w.prize_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                disabled={isLoading || stats.totalNew === 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar Importação ({stats.totalNew} ganhadores)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <div>
              <p className="text-lg font-semibold">Importação concluída!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stats?.totalNew} ganhador(es) importado(s) com sucesso.
              </p>
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

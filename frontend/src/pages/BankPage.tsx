import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Calendar,
  Building2,
  CreditCard,
  Landmark,
  Filter,
  RotateCcw,
  Download,
  FileCheck,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Search,
  ChevronDown,
  CheckCircle2,
  X,
  History,
  Trash2,
  Clock,
  ArrowRight,
  Info,
  FileText,
  Eye,
  Loader2,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseBankCsv, BankParsedData, BankTransaction, normalizeBankAccountId } from '../lib/bankParser';
import { useTranslation } from '../store/languageStore';
import CustomSelect, { SelectOption } from '../components/ui/CustomSelect';
import DatePickerInput from '../components/ui/DatePickerInput';
import { bankApi } from '../lib/api';
import { uploadDocumentWithProgress, UploadedDocumentRef } from '../lib/documentUpload';
import DocumentViewer from '../components/cashbook/DocumentViewer';
import { exportCompanySummaryToPdf, exportAllTransactionsToPdf } from '../lib/pdfExport';

export interface CompanyInvoiceItem {
  path: string;
  originalName: string;
  mimeType: string;
  size?: number;
  uploadedAt?: string;
}

export interface CompanyInvoiceRecord {
  company: string;
  invoices: CompanyInvoiceItem[];
}

interface HistoryItem {
  _id: string;
  fileName: string;
  fileSize: number;
  accountName?: string;
  ownAccountNumber?: string;
  ownIban?: string;
  periodText?: string;
  totalRecords: number;
  createdAt: string;
}

export default function BankPage() {
  const { formatCurrency, formatDate, language } = useTranslation();

  const [bankData, setBankData] = useState<BankParsedData | null>(null);
  const [currentStatementId, setCurrentStatementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [, setIsSaving] = useState(false);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History Drawer / Modal
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Upload Popup Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalIsDragging, setModalIsDragging] = useState(false);

  // Filters
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [accountSearchText, setAccountSearchText] = useState<string>('');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting for All Transactions
  const [sortField, setSortField] = useState<'bookingDate' | 'company' | 'accountNumber' | 'amount'>('bookingDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Sorting for Company Summary
  const [companySortField, setCompanySortField] = useState<'company' | 'count' | 'totalAmount' | 'dates'>('totalAmount');
  const [companySortDirection, setCompanySortDirection] = useState<'asc' | 'desc'>('desc');

  // Company Invoices mapping: company -> array of uploaded invoice docs
  const [companyInvoicesMap, setCompanyInvoicesMap] = useState<Record<string, CompanyInvoiceItem[]>>({});
  const [uploadingCompany, setUploadingCompany] = useState<string | null>(null);
  const companyFileInputRef = useRef<HTMLInputElement>(null);
  const activeCompanyForUploadRef = useRef<string>('');

  // Invoice viewing modal
  const [viewingCompanyInvoices, setViewingCompanyInvoices] = useState<{ company: string; invoices: CompanyInvoiceItem[] } | null>(null);
  const [viewingDocEntry, setViewingDocEntry] = useState<any | null>(null);

  // Fetch the latest uploaded statement and cashbook entries on initial load
  useEffect(() => {
    // 1. Load latest uploaded bank statement
    setIsLoadingLatest(true);
    bankApi
      .getLatest()
      .then((res) => {
        if (res.data?.data) {
          const item = res.data.data;
          setBankData({
            metadata: item.metadata,
            transactions: item.transactions,
          });
          setCurrentStatementId(item.id);
          if (Array.isArray(item.companyInvoices)) {
            const map: Record<string, CompanyInvoiceItem[]> = {};
            item.companyInvoices.forEach((ci: CompanyInvoiceRecord) => {
              if (ci.company && Array.isArray(ci.invoices)) {
                map[ci.company.trim()] = ci.invoices;
              }
            });
            setCompanyInvoicesMap(map);
          }
        } else {
          // Fallback to local storage if offline
          try {
            const cached = localStorage.getItem('last_bank_statement_data');
            if (cached) {
              setBankData(JSON.parse(cached));
            }
            const cachedInvoices = localStorage.getItem('last_bank_company_invoices');
            if (cachedInvoices) {
              setCompanyInvoicesMap(JSON.parse(cachedInvoices));
            }
          } catch {}
        }
      })
      .catch(() => {
        // Fallback to local storage if API fails or backend offline
        try {
          const cached = localStorage.getItem('last_bank_statement_data');
          if (cached) {
            setBankData(JSON.parse(cached));
          }
          const cachedInvoices = localStorage.getItem('last_bank_company_invoices');
          if (cachedInvoices) {
            setCompanyInvoicesMap(JSON.parse(cachedInvoices));
          }
        } catch {}
      })
      .finally(() => setIsLoadingLatest(false));
  }, []);

  // Close account dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await bankApi.getHistory();
      if (res.data?.data) {
        setHistoryList(res.data.data);
      }
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Laden des Verlaufs.' : 'Failed to load history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const openHistoryModal = () => {
    setShowHistoryModal(true);
    loadHistory();
  };

  const handleSelectHistoryItem = async (id: string) => {
    try {
      toast.loading(language === 'de' ? 'Bankauszug wird geladen...' : 'Loading statement...', { id: 'load-stmt' });
      const res = await bankApi.getById(id);
      if (res.data?.data) {
        const item = res.data.data;
        setBankData({
          metadata: item.metadata,
          transactions: item.transactions,
        });
        setCurrentStatementId(item.id);
        if (Array.isArray(item.companyInvoices)) {
          const map: Record<string, CompanyInvoiceItem[]> = {};
          item.companyInvoices.forEach((ci: CompanyInvoiceRecord) => {
            if (ci.company && Array.isArray(ci.invoices)) {
              map[ci.company.trim()] = ci.invoices;
            }
          });
          setCompanyInvoicesMap(map);
        } else {
          setCompanyInvoicesMap({});
        }
        setShowHistoryModal(false);
        handleResetFilters();
        toast.success(language === 'de' ? 'Bankauszug erfolgreich geladen!' : 'Statement loaded!', { id: 'load-stmt' });
      }
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Laden der Datei.' : 'Failed to load file.', { id: 'load-stmt' });
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(language === 'de' ? 'Möchten Sie diesen Eintrag wirklich aus dem Verlauf löschen?' : 'Delete this history record?')) {
      return;
    }
    try {
      await bankApi.delete(id);
      setHistoryList((prev) => prev.filter((item) => item._id !== id));
      if (currentStatementId === id) {
        setCurrentStatementId(null);
      }
      toast.success(language === 'de' ? 'Eintrag gelöscht.' : 'Deleted successfully.');
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Löschen.' : 'Delete failed.');
    }
  };

  const readFileWithEncoding = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      return utf8Decoder.decode(buffer);
    } catch {
      const latinDecoder = new TextDecoder('iso-8859-1');
      return latinDecoder.decode(buffer);
    }
  };

  const handleFilesProcess = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    const csvFiles = rawFiles.filter(
      (f) => f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv'
    );

    if (csvFiles.length === 0) {
      toast.error(
        language === 'de'
          ? 'Bitte laden Sie eine oder mehrere gültige CSV-Dateien hoch.'
          : 'Please upload valid CSV file(s).'
      );
      return;
    }

    let filesToProcess = csvFiles;
    if (csvFiles.length > 5) {
      toast(
        language === 'de'
          ? 'Maximal 5 CSV-Dateien können gleichzeitig hochgeladen werden. Die ersten 5 Dateien werden verarbeitet.'
          : 'Maximum 5 CSV files allowed at once. Processing first 5 files.',
        { icon: '⚠️' }
      );
      filesToProcess = csvFiles.slice(0, 5);
    }

    const toastId = toast.loading(
      language === 'de'
        ? `Lese ${filesToProcess.length} Bank-CSV-Datei(en) ein...`
        : `Reading ${filesToProcess.length} bank CSV file(s)...`
    );

    try {
      const parsedResults: BankParsedData[] = [];
      for (const file of filesToProcess) {
        const text = await readFileWithEncoding(file);
        const parsed = parseBankCsv(text, file.name, file.size);
        parsedResults.push(parsed);
      }

      // Merge statements into single consolidated dataset
      const allTransactions: BankTransaction[] = [];
      const accountNames = new Set<string>();
      const ownAccountNumbers = new Set<string>();
      const ownIbans = new Set<string>();
      let totalSize = 0;

      parsedResults.forEach((res, fileIdx) => {
        totalSize += res.metadata.fileSize || 0;
        if (res.metadata.accountName) accountNames.add(res.metadata.accountName);
        if (res.metadata.ownAccountNumber) ownAccountNumbers.add(res.metadata.ownAccountNumber);
        if (res.metadata.ownIban) ownIbans.add(res.metadata.ownIban);

        res.transactions.forEach((tx, txIdx) => {
          allTransactions.push({
            ...tx,
            id: tx.id || `tx-${fileIdx}-${txIdx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          });
        });
      });

      // Sort merged transactions chronologically descending
      allTransactions.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));

      const earliestDate = allTransactions.length > 0 ? allTransactions[allTransactions.length - 1].bookingDate : '';
      const latestDate = allTransactions.length > 0 ? allTransactions[0].bookingDate : '';

      const mergedData: BankParsedData = {
        metadata: {
          fileName:
            filesToProcess.length === 1
              ? filesToProcess[0].name
              : `${filesToProcess.length} ${language === 'de' ? 'Dateien' : 'Files'} (${filesToProcess.map((f) => f.name).join(', ')})`,
          fileSize: totalSize,
          uploadedAt: new Date().toISOString(),
          accountName: Array.from(accountNames).join(' / ') || undefined,
          ownAccountNumber: Array.from(ownAccountNumbers).join(', ') || undefined,
          ownIban: Array.from(ownIbans).join(', ') || undefined,
          periodText:
            earliestDate && latestDate
              ? `${formatDate(earliestDate)} - ${formatDate(latestDate)}`
              : undefined,
          totalRecords: allTransactions.length,
          currency: 'EUR',
        },
        transactions: allTransactions,
      };

      setBankData(mergedData);

      try {
        localStorage.setItem('last_bank_statement_data', JSON.stringify(mergedData));
      } catch {}

      setSelectedBankAccount('ALL');
      setFromDate('');
      setToDate('');
      setSelectedCompany('ALL');
      setAccountSearchText('');
      setSearchQuery('');
      setShowUploadModal(false);

      setIsSaving(true);
      try {
        const saveRes = await bankApi.save(mergedData);
        if (saveRes.data?.data?.id) {
          setCurrentStatementId(saveRes.data.data.id);
        }
      } catch (err) {
        console.error('Failed to save statement to backend history:', err);
      } finally {
        setIsSaving(false);
      }

      toast.success(
        language === 'de'
          ? `${filesToProcess.length} CSV-Datei(en) erfolgreich eingelesen! ${allTransactions.length} Buchungen geladen.`
          : `${filesToProcess.length} CSV file(s) parsed & saved! ${allTransactions.length} transactions loaded.`,
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Parsen der Bank-CSV-Dateien.', { id: toastId });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesProcess(e.dataTransfer.files);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesProcess(e.target.files);
    }
  };

  // ─── Company Invoices Management ──────────────────────────────────────────
  const handleOpenUploadForCompany = (companyName: string) => {
    activeCompanyForUploadRef.current = companyName;
    if (companyFileInputRef.current) {
      companyFileInputRef.current.value = '';
      companyFileInputRef.current.click();
    }
  };

  const handleCompanyFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const company = activeCompanyForUploadRef.current;
    if (!files || files.length === 0 || !company) return;

    setUploadingCompany(company);
    const toastId = toast.loading(
      language === 'de'
        ? `Lade ${files.length} Belege für "${company}" hoch...`
        : `Uploading ${files.length} invoice(s) for "${company}"...`
    );

    try {
      const uploadedDocs: CompanyInvoiceItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res: UploadedDocumentRef = await uploadDocumentWithProgress(file);
        uploadedDocs.push({
          path: res.path,
          originalName: res.originalName || file.name,
          mimeType: res.mimeType || file.type || 'application/pdf',
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }

      // Append to existing company invoices
      const currentList = companyInvoicesMap[company] || [];
      const updatedList = [...currentList, ...uploadedDocs];

      const newMap = {
        ...companyInvoicesMap,
        [company]: updatedList,
      };
      setCompanyInvoicesMap(newMap);

      // Save to local storage
      try {
        localStorage.setItem('last_bank_company_invoices', JSON.stringify(newMap));
      } catch {}

      // Persist to backend
      await bankApi.saveCompanyInvoices({
        statementId: currentStatementId || undefined,
        company,
        invoices: updatedList,
      });

      toast.success(
        language === 'de'
          ? `${uploadedDocs.length} Beleg(e) für "${company}" gespeichert!`
          : `${uploadedDocs.length} invoice(s) for "${company}" saved!`,
        { id: toastId }
      );
    } catch (err: any) {
      toast.error(
        language === 'de'
          ? `Fehler beim Hochladen der Belege: ${err.message || 'Serverfehler'}`
          : `Failed to upload invoices: ${err.message || 'Server error'}`,
        { id: toastId }
      );
    } finally {
      setUploadingCompany(null);
      if (companyFileInputRef.current) {
        companyFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveCompanyInvoice = async (company: string, invoicePath: string) => {
    if (!confirm(language === 'de' ? 'Möchten Sie diesen Beleg wirklich entfernen?' : 'Remove this invoice?')) {
      return;
    }

    const currentList = companyInvoicesMap[company] || [];
    const updatedList = currentList.filter((inv) => inv.path !== invoicePath);

    const newMap = {
      ...companyInvoicesMap,
      [company]: updatedList,
    };
    setCompanyInvoicesMap(newMap);

    try {
      localStorage.setItem('last_bank_company_invoices', JSON.stringify(newMap));
    } catch {}

    try {
      await bankApi.saveCompanyInvoices({
        statementId: currentStatementId || undefined,
        company,
        invoices: updatedList,
      });
      if (viewingCompanyInvoices && viewingCompanyInvoices.company === company) {
        setViewingCompanyInvoices({
          company,
          invoices: updatedList,
        });
      }
      toast.success(language === 'de' ? 'Beleg entfernt.' : 'Invoice removed.');
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Aktualisieren.' : 'Update failed.');
    }
  };

  const handleOpenDocumentViewer = (doc: CompanyInvoiceItem, company: string) => {
    // Construct fake entry compatible with DocumentViewer
    setViewingDocEntry({
      _id: doc.path,
      voucherNo: company,
      bookingText: company,
      documents: [
        {
          path: doc.path,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
        },
      ],
    });
  };

  // Extracted list of individual file names for clean display
  const statementFilesList = useMemo(() => {
    if (!bankData?.metadata.fileName) return [];
    const raw = bankData.metadata.fileName;
    const match = raw.match(/^\d+\s+(?:Files|Dateien)\s*\((.+)\)$/i);
    if (match) {
      return match[1].split(',').map((s) => s.trim()).filter(Boolean);
    }
    const fromTx = Array.from(
      new Set(bankData.transactions.map((t) => t.sourceFileName).filter(Boolean))
    ) as string[];
    if (fromTx.length > 1) {
      return fromTx;
    }
    return [raw];
  }, [bankData]);

  // Structured breakdown of bank accounts
  const statementAccountsBreakdown = useMemo(() => {
    if (!bankData) return [];

    const knownAccounts: Record<string, { iban: string }> = {
      '350_1292218_00': {
        iban: 'DE76440700240129221800',
      },
      '350_1292218_01': {
        iban: 'DE49440700240129221801',
      },
    };

    const accMap = new Map<string, { id: string; iban?: string; count: number }>();

    bankData.transactions.forEach((tx) => {
      const accId =
        tx.ownAccountNumber ||
        normalizeBankAccountId(
          bankData.metadata?.ownAccountNumber,
          tx.sourceFileName || bankData.metadata?.fileName,
          bankData.metadata?.ownIban
        ) ||
        bankData.metadata?.ownAccountNumber ||
        'Konto';

      let item = accMap.get(accId);
      if (!item) {
        const known = knownAccounts[accId];
        item = {
          id: accId,
          iban: known?.iban || bankData.metadata.ownIban,
          count: 0,
        };
        accMap.set(accId, item);
      }
      item.count += 1;
    });

    if (accMap.size <= 1 && bankData.metadata.ownAccountNumber?.includes(',')) {
      const parts = bankData.metadata.ownAccountNumber.split(',').map((p) => p.trim());
      const ibans = (bankData.metadata.ownIban || '').split(',').map((p) => p.trim());

      const res: { id: string; iban?: string; count?: number }[] = [];
      parts.forEach((accId, idx) => {
        const known = knownAccounts[accId];
        res.push({
          id: accId,
          iban: known?.iban || (ibans[idx] || ibans[0]),
          count: bankData.transactions.filter((t) => t.ownAccountNumber === accId).length,
        });
      });
      return res;
    }

    return Array.from(accMap.values());
  }, [bankData]);

  // Clean title for statement banner
  const statementTitle = useMemo(() => {
    if (!bankData) return '';
    if (statementFilesList.length > 1) {
      return language === 'de'
        ? `${statementFilesList.length} Bankauszüge konsolidiert`
        : `${statementFilesList.length} Bank Statements Consolidated`;
    }
    return statementFilesList[0] || bankData.metadata.fileName;
  }, [bankData, statementFilesList, language]);

  // Dynamic list of companies from CSV
  const companyOptions: SelectOption[] = useMemo(() => {
    if (!bankData) return [{ value: 'ALL', label: language === 'de' ? 'Alle Unternehmen' : 'All Companies' }];

    const comps = Array.from(
      new Set(bankData.transactions.map((tx) => tx.company.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return [
      { value: 'ALL', label: language === 'de' ? 'Alle Unternehmen' : 'All Companies' },
      ...comps.map((c) => ({ value: c, label: c })),
    ];
  }, [bankData, language]);

  // Dynamic list of unique account numbers from CSV
  const allAccounts: string[] = useMemo(() => {
    if (!bankData) return [];
    return Array.from(
      new Set(bankData.transactions.map((tx) => tx.accountNumber.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [bankData]);

  // Filtered accounts matching user's typed search in the account dropdown
  const matchedAccounts = useMemo(() => {
    if (!accountSearchText) return allAccounts;
    const q = accountSearchText.toLowerCase();
    return allAccounts.filter((acc) => acc.toLowerCase().includes(q));
  }, [allAccounts, accountSearchText]);

  // Filtered transactions based on bank account, date, company, account search, and general search
  const filteredTransactions = useMemo(() => {
    if (!bankData) return [];

    return bankData.transactions.filter((tx) => {
      // Filter by selected bank account (350_1292218_00, 350_1292218_01, or ALL)
      if (selectedBankAccount !== 'ALL') {
        const txAccount =
          tx.ownAccountNumber ||
          normalizeBankAccountId(
            bankData.metadata?.ownAccountNumber,
            tx.sourceFileName || bankData.metadata?.fileName,
            bankData.metadata?.ownIban
          );
        if (txAccount !== selectedBankAccount) return false;
      }

      if (fromDate && tx.bookingDate < fromDate) return false;
      if (toDate && tx.bookingDate > toDate) return false;
      if (selectedCompany !== 'ALL' && tx.company !== selectedCompany) return false;
      if (accountSearchText.trim()) {
        const accFilter = accountSearchText.trim().toLowerCase();
        if (!tx.accountNumber.toLowerCase().includes(accFilter)) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inComp = tx.company.toLowerCase().includes(q);
        const inAcc = tx.accountNumber.toLowerCase().includes(q);
        const inPurpose = tx.purpose?.toLowerCase().includes(q);
        const inType = tx.transactionType?.toLowerCase().includes(q);
        const inInvs = tx.extractedInvoices?.some((inv) => inv.toLowerCase().includes(q));
        const inOwnAcc = tx.ownAccountNumber?.toLowerCase().includes(q);
        if (!inComp && !inAcc && !inPurpose && !inType && !inInvs && !inOwnAcc) return false;
      }
      return true;
    });
  }, [bankData, selectedBankAccount, fromDate, toDate, selectedCompany, accountSearchText, searchQuery]);

  // Grouped by Company & Account Summary with Dates
  const companySummary = useMemo(() => {
    const map = new Map<
      string,
      {
        company: string;
        accountNumber: string;
        ownAccountNumber?: string;
        accountNumbers: Set<string>;
        count: number;
        totalAmount: number;
        dates: Set<string>;
        rawDates: Set<string>;
        earliestDate: string;
        latestDate: string;
      }
    >();

    filteredTransactions.forEach((tx) => {
      const acc = (tx.accountNumber || '-').trim();
      const ownAcc = (
        tx.ownAccountNumber ||
        normalizeBankAccountId(
          bankData?.metadata?.ownAccountNumber,
          tx.sourceFileName || bankData?.metadata?.fileName,
          bankData?.metadata?.ownIban
        ) ||
        ''
      ).trim();

      // Group key includes company, account number/IBAN, and bank account
      // When a company has multiple accounts, they appear as separate records
      const groupKey = `${tx.company.trim()}___${acc}___${ownAcc}`;

      let existing = map.get(groupKey);
      if (!existing) {
        existing = {
          company: tx.company,
          accountNumber: acc,
          ownAccountNumber: ownAcc || undefined,
          accountNumbers: new Set<string>(acc && acc !== '-' ? [acc] : []),
          count: 0,
          totalAmount: 0,
          dates: new Set<string>(),
          rawDates: new Set<string>(),
          earliestDate: tx.bookingDate,
          latestDate: tx.bookingDate,
        };
        map.set(groupKey, existing);
      }

      existing.count += 1;
      existing.totalAmount += tx.amount;
      if (acc && acc !== '-') {
        existing.accountNumbers.add(acc);
      }
      existing.dates.add(tx.bookingDate);
      if (tx.rawDate) {
        existing.rawDates.add(tx.rawDate);
      }
      if (tx.bookingDate < existing.earliestDate) {
        existing.earliestDate = tx.bookingDate;
      }
      if (tx.bookingDate > existing.latestDate) {
        existing.latestDate = tx.bookingDate;
      }
    });

    const list = Array.from(map.values());

    // Sort company summary: primary by selected field, secondary so same companies stay together
    list.sort((a, b) => {
      let cmp = 0;
      if (companySortField === 'company') {
        cmp = a.company.localeCompare(b.company, undefined, { sensitivity: 'base' });
        if (cmp === 0) {
          cmp = (a.accountNumber || '').localeCompare(b.accountNumber || '');
        }
      } else if (companySortField === 'count') {
        cmp = a.count - b.count;
      } else if (companySortField === 'totalAmount') {
        cmp = Math.abs(a.totalAmount) - Math.abs(b.totalAmount);
      } else if (companySortField === 'dates') {
        cmp = a.latestDate.localeCompare(b.latestDate);
      }
      return companySortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [filteredTransactions, bankData, companySortField, companySortDirection]);

  // Set of company names that appear multiple times (i.e. having 2 or more distinct accounts)
  const multiAccountCompanies = useMemo(() => {
    const counts = new Map<string, number>();
    companySummary.forEach((item) => {
      counts.set(item.company, (counts.get(item.company) || 0) + 1);
    });
    const set = new Set<string>();
    counts.forEach((count, comp) => {
      if (count > 1) {
        set.add(comp);
      }
    });
    return set;
  }, [companySummary]);

  // Sorted transactions for the All Transactions section
  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'bookingDate') {
        cmp = a.bookingDate.localeCompare(b.bookingDate);
      } else if (sortField === 'company') {
        cmp = a.company.localeCompare(b.company);
      } else if (sortField === 'accountNumber') {
        cmp = a.accountNumber.localeCompare(b.accountNumber);
      } else if (sortField === 'amount') {
        cmp = a.amount - b.amount;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredTransactions, sortField, sortDirection]);

  // Calculations for summary metrics
  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  }, [filteredTransactions]);

  const totalIncome = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.amount > 0).reduce((acc, tx) => acc + tx.amount, 0);
  }, [filteredTransactions]);

  const totalExpense = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.amount < 0).reduce((acc, tx) => acc + tx.amount, 0);
  }, [filteredTransactions]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCompanySort = (field: typeof companySortField) => {
    if (companySortField === field) {
      setCompanySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCompanySortField(field);
      setCompanySortDirection('asc');
    }
  };

  const handleResetFilters = () => {
    setSelectedBankAccount('ALL');
    setFromDate('');
    setToDate('');
    setSelectedCompany('ALL');
    setAccountSearchText('');
    setSearchQuery('');
  };

  const formatDisplayFileName = (name?: string, lang: 'de' | 'en' = 'de'): string => {
    if (!name) return '';
    if (lang === 'en') {
      return name
        .replace(/(\d+)\s+Dateien\b/gi, '$1 Files')
        .replace(/1\s+Datei\b/gi, '1 File');
    } else {
      return name
        .replace(/(\d+)\s+Files\b/gi, '$1 Dateien')
        .replace(/1\s+File\b/gi, '1 Datei');
    }
  };

  const formatDisplayAccountName = (name?: string, lang: 'de' | 'en' = 'de'): string => {
    if (!name) return '';
    const cleaned = name
      .replace(/Business\s*Premium(?:Konto|\s+Account)?/gi, '')
      .replace(/Best(?:Konto|\s+Account)?/gi, '')
      .replace(/^[\s/–—-]+|[\s/–—-]+$/g, '')
      .trim();
    if (!cleaned) return '';
    if (lang === 'en') {
      return cleaned
        .replace(/PremiumKonto/gi, 'Premium Account')
        .replace(/\bKonto\b/gi, 'Account');
    }
    return cleaned;
  };

  const formatDisplayPeriodText = (text?: string, lang: 'de' | 'en' = 'de'): string => {
    if (!text) return '';
    if (lang === 'en') {
      return text
        .replace(/(\d+)\s+Daten\b/gi, '$1 dates')
        .replace(/Letzter Kontostand/gi, 'Last Balance');
    } else {
      return text
        .replace(/(\d+)\s+dates\b/gi, '$1 Daten')
        .replace(/Last Balance/gi, 'Letzter Kontostand');
    }
  };

  const handleExportCompanySummaryPdf = () => {
    if (companySummary.length === 0) return;
    try {
      const items = companySummary.map((item) => {
        const rawDatesArr = Array.from(item.rawDates);
        let dateDisplay = '';
        if (rawDatesArr.length === 1) {
          dateDisplay = rawDatesArr[0];
        } else if (rawDatesArr.length <= 3) {
          dateDisplay = rawDatesArr.join(', ');
        } else {
          dateDisplay = `${formatDate(item.earliestDate)} - ${formatDate(item.latestDate)} (${rawDatesArr.length} Daten)`;
        }

        const ownAcc =
          item.ownAccountNumber ||
          normalizeBankAccountId(
            bankData?.metadata?.ownAccountNumber,
            bankData?.metadata?.fileName,
            bankData?.metadata?.ownIban
          ) ||
          undefined;

        return {
          company: item.company,
          ownAccountNumber: ownAcc,
          accountNumber: item.accountNumber,
          periodText: dateDisplay,
          count: item.count,
          totalAmount: item.totalAmount,
          currency: 'EUR',
          isMultiAccount: multiAccountCompanies.has(item.company),
        };
      });

      exportCompanySummaryToPdf(
        items,
        {
          ownAccountNumber: selectedBankAccount !== 'ALL' ? selectedBankAccount : bankData?.metadata?.ownAccountNumber,
          accountName: bankData?.metadata?.accountName,
          periodText: bankData?.metadata?.periodText,
          language,
        }
      );
      toast.success(
        language === 'de'
          ? 'Zusammenfassung als PDF erfolgreich heruntergeladen!'
          : 'Company summary PDF downloaded successfully!'
      );
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error(language === 'de' ? 'Fehler beim PDF-Export' : 'Failed to export PDF');
    }
  };

  const handleExportTransactionsPdf = () => {
    if (sortedTransactions.length === 0) return;
    try {
      const items = sortedTransactions.map((tx) => {
        const ownAcc =
          tx.ownAccountNumber ||
          normalizeBankAccountId(
            bankData?.metadata?.ownAccountNumber,
            bankData?.metadata?.fileName,
            bankData?.metadata?.ownIban
          ) ||
          undefined;

        return {
          bookingDate: tx.bookingDate,
          rawDate: tx.rawDate,
          ownAccountNumber: ownAcc,
          company: tx.company,
          accountNumber: tx.accountNumber,
          transactionType: tx.transactionType || '',
          purpose: tx.purpose,
          amount: tx.amount,
          currency: tx.currency || 'EUR',
        };
      });

      exportAllTransactionsToPdf(
        items,
        {
          ownAccountNumber: selectedBankAccount !== 'ALL' ? selectedBankAccount : bankData?.metadata?.ownAccountNumber,
          accountName: bankData?.metadata?.accountName,
          periodText: bankData?.metadata?.periodText,
          language,
        }
      );
      toast.success(
        language === 'de'
          ? 'Alle Buchungen als PDF erfolgreich heruntergeladen!'
          : 'All transactions PDF downloaded successfully!'
      );
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast.error(language === 'de' ? 'Fehler beim PDF-Export' : 'Failed to export PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-brand">
              <CreditCard size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {language === 'de' ? 'Bankauszug & Kontoübersicht' : 'Bank Statement & Summary'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {language === 'de'
                  ? 'CSV-Dateien hochladen, dauerhaft gespeicherte Zusammenfassungen & Verlaufsansicht'
                  : 'Upload CSV files, persistent company summaries, and upload history'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* History Button */}
          <button
            onClick={openHistoryModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition-all shadow-2xs"
          >
            <History size={15} className="text-brand-600" />
            <span>{language === 'de' ? 'Verlauf (History)' : 'Upload History'}</span>
          </button>

          {bankData && (
            <>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 rounded-xl transition-all shadow-2xs"
              >
                <UploadCloud size={15} />
                <span>{language === 'de' ? 'Neue CSV laden' : 'Upload New CSV'}</span>
              </button>
              <button
                onClick={handleExportTransactionsPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-all shadow-2xs"
                title={language === 'de' ? 'Als PDF-Dokument herunterladen' : 'Download as PDF document'}
              >
                <FileText size={14} className="text-rose-600" />
                <span>{language === 'de' ? 'PDF Exportieren' : 'Export PDF'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hidden File Input for Statement CSV (supports up to 5 CSVs) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelect}
        accept=".csv,text/csv"
        multiple
        className="hidden"
      />

      {/* Hidden File Input for Company Invoices (supports multiple files) */}
      <input
        type="file"
        ref={companyFileInputRef}
        onChange={handleCompanyFilesSelected}
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
        multiple
        className="hidden"
      />

      {/* Loading State on initial fetch */}
      {isLoadingLatest && !bankData ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-3" />
          <p className="text-xs font-semibold text-slate-500">
            {language === 'de' ? 'Letzten Bankauszug abrufen...' : 'Retrieving latest bank statement...'}
          </p>
        </div>
      ) : !bankData ? (
        /* Upload Dropzone if no data is saved yet */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 sm:p-14 text-center bg-white ${
            isDragging
              ? 'border-brand-500 bg-brand-50/50 scale-[0.99]'
              : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50/50'
          }`}
        >
          <div className="max-w-md mx-auto flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shadow-sm">
              <UploadCloud size={32} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {language === 'de' ? 'Bank-CSV-Dateien hier ablegen (bis zu 5 Dateien)' : 'Drop your Bank CSV files here (up to 5 files)'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {language === 'de'
                  ? 'Klicken oder bis zu 5 CSV-Dateien per Drag & Drop hineinziehen (z.B. für Konto 350_1292218_00 und 350_1292218_01). Werden automatisch zusammengeführt!'
                  : 'Click to browse or drop up to 5 CSV files (e.g. for accounts 350_1292218_00 & 350_1292218_01). Automatically merged!'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60">
              <FileSpreadsheet size={14} />
              <span>{language === 'de' ? 'Unterstützt bis zu 5 Bankumsatz-CSVs (.csv)' : 'Supports up to 5 bank statement CSVs (.csv)'}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Metadata Banner - Executive Redesign */
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* Left: Icon, Clean Title, and Badges */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/20">
                <FileCheck size={24} className="stroke-[2.2]" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {statementTitle}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      {bankData.metadata.totalRecords} {language === 'de' ? 'Buchungen' : 'Transactions'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-emerald-500" />
                      {language === 'de' ? 'Gespeichert' : 'Saved'}
                    </span>
                    {statementAccountsBreakdown.length > 1 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                        {statementAccountsBreakdown.length} {language === 'de' ? 'Konten' : 'Accounts'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Period Display */}
                {bankData.metadata.periodText && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium">
                    <Calendar size={13} className="text-slate-400" />
                    <span className="text-slate-400">{language === 'de' ? 'Zeitraum:' : 'Period:'}</span>
                    <span className="font-semibold text-slate-700">
                      {formatDisplayPeriodText(bankData.metadata.periodText, language)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Upload Button */}
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 rounded-xl transition-all shadow-2xs hover:shadow-xs"
              >
                <UploadCloud size={14} className="stroke-[2.5]" />
                <span>{language === 'de' ? 'Weitere CSV laden' : 'Upload Another File'}</span>
              </button>
            </div>
          </div>

          {/* Bottom Detail Section: Horizontal Inline Layout for Accounts and Files */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {/* Accounts Section (Inline) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 shrink-0 mr-1">
                <Landmark size={12} className="text-brand-600" />
                {language === 'de' ? 'Bankkonten:' : 'Bank Accounts:'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {statementAccountsBreakdown.map((acc, i) => (
                  <div
                    key={acc.id || i}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50/90 border border-slate-200/90 text-xs shadow-2xs hover:bg-slate-100/60 transition-colors"
                  >
                    <span className="font-mono font-bold text-brand-700 bg-brand-100/80 px-2 py-0.5 rounded-lg text-xs">
                      {acc.id}
                    </span>
                    {acc.iban && (
                      <span className="font-mono text-slate-500 text-[11px]">
                        IBAN: <span className="font-semibold text-slate-700">{acc.iban}</span>
                      </span>
                    )}
                    {acc.count !== undefined && acc.count > 0 && (
                      <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs ml-1 shrink-0">
                        {acc.count} {language === 'de' ? 'Umsätze' : 'transactions'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Uploaded Files Section */}
            {statementFilesList.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileSpreadsheet size={12} className="text-emerald-600" />
                  {language === 'de' ? 'Eingelesene Dateien:' : 'Uploaded Files:'}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {statementFilesList.map((fileName, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50/90 border border-slate-200/90 text-slate-700 font-mono text-[11px] shadow-2xs hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="p-0.5 rounded bg-white border border-slate-200 text-brand-600 shrink-0">
                        <FileText size={12} />
                      </div>
                      <span className="font-semibold text-slate-800 select-all">{fileName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area after File is Loaded / Available */}
      {bankData && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Balance / Net */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'de' ? 'Saldo (Gefiltert)' : 'Net Amount (Filtered)'}
                </span>
                <div className={`p-2 rounded-xl ${totalAmount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {totalAmount >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </div>
              </div>
              <div className={`text-xl font-extrabold ${totalAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totalAmount >= 0 ? '+' : ''}{formatCurrency(totalAmount)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {filteredTransactions.length} {language === 'de' ? 'Umsätze berücksichtigt' : 'transactions included'}
              </p>
            </div>

            {/* Income Sum */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'de' ? 'Gutschriften (Haben)' : 'Total Inflows'}
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="text-xl font-extrabold text-emerald-600">
                +{formatCurrency(totalIncome)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {filteredTransactions.filter((tx) => tx.amount > 0).length} {language === 'de' ? 'Eingänge' : 'inflows'}
              </p>
            </div>

            {/* Expense Sum */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'de' ? 'Belastungen (Soll)' : 'Total Outflows'}
                </span>
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <TrendingDown size={16} />
                </div>
              </div>
              <div className="text-xl font-extrabold text-rose-600">
                {formatCurrency(totalExpense)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {filteredTransactions.filter((tx) => tx.amount < 0).length} {language === 'de' ? 'Ausgänge' : 'outflows'}
              </p>
            </div>

            {/* Distinct Companies */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'de' ? 'Unternehmen' : 'Companies'}
                </span>
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                  <Building2 size={16} />
                </div>
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {companySummary.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {language === 'de' ? 'Verschiedene Partner/Firmen' : 'Distinct counterparties'}
              </p>
            </div>
          </div>

          {/* Interactive Filtration Controls Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-brand-600" />
                <span className="font-bold text-slate-900 text-sm">
                  {language === 'de' ? 'Filter & Suche' : 'Filters & Search'}
                </span>
              </div>

              {(selectedBankAccount !== 'ALL' || fromDate || toDate || selectedCompany !== 'ALL' || accountSearchText || searchQuery) && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <RotateCcw size={12} />
                  <span>{language === 'de' ? 'Filter zurücksetzen' : 'Reset Filters'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Bank Account Dropdown with 3 options: All Accounts, 350_1292218_00, 350_1292218_01 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Landmark size={13} className="text-slate-400" />
                  <span>{language === 'de' ? 'Bankkonto' : 'Bank Account'}</span>
                </label>
                <CustomSelect
                  value={selectedBankAccount}
                  onChange={(val) => setSelectedBankAccount(val)}
                  options={[
                    { value: 'ALL', label: language === 'de' ? 'Alle Konten' : 'All Accounts' },
                    { value: '350_1292218_00', label: '350_1292218_00' },
                    { value: '350_1292218_01', label: '350_1292218_01' },
                  ]}
                  className="w-full"
                  buttonClassName="text-xs bg-slate-50 border-slate-200 font-semibold"
                />
              </div>

              {/* From Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{language === 'de' ? 'Von Datum (From Date)' : 'From Date'}</span>
                </label>
                <DatePickerInput
                  value={fromDate}
                  onChange={(val) => setFromDate(val)}
                  placeholder={language === 'de' ? 'TT.MM.JJJJ' : 'DD.MM.YYYY'}
                  max={toDate || undefined}
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{language === 'de' ? 'Bis Datum (To Date)' : 'To Date'}</span>
                </label>
                <DatePickerInput
                  value={toDate}
                  onChange={(val) => setToDate(val)}
                  placeholder={language === 'de' ? 'TT.MM.JJJJ' : 'DD.MM.YYYY'}
                  min={fromDate || undefined}
                />
              </div>

              {/* Company Dropdown (Extracted dynamically) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 size={13} className="text-slate-400" />
                  <span>{language === 'de' ? 'Unternehmen (Company Dropdown)' : 'Company'}</span>
                </label>
                <CustomSelect
                  value={selectedCompany}
                  onChange={(val) => setSelectedCompany(val)}
                  options={companyOptions}
                  className="w-full"
                  buttonClassName="text-xs bg-slate-50 border-slate-200 font-semibold"
                />
              </div>

              {/* Account Number Filter with Typing + Dropdown Matches */}
              <div className="relative" ref={accountDropdownRef}>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-slate-400" />
                  <span>{language === 'de' ? 'Kontonummer / IBAN (Eingabe & Auswahl)' : 'Account Number / IBAN'}</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={language === 'de' ? 'Nummer eingeben oder wählen...' : 'Type or select account...'}
                    value={accountSearchText}
                    onFocus={() => setAccountDropdownOpen(true)}
                    onChange={(e) => {
                      setAccountSearchText(e.target.value);
                      setAccountDropdownOpen(true);
                    }}
                    className="w-full text-xs font-mono font-semibold px-3 py-2 pr-7 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-800"
                  />
                  {accountSearchText ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAccountSearchText('');
                        setAccountDropdownOpen(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAccountDropdownOpen((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <ChevronDown size={13} />
                    </button>
                  )}
                </div>

                {/* Dropdown with matching account numbers based on what user types */}
                {accountDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1">
                    <div
                      onClick={() => {
                        setAccountSearchText('');
                        setAccountDropdownOpen(false);
                      }}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer font-sans font-medium"
                    >
                      {language === 'de' ? '— Alle Konten —' : '— All Accounts —'}
                    </div>
                    {matchedAccounts.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400 italic">
                        {language === 'de' ? 'Kein passendes Konto gefunden' : 'No matching account found'}
                      </div>
                    ) : (
                      matchedAccounts.map((acc) => (
                        <div
                          key={acc}
                          onClick={() => {
                            setAccountSearchText(acc);
                            setAccountDropdownOpen(false);
                          }}
                          className={`px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors ${
                            accountSearchText === acc
                              ? 'bg-brand-50 text-brand-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {acc}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* General Search Input Filter */}
            <div className="pt-1">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    language === 'de'
                      ? 'In Buchungstext, Verwendungszweck, Rechnungsnummer, Firma oder IBAN suchen...'
                      : 'Search in booking text, purpose, invoice number, company or IBAN...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-800"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* 1. SUMMARY BY COMPANY SECTION (PLACED BEFORE ALL TRANSACTIONS)        */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {language === 'de' ? 'Zusammenfassung nach Unternehmen' : 'Summary by Company'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {language === 'de'
                      ? 'Übersicht aller Firmen inklusive Datumsbereich, Buchungsanzahl und Beträgen'
                      : 'Overview of all companies including dates, transaction count, and amounts'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-800">
                  {companySummary.length} {language === 'de' ? (companySummary.length === 1 ? 'Eintrag' : 'Einträge') : (companySummary.length === 1 ? 'record' : 'records')}
                </span>

                {companySummary.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCompanySummaryPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-all shadow-2xs hover:text-rose-800"
                    title={
                      language === 'de'
                        ? 'Zusammenfassung als PDF-Dokument herunterladen'
                        : 'Download summary as PDF document'
                    }
                  >
                    <FileText size={13} className="text-rose-600" />
                    <span>{language === 'de' ? 'PDF herunterladen' : 'Download PDF'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200/80 text-slate-600 font-bold">
                    <th
                      onClick={() => handleCompanySort('company')}
                      className="px-4 py-3 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{language === 'de' ? 'Unternehmen (Company Name)' : 'Company Name'}</span>
                        <ArrowUpDown size={12} className={companySortField === 'company' ? 'text-brand-600' : 'text-slate-400'} />
                      </div>
                    </th>
                    <th className="px-4 py-3">
                      {language === 'de' ? 'Zugehörige Kontonummer / IBAN' : 'Associated Account / IBAN'}
                    </th>
                    <th
                      onClick={() => handleCompanySort('dates')}
                      className="px-4 py-3 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{language === 'de' ? 'Buchungsdatum / Zeitraum' : 'Dates / Period'}</span>
                        <ArrowUpDown size={12} className={companySortField === 'dates' ? 'text-brand-600' : 'text-slate-400'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleCompanySort('count')}
                      className="px-4 py-3 text-center cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>{language === 'de' ? 'Anzahl' : 'Count'}</span>
                        <ArrowUpDown size={12} className={companySortField === 'count' ? 'text-brand-600' : 'text-slate-400'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleCompanySort('totalAmount')}
                      className="px-4 py-3 text-right cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{language === 'de' ? 'Gesamtbetrag (Sum Amount)' : 'Total Amount'}</span>
                        <ArrowUpDown size={12} className={companySortField === 'totalAmount' ? 'text-brand-600' : 'text-slate-400'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">
                      {language === 'de' ? 'Rechnungen / Belege (Invoices)' : 'Invoices / Receipts'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {companySummary.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">
                        {language === 'de' ? 'Keine Unternehmen entsprechen den Filterkriterien.' : 'No companies match the filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    companySummary.map((item, idx) => {
                      const isIncome = item.totalAmount >= 0;
                      const compInvoices = companyInvoicesMap[item.company] || [];
                      const isCurrentlyUploading = uploadingCompany === item.company;

                      // Date text
                      const rawDatesArr = Array.from(item.rawDates);
                      let dateDisplay = '';
                      if (rawDatesArr.length === 1) {
                        dateDisplay = rawDatesArr[0];
                      } else if (rawDatesArr.length <= 3) {
                        dateDisplay = rawDatesArr.join(', ');
                      } else {
                        dateDisplay = `${formatDate(item.earliestDate)} - ${formatDate(item.latestDate)} (${rawDatesArr.length} Daten)`;
                      }

                      return (
                        <tr
                          key={`${item.company}-${item.accountNumber}-${item.ownAccountNumber || ''}-${idx}`}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="px-4 py-3 font-bold text-slate-900 max-w-[220px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate" title={item.company}>{item.company}</span>
                              {multiAccountCompanies.has(item.company) && item.ownAccountNumber && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 rounded px-1.5 py-0.5 w-fit">
                                  {item.ownAccountNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-600 max-w-[180px]">
                            {item.accountNumber && item.accountNumber !== '-' ? (
                              <span className="truncate block" title={item.accountNumber}>
                                {item.accountNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-[11px] font-medium">
                            <span title={rawDatesArr.join(', ')}>{dateDisplay}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {item.count}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-extrabold whitespace-nowrap ${
                            isIncome ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {isIncome ? `+${formatCurrency(item.totalAmount)}` : formatCurrency(item.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {compInvoices.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setViewingCompanyInvoices({ company: item.company, invoices: compInvoices })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 rounded-lg transition-colors shadow-2xs"
                                  title={compInvoices.map((i) => i.originalName).join(', ')}
                                >
                                  <Eye size={13} />
                                  <span>{compInvoices.length} {language === 'de' ? (compInvoices.length === 1 ? 'Beleg' : 'Belege') : (compInvoices.length === 1 ? 'Invoice' : 'Invoices')}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenUploadForCompany(item.company)}
                                disabled={isCurrentlyUploading}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                                  compInvoices.length > 0
                                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:text-brand-600'
                                    : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-2xs'
                                }`}
                                title={
                                  language === 'de'
                                    ? `Rechnung/Beleg für "${item.company}" hochladen`
                                    : `Upload invoice/receipt for "${item.company}"`
                                }
                              >
                                {isCurrentlyUploading ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin text-brand-600" />
                                    <span>{language === 'de' ? 'Laden...' : 'Uploading...'}</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud size={13} />
                                    <span>{compInvoices.length > 0 ? (language === 'de' ? '+ Weiterer' : '+ Add More') : (language === 'de' ? 'Beleg laden' : 'Upload Invoice')}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* 2. ALL TRANSACTIONS TABLE SECTION                                     */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {language === 'de' ? 'Alle Buchungen (All Transactions)' : 'All Transactions'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {language === 'de'
                      ? 'Detaillierte Einzelposten der hochgeladenen Bankumsätze'
                      : 'Detailed single entries of the uploaded bank statement'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                  {sortedTransactions.length} {language === 'de' ? 'Umsätze' : 'transactions'}
                </span>

                {sortedTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportTransactionsPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-all shadow-2xs hover:text-rose-800"
                    title={
                      language === 'de'
                        ? 'Alle Buchungen als PDF-Dokument herunterladen'
                        : 'Download all transactions as PDF document'
                    }
                  >
                    <FileText size={13} className="text-rose-600" />
                    <span>{language === 'de' ? 'PDF herunterladen' : 'Download PDF'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200/80 text-slate-600 font-bold">
                    <th
                      onClick={() => handleSort('bookingDate')}
                      className="px-4 py-3 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{language === 'de' ? 'Datum' : 'Date'}</span>
                        <ArrowUpDown size={12} className={sortField === 'bookingDate' ? 'text-brand-600' : 'text-slate-400'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('company')}
                      className="px-4 py-3 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{language === 'de' ? 'Unternehmen (Company Name)' : 'Company Name'}</span>
                        <ArrowUpDown size={12} className={sortField === 'company' ? 'text-brand-600' : 'text-slate-400'} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('accountNumber')}
                      className="px-4 py-3 cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{language === 'de' ? 'Kontonummer / IBAN' : 'Account Number / IBAN'}</span>
                        <ArrowUpDown size={12} className={sortField === 'accountNumber' ? 'text-brand-600' : 'text-slate-400'} />
                      </div>
                    </th>
                    <th className="px-4 py-3">{language === 'de' ? 'Umsatzart & Details' : 'Type & Details'}</th>
                    <th
                      onClick={() => handleSort('amount')}
                      className="px-4 py-3 text-right cursor-pointer hover:bg-slate-200/50 transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{language === 'de' ? 'Betrag' : 'Amount'}</span>
                        <ArrowUpDown size={12} className={sortField === 'amount' ? 'text-brand-600' : 'text-slate-400'} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                        {language === 'de'
                          ? 'Keine Buchungen entsprechen den ausgewählten Kriterien.'
                          : 'No transactions match the selected filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    sortedTransactions.map((tx) => {
                      const isIncome = tx.amount > 0;

                      return (
                        <tr
                          key={tx.id}
                          className={`hover:bg-brand-50/20 transition-colors ${
                            isIncome ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">
                            <div>{tx.rawDate || formatDate(tx.bookingDate)}</div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 max-w-[190px] truncate">
                            <span title={tx.company}>{tx.company}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {tx.accountNumber || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 max-w-[280px] truncate">
                            <span className="font-semibold text-slate-700 mr-1.5">{tx.transactionType}</span>
                            {tx.purpose && <span title={tx.purpose}>• {tx.purpose}</span>}
                          </td>
                          <td className={`px-4 py-3 text-right font-extrabold whitespace-nowrap ${
                            isIncome ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {isIncome ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {sortedTransactions.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-700" colSpan={3}>
                        {language === 'de' ? 'Gesamtsumme' : 'Total'} ({sortedTransactions.length} {language === 'de' ? 'Buchungen' : 'items'})
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {language === 'de' ? 'Netto:' : 'Net:'}
                      </td>
                      <td className={`px-4 py-3 text-right font-black text-sm ${totalAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {totalAmount >= 0 ? '+' : ''}{formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* HISTORY MODAL                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {language === 'de' ? 'Gespeicherte Bankauszüge (Verlauf)' : 'Bank Statements History'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'de'
                      ? 'Wählen Sie einen zuvor hochgeladenen Auszug aus, um ihn erneut anzuzeigen'
                      : 'Select any previously uploaded statement to view its summary'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {isLoadingHistory ? (
                <div className="py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-brand-600 mb-2" />
                  <p className="text-xs text-slate-500">{language === 'de' ? 'Verlauf laden...' : 'Loading history...'}</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {language === 'de' ? 'Noch keine Bankauszüge im Verlauf gespeichert.' : 'No bank statements in history yet.'}
                </div>
              ) : (
                historyList.map((item) => {
                  const isCurrent = currentStatementId === item._id;
                  return (
                    <div
                      key={item._id}
                      onClick={() => handleSelectHistoryItem(item._id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isCurrent
                          ? 'border-brand-500 bg-brand-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isCurrent ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <FileSpreadsheet size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{formatDisplayFileName(item.fileName, language)}</span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-100 text-brand-800">
                                {language === 'de' ? 'Aktiv' : 'Active'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {item.accountName && <span>{formatDisplayAccountName(item.accountName, language)}</span>}
                            {item.periodText && <span>{formatDisplayPeriodText(item.periodText, language)}</span>}
                            <span className="font-semibold text-slate-700">
                              {item.totalRecords} {language === 'de' ? 'Buchungen' : 'items'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                            <Clock size={11} />
                            <span>{new Date(item.createdAt).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHistoryItem(e, item._id)}
                          title="Löschen"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="text-slate-400">
                          <ArrowRight size={16} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {language === 'de' ? 'Schließen' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* UPLOAD POPUP MODAL WITH DRAG & DROP                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600 border border-brand-100/80">
                  <UploadCloud size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    {language === 'de' ? 'Bank-CSV hochladen (bis zu 5 Dateien)' : 'Upload Bank CSV (Up to 5 files)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'de'
                      ? 'Ziehen Sie bis zu 5 CSV-Dateien per Drag & Drop hierher oder wählen Sie sie aus'
                      : 'Drag & drop up to 5 CSV files here or browse from device'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setModalIsDragging(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Dropzone */}
            <div className="p-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setModalIsDragging(true);
                }}
                onDragLeave={() => setModalIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setModalIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesProcess(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all p-8 sm:p-10 text-center flex flex-col items-center justify-center gap-3 ${
                  modalIsDragging
                    ? 'border-brand-500 bg-brand-50/60 scale-[0.99]'
                    : 'border-slate-300 hover:border-brand-500 hover:bg-slate-50/70 bg-slate-50/30'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  modalIsDragging ? 'bg-brand-600 text-white scale-110' : 'bg-brand-50 text-brand-600 border border-brand-100'
                }`}>
                  <UploadCloud size={28} />
                </div>

                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-800">
                    {language === 'de' ? 'Bank-CSV-Dateien hier hineinziehen' : 'Drop your bank statement files here'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    {language === 'de'
                      ? 'oder klicken, um bis zu 5 CSV-Dateien von Ihrem Computer auszuwählen'
                      : 'or click to browse up to 5 CSV files from your computer'}
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs mt-1">
                  <FileSpreadsheet size={13} className="text-brand-600" />
                  <span>{language === 'de' ? 'Bis zu 5 .csv-Dateien (z.B. Konto 00 & 01)' : 'Up to 5 .csv files (e.g. accounts 00 & 01)'}</span>
                </div>
              </div>

              {/* Informational Note */}
              <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Info size={14} className="text-brand-600 shrink-0 mt-0.5" />
                <span>
                  {language === 'de'
                    ? 'Unterstützt Mehrfach-Uploads (max. 5 Dateien). Konten wie 350_1292218_00 und 350_1292218_01 werden automatisch erkannt, zugeordnet und zusammengeführt.'
                    : 'Supports multiple uploads (max 5 files). Accounts such as 350_1292218_00 and 350_1292218_01 are automatically detected, tagged, and merged.'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setModalIsDragging(false);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {language === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all shadow-sm"
              >
                <UploadCloud size={14} />
                <span>{language === 'de' ? 'Datei durchsuchen' : 'Browse File'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* COMPANY INVOICES LIST & MANAGE MODAL                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {viewingCompanyInvoices && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>{viewingCompanyInvoices.company}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                      {viewingCompanyInvoices.invoices.length} {language === 'de' ? 'Belege' : 'Invoices'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'de'
                      ? 'Hochgeladene Rechnungen und Zahlungsbelege für dieses Unternehmen'
                      : 'Uploaded invoices and receipts for this company'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingCompanyInvoices(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {viewingCompanyInvoices.invoices.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  {language === 'de'
                    ? 'Noch keine Belege für dieses Unternehmen vorhanden.'
                    : 'No invoices uploaded for this company yet.'}
                </div>
              ) : (
                viewingCompanyInvoices.invoices.map((inv, iIdx) => {
                  const isPdf = inv.mimeType === 'application/pdf' || inv.originalName.toLowerCase().endsWith('.pdf');
                  return (
                    <div
                      key={inv.path || iIdx}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-slate-50/70 transition-all flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isPdf ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-brand-50 text-brand-600 border border-brand-100'
                          }`}
                        >
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate" title={inv.originalName}>
                            {inv.originalName}
                          </p>
                          <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {inv.size && (
                              <span>{(inv.size / 1024).toFixed(0)} KB</span>
                            )}
                            {inv.uploadedAt && (
                              <span>• {new Date(inv.uploadedAt).toLocaleDateString()}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* View in DocumentViewer */}
                        <button
                          type="button"
                          onClick={() => handleOpenDocumentViewer(inv, viewingCompanyInvoices.company)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200/60"
                          title={language === 'de' ? 'Vollbildanzeige öffnen' : 'View document'}
                        >
                          <Eye size={13} />
                          <span>{language === 'de' ? 'Ansehen' : 'View'}</span>
                        </button>

                        {/* Download */}
                        <a
                          href={`/uploads/${inv.path}?download=true`}
                          download={inv.originalName}
                          className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          title={language === 'de' ? 'Herunterladen' : 'Download'}
                        >
                          <Download size={13} />
                        </a>

                        {/* Delete/Remove */}
                        <button
                          type="button"
                          onClick={() => handleRemoveCompanyInvoice(viewingCompanyInvoices.company, inv.path)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title={language === 'de' ? 'Beleg entfernen' : 'Remove document'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewingCompanyInvoices(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {language === 'de' ? 'Schließen' : 'Close'}
              </button>

              <button
                type="button"
                onClick={() => handleOpenUploadForCompany(viewingCompanyInvoices.company)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all shadow-sm"
              >
                <Plus size={14} />
                <span>{language === 'de' ? 'Weiteren Beleg hinzufügen' : 'Add Another Invoice'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* INTEGRATED DOCUMENT VIEWER (PREVIEW MODAL)                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {viewingDocEntry && (
        <DocumentViewer
          entry={viewingDocEntry}
          onClose={() => setViewingDocEntry(null)}
        />
      )}
    </div>
  );
}

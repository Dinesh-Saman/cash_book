import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Calendar,
  Building2,
  CreditCard,
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
  AlertTriangle,
  Info,
  FileText,
  Eye,
  Loader2,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseBankCsv, BankParsedData } from '../lib/bankParser';
import { useTranslation } from '../store/languageStore';
import CustomSelect, { SelectOption } from '../components/ui/CustomSelect';
import { bankApi } from '../lib/api';
import { uploadDocumentWithProgress, UploadedDocumentRef } from '../lib/documentUpload';
import DocumentViewer from '../components/cashbook/DocumentViewer';

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

  const handleFileProcess = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error(
        language === 'de'
          ? 'Bitte laden Sie eine gültige CSV-Datei hoch.'
          : 'Please upload a valid CSV file.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseBankCsv(text, file.name, file.size);
        setBankData(parsed);

        // Save immediately in local storage for instantaneous recovery
        try {
          localStorage.setItem('last_bank_statement_data', JSON.stringify(parsed));
        } catch {}

        // Reset filters
        setFromDate('');
        setToDate('');
        setSelectedCompany('ALL');
        setAccountSearchText('');
        setSearchQuery('');
        setShowUploadModal(false);

        // Persist to database so it stays permanently in history & on login/logout
        setIsSaving(true);
        try {
          const saveRes = await bankApi.save(parsed);
          if (saveRes.data?.data?.id) {
            setCurrentStatementId(saveRes.data.data.id);
          }
          toast.success(
            language === 'de'
              ? `CSV erfolgreich eingelesen & gespeichert! ${parsed.transactions.length} Buchungen geladen.`
              : `CSV parsed & saved to history! ${parsed.transactions.length} transactions loaded.`
          );
        } catch {
          toast.success(
            language === 'de'
              ? `CSV eingelesen! ${parsed.transactions.length} Buchungen verfügbar.`
              : `CSV parsed! ${parsed.transactions.length} transactions loaded.`
          );
        } finally {
          setIsSaving(false);
        }
      } catch (err: any) {
        toast.error(err.message || 'Fehler beim Parsen der Bank-CSV-Datei.');
      }
    };
    reader.onerror = () => {
      toast.error(language === 'de' ? 'Fehler beim Lesen der Datei.' : 'Error reading file.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
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

  // Filtered transactions based on date, company, account search, and general search
  const filteredTransactions = useMemo(() => {
    if (!bankData) return [];

    return bankData.transactions.filter((tx) => {
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
        if (!inComp && !inAcc && !inPurpose && !inType && !inInvs) return false;
      }
      return true;
    });
  }, [bankData, fromDate, toDate, selectedCompany, accountSearchText, searchQuery]);

  // Grouped by Company Summary with Dates
  const companySummary = useMemo(() => {
    const map = new Map<
      string,
      {
        company: string;
        count: number;
        totalAmount: number;
        accountNumbers: Set<string>;
        dates: Set<string>;
        rawDates: Set<string>;
        earliestDate: string;
        latestDate: string;
      }
    >();

    filteredTransactions.forEach((tx) => {
      let existing = map.get(tx.company);
      if (!existing) {
        existing = {
          company: tx.company,
          count: 0,
          totalAmount: 0,
          accountNumbers: new Set<string>(),
          dates: new Set<string>(),
          rawDates: new Set<string>(),
          earliestDate: tx.bookingDate,
          latestDate: tx.bookingDate,
        };
        map.set(tx.company, existing);
      }

      existing.count += 1;
      existing.totalAmount += tx.amount;
      if (tx.accountNumber && tx.accountNumber !== '-') {
        existing.accountNumbers.add(tx.accountNumber);
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

    // Sort company summary
    list.sort((a, b) => {
      let cmp = 0;
      if (companySortField === 'company') {
        cmp = a.company.localeCompare(b.company, undefined, { sensitivity: 'base' });
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
  }, [filteredTransactions, companySortField, companySortDirection]);

  // Detect companies with multiple account numbers/IBANs in the uploaded statement
  // A company is considered to have conflicting accounts if it has >= 2 distinct, non-empty account numbers/IBANs.
  // Exception: Ambikapathy Suyatharsan is the account owner / director and legitimately uses multiple accounts.
  const isMultipleAccountAllowed = (companyName: string): boolean => {
    const clean = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean.includes('ambikapathy') || clean.includes('suyatharsan');
  };

  const conflictingCompanies = useMemo(() => {
    if (!bankData) return [];

    const compAccountMap = new Map<string, Set<string>>();

    bankData.transactions.forEach((tx) => {
      const comp = (tx.company || '').trim();
      const acc = (tx.accountNumber || '').trim();
      if (!comp || !acc || acc === '-' || acc.toLowerCase() === 'unbekannt') return;

      // Skip rule for exempted entities (Ambikapathy Suyatharsan)
      if (isMultipleAccountAllowed(comp)) return;

      if (!compAccountMap.has(comp)) {
        compAccountMap.set(comp, new Set<string>());
      }
      compAccountMap.get(comp)!.add(acc);
    });

    const conflicts: { company: string; accounts: string[]; count: number }[] = [];
    compAccountMap.forEach((accountsSet, company) => {
      if (accountsSet.size > 1) {
        conflicts.push({
          company,
          accounts: Array.from(accountsSet),
          count: accountsSet.size,
        });
      }
    });

    return conflicts;
  }, [bankData]);

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
    setFromDate('');
    setToDate('');
    setSelectedCompany('ALL');
    setAccountSearchText('');
    setSearchQuery('');
  };

  const handleExportCsv = () => {
    if (sortedTransactions.length === 0) return;

    const headers = [
      'Buchungstag',
      'Unternehmen (Begünstigter / Auftraggeber)',
      'Kontonummer / IBAN',
      'Umsatzart',
      'Verwendungszweck',
      'Betrag',
      'Währung',
    ];
    const rows = sortedTransactions.map((tx) => [
      tx.rawDate || tx.bookingDate,
      `"${(tx.company || '').replace(/"/g, '""')}"`,
      `"${(tx.accountNumber || '').replace(/"/g, '""')}"`,
      `"${(tx.transactionType || '').replace(/"/g, '""')}"`,
      `"${(tx.purpose || '').replace(/"/g, '""')}"`,
      tx.amount.toFixed(2).replace('.', ','),
      tx.currency || 'EUR',
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bank_Alle_Buchungen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(language === 'de' ? 'Alle Buchungen exportiert!' : 'Transactions exported!');
  };

  const handleExportCompanySummaryCsv = () => {
    if (companySummary.length === 0) return;

    const headers = [
      'Unternehmen (Company Name)',
      'Zugehörige Kontonummer(n) / IBAN(s)',
      'Buchungsdatum / Zeitraum',
      'Anzahl Buchungen (Count)',
      'Gesamtbetrag (Sum Amount)',
      'Währung (Currency)',
    ];

    const rows = companySummary.map((item) => {
      const accounts = Array.from(item.accountNumbers).join(', ');
      const rawDatesArr = Array.from(item.rawDates);
      let dateDisplay = '';
      if (rawDatesArr.length === 1) {
        dateDisplay = rawDatesArr[0];
      } else if (rawDatesArr.length <= 3) {
        dateDisplay = rawDatesArr.join(', ');
      } else {
        dateDisplay = `${formatDate(item.earliestDate)} - ${formatDate(item.latestDate)} (${rawDatesArr.length} Daten)`;
      }

      return [
        `"${(item.company || '').replace(/"/g, '""')}"`,
        `"${accounts.replace(/"/g, '""')}"`,
        `"${dateDisplay.replace(/"/g, '""')}"`,
        item.count,
        item.totalAmount.toFixed(2).replace('.', ','),
        'EUR',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bank_Zusammenfassung_Unternehmen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      language === 'de'
        ? 'Zusammenfassung nach Unternehmen als CSV heruntergeladen!'
        : 'Company summary downloaded as CSV!'
    );
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
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm"
              >
                <Download size={14} />
                <span>{language === 'de' ? 'Exportieren' : 'Export'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hidden File Input for Statement CSV */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelect}
        accept=".csv,text/csv"
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
                {language === 'de' ? 'Bank-CSV-Datei hier ablegen' : 'Drop your Bank CSV file here'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {language === 'de'
                  ? 'Klicken oder Datei per Drag & Drop hineinziehen. Das Ergebnis wird automatisch gespeichert und bleibt auch nach dem Abmelden erhalten!'
                  : 'Click to browse or drop CSV. Summary is permanently saved and preserved across login/logout!'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60">
              <FileSpreadsheet size={14} />
              <span>Unterstützt standardisierte Bankumsatz-CSVs (.csv)</span>
            </div>
          </div>
        </div>
      ) : (
        /* Metadata Banner */
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <FileCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm sm:text-base">
                  {bankData.metadata.fileName}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {bankData.metadata.totalRecords} {language === 'de' ? 'Buchungen' : 'Transactions'}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-500" />
                  {language === 'de' ? 'Gespeichert' : 'Saved'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {bankData.metadata.accountName && (
                  <span>
                    <strong className="text-slate-700 font-semibold">{bankData.metadata.accountName}</strong>
                    {bankData.metadata.ownAccountNumber && ` (${bankData.metadata.ownAccountNumber})`}
                  </span>
                )}
                {bankData.metadata.ownIban && (
                  <span className="font-mono text-[11px] text-slate-600">
                    IBAN: {bankData.metadata.ownIban}
                  </span>
                )}
                {bankData.metadata.periodText && (
                  <span className="text-slate-500">{bankData.metadata.periodText}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/70 px-3 py-1.5 rounded-xl transition-colors"
            >
              {language === 'de' ? 'Andere Datei hochladen' : 'Upload Another File'}
            </button>
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

              {(fromDate || toDate || selectedCompany !== 'ALL' || accountSearchText || searchQuery) && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <RotateCcw size={12} />
                  <span>{language === 'de' ? 'Filter zurücksetzen' : 'Reset Filters'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* From Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{language === 'de' ? 'Von Datum (From Date)' : 'From Date'}</span>
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-800"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{language === 'de' ? 'Bis Datum (To Date)' : 'To Date'}</span>
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-800"
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
          {/* MULTIPLE ACCOUNTS PER COMPANY WARNING ALERT (BEFORE SUMMARY)            */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {conflictingCompanies.length > 0 && (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <AlertTriangle size={22} className="animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-amber-900 flex items-center gap-2">
                      <span>
                        {language === 'de'
                          ? 'Achtung: Mehrere Kontonummern für dasselbe Unternehmen gefunden!'
                          : 'Warning: Multiple Account Numbers Found for the Same Company!'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900 border border-amber-300">
                        {conflictingCompanies.length} {language === 'de' ? 'Firma(en)' : 'company/companies'}
                      </span>
                    </h3>
                  </div>
                  <p className="text-xs text-amber-800/90 mt-1 font-medium leading-relaxed">
                    {language === 'de'
                      ? 'In der hochgeladenen CSV-Datei wurden für das folgende Unternehmen mehrere unterschiedliche Kontonummern/IBANs festgestellt. Dies sollte in der Regel nicht vorkommen. Bitte überprüfen Sie die Bankdaten auf etwaige Unstimmigkeiten oder Tippfehler:'
                      : 'In the uploaded bank statement, multiple different account numbers/IBANs were found for the same company. This should typically not exist. Please review the affected accounts for discrepancies or errors:'}
                  </p>

                  <div className="mt-3.5 space-y-2.5">
                    {conflictingCompanies.map((c, cIdx) => (
                      <div
                        key={cIdx}
                        className="bg-white/95 rounded-xl border border-amber-200/90 p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-900 truncate">
                              {c.company}
                            </span>
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                              {c.accounts.length} {language === 'de' ? 'verschiedene Konten' : 'different accounts'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="text-[11px] text-slate-500 font-medium">
                              {language === 'de' ? 'Gefundene Konten:' : 'Found Accounts:'}
                            </span>
                            {c.accounts.map((acc, aIdx) => (
                              <button
                                key={aIdx}
                                type="button"
                                onClick={() => {
                                  setSelectedCompany(c.company);
                                  setAccountSearchText(acc);
                                }}
                                title={language === 'de' ? 'Nach diesem Konto filtern' : 'Filter by this account'}
                                className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                              >
                                {acc}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCompany(c.company);
                            setAccountSearchText('');
                          }}
                          className="self-start sm:self-center shrink-0 text-[11px] font-bold px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-2xs"
                        >
                          {language === 'de' ? 'Firma filtern' : 'Filter Company'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  {companySummary.length} {language === 'de' ? 'Unternehmen' : 'companies'}
                </span>

                {companySummary.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCompanySummaryCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs hover:text-brand-700"
                    title={
                      language === 'de'
                        ? 'Zusammenfassung nach Unternehmen als CSV herunterladen'
                        : 'Download summary by company as CSV'
                    }
                  >
                    <Download size={13} className="text-brand-600" />
                    <span>{language === 'de' ? 'Zusammenfassung als CSV' : 'Download Summary CSV'}</span>
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
                      {language === 'de' ? 'Zugehörige Kontonummer(n)' : 'Associated Account(s)'}
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
                      const accountsArr = Array.from(item.accountNumbers);
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

                      const hasAccountConflict = accountsArr.length > 1 && !isMultipleAccountAllowed(item.company);

                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            hasAccountConflict ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-4 py-3 font-bold text-slate-900 max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span>{item.company}</span>
                              {hasAccountConflict && (
                                <span
                                  title={
                                    language === 'de'
                                      ? 'Warnung: Dieser Firma sind mehrere unterschiedliche Kontonummern zugeordnet!'
                                      : 'Warning: Multiple different accounts are assigned to this company!'
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0"
                                >
                                  <AlertTriangle size={11} className="text-amber-600" />
                                  <span>{accountsArr.length} {language === 'de' ? 'Konten' : 'Accounts'}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-600 max-w-[170px]">
                            {accountsArr.length > 0 ? (
                              <div className="space-y-0.5">
                                {accountsArr.map((acc, aIdx) => (
                                  <div
                                    key={aIdx}
                                    className={`truncate ${hasAccountConflict ? 'text-amber-900 font-semibold' : ''}`}
                                    title={acc}
                                  >
                                    {acc}
                                  </div>
                                ))}
                              </div>
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

              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                {sortedTransactions.length} {language === 'de' ? 'Umsätze' : 'transactions'}
              </span>
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
                            {tx.rawDate || formatDate(tx.bookingDate)}
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
                            <span className="font-bold text-slate-900 text-sm">{item.fileName}</span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-100 text-brand-800">
                                {language === 'de' ? 'Aktiv' : 'Active'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {item.accountName && <span>{item.accountName}</span>}
                            {item.periodText && <span>{item.periodText}</span>}
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
                    {language === 'de' ? 'Neue Bank-CSV hochladen' : 'Upload New Bank CSV'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'de'
                      ? 'Ziehen Sie die Datei per Drag & Drop hierher oder wählen Sie sie aus'
                      : 'Drag & drop your CSV file here or browse from device'}
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
                    handleFileProcess(e.dataTransfer.files[0]);
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
                    {language === 'de' ? 'Bank-CSV hier hineinziehen' : 'Drop your bank statement here'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    {language === 'de'
                      ? 'oder klicken, um eine CSV-Datei von Ihrem Computer auszuwählen'
                      : 'or click to browse a CSV file from your computer'}
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs mt-1">
                  <FileSpreadsheet size={13} className="text-brand-600" />
                  <span>{language === 'de' ? 'Nur .csv-Dateien' : 'Only .csv files'}</span>
                </div>
              </div>

              {/* Informational Note */}
              <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Info size={14} className="text-brand-600 shrink-0 mt-0.5" />
                <span>
                  {language === 'de'
                    ? 'Nach dem Hochladen wird der Auszug automatisch analysiert, im Verlauf gespeichert und bleibt dauerhaft erhalten.'
                    : 'Once uploaded, the statement is instantly analyzed, saved to history, and permanently preserved.'}
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

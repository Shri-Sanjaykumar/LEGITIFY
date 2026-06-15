'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Globe, Mail, Type, ChevronRight } from 'lucide-react';
import { Linkedin } from '@/components/shared/BrandIcons';
import DashboardLayout from '@/components/layout/DashboardLayout';
import InputTypeSelector from '@/components/scan/InputTypeSelector';
import FileUpload from '@/components/scan/FileUpload';
import ScanProgress from '@/components/scan/ScanProgress';
import AuthGuard from '@/components/shared/AuthGuard';
import { useCreateScan, useUploadFile } from '@/hooks/useScans';
import { apiFetch } from '@/lib/api/client';

const iconMap = { url: Globe, linkedin: Linkedin, email: Mail, text: Type };

type ScanType = 'pdf' | 'docx' | 'txt' | 'url' | 'linkedin' | 'email' | 'text';

function ScanContent() {
  const router = useRouter();
  const createScanMutation = useCreateScan();
  const uploadFileMutation = useUploadFile();

  const [selectedType, setSelectedType] = useState<ScanType>('url');
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);

  const isFileSelected = selectedType === 'pdf' || selectedType === 'docx';
  const hasInput = isFileSelected ? !!file : inputValue.trim().length > 0;

  const handleStartScan = useCallback(async () => {
    if (!hasInput) return;
    setIsScanning(true);
    setScanStep(0); // Uploading

    try {
      let fileId: string | undefined = undefined;

      // 1. Upload file if applicable
      if (isFileSelected && file) {
        const uploadResult = await uploadFileMutation.mutateAsync(file);
        fileId = uploadResult.id;
      }

      setScanStep(1); // Extracting Text

      // 2. Map input details to backend Scan parameters
      const scanSourceMap: Record<ScanType, 'FILE' | 'EMAIL' | 'LINKEDIN' | 'URL' | 'TEXT'> = {
        pdf: 'FILE',
        docx: 'FILE',
        txt: 'FILE',
        url: 'URL',
        linkedin: 'LINKEDIN',
        email: 'EMAIL',
        text: 'TEXT',
      };

      setScanStep(2); // Analyzing Document

      const scanParams = {
        file_id: fileId,
        scan_type: selectedType,
        raw_input_text: isFileSelected ? undefined : inputValue,
        scan_source: scanSourceMap[selectedType] || 'TEXT',
        priority: 'NORMAL' as const,
      };

      // 3. Create Scan Record in PostgreSQL
      const scanResult = await createScanMutation.mutateAsync(scanParams);

      setScanStep(3); // Checking Domain
      await new Promise((resolve) => setTimeout(resolve, 800));

      setScanStep(4); // Verifying Company
      await new Promise((resolve) => setTimeout(resolve, 800));

      setScanStep(5); // Checking Reputation
      await new Promise((resolve) => setTimeout(resolve, 800));

      setScanStep(6); // Generating Report

      // 4. Trigger the real trust engine analysis on the backend
      const analyzeRes = await apiFetch('/trust/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_id: scanResult.id }),
      });

      if (analyzeRes.success) {
        setScanStep(7); // Complete
        setTimeout(() => {
          router.push(`/report/${scanResult.id}`);
        }, 1200);
      } else {
        throw new Error(analyzeRes.message || 'Trust analysis failed');
      }
    } catch (error) {
      console.error('Verification workflow failed:', error);
      setIsScanning(false);
      setScanStep(0);
      alert('Verification failed. Please check the backend service status.');
    }
  }, [hasInput, file, selectedType, isFileSelected, inputValue, createScanMutation, uploadFileMutation, router]);

  const handleTypeChange = (type: string) => {
    setSelectedType(type as ScanType);
    setInputValue('');
    setFile(null);
  };

  const IconComponent = iconMap[selectedType as keyof typeof iconMap] || Type;

  return (
    <div className="max-w-3xl mx-auto space-y-8 relative">
      <div className="flex flex-col gap-1.5 text-left">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">New Scan</h2>
        <p className="text-sm text-[var(--text-secondary)]">Upload documents, paste emails, or input URLs to verify legitimacy.</p>
      </div>

      {/* Input Type Selection */}
      <div className="bg-[#0c0c14] border border-[var(--border-primary)] rounded-xl p-4">
        <p className="text-left text-xs text-[var(--text-tertiary)] font-semibold uppercase tracking-wider mb-3">Select Scan Source</p>
        <InputTypeSelector selectedType={selectedType} onSelect={handleTypeChange} />
      </div>

      {/* Input Form */}
      <motion.div key={selectedType} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
        className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 space-y-6">
        {isFileSelected ? (
          <FileUpload onFileSelect={(selected) => setFile(selected)} />
        ) : selectedType === 'email' || selectedType === 'text' ? (
          <div className="space-y-2 text-left">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              {selectedType === 'email' ? 'Email Content' : 'Raw Text'}
            </label>
            <div className="relative">
              <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                placeholder={selectedType === 'email' ? 'Paste the full email text here...' : 'Paste any text description...'}
                rows={6} className="w-full px-4 py-3 pl-10 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[rgba(99,102,241,0.2)] transition-all" />
              <div className="absolute left-3.5 top-3.5 text-[var(--text-muted)]"><IconComponent className="w-4 h-4" /></div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-left">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              {selectedType === 'url' ? 'Company Website URL' : 'LinkedIn Recruiter URL'}
            </label>
            <div className="relative">
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                placeholder={selectedType === 'url' ? 'https://company-website.com' : 'https://linkedin.com/in/recruiter-username'}
                className="w-full h-11 px-4 pl-10 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[rgba(99,102,241,0.2)] transition-all" />
              <div className="absolute left-3.5 top-3.5 text-[var(--text-muted)]"><IconComponent className="w-4 h-4" /></div>
            </div>
          </div>
        )}

        <motion.button whileHover={{ scale: hasInput ? 1.01 : 1 }} whileTap={{ scale: hasInput ? 0.99 : 1 }}
          onClick={handleStartScan} disabled={!hasInput || createScanMutation.isPending || uploadFileMutation.isPending}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer
            ${hasInput ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
              : 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-primary)] cursor-not-allowed'}`}>
          <Shield className="w-4 h-4" />
          {createScanMutation.isPending || uploadFileMutation.isPending ? 'Initializing...' : 'Start AI Verification'}
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </motion.div>

      <ScanProgress isScanning={isScanning} currentStep={scanStep} />
    </div>
  );
}

export default function ScanPage() {
  return (
    <AuthGuard>
      <DashboardLayout activePath="/scan">
        <ScanContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

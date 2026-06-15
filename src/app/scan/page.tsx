'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Globe, Mail, Type, FileText, ChevronRight } from 'lucide-react';
import { Linkedin } from '@/components/shared/BrandIcons';
import DashboardLayout from '@/components/layout/DashboardLayout';
import InputTypeSelector from '@/components/scan/InputTypeSelector';
import FileUpload from '@/components/scan/FileUpload';
import ScanProgress from '@/components/scan/ScanProgress';

const iconMap = {
  url: Globe,
  linkedin: Linkedin,
  email: Mail,
  text: Type,
};

export default function ScanPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState('url');
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);

  const isFileSelected = selectedType === 'pdf' || selectedType === 'docx';
  const hasInput = isFileSelected ? !!file : inputValue.trim().length > 0;

  const handleStartScan = useCallback(() => {
    if (!hasInput) return;
    setIsScanning(true);
    setScanStep(0);
  }, [hasInput]);

  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setScanStep((prev) => {
        if (prev >= 6) {
          clearInterval(interval);
          return prev + 1; // trigger redirect
        }
        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isScanning]);

  useEffect(() => {
    if (scanStep > 6) {
      const timeout = setTimeout(() => {
        router.push('/report/demo');
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [scanStep, router]);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setInputValue('');
    setFile(null);
  };

  const IconComponent = iconMap[selectedType as keyof typeof iconMap] || Type;

  return (
    <DashboardLayout activePath="/scan">
      <div className="max-w-3xl mx-auto space-y-8 relative">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            New Scan
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Upload documents, paste emails, or input URLs to verify legitimacy.
          </p>
        </div>

        {/* Input Type Selection Row */}
        <div className="bg-[#0c0c14] border border-[var(--border-primary)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-tertiary)] font-semibold uppercase tracking-wider mb-3">
            Select Scan Source
          </p>
          <InputTypeSelector selectedType={selectedType} onSelect={handleTypeChange} />
        </div>

        {/* Input Forms */}
        <motion.div
          key={selectedType}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 space-y-6"
        >
          {isFileSelected ? (
            <FileUpload onFileSelect={(selected) => setFile(selected)} />
          ) : selectedType === 'email' || selectedType === 'text' ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                {selectedType === 'email' ? 'Email Content' : 'Raw Text'}
              </label>
              <div className="relative">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    selectedType === 'email'
                      ? 'Paste the full email text here...'
                      : 'Paste any text description, offer, or claims...'
                  }
                  rows={6}
                  className="w-full px-4 py-3 pl-10 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[rgba(99,102,241,0.2)] transition-all duration-200 resize-none font-sans"
                />
                <div className="absolute left-3.5 top-3.5 text-[var(--text-muted)]">
                  <IconComponent className="w-4 h-4" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                {selectedType === 'url' ? 'Company Website URL' : 'LinkedIn Recruiter URL'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    selectedType === 'url'
                      ? 'https://company-website.com'
                      : 'https://linkedin.com/in/recruiter-username'
                  }
                  className="w-full h-11 px-4 pl-10 bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[rgba(99,102,241,0.2)] transition-all duration-200"
                />
                <div className="absolute left-3.5 top-3.5 text-[var(--text-muted)]">
                  <IconComponent className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* Trigger Button */}
          <motion.button
            whileHover={{ scale: hasInput ? 1.01 : 1 }}
            whileTap={{ scale: hasInput ? 0.99 : 1 }}
            onClick={handleStartScan}
            disabled={!hasInput}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 border border-transparent select-none
              ${
                hasInput
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]'
                  : 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-primary)] cursor-not-allowed'
              }`}
          >
            <Shield className="w-4 h-4" />
            Start AI Verification
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </motion.div>

        {/* Scan Progress Overlay */}
        <ScanProgress isScanning={isScanning} currentStep={scanStep} />
      </div>
    </DashboardLayout>
  );
}

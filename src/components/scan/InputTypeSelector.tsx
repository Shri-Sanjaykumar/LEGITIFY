'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  Globe,
  Mail,
  Type,
} from 'lucide-react';
import { Linkedin } from '@/components/shared/BrandIcons';
import { cn } from '@/lib/utils';
import { INPUT_TYPES } from '@/lib/constants';

interface InputTypeSelectorProps {
  selectedType: string;
  onSelect: (type: string) => void;
}

const iconMap: Record<string, React.ElementType> = {
  FileText,
  Globe,
  Linkedin,
  Mail,
  Type,
};

export default function InputTypeSelector({ selectedType, onSelect }: InputTypeSelectorProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {INPUT_TYPES.map((inputType) => {
        const isSelected = selectedType === inputType.type;
        const IconComponent = iconMap[inputType.icon] || FileText;

        return (
          <motion.button
            key={inputType.type}
            layout
            onClick={() => onSelect(inputType.type)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0',
              'backdrop-blur-md'
            )}
            style={{
              background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--glass-bg)',
              border: isSelected
                ? '1px solid #6366f1'
                : '1px solid var(--border-primary)',
              color: isSelected ? '#818cf8' : 'var(--text-secondary)',
              boxShadow: isSelected
                ? '0 0 16px rgba(99, 102, 241, 0.2)'
                : 'none',
            }}
          >
            <IconComponent size={16} />
            {inputType.label}
            {isSelected && (
              <motion.div
                layoutId="input-type-indicator"
                className="w-1.5 h-1.5 rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

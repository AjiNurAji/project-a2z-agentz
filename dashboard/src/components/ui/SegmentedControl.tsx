'use client';
import { motion } from 'motion/react';
import React, { useRef } from 'react';

export interface SegmentedControlOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
}

export function SegmentedControl({ options, value, onChange, name }: SegmentedControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = options.findIndex((opt) => opt.value === value);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % options.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + options.length) % options.length;
      e.preventDefault();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(options[currentIndex].value);
    } else {
      return;
    }

    onChange(options[nextIndex].value);
    
    // Focus the newly selected radio button
    setTimeout(() => {
      const radioElements = containerRef.current?.querySelectorAll<HTMLDivElement>('[role="radio"]');
      if (radioElements && radioElements[nextIndex]) {
        radioElements[nextIndex].focus();
      }
    }, 0);
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      data-testid="segmented-control"
      onKeyDown={handleKeyDown}
      className="flex p-1 gap-1 rounded-xl bg-[var(--color-neutral-secondary-soft)] border border-[var(--color-border-default)] w-fit"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <div
            key={option.value}
            role="radio"
            aria-checked={isSelected}
            data-testid={`segment-${option.value}`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              if (!isSelected) {
                onChange(option.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!isSelected) {
                  onChange(option.value);
                }
              }
            }}
            className="relative px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] select-none text-center min-w-[80px]"
            style={{
              color: isSelected ? 'var(--color-heading)' : 'var(--color-body-subtle)',
            }}
          >
            {/* Sliding animation background */}
            {isSelected && (
              <motion.div
                layoutId={`active-indicator-${name}`}
                className="absolute inset-0 rounded-lg bg-[var(--color-neutral-secondary-strong)] shadow-xs"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{ zIndex: 0 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </div>
        );
      })}
    </div>
  );
}

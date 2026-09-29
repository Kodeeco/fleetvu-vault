'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, X, Plus, Search } from 'lucide-react';

export function LocationTagInput({
  selected,
  onChange,
  availableLocations,
  onRegisterNewLocation,
}: {
  selected: string[];
  onChange: (locations: string[]) => void;
  availableLocations: string[];
  onRegisterNewLocation?: (location: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = availableLocations
    .filter((loc) => !selected.includes(loc))
    .filter((loc) => loc.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const queryTrimmed = query.trim();
  const isExactMatch = availableLocations.some(
    (loc) => loc.toLowerCase() === queryTrimmed.toLowerCase()
  );
  const canCreate = queryTrimmed.length > 0 && !isExactMatch && !selected.includes(queryTrimmed);

  const options = [
    ...filtered,
    ...(canCreate ? [`__create__:${queryTrimmed}`] : []),
  ];

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addLocation = useCallback((loc: string) => {
    if (!loc || selected.includes(loc)) return;
    onChange([...selected, loc]);
    setQuery('');
    setFocused(false);
  }, [selected, onChange]);

  const removeLocation = (loc: string) => {
    onChange(selected.filter((l) => l !== loc));
  };

  const selectOption = (option: string) => {
    if (option.startsWith('__create__:')) {
      const newLoc = option.slice('__create__:'.length);
      addLocation(newLoc);
      onRegisterNewLocation?.(newLoc);
    } else {
      addLocation(option);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (options.length > 0) {
        selectOption(options[highlightIndex] || options[0]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Backspace' && query === '' && selected.length > 0) {
      removeLocation(selected[selected.length - 1]);
    } else if (e.key === 'Escape') {
      setFocused(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Tag area */}
      <div
        className={cn(
          'min-h-[40px] rounded-lg border bg-slate-900/50 p-1.5 flex flex-wrap items-center gap-1.5 cursor-text transition-colors',
          focused ? 'border-orange-500/50 ring-1 ring-orange-500/20' : 'border-slate-600'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((loc) => (
          <span
            key={loc}
            className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-xs text-orange-200 font-medium"
          >
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {loc}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeLocation(loc);
              }}
              className="hover:text-orange-400 transition-colors ml-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 flex-1 min-w-[120px]">
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocused(true); }}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={selected.length === 0 ? 'Search or type a new location…' : ''}
            className="bg-transparent text-xs text-white placeholder:text-slate-500 outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* Dropdown */}
      {focused && (query.length > 0 || filtered.length > 0) && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((loc, i) => (
            <button
              key={loc}
              type="button"
              onMouseEnter={() => setHighlightIndex(i)}
              onClick={() => selectOption(loc)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors',
                highlightIndex === i ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              )}
            >
              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
              {loc}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseEnter={() => setHighlightIndex(options.length - 1)}
              onClick={() => selectOption(options[options.length - 1])}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors border-t border-slate-700',
                highlightIndex === options.length - 1 ? 'bg-orange-500/20 text-orange-200' : 'text-orange-300 hover:bg-orange-500/10'
              )}
            >
              <Plus className="w-3 h-3 shrink-0" />
              Add &ldquo;{queryTrimmed}&rdquo; as new location
            </button>
          )}
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-[10px] text-slate-500 mt-1">Leave empty for &ldquo;All Locations&rdquo; access.</p>
      )}
    </div>
  );
}

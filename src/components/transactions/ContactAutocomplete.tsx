'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchContacts } from '@/lib/api/contacts';
import { User, Building, Users2, UserPlus } from 'lucide-react';
import type { Contact, ContactType } from '@/types';

const TYPE_ICON: Record<ContactType, React.ReactNode> = {
  customer: <User className="w-3.5 h-3.5 text-green-500" />,
  vendor: <Building className="w-3.5 h-3.5 text-blue-500" />,
  other: <Users2 className="w-3.5 h-3.5 text-gray-400" />,
};

const TYPE_LABEL: Record<ContactType, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  other: 'Lainnya',
};

interface ContactAutocompleteProps {
  businessId: string;
  value: string;
  onChange: (value: string) => void;
  onSelectContact?: (contact: Contact) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  /** Tampilkan opsi "Simpan sebagai kontak" jika nama belum ada */
  onSaveAsContact?: (name: string) => void;
}

export function ContactAutocomplete({
  businessId,
  value,
  onChange,
  onSelectContact,
  placeholder = 'Nama customer/vendor',
  className = 'input',
  required,
  onSaveAsContact,
}: ContactAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!query.trim() || !businessId) {
        setSuggestions([]);
        return;
      }
      try {
        const results = await searchContacts(businessId, query.trim());
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    },
    [businessId]
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (contact: Contact) => {
    onChange(contact.name);
    onSelectContact?.(contact);
    setShowDropdown(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    const totalItems = suggestions.length + (showSaveOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      if (activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      } else if (showSaveOption && onSaveAsContact) {
        onSaveAsContact(value.trim());
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Check if current value exactly matches a suggestion
  const exactMatch = suggestions.some((c) => c.name.toLowerCase() === value.trim().toLowerCase());
  const showSaveOption = onSaveAsContact && value.trim().length > 0 && !exactMatch;

  const shouldShowDropdown = showDropdown && value.trim().length > 0 && (suggestions.length > 0 || showSaveOption);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (value.trim()) setShowDropdown(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="off"
      />

      {shouldShowDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((contact, idx) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => handleSelect(contact)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                idx === activeIndex
                  ? 'bg-indigo-50 dark:bg-indigo-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              } ${idx === 0 ? 'rounded-t-xl' : ''} ${idx === suggestions.length - 1 && !showSaveOption ? 'rounded-b-xl' : ''}`}
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                {TYPE_ICON[contact.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{contact.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {TYPE_LABEL[contact.type]}
                  {contact.phone ? ` · ${contact.phone}` : ''}
                </p>
              </div>
            </button>
          ))}

          {showSaveOption && (
            <button
              type="button"
              onClick={() => {
                onSaveAsContact!(value.trim());
                setShowDropdown(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-t border-gray-100 dark:border-gray-700 rounded-b-xl ${
                activeIndex === suggestions.length
                  ? 'bg-indigo-50 dark:bg-indigo-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                Simpan &quot;{value.trim()}&quot; sebagai kontak
              </p>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

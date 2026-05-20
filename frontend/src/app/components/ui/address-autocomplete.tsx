import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { MapPin, Loader2 } from 'lucide-react';

const API_KEY = '46e494a8-7f75-4320-9a5d-d145a1d6932c';
const API_URL = 'https://catalog.api.2gis.ru/3.0/items';

interface Suggestion {
  id: string;
  fullName: string;
  point?: { lat: number; lon: number };
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coordinates: { lat: number; lng: number } | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Начните вводить адрес...',
  required,
  className = '',
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(API_URL, {
        params: {
          q,
          key: API_KEY,
          page_size: 7,
          locale: 'ru_RU',
        },
        timeout: 8000,
      });

      const items = (data?.result?.items || []).map((item: any) => {
        const name = item.full_name
          || item.address_name
          || item.name
          || '';
        return {
          id: item.id || String(Math.random()),
          fullName: name,
          point: item.point ? { lat: item.point.lat, lon: item.point.lon } : undefined,
        };
      });

      setSuggestions(items);
      setHighlightedIndex(-1);
      setIsOpen(items.length > 0);
    } catch (err: any) {
      console.error('[2GIS items]', err?.response?.data || err.message);
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelect = (s: Suggestion) => {
    setQuery(s.fullName);
    onChange(
      s.fullName,
      s.point ? { lat: s.point.lat, lng: s.point.lon } : null
    );
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v, null);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          required={required}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`w-full pl-10 pr-10 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
          placeholder={placeholder}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
        )}
      </div>
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              onMouseEnter={() => setHighlightedIndex(i)}
              onClick={() => handleSelect(s)}
              className={`px-4 py-3 cursor-pointer text-sm transition-colors flex items-start gap-2 ${
                i === highlightedIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
              }`}
            >
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-foreground">{s.fullName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

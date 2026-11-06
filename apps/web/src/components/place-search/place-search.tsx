'use client';

import { MapPin, Search, X } from 'lucide-react';
import { cn } from 'cn';
import { type KeyboardEvent, useId, useState } from 'react';
import { usePlaceSearch } from '@/hooks/use-place-search';
import type { Place } from '@/lib/place';

type PlaceSearchProps = {
  label: string;
  placeholder: string;
  autoFocus?: boolean;
  onSelect: (place: Place) => void;
};

const NO_ACTIVE = -1;

// 검색창 + 결과 목록 (콤보박스). 위아래 화살표로 고르고 Enter로 선택한다.
export function PlaceSearch({ label, placeholder, autoFocus, onSelect }: PlaceSearchProps) {
  const [input, setInput] = useState('');
  const [active, setActive] = useState(NO_ACTIVE);
  const { data: places = [], isError, isSearching, enabled } = usePlaceSearch(input);
  const listId = useId();
  const showList = enabled && input.trim().length > 0;

  const change = (value: string) => {
    setInput(value);
    setActive(NO_ACTIVE);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, places.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, NO_ACTIVE));
    } else if (event.key === 'Enter' && places[active]) {
      event.preventDefault();
      onSelect(places[active]);
    } else if (event.key === 'Escape') {
      change('');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-xl bg-surface px-3.5 py-3 ring-primary focus-within:bg-background focus-within:ring-2">
        <Search aria-hidden className="size-5 shrink-0 text-subtle-foreground" />
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          value={input}
          placeholder={placeholder}
          onChange={(event) => change(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle-foreground"
        />
        {input && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => change('')}
            className="flex size-6 items-center justify-center rounded-full bg-surface-strong text-muted-foreground"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} 결과`}
          aria-busy={isSearching}
          hidden={places.length === 0}
        >
          {places.map((place, i) => (
            <li
              key={place.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={() => onSelect(place)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center gap-3 border-b border-border px-0.5 py-3.5',
                i === active && 'bg-surface',
              )}
            >
              <MapPin aria-hidden className="size-5 shrink-0 text-subtle-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">{place.name}</p>
                {place.address !== place.name && (
                  <p className="truncate text-[13px] text-subtle-foreground">{place.address}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {showList && !isSearching && !isError && places.length === 0 && (
        <p role="status" className="py-6 text-center text-sm text-muted-foreground">
          검색 결과가 없어요
        </p>
      )}
      {showList && !isSearching && isError && (
        <p role="alert" className="py-6 text-center text-sm text-muted-foreground">
          검색하지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}

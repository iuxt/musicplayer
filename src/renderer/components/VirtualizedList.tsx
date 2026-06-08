import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";

interface VirtualizedListProps<T> {
  className: string;
  items: T[];
  estimatedRowHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  emptyState?: ReactNode;
  overscan?: number;
  virtualizationThreshold?: number;
}

const defaultViewportHeight = 640;
const defaultOverscan = 6;
const defaultVirtualizationThreshold = 120;

export function VirtualizedList<T>({
  className,
  items,
  estimatedRowHeight,
  renderItem,
  getKey,
  emptyState,
  overscan = defaultOverscan,
  virtualizationThreshold = defaultVirtualizationThreshold
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState(() => visibleRangeFor(0, defaultViewportHeight, items.length, estimatedRowHeight, overscan));
  const shouldVirtualize = items.length > virtualizationThreshold;

  const updateRange = useCallback(() => {
    if (!shouldVirtualize) {
      return;
    }

    const container = containerRef.current;
    const nextRange = visibleRangeFor(
      container?.scrollTop ?? 0,
      container?.clientHeight || defaultViewportHeight,
      items.length,
      estimatedRowHeight,
      overscan
    );
    setRange((currentRange) =>
      currentRange.start === nextRange.start && currentRange.end === nextRange.end ? currentRange : nextRange
    );
  }, [estimatedRowHeight, items.length, overscan, shouldVirtualize]);

  useLayoutEffect(() => {
    updateRange();
  }, [updateRange]);

  if (items.length === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  if (!shouldVirtualize) {
    return <div className={className}>{items.map((item, index) => renderItemWithKey(item, index, getKey, renderItem))}</div>;
  }

  const visibleItems = items.slice(range.start, range.end);
  const topSpacerHeight = range.start * estimatedRowHeight;
  const bottomSpacerHeight = Math.max(0, (items.length - range.end) * estimatedRowHeight);

  return (
    <div className={className} ref={containerRef} onScroll={updateRange}>
      {topSpacerHeight > 0 ? <div aria-hidden="true" style={{ height: topSpacerHeight }} /> : null}
      {visibleItems.map((item, visibleIndex) =>
        renderItemWithKey(item, range.start + visibleIndex, getKey, renderItem)
      )}
      {bottomSpacerHeight > 0 ? <div aria-hidden="true" style={{ height: bottomSpacerHeight }} /> : null}
    </div>
  );
}

function renderItemWithKey<T>(
  item: T,
  index: number,
  getKey: (item: T, index: number) => string,
  renderItem: (item: T, index: number) => ReactNode
) {
  return <div key={getKey(item, index)}>{renderItem(item, index)}</div>;
}

function visibleRangeFor(
  scrollTop: number,
  viewportHeight: number,
  itemCount: number,
  estimatedRowHeight: number,
  overscan: number
) {
  const firstVisibleIndex = Math.max(0, Math.floor(scrollTop / estimatedRowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / estimatedRowHeight) + overscan * 2;
  return {
    start: firstVisibleIndex,
    end: Math.min(itemCount, firstVisibleIndex + visibleCount)
  };
}

export const INITIAL_ITEMS_COUNT = 1_000_000;
export const MAX_PAGE_SIZE = 20;

export const allIds = new Set<number>();
export const extraIds: number[] = [];

export const selectedIds = new Set<number>();
export const selectedOrder: number[] = [];

export const pendingIds = new Set<number>();

export const pendingSelectedIds = new Set<number>();

export type JobStatus = 'queued' | 'completed' | 'failed';

export interface AddJob {
    requestId: string;
    id: number;
    status: JobStatus;
    createdAt: number;
    error?: string;
}

export interface OperationJob {
    requestId: string;
    status: JobStatus;
    createdAt: number;
    error?: string;
}

export const addJobs = new Map<string, AddJob>();
export const operationJobs = new Map<string, OperationJob>();

for (let id = 1; id <= INITIAL_ITEMS_COUNT; id++) {
    allIds.add(id);
}

export function insertExtraId(id: number): void {
    let left = 0;
    let right = extraIds.length;

    while (left < right) {
        const middle = Math.floor((left + right) / 2);

        if (extraIds[middle] < id) {
            left = middle + 1;
        } else {
            right = middle;
        }
    }

    extraIds.splice(left, 0, id);
}

export function getAvailableItems(
    offset: number,
    limit: number,
    filter: string
) {
    const items: number[] = [];
    const search = filter.trim();

    let matched = 0;
    const required = limit + 1;

    const processId = (id: number): boolean => {
        if (selectedIds.has(id)) return false;
        if (search && !String(id).includes(search)) return false;

        if (matched < offset) {
            matched++;
            return false;
        }

        items.push(id);
        matched++;

        return items.length >= required;
    };

    for (let id = 1; id <= INITIAL_ITEMS_COUNT; id++) {
        if (processId(id)) break;
    }

    if (items.length < required) {
        for (const id of extraIds) {
            if (processId(id)) break;
        }
    }

    const hasMore = items.length > limit;

    if (hasMore) items.pop();

    return {
        items,
        hasMore,
        nextOffset: offset + items.length
    };
}

export function getSelectedItems(
    offset: number,
    limit: number,
    filter: string
) {
    const search = filter.trim();
    const items: number[] = [];
    let matched = 0;

    for (const id of selectedOrder) {
        if (!selectedIds.has(id)) continue;
        if (search && !String(id).includes(search)) continue;

        if (matched < offset) {
            matched++;
            continue;
        }

        items.push(id);
        matched++;

        if (items.length >= limit + 1) break;
    }

    const hasMore = items.length > limit;

    if (hasMore) items.pop();

    return {
        items,
        hasMore,
        nextOffset: offset + items.length
    };
}

export function selectItem(id: number): void {
    selectedIds.add(id);
    selectedOrder.push(id);
}

export function removeSelectedItem(id: number): void {
    selectedIds.delete(id);

    const index = selectedOrder.indexOf(id);

    if (index !== -1) {
        selectedOrder.splice(index, 1);
    }
}

export function reorderSelectedItems(
    activeId: number,
    overId: number
): boolean {
    const from = selectedOrder.indexOf(activeId);
    const to = selectedOrder.indexOf(overId);

    if (from === -1 || to === -1) return false;
    if (!selectedIds.has(activeId) || !selectedIds.has(overId)) return false;

    const [moved] = selectedOrder.splice(from, 1);
    selectedOrder.splice(to, 0, moved);

    return true;
}
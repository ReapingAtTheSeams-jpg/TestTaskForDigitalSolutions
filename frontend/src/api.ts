const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export interface PaginatedResponse {
    items: number[];
    hasMore: boolean;
    nextOffset: number;
}

export interface JobResponse {
    requestId: string;
    status: 'queued' | 'completed' | 'failed';
    error?: string;
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export function getItems(
    offset: number,
    filter: string
): Promise<PaginatedResponse> {
    const params = new URLSearchParams({
        offset: String(offset),
        limit: '20',
        filter
    });

    return request(`/items?${params}`);
}

export function getSelected(
    offset: number,
    filter: string
): Promise<PaginatedResponse> {
    const params = new URLSearchParams({
        offset: String(offset),
        limit: '20',
        filter
    });

    return request(`/selected?${params}`);
}

export function addItem(id: number): Promise<JobResponse> {
    return request('/items', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ id })
    });
}

export function selectItem(id: number): Promise<JobResponse> {
    return request('/selected', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ id })
    });
}

export function removeItem(id: number): Promise<JobResponse> {
    return request(`/selected/${id}`, {
        method: 'DELETE',
        headers: {
            'Idempotency-Key': crypto.randomUUID()
        }
    });
}

export function reorderItems(
    activeId: number,
    overId: number
): Promise<JobResponse> {
    return request('/selected/reorder', {
        method: 'PATCH',
        headers: {
            'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ activeId, overId })
    });
}

export function getAddStatus(requestId: string): Promise<JobResponse> {
    return request(`/items/add-status/${encodeURIComponent(requestId)}`);
}

export function getOperationStatus(requestId: string): Promise<JobResponse> {
    return request(`/selected/operations/${encodeURIComponent(requestId)}`);
}
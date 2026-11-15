export interface PaginationParams {
    offset: number;
    limit: number;
    filter: number;
}

export interface PaginatedResponse {
    items: number[];
    hasMore: boolean;
    nextOffset: number;
}

export interface AddItemRequest {
    id: number;
}

export interface ReorderRequest {
    activeId: number;
    overId: number;
}

export interface PaginatedResponse {
    items: number[];
    hasMore: boolean;
    nextOffset: number;
}


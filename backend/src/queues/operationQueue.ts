import { randomUUID } from 'node:crypto';

import {
    allIds,
    selectedIds,
    pendingSelectedIds,
    operationJobs,
    selectItem,
    removeSelectedItem,
    reorderSelectedItems,
    type OperationJob
} from '../config/store.js';

type Operation =
    | { type: 'select'; id: number; job: OperationJob }
    | { type: 'remove'; id: number; job: OperationJob }
    | { type: 'reorder'; activeId: number; overId: number; job: OperationJob };

const queue: Operation[] = [];
const UPDATE_INTERVAL = 1_000;

function createJob(requestKey?: string): {
    job: OperationJob;
    duplicate: boolean;
} {
    const requestId = requestKey?.trim() || randomUUID();
    const existing = operationJobs.get(requestId);

    if (existing) {
        return { job: existing, duplicate: true };
    }

    const job: OperationJob = {
        requestId,
        status: 'queued',
        createdAt: Date.now()
    };

    operationJobs.set(requestId, job);

    return { job, duplicate: false };
}

export function enqueueSelect(id: number, key?: string) {
    const result = createJob(key);

    if (result.duplicate) {
        return result;
    }

    if (!allIds.has(id)) {
        result.job.status = 'failed';
        result.job.error = 'ID does not exist';
        return result;
    }

    if (selectedIds.has(id) || pendingSelectedIds.has(id)) {
        result.job.status = 'failed';
        result.job.error = 'ID is already selected';
        return result;
    }

    pendingSelectedIds.add(id);
    queue.push({ type: 'select', id, job: result.job });

    return result;
}

export function enqueueRemove(id: number, key?: string) {
    const result = createJob(key);

    if (result.duplicate) {
        return result;
    }

    if (!selectedIds.has(id) && !pendingSelectedIds.has(id)) {
        result.job.status = 'failed';
        result.job.error = 'ID is not selected';
        return result;
    }

    queue.push({ type: 'remove', id, job: result.job });

    return result;
}

export function enqueueReorder(
    activeId: number,
    overId: number,
    key?: string
) {
    const result = createJob(key);

    if (result.duplicate) {
        return result;
    }

    if (
        !selectedIds.has(activeId) ||
        !selectedIds.has(overId)
    ) {
        result.job.status = 'failed';
        result.job.error = 'Both IDs must be selected';
        return result;
    }

    queue.push({
        type: 'reorder',
        activeId,
        overId,
        job: result.job
    });

    return result;
}

function processQueue(): void {
    if (queue.length === 0) return;

    const batch = queue.splice(0, queue.length);

    for (const operation of batch) {
        try {
            switch (operation.type) {
                case 'select':
                    pendingSelectedIds.delete(operation.id);
                    selectItem(operation.id);
                    break;

                case 'remove':
                    pendingSelectedIds.delete(operation.id);
                    removeSelectedItem(operation.id);
                    break;

                case 'reorder': {
                    const success = reorderSelectedItems(
                        operation.activeId,
                        operation.overId
                    );

                    if (!success) {
                        throw new Error('Unable to reorder selected items');
                    }

                    break;
                }
            }

            operation.job.status = 'completed';
        } catch (error) {
            if (operation.type === 'select' || operation.type === 'remove') {
                pendingSelectedIds.delete(operation.id);
            }

            operation.job.status = 'failed';
            operation.job.error = error instanceof Error
                ? error.message
                : 'Unknown error';
        }
    }
}

const timer = setInterval(processQueue, UPDATE_INTERVAL);
timer.unref();
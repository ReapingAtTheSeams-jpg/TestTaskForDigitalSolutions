import { randomUUID } from 'node:crypto';

import {
    allIds,
    pendingIds,
    addJobs,
    insertExtraId,
    type AddJob
} from '../config/store.js';

const ADD_INTERVAL = 10_000;

const queue: AddJob[] = [];

function cleanOldJobs(): void {
    const expiration = Date.now() - 60 * 60 * 1000;

    for (const [key, job] of addJobs) {
        if (job.status !== 'queued' && job.createdAt < expiration) {
            addJobs.delete(key);
        }
    }
}

export function enqueueAdd(
    id: number,
    requestKey?: string
): { job: AddJob; duplicate: boolean; conflict?: string } {
    const requestId = requestKey?.trim() || randomUUID();

    const existingRequest = addJobs.get(requestId);

    if (existingRequest) {
        if (existingRequest.id !== id) {
            return {
                job: existingRequest,
                duplicate: false,
                conflict: 'Idempotency key is already used for another ID'
            };
        }

        return {
            job: existingRequest,
            duplicate: true
        };
    }

    if (allIds.has(id) || pendingIds.has(id)) {
        return {
            job: {
                requestId,
                id,
                status: 'failed',
                createdAt: Date.now(),
                error: 'ID already exists'
            },
            duplicate: false,
            conflict: 'ID already exists'
        };
    }

    const job: AddJob = {
        requestId,
        id,
        status: 'queued',
        createdAt: Date.now()
    };

    // Резервируем ID синхронно, до помещения в очередь.
    pendingIds.add(id);
    addJobs.set(requestId, job);
    queue.push(job);

    cleanOldJobs();

    return {
        job,
        duplicate: false
    };
}

function processQueue(): void {
    if (queue.length === 0) return;

    const batch = queue.splice(0, queue.length);

    for (const job of batch) {
        try {
            allIds.add(job.id);
            insertExtraId(job.id);

            job.status = 'completed';
            pendingIds.delete(job.id);
        } catch (error) {
            job.status = 'failed';
            job.error = error instanceof Error
                ? error.message
                : 'Unknown error';

            pendingIds.delete(job.id);
        }
    }

    console.log(`[AddQueue] Processed ${batch.length} items`);
}

const timer = setInterval(processQueue, ADD_INTERVAL);
timer.unref();
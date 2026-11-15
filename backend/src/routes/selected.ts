import { Router, type Request, type Response } from 'express';
import { enqueueRead } from '../queues/readQueue.js';

import {
    getSelectedItems,
    MAX_PAGE_SIZE,
    operationJobs
} from '../config/store.js';

import {
    enqueueSelect,
    enqueueRemove,
    enqueueReorder
} from '../queues/operationQueue.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    const rawOffset = Number(req.query.offset ?? 0);
    const rawLimit = Number(req.query.limit ?? MAX_PAGE_SIZE);
    const filter = String(req.query.filter ?? '');

    if (
        !Number.isSafeInteger(rawOffset) ||
        rawOffset < 0 ||
        !Number.isSafeInteger(rawLimit) ||
        rawLimit < 1
    ) {
        res.status(400).json({ error: 'Invalid pagination parameters' });
        return;
    }

    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

    try {
        const result = await enqueueRead(() =>
            getSelectedItems(rawOffset, limit, filter)
        );

        res.json(result);
    } catch {
        res.status(500).json({ error: 'Failed to read selected items' });
    }
});

router.post('/', (req: Request, res: Response) => {
    const id = Number(req.body?.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
    }

    const result = enqueueSelect(id, req.header('Idempotency-Key'));

    if (result.job.status === 'failed') {
        res.status(409).json(result.job);
        return;
    }

    res.status(result.job.status === 'completed' ? 200 : 202).json({
        ...result.job,
        duplicateRequest: result.duplicate
    });
});

router.delete('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
    }

    const result = enqueueRemove(id, req.header('Idempotency-Key'));

    if (result.job.status === 'failed') {
        res.status(409).json(result.job);
        return;
    }

    res.status(result.job.status === 'completed' ? 200 : 202).json({
        ...result.job,
        duplicateRequest: result.duplicate
    });
});

router.patch('/reorder', (req: Request, res: Response) => {
    const activeId = Number(req.body?.activeId);
    const overId = Number(req.body?.overId);

    if (
        !Number.isSafeInteger(activeId) ||
        activeId <= 0 ||
        !Number.isSafeInteger(overId) ||
        overId <= 0
    ) {
        res.status(400).json({ error: 'Invalid IDs' });
        return;
    }

    const result = enqueueReorder(
        activeId,
        overId,
        req.header('Idempotency-Key')
    );

    if (result.job.status === 'failed') {
        res.status(409).json(result.job);
        return;
    }

    res.status(result.job.status === 'completed' ? 200 : 202).json({
        ...result.job,
        duplicateRequest: result.duplicate
    });
});

router.get('/operations/:requestId', (req: Request, res: Response) => {
    const requestId = req.params.requestId;

    if (typeof requestId !== 'string') {
        res.status(400).json({ error: 'Invalid request ID' });
        return;
    }

    const job = operationJobs.get(requestId);

    if (!job) {
        res.status(404).json({ error: 'Request not found' });
        return;
    }

    res.json(job);
});

export default router;
import { Router, type Request, type Response } from 'express';


import {
    getAvailableItems,
    MAX_PAGE_SIZE,
    addJobs
} from '../config/store.js';

import { enqueueAdd } from '../queues/addQueue.js';
import { enqueueRead } from '../queues/readQueue.js';

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
            getAvailableItems(rawOffset, limit, filter)
        );

        res.json(result);
    } catch {
        res.status(500).json({ error: 'Failed to read items' });
    }
});

router.post('/', (req: Request, res: Response) => {
    const id = Number(req.body?.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({
            error: 'ID must be a positive safe integer'
        });
        return;
    }

    const key = req.header('Idempotency-Key');
    const result = enqueueAdd(id, key);

    if (result.conflict) {
        res.status(409).json({
            error: result.conflict,
            requestId: result.job.requestId
        });
        return;
    }

    res.status(result.job.status === 'completed' ? 200 : 202).json({
        requestId: result.job.requestId,
        id: result.job.id,
        status: result.job.status,
        duplicateRequest: result.duplicate
    });
});

router.get('/add-status/:requestId', (req: Request, res: Response) => {
    const requestId = req.params.requestId;

    if (typeof requestId !== 'string') {
        res.status(400).json({ error: 'Invalid request ID' });
        return;
    }

    const job = addJobs.get(requestId);

    if (!job) {
        res.status(404).json({ error: 'Request not found' });
        return;
    }

    res.json(job);
});

export default router;
import express, {
    type Express,
    type Request,
    type Response
} from 'express';

import cors from 'cors';

import { allIds } from './config/store.js';
import itemsRouter from './routes/items.js';
import selectedRouter from './routes/selected.js';

const app: Express = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        totalItems: allIds.size
    });
});

app.use('/api/items', itemsRouter);
app.use('/api/selected', selectedRouter);

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
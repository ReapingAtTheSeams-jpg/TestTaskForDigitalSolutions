type ReadTask = () => void;

const queue: ReadTask[] = [];
const READ_INTERVAL = 1_000;

export function enqueueRead<T>(read: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        queue.push(() => {
            try {
                resolve(read());
            } catch (error) {
                reject(error);
            }
        });
    });
}

function processQueue(): void {
    if (queue.length === 0) return;

    const batch = queue.splice(0, queue.length);

    for (const task of batch) {
        task();
    }
}

const timer = setInterval(processQueue, READ_INTERVAL);
timer.unref();
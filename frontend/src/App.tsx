import {
    DndContext,
    closestCenter,
    type DragEndEvent
} from '@dnd-kit/core';

import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove
} from '@dnd-kit/sortable';

import {
    addItem,
    getAddStatus,
    getItems,
    getOperationStatus,
    getSelected,
    removeItem,
    reorderItems,
    selectItem
} from './api';

import type { JobResponse } from './api';

import {
    PlainItem,
    SortableItem
} from './components/Item';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type UIEvent
} from 'react';

interface ListState {
    items: number[];
    offset: number;
    hasMore: boolean;
    loading: boolean;
}

const emptyList: ListState = {
    items: [],
    offset: 0,
    hasMore: true,
    loading: false
};

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForJob(
    requestId: string,
    getStatus: (id: string) => Promise<JobResponse>
): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt++) {
        const job = await getStatus(requestId);

        if (job.status === 'completed') return;

        if (job.status === 'failed') {
            throw new Error(job.error ?? 'Операция не выполнена');
        }

        await sleep(300);
    }

    throw new Error('Истекло время ожидания операции');
}

function App() {
    const [available, setAvailable] = useState<ListState>(emptyList);
    const [selected, setSelected] = useState<ListState>(emptyList);

    const [availableFilter, setAvailableFilter] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('');

    const [newId, setNewId] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const availableVersion = useRef(0);
    const selectedVersion = useRef(0);

    const loadAvailable = useCallback(async (
        reset = false,
        filter = availableFilter
    ) => {
        if (!reset && (!available.hasMore || available.loading)) return;

        const version = reset
            ? ++availableVersion.current
            : availableVersion.current;

        const offset = reset ? 0 : available.offset;

        setAvailable(previous => ({
            ...previous,
            loading: true
        }));

        try {
            const result = await getItems(offset, filter);

            if (version !== availableVersion.current) return;

            setAvailable(previous => ({
                items: reset
                    ? result.items
                    : [...previous.items, ...result.items],
                offset: result.nextOffset,
                hasMore: result.hasMore,
                loading: false
            }));
        } catch (err) {
            if (version === availableVersion.current) {
                setError(err instanceof Error ? err.message : 'Ошибка загрузки');
                setAvailable(previous => ({ ...previous, loading: false }));
            }
        }
    }, [available, availableFilter]);

    const loadSelected = useCallback(async (
        reset = false,
        filter = selectedFilter
    ) => {
        if (!reset && (!selected.hasMore || selected.loading)) return;

        const version = reset
            ? ++selectedVersion.current
            : selectedVersion.current;

        const offset = reset ? 0 : selected.offset;

        setSelected(previous => ({
            ...previous,
            loading: true
        }));

        try {
            const result = await getSelected(offset, filter);

            if (version !== selectedVersion.current) return;

            setSelected(previous => ({
                items: reset
                    ? result.items
                    : [...previous.items, ...result.items],
                offset: result.nextOffset,
                hasMore: result.hasMore,
                loading: false
            }));
        } catch (err) {
            if (version === selectedVersion.current) {
                setError(err instanceof Error ? err.message : 'Ошибка загрузки');
                setSelected(previous => ({ ...previous, loading: false }));
            }
        }
    }, [selected, selectedFilter]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadAvailable(true, availableFilter);
        }, 250);

        return () => window.clearTimeout(timer);
    }, [availableFilter]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadSelected(true, selectedFilter);
        }, 250);

        return () => window.clearTimeout(timer);
    }, [selectedFilter]);

    async function handleAdd() {
        const id = Number(newId);

        if (!Number.isSafeInteger(id) || id <= 0) {
            setError('Введите положительный целочисленный ID');
            return;
        }

        setAdding(true);
        setError('');

        try {
            const job = await addItem(id);

            await waitForJob(job.requestId, getAddStatus);

            setNewId('');
            await loadAvailable(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось добавить ID');
        } finally {
            setAdding(false);
        }
    }

    async function handleSelect(id: number) {
        setError('');

        try {
            const job = await selectItem(id);

            await waitForJob(job.requestId, getOperationStatus);

            await Promise.all([
                loadAvailable(true),
                loadSelected(true)
            ]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось выбрать ID');
        }
    }

    async function handleRemove(id: number) {
        setError('');

        try {
            const job = await removeItem(id);

            await waitForJob(job.requestId, getOperationStatus);

            await Promise.all([
                loadAvailable(true),
                loadSelected(true)
            ]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось убрать ID');
        }
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const activeId = Number(active.id);
        const overId = Number(over.id);

        const previousItems = selected.items;

        setSelected(previous => ({
            ...previous,
            items: arrayMove(
                previous.items,
                previous.items.indexOf(activeId),
                previous.items.indexOf(overId)
            )
        }));

        try {
            const job = await reorderItems(activeId, overId);

            await waitForJob(job.requestId, getOperationStatus);

            await loadSelected(true);
        } catch (err) {
            setSelected(previous => ({
                ...previous,
                items: previousItems
            }));

            setError(err instanceof Error ? err.message : 'Не удалось изменить порядок');
        }
    }

    function handleScroll(
    event: UIEvent<HTMLDivElement>,
    loadMore: () => void
    ) {
        const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            loadMore();
        }
    }

    return (
        <main className="app">
            {error && (
                <div className="error-message">
                    {error}
                    <button type="button" onClick={() => setError('')}>×</button>
                </div>
            )}

            <section className="lists">
                <div className="list-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Все элементы</h2>
                        </div>
                        <span className="counter">{available.items.length}</span>
                    </div>

                    <input
                        className="filter-input"
                        placeholder="Поиск по ID..."
                        value={availableFilter}
                        onChange={event => setAvailableFilter(event.target.value)}
                    />

                    <div
                        className="items-scroll"
                        onScroll={event => handleScroll(
                            event,
                            () => void loadAvailable()
                        )}
                    >
                        {available.items.map(id => (
                            <PlainItem
                                key={id}
                                id={id}
                                onClick={() => void handleSelect(id)}
                            />
                        ))}

                        {available.loading && (
                            <div className="list-message">Загрузка...</div>
                        )}

                        {!available.loading && available.items.length === 0 && (
                            <div className="list-message">Ничего не найдено</div>
                        )}

                        {!available.hasMore && available.items.length > 0 && (
                            <div className="list-message">Все элементы загружены</div>
                        )}
                    </div>

                    <section className="add-panel">
                        <input
                            type="number"
                            min="1"
                            placeholder="Введите ID для добавления"
                            value={newId}
                            onChange={event => setNewId(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Enter' && !adding) {
                                    void handleAdd();
                                }
                            }}
                        />

                        <button
                            type="button"
                            onClick={() => void handleAdd()}
                            disabled={adding}
                        >
                            {adding ? 'Добавление...' : 'Добавить ID'}
                        </button>
                    </section>
                </div>

                <div className="list-panel selected-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Выбранные элементы</h2>
                        </div>
                        <span className="counter">{selected.items.length}</span>
                    </div>

                    <input
                        className="filter-input"
                        placeholder="Поиск по ID..."
                        value={selectedFilter}
                        onChange={event => setSelectedFilter(event.target.value)}
                    />

                    <div
                        className="items-scroll"
                        onScroll={event => handleScroll(
                            event,
                            () => void loadSelected()
                        )}
                    >
                        <DndContext
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={selected.items}
                                strategy={verticalListSortingStrategy}
                            >
                                {selected.items.map(id => (
                                    <SortableItem
                                        key={id}
                                        id={id}
                                        onClick={() => void handleRemove(id)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        {selected.loading && (
                            <div className="list-message">Загрузка...</div>
                        )}

                        {!selected.loading && selected.items.length === 0 && (
                            <div className="list-message">Пока ничего не выбрано</div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
    
}

export default App;
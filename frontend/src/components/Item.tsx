import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ItemProps {
    id: number;
    selected?: boolean;
    onClick?: () => void;
}

export function PlainItem({ id, selected, onClick }: ItemProps) {
    return (
        <div className="item-row">
            <span className="item-id">#{id}</span>

            {onClick && (
                <button
                    className="item-action"
                    onClick={onClick}
                    type="button"
                >
                    {selected ? 'Убрать' : 'Выбрать'}
                </button>
            )}
        </div>
    );
}

export function SortableItem({ id, onClick }: ItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`item-row sortable-item ${isDragging ? 'dragging' : ''}`}
            style={{
                transform: CSS.Transform.toString(transform),
                transition
            }}
        >
            <button
                className="drag-handle"
                type="button"
                aria-label={`Переместить элемент ${id}`}
                {...attributes}
                {...listeners}
            >
                ⠿
            </button>

            <span className="item-id">#{id}</span>

            <button
                className="item-action"
                onClick={onClick}
                type="button"
            >
                Убрать
            </button>
        </div>
    );
}
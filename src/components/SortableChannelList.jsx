// SortableChannelList — drag-and-drop reordering of channel cards within a group
import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import ChannelCard from './ChannelCard';

function SortableItem({ channel, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/drag">
      {/* Drag handle — visible on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-5 top-5 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 opacity-0 group-hover/drag:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-[#444]" />
      </div>
      {children}
    </div>
  );
}

export default function SortableChannelList({ channels, videosMap, videosLoading, onEdit, keyStatus, onGoToSettings, storageKey = 'statflow-channels-order' }) {
  const [orderedIds, setOrderedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sort channels by saved order
  const sortedChannels = [...channels].sort((a, b) => {
    const idxA = orderedIds.indexOf(a.id);
    const idxB = orderedIds.indexOf(b.id);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  useEffect(() => {
    if (orderedIds.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(orderedIds));
      } catch {}
    }
  }, [orderedIds, storageKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedChannels.findIndex(ch => ch.id === active.id);
    const newIndex = sortedChannels.findIndex(ch => ch.id === over.id);
    const newOrder = arrayMove(sortedChannels, oldIndex, newIndex);
    setOrderedIds(newOrder.map(ch => ch.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedChannels.map(ch => ch.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {sortedChannels.map((channel) => (
            <SortableItem key={channel.id} channel={channel}>
              <ChannelCard
                channel={channel}
                videos={videosMap[channel.id] || null}
                loading={videosLoading}
                onEdit={onEdit}
                hasApiKey={channel.type === 'youtube' ? keyStatus.youtubeKeySet : keyStatus.tiktokKeySet}
                onGoToSettings={onGoToSettings}
              />
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

'use client';
import { useState } from 'react';
import { Timer, MessageSquare, CheckSquare, Music, Palette, ChevronRight, X } from 'lucide-react';
import PomodoroTimer from './PomodoroTimer';
import ChatPanel from './ChatPanel';
import TaskList from './TaskList';
import AmbientPlayer from './AmbientPlayer';
import BackgroundPicker from './BackgroundPicker';

export type SidebarTab = 'timer' | 'chat' | 'tasks' | 'sounds' | 'themes';

interface SidebarProps {
  roomId: string;
  displayName: string;
  myPeerId: string;
  onSetGoal: (goal: string) => void;
  currentGoal: string;
  bgTheme: string;
  onBgChange: (theme: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { id: SidebarTab; label: string; icon: typeof Timer }[] = [
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'sounds', label: 'Sounds', icon: Music },
  { id: 'themes', label: 'Theme', icon: Palette },
];

export default function Sidebar({
  roomId,
  displayName,
  myPeerId,
  onSetGoal,
  currentGoal,
  bgTheme,
  onBgChange,
  isOpen,
  onClose,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('timer');

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      className="w-full sm:w-80 md:w-96 flex flex-col h-full glass border-l border-white/10 z-20 transition-all duration-300 flex-shrink-0"
    >
      {/* Tab Navigation Strip */}
      <div className="flex items-center justify-between px-2 pt-2 pb-1 border-b border-white/10 bg-black/20">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Close Sidebar button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0 ml-1"
          title="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'timer' && (
          <PomodoroTimer roomId={roomId} userName={displayName} />
        )}
        {activeTab === 'chat' && (
          <ChatPanel roomId={roomId} displayName={displayName} />
        )}
        {activeTab === 'tasks' && (
          <TaskList
            roomId={roomId}
            myPeerId={myPeerId}
            displayName={displayName}
            onSetGoal={onSetGoal}
            currentGoal={currentGoal}
          />
        )}
        {activeTab === 'sounds' && <AmbientPlayer />}
        {activeTab === 'themes' && (
          <BackgroundPicker currentTheme={bgTheme} onSelectTheme={onBgChange} />
        )}
      </div>
    </aside>
  );
}

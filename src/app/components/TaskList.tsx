'use client';
import { useState } from 'react';
import { Plus, Check, Trash2, Target, CheckCircle2 } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';

interface TaskListProps {
  roomId: string;
  myPeerId: string;
  displayName: string;
  onSetGoal: (goal: string) => void;
  currentGoal: string;
}

export default function TaskList({
  roomId,
  myPeerId,
  displayName,
  onSetGoal,
  currentGoal,
}: TaskListProps) {
  const { tasks, addTask, toggleTask, deleteTask } = useTasks(roomId, myPeerId, displayName);
  const [text, setText] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    addTask(trimmed);
    if (!currentGoal) {
      onSetGoal(trimmed);
    }
    setText('');
  };

  const completedCount = tasks.filter((t) => t.done).length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="flex flex-col h-full p-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Session Tasks & Goals
        </span>
        <span className="text-[11px] text-slate-400 font-medium">
          {completedCount}/{tasks.length} Done ({progressPct}%)
        </span>
      </div>

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <div className="w-full h-1.5 bg-white/10 rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Active Goal Pill */}
      <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/25 mb-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-300">
          <Target className="w-3.5 h-3.5 text-purple-400" />
          <span>Active Cam Status Badge</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentGoal}
            onChange={(e) => onSetGoal(e.target.value)}
            placeholder="e.g. Finish Chapter 4 Notes ✍️"
            className="flex-1 bg-white/5 border border-purple-500/20 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />
        </div>
      </div>

      {/* Add Task Input */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add session task..."
          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Task List Items */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {tasks.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No session tasks yet. Add what you plan to accomplish!
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 p-2.5 rounded-xl transition-all border group ${
                task.done
                  ? 'bg-emerald-950/20 border-emerald-500/20 opacity-75'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              {/* Checkbox button */}
              <button
                onClick={() => toggleTask(task.id, task.done)}
                className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                  task.done
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'border border-white/30 hover:border-purple-400'
                }`}
              >
                {task.done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              {/* Task Text & Badges */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs truncate transition-all ${
                    task.done ? 'line-through text-slate-400' : 'text-slate-200'
                  }`}
                >
                  {task.text}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500">{task.ownerName}</span>
                  {!task.done && (
                    <button
                      onClick={() => onSetGoal(task.text)}
                      className="text-[10px] text-purple-400 hover:underline"
                    >
                      Set as badge
                    </button>
                  )}
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all rounded"
                title="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

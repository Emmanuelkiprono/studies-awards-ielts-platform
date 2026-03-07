import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/UI';
import {
  PlayCircle,
  FileText,
  Lightbulb,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Resource } from '../types';

type Tab = 'all' | 'video' | 'pdf' | 'tip';

const typeIcon: Record<string, React.ElementType> = {
  video: PlayCircle,
  pdf: FileText,
  tip: Lightbulb,
};

const typeStyle: Record<string, string> = {
  video: 'bg-[#6324eb]/20 text-[#6324eb] border-[#6324eb]/20',
  pdf: 'bg-red-500/20 text-red-400 border-red-500/20',
  tip: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
};

const typeBadge: Record<string, string> = {
  video: 'Video',
  pdf: 'PDF',
  tip: 'Tip',
};

export const ResourcesPage: React.FC = () => {
  const { user, studentData } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    if (!studentData?.courseId) { setLoading(false); return; }
    getDocs(query(
      collection(db, 'resources'),
      where('courseId', '==', studentData.courseId),
      orderBy('createdAt', 'desc')
    )).then(snap => {
      setResources(snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [studentData?.courseId]);

  const filtered = tab === 'all' ? resources : resources.filter(r => r.type === tab);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'video', label: 'Videos' },
    { key: 'pdf', label: 'PDFs' },
    { key: 'tip', label: 'Tips' },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="size-10 border-4 border-[rgba(99,36,235,0.3)] border-t-[#6324eb] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 space-y-6 max-w-2xl mx-auto w-full pb-32"
    >
      <h2 className="text-2xl font-bold text-[var(--ui-heading)]">Resources</h2>

      {/* Tabs */}
      <div className="flex border-b border-[var(--ui-border-soft)] sticky top-[73px] bg-[var(--ui-bg)]/80 backdrop-blur-sm z-40">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 pb-3 pt-2 text-sm font-bold border-b-2 transition-colors',
              tab === t.key
                ? 'border-[var(--ui-accent)] text-[var(--ui-heading)]'
                : 'border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-heading)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="size-16 rounded-3xl bg-white/5 flex items-center justify-center">
            <FolderOpen size={28} className="text-[var(--ui-muted)]" />
          </div>
          <div>
            <p className="font-bold text-[var(--ui-heading)]">No resources yet</p>
            <p className="text-[var(--ui-muted)] text-sm mt-1">Your teacher will upload resources here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(item => {
            const Icon = typeIcon[item.type] ?? FileText;
            return (
              <GlassCard key={item.id} className="p-4 flex gap-4 items-center group">
                <div className={cn(
                  'size-16 shrink-0 rounded-xl flex items-center justify-center border',
                  typeStyle[item.type] ?? typeStyle.pdf
                )}>
                  <Icon size={26} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black text-[var(--ui-accent)] uppercase tracking-widest">
                    {typeBadge[item.type]}
                  </span>
                  <h3 className="text-[var(--ui-heading)] font-bold text-sm truncate mt-0.5">{item.title}</h3>
                  {item.description && (
                    <p className="text-[var(--ui-muted)] text-xs mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 bg-[var(--ui-accent)]/20 text-[var(--ui-accent)] rounded-lg text-xs font-bold hover:bg-[var(--ui-accent)] hover:text-white transition-all"
                  >
                    <ExternalLink size={12} />
                    {item.type === 'video' ? 'Watch' : item.type === 'pdf' ? 'Open PDF' : 'Read'}
                  </a>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

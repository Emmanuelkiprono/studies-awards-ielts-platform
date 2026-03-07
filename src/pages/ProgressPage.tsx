import React, { useEffect, useState } from 'react';
import { GlassCard, StatusBadge } from '../components/UI';
import {
  TrendingUp,
  GraduationCap,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Assignment, Submission } from '../types';

const SKILL_TYPES = ['writing', 'listening', 'reading', 'speaking'] as const;
const SKILL_COLORS: Record<string, string> = {
  writing: 'bg-[#6324eb]',
  listening: 'bg-blue-400',
  reading: 'bg-emerald-400',
  speaking: 'bg-pink-400',
};

export const ProgressPage: React.FC = () => {
  const { user, studentData } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !studentData?.courseId) { setLoading(false); return; }
    const load = async () => {
      const [aSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'assignments'), where('courseId', '==', studentData.courseId))),
        getDocs(query(collection(db, 'submissions'), where('studentId', '==', user.uid), where('status', '==', 'graded'))),
      ]);
      setAssignments(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
      setSubmissions(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
      setLoading(false);
    };
    load();
  }, [user, studentData?.courseId]);

  const graded = submissions.filter(s => s.bandScore != null);
  const avgScore = graded.length
    ? (graded.reduce((sum, s) => sum + (s.bandScore ?? 0), 0) / graded.length)
    : null;

  // Chart: one point per graded submission, sorted by submittedAt
  const chartData = [...graded]
    .sort((a, b) => (a.submittedAt > b.submittedAt ? 1 : -1))
    .map((s, i) => ({
      name: `#${i + 1}`,
      score: s.bandScore ?? 0,
    }));

  // Skill breakdown: avg band score per type
  const skillBreakdown = SKILL_TYPES.map(type => {
    const typeAssignmentIds = new Set(
      assignments.filter(a => a.type === type).map(a => a.id)
    );
    const typeSubs = graded.filter(s => typeAssignmentIds.has(s.assignmentId));
    const avg = typeSubs.length
      ? typeSubs.reduce((sum, s) => sum + (s.bandScore ?? 0), 0) / typeSubs.length
      : null;
    return { label: type.charAt(0).toUpperCase() + type.slice(1), type, avg, count: typeSubs.length };
  });

  const totalSubmitted = submissions.length;
  const totalGraded = graded.length;
  const totalPending = assignments.filter(
    a => !submissions.find(s => s.assignmentId === a.id)
  ).length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="size-10 border-4 border-[rgba(99,36,235,0.3)] border-t-[#6324eb] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 space-y-6 max-w-lg mx-auto w-full pb-24"
    >
      <section>
        <h2 className="text-2xl font-bold text-[var(--ui-heading)]">Your Progress</h2>
        <p className="text-[var(--ui-muted)] text-sm">Keep track of your IELTS journey</p>
      </section>

      {/* Chart Section */}
      <GlassCard className="p-5">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[var(--ui-muted)] text-xs font-bold uppercase tracking-wider">Avg Band Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[var(--ui-heading)]">
                {avgScore != null ? avgScore.toFixed(1) : '—'}
              </span>
              {avgScore != null && (
                <span className="text-emerald-400 text-sm font-semibold flex items-center">
                  <TrendingUp size={14} className="mr-1" />
                  Graded
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={`${totalGraded} graded`} variant="primary" />
        </div>

        {chartData.length >= 2 ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6324eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6324eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1b4b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#6324eb' }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#6324eb"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorScore)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-center">
            <div>
              <TrendingUp size={36} className="mx-auto text-slate-700 mb-2" />
              <p className="text-[var(--ui-muted)] text-sm">
                {totalGraded === 0
                  ? 'No graded submissions yet'
                  : 'Submit more assignments to see your trend'}
              </p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-4 flex flex-col gap-1">
          <GraduationCap size={20} className="text-[#6324eb]" />
          <p className="text-[var(--ui-heading)] text-lg font-bold">{totalSubmitted}</p>
          <p className="text-[var(--ui-muted)] text-xs">Total Submitted</p>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col gap-1">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <p className="text-[var(--ui-heading)] text-lg font-bold">{totalGraded}</p>
          <p className="text-[var(--ui-muted)] text-xs">Graded</p>
        </GlassCard>
        <GlassCard className="col-span-2 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 p-2 rounded-xl">
              <ClipboardList size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[var(--ui-heading)] font-bold">{totalPending} Pending</p>
              <p className="text-[var(--ui-muted)] text-xs">Assignments not yet submitted</p>
            </div>
          </div>
          <span className="text-[10px] font-black text-[var(--ui-muted)] uppercase">{assignments.length} total</span>
        </GlassCard>
      </div>

      {/* Skill Breakdown */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-[var(--ui-heading)] px-1">Skill Breakdown</h3>
        <div className="space-y-3">
          {skillBreakdown.map(skill => (
            <GlassCard key={skill.type} className="p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--ui-body)]">{skill.label}</span>
                <span className="text-sm font-bold text-[var(--ui-heading)]">
                  {skill.avg != null ? skill.avg.toFixed(1) : '—'}
                  <span className="text-[10px] text-[var(--ui-muted)] font-normal ml-1">
                    ({skill.count} graded)
                  </span>
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: skill.avg != null ? `${(skill.avg / 9) * 100}%` : '0%' }}
                  className={cn('h-2 rounded-full', SKILL_COLORS[skill.type])}
                />
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </motion.div>
  );
};

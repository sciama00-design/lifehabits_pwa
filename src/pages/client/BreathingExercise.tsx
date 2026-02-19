import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, RotateCcw, Wind, Sparkles, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Config ─────────────────────────────────────────────────────────
const PHASES = [
    { name: 'Inspira', duration: 3000, icon: '🌬️' },
    { name: 'Trattieni', duration: 3000, icon: '✨' },
    { name: 'Espira', duration: 3000, icon: '🍃' },
    { name: 'Pausa', duration: 3000, icon: '🧘' },
] as const;

const TOTAL_CYCLE = PHASES.reduce((s, p) => s + p.duration, 0); // 12s
const SESSION_DURATION = 2 * 60 * 1000; // 2 minutes
const PARTICLE_COUNT = 12;

type Phase = typeof PHASES[number]['name'];
type Status = 'idle' | 'running' | 'paused' | 'done';

// ─── Circle scale per phase ─────────────────────────────────────────
const scaleFor = (phase: Phase) => {
    switch (phase) {
        case 'Inspira': return 1.35;
        case 'Trattieni': return 1.35;
        case 'Espira': return 0.75;
        case 'Pausa': return 0.75;
    }
};

const glowFor = (phase: Phase) => {
    switch (phase) {
        case 'Inspira': return '0 0 80px rgba(16,185,129,.5), 0 0 160px rgba(16,185,129,.2)';
        case 'Trattieni': return '0 0 60px rgba(16,185,129,.4), 0 0 120px rgba(16,185,129,.15)';
        case 'Espira': return '0 0 30px rgba(16,185,129,.25), 0 0 60px rgba(16,185,129,.1)';
        case 'Pausa': return '0 0 20px rgba(16,185,129,.2), 0 0 40px rgba(16,185,129,.08)';
    }
};

// ─── Component ──────────────────────────────────────────────────────
export default function BreathingExercise() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status>('idle');
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [phaseProgress, setPhaseProgress] = useState(0);   // 0–1 within phase
    const [elapsed, setElapsed] = useState(0);
    const rafRef = useRef<number | null>(null);
    const startTimeRef = useRef(0);
    const pausedAtRef = useRef(0);

    const currentPhase = PHASES[phaseIndex];
    const totalProgress = Math.min(elapsed / SESSION_DURATION, 1);
    const remaining = Math.max(0, SESSION_DURATION - elapsed);
    const remainMin = Math.floor(remaining / 60000);
    const remainSec = Math.floor((remaining % 60000) / 1000);

    // ─── Main animation loop ───────────────────────────────────────
    const tick = useCallback((now: number) => {
        const dt = now - startTimeRef.current;
        setElapsed(dt);

        if (dt >= SESSION_DURATION) {
            setStatus('done');
            return;
        }

        // Determine current phase based on cycle position
        const cyclePos = dt % TOTAL_CYCLE;
        let acc = 0;
        for (let i = 0; i < PHASES.length; i++) {
            acc += PHASES[i].duration;
            if (cyclePos < acc) {
                setPhaseIndex(i);
                setPhaseProgress((cyclePos - (acc - PHASES[i].duration)) / PHASES[i].duration);
                break;
            }
        }

        rafRef.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        if (status === 'running') {
            startTimeRef.current = performance.now() - pausedAtRef.current;
            rafRef.current = requestAnimationFrame(tick);
        }
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [status, tick]);

    // ─── Controls ──────────────────────────────────────────────────
    const handleStart = () => {
        pausedAtRef.current = 0;
        setElapsed(0);
        setPhaseIndex(0);
        setPhaseProgress(0);
        setStatus('running');
    };

    const handlePause = () => {
        pausedAtRef.current = elapsed;
        setStatus('paused');
    };

    const handleResume = () => {
        setStatus('running');
    };

    const handleReset = () => {
        setStatus('idle');
        setElapsed(0);
        setPhaseIndex(0);
        setPhaseProgress(0);
        pausedAtRef.current = 0;
    };

    // ─── SVG ring ──────────────────────────────────────────────────
    const RING_R = 130;
    const RING_C = 2 * Math.PI * RING_R;

    // ─── Particles ─────────────────────────────────────────────────
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (360 / PARTICLE_COUNT) * i;
        const delay = (i / PARTICLE_COUNT) * 4;
        return { angle, delay, size: 3 + Math.random() * 3 };
    });

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
            {/* Full-screen gradient backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#0d9488] dark:from-[#022c22] dark:via-[#064e3b] dark:to-[#0f766e]" />

            {/* Subtle grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Back button */}
            <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => navigate('/')}
                className="absolute top-6 left-6 z-10 flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
            >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Torna alla Home</span>
            </motion.button>

            {/* Title */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative z-10 text-center mb-8"
            >
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Wind className="h-4 w-4 text-emerald-300" />
                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-[0.25em]">
                        Breathing Habits
                    </span>
                    <Wind className="h-4 w-4 text-emerald-300" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Respiriamo Insieme
                </h1>
            </motion.div>

            {/* ─── Main breathing circle area ───────────────────── */}
            <div className="relative z-10 flex items-center justify-center" style={{ width: 320, height: 320 }}>

                {/* Progress ring SVG */}
                <svg
                    className="absolute inset-0"
                    width={320}
                    height={320}
                    viewBox="0 0 320 320"
                >
                    {/* Track */}
                    <circle
                        cx={160}
                        cy={160}
                        r={RING_R}
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={4}
                    />
                    {/* Progress */}
                    <motion.circle
                        cx={160}
                        cy={160}
                        r={RING_R}
                        fill="none"
                        stroke="url(#progressGrad)"
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C * (1 - totalProgress)}
                        style={{ transformOrigin: '160px 160px', rotate: '-90deg' }}
                    />
                    <defs>
                        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#34d399" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                    </defs>
                </svg>

                {/* Orbiting particles */}
                {status === 'running' && particles.map((p, i) => (
                    <div
                        key={i}
                        className="absolute breathing-particle"
                        style={{
                            width: p.size,
                            height: p.size,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(52,211,153,0.9), rgba(6,182,212,0.4))',
                            boxShadow: '0 0 6px rgba(52,211,153,0.6)',
                            left: '50%',
                            top: '50%',
                            transformOrigin: '0 0',
                            animation: `orbit 8s linear infinite`,
                            animationDelay: `${p.delay}s`,
                            ['--orbit-angle' as string]: `${p.angle}deg`,
                            ['--orbit-radius' as string]: '120px',
                        }}
                    />
                ))}

                {/* The breathing circle */}
                <motion.div
                    animate={{
                        scale: status === 'running' || status === 'paused'
                            ? scaleFor(currentPhase.name)
                            : 1,
                        boxShadow: status === 'running' || status === 'paused'
                            ? glowFor(currentPhase.name)
                            : '0 0 40px rgba(16,185,129,.2)',
                    }}
                    transition={{
                        scale: {
                            duration: currentPhase.duration / 1000,
                            ease: currentPhase.name === 'Inspira' || currentPhase.name === 'Espira'
                                ? 'easeInOut'
                                : 'linear',
                        },
                        boxShadow: { duration: 1 },
                    }}
                    className="relative w-40 h-40 rounded-full flex items-center justify-center"
                    style={{
                        background: 'radial-gradient(circle at 35% 35%, rgba(52,211,153,0.35), rgba(16,185,129,0.15), rgba(5,150,105,0.25))',
                        border: '2px solid rgba(52,211,153,0.3)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    {/* Inner glow ring */}
                    <div
                        className="absolute inset-2 rounded-full"
                        style={{
                            border: '1px solid rgba(52,211,153,0.15)',
                            background: 'radial-gradient(circle at 40% 40%, rgba(255,255,255,0.08), transparent 70%)',
                        }}
                    />

                    {/* Human silhouette / Lungs icon */}
                    <AnimatePresence mode="wait">
                        {status === 'idle' ? (
                            <motion.div
                                key="idle-icon"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center gap-1"
                            >
                                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-emerald-300 opacity-80">
                                    {/* Simple person meditating silhouette */}
                                    <circle cx="24" cy="10" r="5" fill="currentColor" />
                                    <path d="M24 16c-3 0-5 2-8 6-2 3-3 6-3 8 0 2 1.5 3 3 3s2.5-1 4-3l4-6 4 6c1.5 2 2.5 3 4 3s3-1 3-3c0-2-1-5-3-8-3-4-5-6-8-6z" fill="currentColor" opacity="0.7" />
                                    <path d="M16 38h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                                </svg>
                            </motion.div>
                        ) : status === 'done' ? (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-1"
                            >
                                <Check className="h-10 w-10 text-emerald-300" strokeWidth={3} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key={currentPhase.name}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.4 }}
                                className="flex flex-col items-center gap-2"
                            >
                                <span className="text-2xl">{currentPhase.icon}</span>
                                <span className="text-white text-sm font-bold tracking-wide">
                                    {currentPhase.name}
                                </span>
                                {/* Phase progress bar */}
                                <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                                        style={{ width: `${phaseProgress * 100}%` }}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Timer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="relative z-10 mt-6 text-center"
            >
                {status !== 'idle' && status !== 'done' && (
                    <p className="text-white/50 text-xs font-medium tracking-widest tabular-nums">
                        {String(remainMin).padStart(2, '0')}:{String(remainSec).padStart(2, '0')}
                    </p>
                )}
                {status === 'idle' && (
                    <p className="text-white/40 text-xs font-medium">
                        2 minuti · Box Breathing 3-3-3-3
                    </p>
                )}
            </motion.div>

            {/* Controls */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="relative z-10 mt-8 flex items-center gap-4"
            >
                {status === 'idle' && (
                    <button
                        onClick={handleStart}
                        className="flex items-center gap-3 px-8 py-3.5 rounded-full font-bold text-sm text-white
                            bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                            shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-95"
                    >
                        <Play className="h-4 w-4 fill-current" />
                        Inizia
                    </button>
                )}

                {status === 'running' && (
                    <button
                        onClick={handlePause}
                        className="flex items-center gap-3 px-8 py-3.5 rounded-full font-bold text-sm
                            text-white/90 bg-white/10 hover:bg-white/20 backdrop-blur-sm
                            border border-white/10 transition-all active:scale-95"
                    >
                        <Pause className="h-4 w-4" />
                        Pausa
                    </button>
                )}

                {status === 'paused' && (
                    <>
                        <button
                            onClick={handleResume}
                            className="flex items-center gap-3 px-8 py-3.5 rounded-full font-bold text-sm text-white
                                bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                                shadow-xl shadow-emerald-500/25 transition-all active:scale-95"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            Riprendi
                        </button>
                        <button
                            onClick={handleReset}
                            className="p-3.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </button>
                    </>
                )}

                {status === 'done' && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-emerald-300">
                            <Sparkles className="h-4 w-4" />
                            <span className="text-sm font-bold">Sessione completata!</span>
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleStart}
                                className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white
                                    bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                                    shadow-xl shadow-emerald-500/25 transition-all active:scale-95"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Ancora
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm
                                    text-white/80 bg-white/10 hover:bg-white/20 backdrop-blur-sm
                                    border border-white/10 transition-all active:scale-95"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Home
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Instruction text at bottom */}
            {status === 'idle' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="relative z-10 mt-10 max-w-xs text-center"
                >
                    <p className="text-white/30 text-[11px] leading-relaxed">
                        Inspira per 3 secondi, trattieni per 3, espira per 3, pausa per 3.
                        Ripeti per 2 minuti. Una pratica semplice per calmare mente e corpo.
                    </p>
                </motion.div>
            )}
        </div>
    );
}

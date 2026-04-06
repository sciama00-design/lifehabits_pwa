import { useState, useRef, useEffect, useCallback } from 'react';
import type { PhotoAnalysis, Tool, Point, Line } from '@/pages/coach/PostureAnalysis';
import { AnimatePresence, motion } from 'framer-motion';

interface PostureCanvasProps {
    photo: PhotoAnalysis;
    activeTool: Tool;
    updateAnalysis: (update: Partial<PhotoAnalysis>) => void;
    isExporting: boolean;
    onExportComplete: () => void;
    selectedItem: { type: 'point' | 'line', id: string } | null;
    setSelectedItem: (item: { type: 'point' | 'line', id: string } | null) => void;
}

export function PostureCanvas({ 
    photo, 
    activeTool, 
    updateAnalysis, 
    isExporting, 
    onExportComplete,
    selectedItem,
    setSelectedItem
}: PostureCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Transform State
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    
    // Interaction State
    const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null); // Reference line for parallel
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
    const [isPinching, setIsPinching] = useState(false);
    
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Set canvas dimensions based on image aspect ratio and container size
    useEffect(() => {
        const img = new Image();
        img.src = photo.url;
        img.onload = () => {
            const containerWidth = window.innerWidth;
            const containerHeight = window.innerHeight;
            
            const imgRatio = img.width / img.height;
            const containerRatio = containerWidth / containerHeight;
            
            let canvasWidth, canvasHeight;
            if (imgRatio > containerRatio) {
                // Image is wider, constrain by width
                canvasWidth = containerWidth;
                canvasHeight = containerWidth / imgRatio;
            } else {
                // Image is taller, constrain by height
                canvasHeight = containerHeight;
                canvasWidth = containerHeight * imgRatio;
            }
            
            setDimensions({ width: canvasWidth, height: canvasHeight });
            setScale(1);
            
            // If the user hates black spaces, maybe we start with scale slightly zoomed in? 
            // We stick to 1 for perfect fit, they can zoom.
            setOffset({ x: 0, y: 0 });
        };
    }, [photo.url]);

    // Recalculate on window resize
    useEffect(() => {
        const handleResize = () => {
            // Re-trigger the photo.url effect by updating a dummy state or just calling logic
            // But we already have isFullscreen and photo.url as deps.
            // Let's add a window resize listener that just triggers a re-calc.
            const img = new Image();
            img.src = photo.url;
            img.onload = () => {
                const containerWidth = window.innerWidth;
                const containerHeight = window.innerHeight;
                const imgRatio = img.width / img.height;
                const containerRatio = containerWidth / containerHeight;
                let canvasWidth, canvasHeight;
                if (imgRatio > containerRatio) {
                    canvasWidth = containerWidth;
                    canvasHeight = containerWidth / imgRatio;
                } else {
                    canvasHeight = containerHeight;
                    canvasWidth = containerHeight * imgRatio;
                }
                setDimensions({ width: canvasWidth, height: canvasHeight });
            };
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [photo.url]);

    const draw = useCallback((ctx: CanvasRenderingContext2D, isForExport = false) => {
        const drawWidth = ctx.canvas.width;
        const drawHeight = ctx.canvas.height;
        
        if (drawWidth === 0 || drawHeight === 0) return;

        ctx.clearRect(0, 0, drawWidth, drawHeight);

        ctx.save();
        if (!isForExport) {
            ctx.translate(offset.x, offset.y);
            ctx.scale(scale, scale);
        }

        const img = new Image();
        img.src = photo.url;
        ctx.drawImage(img, 0, 0, drawWidth, drawHeight);

        // --- Start Clipping For Overlays ---
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, drawWidth, drawHeight);
        ctx.clip();

        // Draw Lines
        photo.lines.forEach(line => {
            const p1 = photo.points.find(p => p.id === line.p1Id);
            const p2 = photo.points.find(p => p.id === line.p2Id);
            const isSelected = selectedItem?.id === line.id || selectedLineId === line.id;
            
            if (line.type === 'basic' && p1 && p2) {
                ctx.beginPath();
                ctx.moveTo((p1.x / 100) * drawWidth, (p1.y / 100) * drawHeight);
                ctx.lineTo((p2.x / 100) * drawWidth, (p2.y / 100) * drawHeight);
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#10b981cc';
                ctx.lineWidth = ((isSelected ? 2 : 1) / (isForExport ? 0.3 : scale)) * (isForExport ? drawWidth / 1000 : 1);
                if (isSelected && !isForExport) {
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = '#3b82f6';
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else if (line.type === 'parallel') {
                const refLine = photo.lines.find(l => l.id === line.refLineId);
                const passPoint = photo.points.find(p => p.id === line.p1Id);
                
                if (refLine && passPoint) {
                    const rp1 = photo.points.find(p => p.id === refLine.p1Id);
                    const rp2 = photo.points.find(p => p.id === refLine.p2Id);
                    
                    if (rp1 && rp2) {
                        const dx = (rp2.x - rp1.x);
                        const dy = (rp2.y - rp1.y);
                        
                        ctx.beginPath();
                        if (dx === 0) {
                            ctx.moveTo((passPoint.x / 100) * drawWidth, 0);
                            ctx.lineTo((passPoint.x / 100) * drawWidth, drawHeight);
                        } else {
                            const m = dy / dx;
                            const xStart = 0;
                            const yStart = m * (xStart - passPoint.x) + passPoint.y;
                            const xEnd = 100;
                            const yEnd = m * (xEnd - passPoint.x) + passPoint.y;
                            
                            ctx.moveTo((xStart / 100) * drawWidth, (yStart / 100) * drawHeight);
                            ctx.lineTo((xEnd / 100) * drawWidth, (yEnd / 100) * drawHeight);
                        }
                        ctx.strokeStyle = selectedItem?.id === line.id ? '#3b82f6' : '#22c55ecc';
                        ctx.setLineDash([(4 / scale) * (isForExport ? drawWidth/1000 : 1), (4 / scale) * (isForExport ? drawWidth/1000 : 1)]);
                        ctx.lineWidth = ((isForExport ? 2 : 1) / (isForExport ? 0.3 : scale)) * (isForExport ? drawWidth / 1000 : 1);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }
            }
        });

        // Draw Points
        photo.points.forEach(point => {
            const px = (point.x / 100) * drawWidth;
            const py = (point.y / 100) * drawHeight;
            const isSelected = selectedItem?.id === point.id;
            
            const baseSize = (isSelected ? 4 : 3);
            const exportSize = (isSelected ? 6 : 5) * (drawWidth / 1000);
            const finalSize = isForExport ? exportSize : baseSize / scale;

            ctx.beginPath();
            ctx.arc(px, py, finalSize, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? '#3b82f6' : '#ffffffcc';
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#2563eb' : '#10b981';
            ctx.lineWidth = (isSelected ? 2 : 1) / (isForExport ? 0.3 : scale) * (isForExport ? drawWidth/1000 : 1);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(px, py, isForExport ? 1 * (drawWidth/1000) : 1 / scale, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? 'white' : '#059669';
            ctx.fill();
        });

        ctx.restore(); // Overlay clipping
        ctx.restore(); // Transform
    }, [photo, dimensions, selectedItem, selectedLineId, scale, offset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        draw(ctx);
    }, [draw]);

    // Wheel Zoom
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = 1.1;
            const newScale = delta > 0 ? scale * factor : scale / factor;
            const finalScale = Math.max(1, Math.min(newScale, 10));
            
            if (finalScale !== scale) {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const ratio = finalScale / scale;
                setOffset(prev => ({
                    x: mouseX - (mouseX - prev.x) * ratio,
                    y: mouseY - (mouseY - prev.y) * ratio
                }));
                setScale(finalScale);
            }
        };
        const canvas = canvasRef.current;
        canvas?.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas?.removeEventListener('wheel', handleWheel);
    }, [scale, offset]);

    // Export
    useEffect(() => {
        if (isExporting) {
            const canvas = document.createElement('canvas');
            const img = new Image();
            img.src = photo.url;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    draw(ctx, true);
                    const link = document.createElement('a');
                    link.download = `analisi_posturale_${new Date().getTime()}.jpg`;
                    link.href = canvas.toDataURL('image/jpeg', 0.9);
                    link.click();
                    onExportComplete();
                }
            };
        }
    }, [isExporting, photo, draw, onExportComplete]);

    const getMousePos = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (((clientX - rect.left) - offset.x) / (rect.width * scale)) * 100,
            y: (((clientY - rect.top) - offset.y) / (rect.height * scale)) * 100
        };
    }, [scale, offset]);

    const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent | TouchEvent) => {
        if ('touches' in e) {
            if (e.touches.length > 1 && e.cancelable) e.preventDefault();
            
            if (e.touches.length === 2) {
                setIsPinching(true);
                const dist = Math.sqrt(
                    Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) +
                    Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2)
                );
                setLastTouchDistance(dist);
                return;
            }
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const pos = getMousePos(clientX, clientY);
        
        if (('button' in e && (e as React.MouseEvent).button === 1) || activeTool === 'select') {
            const pointUnderMouse = photo.points.find(p => {
                const dist = Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2));
                return dist < (3 / scale);
            });
            if (pointUnderMouse) {
                setSelectedItem({ type: 'point', id: pointUnderMouse.id });
                setDraggingPointId(pointUnderMouse.id);
                return;
            }

            // Check if clicked on a line
            const basicLines = photo.lines;
            let foundLineId = null;
            for (const line of basicLines) {
                const p1 = photo.points.find(p => p.id === line.p1Id);
                const p2 = photo.points.find(p => p.id === line.p2Id);
                if (!p1 || !p2) continue;
                const dist = getDistPointToSegment(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y);
                if (dist < (4 / scale)) { foundLineId = line.id; break; }
            }
            if (foundLineId) {
                setSelectedItem({ type: 'line', id: foundLineId });
                return;
            }

            setIsPanning(true);
            setLastMousePos({ x: clientX, y: clientY });
            setSelectedItem(null);
            return;
        }

        if (activeTool === 'point') {
            if ('touches' in e && e.cancelable) e.preventDefault();
            const pointUnderMouse = photo.points.find(p => {
                const dist = Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2));
                return dist < (3 / scale);
            });
            if (pointUnderMouse) {
                setSelectedItem({ type: 'point', id: pointUnderMouse.id });
                setDraggingPointId(pointUnderMouse.id);
                return;
            }
            const newPoint: Point = { id: crypto.randomUUID(), x: pos.x, y: pos.y };
            updateAnalysis({ points: [...photo.points, newPoint] });
            setSelectedItem({ type: 'point', id: newPoint.id });
        } else if (activeTool === 'line') {
            if ('touches' in e && e.cancelable) e.preventDefault();
            const pointUnderMouse = photo.points.find(p => {
                const dist = Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2));
                return dist < (3 / scale);
            });
            if (pointUnderMouse) {
                if (selectedItem?.type === 'point' && selectedItem.id !== pointUnderMouse.id) {
                    const newLine: Line = {
                        id: crypto.randomUUID(),
                        p1Id: selectedItem.id,
                        p2Id: pointUnderMouse.id,
                        type: 'basic'
                    };
                    updateAnalysis({ lines: [...photo.lines, newLine] });
                    setSelectedItem({ type: 'line', id: newLine.id });
                } else {
                    setSelectedItem({ type: 'point', id: pointUnderMouse.id });
                }
            }
        } else if (activeTool === 'parallel') {
            if ('touches' in e && e.cancelable) e.preventDefault();
            if (!selectedLineId) {
                const basicLines = photo.lines.filter(l => l.type === 'basic');
                let foundLineId = null;
                for (const line of basicLines) {
                    const p1 = photo.points.find(p => p.id === line.p1Id);
                    const p2 = photo.points.find(p => p.id === line.p2Id);
                    if (!p1 || !p2) continue;
                    const dist = getDistPointToSegment(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y);
                    if (dist < (6 / scale)) { foundLineId = line.id; break; } // More permissive
                }
                if (foundLineId) {
                    setSelectedLineId(foundLineId);
                    setSelectedItem({ type: 'line', id: foundLineId });
                }
            } else {
                const pointUnderMouse = photo.points.find(p => {
                    const dist = Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2));
                    return dist < (3 / scale);
                });
                let finalPointId = pointUnderMouse?.id || null;
                if (!finalPointId) {
                    const newPoint: Point = { id: crypto.randomUUID(), x: pos.x, y: pos.y };
                    updateAnalysis({ points: [...photo.points, newPoint] });
                    finalPointId = newPoint.id;
                }
                if (finalPointId) {
                    const newLine: Line = {
                        id: crypto.randomUUID(),
                        p1Id: finalPointId,
                        p2Id: '',
                        type: 'parallel',
                        refLineId: selectedLineId
                    };
                    updateAnalysis({ lines: [...photo.lines, newLine] });
                    setSelectedLineId(null);
                    setSelectedItem({ type: 'line', id: newLine.id });
                }
            }
        }
    }, [getMousePos, activeTool, photo, setSelectedItem, updateAnalysis, selectedLineId, setSelectedLineId, selectedItem, scale]);

    const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent | TouchEvent) => {
        if ('touches' in e) {
            if (e.touches.length > 0 && e.cancelable) {
                // Prevent scrolling when interacting with canvas
                e.preventDefault();
            }

            if (e.touches.length === 2 && isPinching && lastTouchDistance) {
                const dist = Math.sqrt(
                    Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) +
                    Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2)
                );
                
                const factor = dist / lastTouchDistance;
                const newScale = Math.max(1, Math.min(scale * factor, 10));
                
                if (newScale !== scale) {
                    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                    
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) {
                        const mouseX = centerX - rect.left;
                        const mouseY = centerY - rect.top;
                        const ratio = newScale / scale;
                        
                        setOffset(prev => ({
                            x: mouseX - (mouseX - prev.x) * ratio,
                            y: mouseY - (mouseY - prev.y) * ratio
                        }));
                        setScale(newScale);
                    }
                }
                setLastTouchDistance(dist);
                return;
            }
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        if (isPanning) {
            const dx = clientX - lastMousePos.x;
            const dy = clientY - lastMousePos.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastMousePos({ x: clientX, y: clientY });
            return;
        }
        if (draggingPointId) {
            const pos = getMousePos(clientX, clientY);
            updateAnalysis({
                points: photo.points.map(p => 
                    p.id === draggingPointId ? { ...p, x: pos.x, y: pos.y } : p
                )
            });
        }
    }, [isPinching, lastTouchDistance, isPanning, lastMousePos, draggingPointId, getMousePos, scale, photo.points, updateAnalysis]);

    const handleMouseUp = useCallback(() => {
        setDraggingPointId(null);
        setIsPanning(false);
        setIsPinching(false);
        setLastTouchDistance(null);
    }, []);

    // Set up native touch listeners to ensure passive: false works
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onTouchStart = (e: TouchEvent) => handleMouseDown(e);
        const onTouchMove = (e: TouchEvent) => handleMouseMove(e);
        const onTouchEnd = () => handleMouseUp();

        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
        };
    }, [handleMouseDown, handleMouseMove, handleMouseUp]);

    const getDistPointToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        return Math.sqrt(Math.pow(px - xx, 2) + Math.pow(py - yy, 2));
    };

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="object-contain"
                style={{ 
                    maxWidth: '100vw', 
                    maxHeight: '100vh',
                    cursor: isPanning ? 'grabbing' : draggingPointId ? 'grabbing' : activeTool === 'select' ? 'grab' : 'crosshair' 
                }}
            />
            {/* Legend / Guidance */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] text-white">
                    <div className="w-2 h-2 rounded-full bg-primary" /> Zoom: {Math.round(scale * 100)}%
                </div>
                
                <AnimatePresence>
                    {activeTool === 'parallel' && (
                        <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="bg-primary/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-primary/30 text-xs text-primary font-bold shadow-xl"
                        >
                            {!selectedLineId ? '1. Clicca sulla linea di riferimento' : '2. Clicca sul punto di passaggio'}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

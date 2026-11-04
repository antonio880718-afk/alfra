# -*- coding: utf-8 -*-
import sys

with open("src/pages/paciente/PacienteProfile.backup.jsx", "r", encoding="utf-8") as f:
    orig = f.read()

start_ali = orig.find("const ALIMENTOS_CATALOGO = [")
end_ali = orig.find("];\n\nexport default function PacienteProfile()")
alimentos_block = orig[start_ali:end_ali + 2]

start_leal = orig.find("{/* Tarjeta de Lealtad - foto llena todo el recuadro */}")
end_leal = orig.find("{/* Plan de Cuidados en Casa (Interactivo) */}")
lealtad_block = orig[start_leal:end_leal]

start_mem = orig.find("{/* MEMBRESIA CON FLIP CARD */}")
end_mem = orig.find("{/* CONFIG */}")
membresia_block = orig[start_mem:end_mem]

header_code = """import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import ReciboDigital from "../../components/ui/ReciboDigital";
import AutoAgendadoModal from "../../components/paciente/AutoAgendadoModal";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Calendar, Activity, User, Lock, Gift, Camera, Bell, FileText, Receipt, 
  CheckCircle, Mail, Crown, Heart, Stethoscope, Sparkles, ChevronRight, Zap, 
  RefreshCw, Search, RotateCw, Flame, Award, Target, MapPin, Play, Square, 
  Timer, Navigation, Footprints, Trophy, ShieldCheck, Star, MessageSquare, 
  Droplets, Check, AlertCircle, ThumbsUp, Smile, HelpCircle, Sliders, Eye, 
  ArrowRight, Phone, Sparkle, Compass, Share2, CheckCircle2, ChevronDown, 
  Info, TrendingDown
} from 'lucide-react';
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { db } from "../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc } from "firebase/firestore";
import { getPacienteByUid } from "../../services/pacientesService";
import { getSeguimientosPaciente, getApoyoEnCasa, getDailyTrackers, saveDailyTracker } from "../../services/seguimientoService";
import { getRecibosPaciente } from "../../services/recibosService";
import { getCitasByPaciente, onCitasPacienteChange } from "../../services/citasService";
import { getTratamientosPaciente, getSesionesPaciente, MEDIDAS_CORPORALES } from "../../services/tratamientosService";
import Barcode39 from "../../components/ui/Barcode39";

const auth = getAuth();
const getMembresiaObj = (m) => { if (!m) return null; if (typeof m === "object" && m.nivel) return m; return null; };

// Componente interactivo Ultra HD para comparativa táctil de Antes y Después
function BeforeAfterSlider({ beforeUrl, afterUrl, beforeLabel = "Día 1", afterLabel = "Hoy" }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(percent);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX);
  };
  const handleMouseMove = (e) => {
    if (isDragging) handleMove(e.clientX);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden select-none cursor-ew-resize shadow-2xl border-2 border-white/20 group"
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      <img src={afterUrl} alt="Después" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      <span className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md text-emerald-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full z-10 border border-emerald-500/30 flex items-center gap-1 shadow-lg">
        <Sparkles size={11} /> {afterLabel}
      </span>

      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${sliderPos}%` }}
      >
        <img 
          src={beforeUrl} 
          alt="Antes" 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none grayscale contrast-125"
          style={{ width: containerRef.current ? containerRef.current.clientWidth : '100%', maxWidth: 'none' }}
        />
        <span className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md text-amber-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full z-10 border border-amber-500/30 flex items-center gap-1 shadow-lg">
          <Calendar size={11} /> {beforeLabel}
        </span>
      </div>

      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(45,212,191,0.9)] pointer-events-none"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-turquesa text-turquesa pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
          <span className="text-[11px] font-black">◀ ▶</span>
        </div>
      </div>
    </div>
  );
}

"""

with open("scripts/part_header.txt", "w", encoding="utf-8") as f:
    f.write(header_code)

print("Part header written successfully!")

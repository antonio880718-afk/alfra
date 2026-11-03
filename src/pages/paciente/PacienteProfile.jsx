import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import ReciboDigital from "../../components/ui/ReciboDigital";
import AutoAgendadoModal from "../../components/paciente/AutoAgendadoModal";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Calendar, Activity, User, Lock, Gift, Camera, Bell, FileText, Receipt, 
  CheckCircle, Mail, Crown, Heart, Stethoscope, Sparkles, ChevronRight, Zap, 
  RefreshCw, Search, RotateCw, Flame, Award, Target, MapPin, Play, Pause, Square, 
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
import { getTratamientosPaciente, onTratamientosPacienteChange, getSesionesPaciente, MEDIDAS_CORPORALES } from "../../services/tratamientosService";
import { comprimirImagenBase64 } from "../../services/staffService";
import Barcode39 from "../../components/ui/Barcode39";

const auth = getAuth();
const getMembresiaObj = (m, pacienteId = null) => {
  if (!m) return null;
  if (typeof m === "object" && (m.nivel || m.activa)) {
    let codigo = m.codigo || m.id;
    if (!codigo || !String(codigo).startsWith("MEM-")) {
      const pacPart = String(pacienteId || "ALF").replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "7024";
      const randPart = Math.floor(1000 + Math.random() * 9000);
      codigo = `MEM-${pacPart}-${randPart}`;
    }
    return {
      ...m,
      id: codigo,
      codigo,
      nivel: m.nivel || "Bronce",
      horas: Number(m.horasDisponibles ?? m.horas ?? 0),
      activa: m.activa !== false
    };
  }
  return null;
};

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

const ALIMENTOS_CATALOGO = [
{id:1,nombre:"Manzana",calorias:95,porcion:"1 pieza mediana"},
{id:2,nombre:"Platano",calorias:105,porcion:"1 pieza"},
{id:3,nombre:"Platano macho hervido",calorias:130,porcion:"1/2 taza"},
{id:4,nombre:"Naranja",calorias:60,porcion:"1 pieza"},
{id:5,nombre:"Mandarina",calorias:45,porcion:"1 pieza"},
{id:6,nombre:"Mango Ataulfo",calorias:120,porcion:"1 pieza chica"},
{id:7,nombre:"Mango Manila con chile y limon",calorias:140,porcion:"1 pieza"},
{id:8,nombre:"Papaya en trozos",calorias:60,porcion:"1 taza 150g"},
{id:9,nombre:"Pina en trozos",calorias:80,porcion:"1 taza 150g"},
{id:10,nombre:"Sandia en trozos",calorias:46,porcion:"1 taza 150g"},
{id:11,nombre:"Melon en trozos",calorias:50,porcion:"1 taza 150g"},
{id:12,nombre:"Guayaba",calorias:68,porcion:"1 pieza"},
{id:13,nombre:"Toronja",calorias:52,porcion:"1/2 pieza"},
{id:14,nombre:"Uvas",calorias:70,porcion:"1 taza 150g"},
{id:15,nombre:"Kiwi",calorias:60,porcion:"1 pieza"},
{id:16,nombre:"Fresa",calorias:50,porcion:"1 taza 150g"},
{id:17,nombre:"Durazno",calorias:60,porcion:"1 pieza"},
{id:18,nombre:"Ciruela",calorias:45,porcion:"1 pieza"},
{id:19,nombre:"Coco natural en trozos",calorias:150,porcion:"1/4 pieza"},
{id:20,nombre:"Tejocotes",calorias:40,porcion:"4 piezas"},
{id:21,nombre:"Tamarindo con azucar",calorias:120,porcion:"1 pieza 60g"},
{id:22,nombre:"Nanche",calorias:60,porcion:"1 taza"},
{id:23,nombre:"Zapote negro",calorias:80,porcion:"1 porcion 100g"},
{id:24,nombre:"Lima",calorias:20,porcion:"1 pieza"},
{id:25,nombre:"Tuna",calorias:40,porcion:"1 pieza"},
{id:26,nombre:"Nopal cocido",calorias:15,porcion:"1 taza"},
{id:27,nombre:"Jitomate",calorias:22,porcion:"1 pieza mediana"},
{id:28,nombre:"Aguacate",calorias:160,porcion:"1/2 pieza"},
{id:29,nombre:"Cebolla",calorias:40,porcion:"1 pieza mediana"},
{id:30,nombre:"Chile serrano",calorias:5,porcion:"1 pieza"},
{id:31,nombre:"Chile jalapeno",calorias:8,porcion:"1 pieza"},
{id:32,nombre:"Chile poblano",calorias:25,porcion:"1 pieza"},
{id:33,nombre:"Elote desgranado",calorias:130,porcion:"1/2 taza"},
{id:34,nombre:"Chayote cocido",calorias:25,porcion:"1 taza"},
{id:35,nombre:"Calabacita cocida",calorias:20,porcion:"1 taza"},
{id:36,nombre:"Espinaca",calorias:7,porcion:"1 taza"},
{id:37,nombre:"Lechuga",calorias:5,porcion:"1 taza"},
{id:38,nombre:"Zanahoria",calorias:30,porcion:"1 pieza mediana"},
{id:39,nombre:"Pepino",calorias:16,porcion:"1 taza"},
{id:40,nombre:"Brocoli cocido",calorias:55,porcion:"1 taza"},
{id:41,nombre:"Ejotes cocidos",calorias:35,porcion:"1 taza"},
{id:42,nombre:"Chicharo cocido",calorias:120,porcion:"1 taza"},
{id:43,nombre:"Papa cocida",calorias:110,porcion:"1 pieza mediana"},
{id:44,nombre:"Camote cocido",calorias:115,porcion:"1 pieza mediana"},
{id:45,nombre:"Jicama",calorias:50,porcion:"1 taza"},
{id:46,nombre:"Rabano",calorias:10,porcion:"5 piezas"},
{id:47,nombre:"Quelites",calorias:20,porcion:"1 taza"},
{id:48,nombre:"Huitlacoche",calorias:35,porcion:"1/2 taza"},
{id:49,nombre:"Flor de calabaza",calorias:15,porcion:"1 taza"},
{id:50,nombre:"Ensalada verde mixta",calorias:35,porcion:"1 taza"},
{id:51,nombre:"Pollo a la plancha",calorias:165,porcion:"100g"},
{id:52,nombre:"Pollo frito",calorias:250,porcion:"100g"},
{id:53,nombre:"Pechuga empanizada",calorias:280,porcion:"1 pieza"},
{id:54,nombre:"Pierna de pollo con piel",calorias:210,porcion:"1 pieza"},
{id:55,nombre:"Muslo de pollo",calorias:180,porcion:"1 pieza"},
{id:56,nombre:"Alitas de pollo BBQ",calorias:320,porcion:"6 piezas"},
{id:57,nombre:"Bistec de res a la plancha",calorias:180,porcion:"100g"},
{id:58,nombre:"Bistec encebollado",calorias:220,porcion:"100g"},
{id:59,nombre:"Carne molida de res",calorias:250,porcion:"100g"},
{id:60,nombre:"Carne al pastor",calorias:200,porcion:"100g"},
{id:61,nombre:"Carne asada",calorias:250,porcion:"100g"},
{id:62,nombre:"Arrachera",calorias:270,porcion:"100g"},
{id:63,nombre:"Costilla de res",calorias:290,porcion:"100g"},
{id:64,nombre:"Cecina",calorias:180,porcion:"100g"},
{id:65,nombre:"Tasajo",calorias:170,porcion:"100g"},
{id:66,nombre:"Barbacoa",calorias:250,porcion:"100g"},
{id:67,nombre:"Birria",calorias:280,porcion:"1 taza"},
{id:68,nombre:"Carnitas",calorias:300,porcion:"100g"},
{id:69,nombre:"Chicharron de cerdo",calorias:350,porcion:"50g"},
{id:70,nombre:"Chorizo",calorias:280,porcion:"1 pieza 60g"},
{id:71,nombre:"Longaniza",calorias:250,porcion:"1 pieza 60g"},
{id:72,nombre:"Jamon de cerdo",calorias:45,porcion:"1 rebanada"},
{id:73,nombre:"Salchicha de pavo",calorias:70,porcion:"1 pieza"},
{id:74,nombre:"Salchicha de cerdo",calorias:120,porcion:"1 pieza"},
{id:75,nombre:"Tocino",calorias:90,porcion:"2 tiras"},
{id:76,nombre:"Milanesa de res",calorias:300,porcion:"1 pieza"},
{id:77,nombre:"Milanesa de cerdo",calorias:310,porcion:"1 pieza"},
{id:78,nombre:"Chuleta de cerdo",calorias:220,porcion:"1 pieza"},
{id:79,nombre:"Suadero",calorias:280,porcion:"100g"},
{id:80,nombre:"Higado de res",calorias:140,porcion:"100g"},
{id:81,nombre:"Camaron cocido",calorias:100,porcion:"100g"},
{id:82,nombre:"Camaron empanizado",calorias:250,porcion:"6 piezas"},
{id:83,nombre:"Coctel de camaron",calorias:200,porcion:"1 vaso"},
{id:84,nombre:"Aguachile",calorias:180,porcion:"1 porcion"},
{id:85,nombre:"Ceviche de pescado",calorias:150,porcion:"1 taza"},
{id:86,nombre:"Ceviche de camaron",calorias:180,porcion:"1 taza"},
{id:87,nombre:"Pescado a la plancha",calorias:120,porcion:"100g"},
{id:88,nombre:"Mojarra frita",calorias:300,porcion:"1 pieza"},
{id:89,nombre:"Pescado empanizado",calorias:280,porcion:"1 filete"},
{id:90,nombre:"Filete de tilapia",calorias:130,porcion:"100g"},
{id:91,nombre:"Salmon a la plancha",calorias:200,porcion:"100g"},
{id:92,nombre:"Atun en agua",calorias:100,porcion:"1 lata"},
{id:93,nombre:"Atun en aceite",calorias:180,porcion:"1 lata"},
{id:94,nombre:"Sardinas en tomate",calorias:150,porcion:"1 lata"},
{id:95,nombre:"Pulpo",calorias:140,porcion:"100g"},
{id:96,nombre:"Caldo de camaron",calorias:200,porcion:"1 tazon"},
{id:97,nombre:"Tostada de ceviche",calorias:220,porcion:"1 pieza"},
{id:98,nombre:"Tacos de pescado",calorias:250,porcion:"2 piezas"},
{id:99,nombre:"Camaron a la diabla",calorias:220,porcion:"1 porcion"},
{id:100,nombre:"Filete empapelado",calorias:180,porcion:"1 porcion"},
{id:101,nombre:"Taco de carne asada",calorias:200,porcion:"1 pieza"},
{id:102,nombre:"Taco al pastor",calorias:180,porcion:"1 pieza"},
{id:103,nombre:"Taco de suadero",calorias:190,porcion:"1 pieza"},
{id:104,nombre:"Taco de bistec",calorias:170,porcion:"1 pieza"},
{id:105,nombre:"Taco de carnitas",calorias:220,porcion:"1 pieza"},
{id:106,nombre:"Taco de barbacoa",calorias:230,porcion:"1 pieza"},
{id:107,nombre:"Taco de chicharron",calorias:200,porcion:"1 pieza"},
{id:108,nombre:"Taco de canasta frijol",calorias:150,porcion:"1 pieza"},
{id:109,nombre:"Taco de canasta papa",calorias:160,porcion:"1 pieza"},
{id:110,nombre:"Taco de canasta chicharron",calorias:170,porcion:"1 pieza"},
{id:111,nombre:"Taco dorado de pollo",calorias:180,porcion:"1 pieza"},
{id:112,nombre:"Taco dorado de papa",calorias:160,porcion:"1 pieza"},
{id:113,nombre:"Gordita de chicharron",calorias:280,porcion:"1 pieza"},
{id:114,nombre:"Gordita de frijol",calorias:250,porcion:"1 pieza"},
{id:115,nombre:"Gordita de queso",calorias:270,porcion:"1 pieza"},
{id:116,nombre:"Sope de frijol con pollo",calorias:280,porcion:"1 pieza"},
{id:117,nombre:"Sope de chorizo",calorias:300,porcion:"1 pieza"},
{id:118,nombre:"Huarache con bistec",calorias:350,porcion:"1 pieza"},
{id:119,nombre:"Huarache con nopales",calorias:280,porcion:"1 pieza"},
{id:120,nombre:"Tlacoyos de frijol",calorias:200,porcion:"1 pieza"},
{id:121,nombre:"Tlacoyo de chicharron",calorias:220,porcion:"1 pieza"},
{id:122,nombre:"Quesadilla de queso masa",calorias:250,porcion:"1 pieza"},
{id:123,nombre:"Quesadilla de hongos",calorias:230,porcion:"1 pieza"},
{id:124,nombre:"Quesadilla de huitlacoche",calorias:240,porcion:"1 pieza"},
{id:125,nombre:"Quesadilla de flor de calabaza",calorias:220,porcion:"1 pieza"},
{id:126,nombre:"Enchiladas verdes",calorias:450,porcion:"3 piezas"},
{id:127,nombre:"Enchiladas rojas",calorias:430,porcion:"3 piezas"},
{id:128,nombre:"Enchiladas suizas",calorias:500,porcion:"3 piezas"},
{id:129,nombre:"Chilaquiles verdes",calorias:400,porcion:"1 plato"},
{id:130,nombre:"Chilaquiles rojos",calorias:420,porcion:"1 plato"},
{id:131,nombre:"Tamales de pollo",calorias:250,porcion:"1 pieza"},
{id:132,nombre:"Tamales de rajas con queso",calorias:280,porcion:"1 pieza"},
{id:133,nombre:"Tamales de dulce",calorias:300,porcion:"1 pieza"},
{id:134,nombre:"Tamales oaxaquenos",calorias:350,porcion:"1 pieza"},
{id:135,nombre:"Pozole rojo",calorias:350,porcion:"1 tazon"},
{id:136,nombre:"Pozole verde",calorias:330,porcion:"1 tazon"},
{id:137,nombre:"Tostada de tinga",calorias:280,porcion:"1 pieza"},
{id:138,nombre:"Tostada de pata",calorias:250,porcion:"1 pieza"},
{id:139,nombre:"Flautas de pollo",calorias:400,porcion:"3 piezas"},
{id:140,nombre:"Molotes",calorias:220,porcion:"1 pieza"},
{id:141,nombre:"Elote hervido con mayo y queso",calorias:350,porcion:"1 pieza"},
{id:142,nombre:"Elote hervido con limon",calorias:130,porcion:"1 pieza"},
{id:143,nombre:"Esquites con mayonesa",calorias:300,porcion:"1 vaso"},
{id:144,nombre:"Esquites con Valentina",calorias:200,porcion:"1 vaso"},
{id:145,nombre:"Churros con azucar",calorias:250,porcion:"3 piezas"},
{id:146,nombre:"Churros rellenos de cajeta",calorias:350,porcion:"2 piezas"},
{id:147,nombre:"Papas preparadas con crema",calorias:450,porcion:"1 vaso"},
{id:148,nombre:"Papas a la francesa",calorias:350,porcion:"1 porcion grande"},
{id:149,nombre:"Dorilocos",calorias:400,porcion:"1 vaso"},
{id:150,nombre:"Tostilocos",calorias:380,porcion:"1 vaso"},
{id:151,nombre:"Mango con chile y chamoy",calorias:150,porcion:"1 pieza"},
{id:152,nombre:"Pepino loco con chamoy",calorias:100,porcion:"1 pieza"},
{id:153,nombre:"Fruta con chile mixta",calorias:120,porcion:"1 vaso"},
{id:154,nombre:"Banderillas de salchicha",calorias:350,porcion:"2 piezas"},
{id:155,nombre:"Hot dog callejero",calorias:380,porcion:"1 pieza"},
{id:156,nombre:"Hamburguesa callejera",calorias:550,porcion:"1 pieza"},
{id:157,nombre:"Torta de milanesa",calorias:650,porcion:"1 pieza"},
{id:158,nombre:"Torta de jamon",calorias:400,porcion:"1 pieza"},
{id:159,nombre:"Torta ahogada",calorias:500,porcion:"1 pieza"},
{id:160,nombre:"Torta cubana",calorias:750,porcion:"1 pieza"},
{id:161,nombre:"Caldo de pollo",calorias:200,porcion:"1 tazon"},
{id:162,nombre:"Caldo de res",calorias:250,porcion:"1 tazon"},
{id:163,nombre:"Caldo tlalpeno",calorias:280,porcion:"1 tazon"},
{id:164,nombre:"Consome de pollo",calorias:100,porcion:"1 taza"},
{id:165,nombre:"Sopa de fideo",calorias:180,porcion:"1 plato"},
{id:166,nombre:"Sopa de tortilla",calorias:250,porcion:"1 tazon"},
{id:167,nombre:"Sopa de verduras",calorias:100,porcion:"1 tazon"},
{id:168,nombre:"Sopa de lentejas",calorias:230,porcion:"1 tazon"},
{id:169,nombre:"Crema de elote",calorias:200,porcion:"1 taza"},
{id:170,nombre:"Menudo",calorias:300,porcion:"1 tazon"},
{id:171,nombre:"Pancita",calorias:280,porcion:"1 tazon"},
{id:172,nombre:"Mole negro con pollo",calorias:400,porcion:"1 porcion"},
{id:173,nombre:"Mole rojo con pollo",calorias:380,porcion:"1 porcion"},
{id:174,nombre:"Pipian verde",calorias:350,porcion:"1 porcion"},
{id:175,nombre:"Maruchan cualquier sabor",calorias:380,porcion:"1 sobre"},
{id:176,nombre:"Huevo cocido",calorias:78,porcion:"1 pieza"},
{id:177,nombre:"Huevo estrellado",calorias:100,porcion:"1 pieza"},
{id:178,nombre:"Huevo revuelto con aceite",calorias:110,porcion:"1 pieza"},
{id:179,nombre:"Huevos rancheros",calorias:350,porcion:"2 piezas"},
{id:180,nombre:"Huevos a la mexicana",calorias:300,porcion:"2 piezas"},
{id:181,nombre:"Huevos con jamon",calorias:280,porcion:"2 piezas"},
{id:182,nombre:"Huevos con chorizo",calorias:400,porcion:"2 piezas"},
{id:183,nombre:"Huevos divorciados",calorias:380,porcion:"2 piezas"},
{id:184,nombre:"Molletes",calorias:400,porcion:"2 mitades"},
{id:185,nombre:"Hotcakes con miel",calorias:450,porcion:"3 piezas"},
{id:186,nombre:"Pan frances tostado",calorias:350,porcion:"2 rebanadas"},
{id:187,nombre:"Avena con leche",calorias:180,porcion:"1 taza"},
{id:188,nombre:"Cereal con leche",calorias:250,porcion:"1 tazon"},
{id:189,nombre:"Granola con yogurt",calorias:300,porcion:"1 taza"},
{id:190,nombre:"Licuado de platano",calorias:250,porcion:"1 vaso"},
{id:191,nombre:"Papas Sabritas bolsa chica",calorias:270,porcion:"1 bolsa 45g"},
{id:192,nombre:"Papas Ruffles",calorias:250,porcion:"1 bolsa 45g"},
{id:193,nombre:"Cheetos Flamin Hot",calorias:280,porcion:"1 bolsa 52g"},
{id:194,nombre:"Cheetos Torciditos",calorias:250,porcion:"1 bolsa 45g"},
{id:195,nombre:"Doritos Nacho",calorias:260,porcion:"1 bolsa 45g"},
{id:196,nombre:"Doritos Incognita",calorias:250,porcion:"1 bolsa 45g"},
{id:197,nombre:"Takis Fuego",calorias:280,porcion:"1 bolsa 56g"},
{id:198,nombre:"Takis bolsa grande",calorias:560,porcion:"1 bolsa 113g"},
{id:199,nombre:"Fritos",calorias:240,porcion:"1 bolsa 44g"},
{id:200,nombre:"Cacahuates japoneses",calorias:200,porcion:"1/2 taza"},
{id:201,nombre:"Cacahuates salados",calorias:280,porcion:"1/2 taza"},
{id:202,nombre:"Chicharrones de harina preparados",calorias:300,porcion:"1 bolsa"},
{id:203,nombre:"Palomitas de mantequilla",calorias:180,porcion:"1 bolsa chica"},
{id:204,nombre:"Palomitas naturales",calorias:110,porcion:"3 tazas"},
{id:205,nombre:"Churrumais",calorias:240,porcion:"1 bolsa 46g"},
{id:206,nombre:"Rancheritos",calorias:250,porcion:"1 bolsa 52g"},
{id:207,nombre:"Runners",calorias:230,porcion:"1 bolsa 46g"},
{id:208,nombre:"Totis",calorias:230,porcion:"1 bolsa 42g"},
{id:209,nombre:"De Todito paquete",calorias:300,porcion:"1 paquete"},
{id:210,nombre:"Maruchan vaso",calorias:290,porcion:"1 vaso"},
{id:211,nombre:"Maruchan sobre",calorias:380,porcion:"1 sobre"},
{id:212,nombre:"Maruchan Habanero",calorias:390,porcion:"1 sobre"},
{id:213,nombre:"Nissin",calorias:380,porcion:"1 sobre"},
{id:214,nombre:"Galletas Marias",calorias:120,porcion:"4 piezas"},
{id:215,nombre:"Galletas de animalitos",calorias:130,porcion:"8 piezas"},
{id:216,nombre:"Galletas Emperador",calorias:200,porcion:"1 paquete 4 pzas"},
{id:217,nombre:"Galletas Principe",calorias:200,porcion:"1 paquete 4 pzas"},
{id:218,nombre:"Galletas Oreo",calorias:160,porcion:"3 galletas"},
{id:219,nombre:"Barritas Marinela fresa",calorias:180,porcion:"1 pieza"},
{id:220,nombre:"Gansito Marinela",calorias:280,porcion:"1 pieza"},
{id:221,nombre:"Coca-Cola lata",calorias:140,porcion:"1 lata 355ml"},
{id:222,nombre:"Coca-Cola 600ml",calorias:252,porcion:"1 botella"},
{id:223,nombre:"Pepsi",calorias:150,porcion:"1 lata 355ml"},
{id:224,nombre:"Sprite",calorias:140,porcion:"1 lata 355ml"},
{id:225,nombre:"Fanta naranja",calorias:160,porcion:"1 lata 355ml"},
{id:226,nombre:"Manzanita Sol",calorias:170,porcion:"1 lata 355ml"},
{id:227,nombre:"Jarritos",calorias:180,porcion:"1 botella 370ml"},
{id:228,nombre:"Boing de mango",calorias:200,porcion:"1 caja 500ml"},
{id:229,nombre:"Jumex de durazno",calorias:180,porcion:"1 lata 335ml"},
{id:230,nombre:"Jugo de naranja natural",calorias:110,porcion:"1 vaso 250ml"},
{id:231,nombre:"Jugo verde",calorias:80,porcion:"1 vaso 250ml"},
{id:232,nombre:"Agua de horchata",calorias:200,porcion:"1 vaso 250ml"},
{id:233,nombre:"Agua de jamaica",calorias:90,porcion:"1 vaso 250ml"},
{id:234,nombre:"Agua de tamarindo",calorias:130,porcion:"1 vaso 250ml"},
{id:235,nombre:"Agua de limon",calorias:80,porcion:"1 vaso 250ml"},
{id:236,nombre:"Agua mineral",calorias:0,porcion:"1 botella"},
{id:237,nombre:"Cafe americano sin azucar",calorias:5,porcion:"1 taza"},
{id:238,nombre:"Cafe con leche",calorias:60,porcion:"1 taza"},
{id:239,nombre:"Cafe con leche y azucar",calorias:100,porcion:"1 taza"},
{id:240,nombre:"Cappuccino",calorias:120,porcion:"1 taza"},
{id:241,nombre:"Te sin azucar",calorias:2,porcion:"1 taza"},
{id:242,nombre:"Leche entera",calorias:150,porcion:"1 vaso 250ml"},
{id:243,nombre:"Leche descremada",calorias:90,porcion:"1 vaso 250ml"},
{id:244,nombre:"Chocomilk",calorias:210,porcion:"1 vaso 250ml"},
{id:245,nombre:"Mazapan",calorias:120,porcion:"1 pieza"},
{id:246,nombre:"Palanqueta de cacahuate",calorias:180,porcion:"1 pieza"},
{id:247,nombre:"Pulparindo",calorias:90,porcion:"1 pieza"},
{id:248,nombre:"Lucas Muecas",calorias:70,porcion:"1 pieza"},
{id:249,nombre:"Pelon Pelo Rico",calorias:60,porcion:"1 pieza"},
{id:250,nombre:"Duvalin",calorias:130,porcion:"1 pieza"},
{id:251,nombre:"Paleta Payaso",calorias:150,porcion:"1 pieza"},
{id:252,nombre:"Bubulubu",calorias:140,porcion:"1 pieza"},
{id:253,nombre:"Carlos V",calorias:200,porcion:"1 barra"},
{id:254,nombre:"Snickers",calorias:280,porcion:"1 barra"},
{id:255,nombre:"M and Ms",calorias:230,porcion:"1 bolsa 47g"},
{id:256,nombre:"Gomitas",calorias:130,porcion:"10 piezas"},
{id:257,nombre:"Ate de membrillo",calorias:80,porcion:"1 porcion 30g"},
{id:258,nombre:"Gelatina de agua",calorias:80,porcion:"1 taza"},
{id:259,nombre:"Gelatina de leche",calorias:150,porcion:"1 taza"},
{id:260,nombre:"Flan casero",calorias:200,porcion:"1 porcion"},
{id:261,nombre:"Arroz con leche",calorias:250,porcion:"1 taza"},
{id:262,nombre:"Pastel de chocolate",calorias:350,porcion:"1 rebanada"},
{id:263,nombre:"Pastel tres leches",calorias:400,porcion:"1 rebanada"},
{id:264,nombre:"Pan de elote",calorias:280,porcion:"1 rebanada"},
{id:265,nombre:"Pay de limon",calorias:300,porcion:"1 rebanada"},
{id:266,nombre:"Helado de vainilla",calorias:200,porcion:"1 bola"},
{id:267,nombre:"Paleta helada de fruta",calorias:80,porcion:"1 pieza"},
{id:268,nombre:"Nieve de limon",calorias:130,porcion:"1 bola"},
{id:269,nombre:"Queso panela",calorias:80,porcion:"30g"},
{id:270,nombre:"Queso Oaxaca",calorias:100,porcion:"30g"},
{id:271,nombre:"Queso fresco",calorias:70,porcion:"30g"},
{id:272,nombre:"Queso manchego",calorias:110,porcion:"30g"},
{id:273,nombre:"Queso crema Philadelphia",calorias:100,porcion:"2 cucharadas"},
{id:274,nombre:"Crema acida",calorias:60,porcion:"2 cucharadas"},
{id:275,nombre:"Yogurt natural",calorias:100,porcion:"1 taza"},
{id:276,nombre:"Yogurt de sabor Danone",calorias:160,porcion:"1 pieza"},
{id:277,nombre:"Yakult",calorias:50,porcion:"1 pieza"},
{id:278,nombre:"Danonino",calorias:70,porcion:"1 pieza"},
{id:279,nombre:"Requeson",calorias:90,porcion:"1/2 taza"},
{id:280,nombre:"Mantequilla",calorias:100,porcion:"1 cucharada"},
{id:281,nombre:"Queso amarillo",calorias:80,porcion:"1 rebanada"},
{id:282,nombre:"Queso cotija",calorias:110,porcion:"30g"},
{id:283,nombre:"Jocoque",calorias:60,porcion:"1/4 taza"},
{id:284,nombre:"Tortilla de maiz",calorias:70,porcion:"1 pieza"},
{id:285,nombre:"Tortilla de harina",calorias:120,porcion:"1 pieza"},
{id:286,nombre:"Arroz blanco",calorias:130,porcion:"1/2 taza"},
{id:287,nombre:"Arroz rojo",calorias:140,porcion:"1/2 taza"},
{id:288,nombre:"Frijoles de la olla",calorias:120,porcion:"1/2 taza"},
{id:289,nombre:"Frijoles refritos",calorias:150,porcion:"1/2 taza"},
{id:290,nombre:"Frijoles charros",calorias:250,porcion:"1 taza"},
{id:291,nombre:"Lentejas",calorias:230,porcion:"1 taza"},
{id:292,nombre:"Habas secas",calorias:180,porcion:"1/2 taza"},
{id:293,nombre:"Amaranto en barra",calorias:120,porcion:"1 pieza"},
{id:294,nombre:"Avena natural",calorias:150,porcion:"1/2 taza"},
{id:295,nombre:"Pasta cocida",calorias:200,porcion:"1 taza"},
{id:296,nombre:"Spaghetti salsa roja",calorias:350,porcion:"1 plato"},
{id:297,nombre:"Espagueti verde",calorias:400,porcion:"1 plato"},
{id:298,nombre:"Coditos con crema",calorias:380,porcion:"1 plato"},
{id:299,nombre:"Pan blanco",calorias:80,porcion:"1 rebanada"},
{id:300,nombre:"Pan integral",calorias:75,porcion:"1 rebanada"},
{id:301,nombre:"Bolillo",calorias:150,porcion:"1 pieza"},
{id:302,nombre:"Telera",calorias:170,porcion:"1 pieza"},
{id:303,nombre:"Concha",calorias:280,porcion:"1 pieza"},
{id:304,nombre:"Cuerno",calorias:250,porcion:"1 pieza"},
{id:305,nombre:"Oreja pan dulce",calorias:300,porcion:"1 pieza"},
{id:306,nombre:"Polvoron",calorias:180,porcion:"1 pieza"},
{id:307,nombre:"Dona azucarada",calorias:250,porcion:"1 pieza"},
{id:308,nombre:"Dona de chocolate",calorias:300,porcion:"1 pieza"},
{id:309,nombre:"Pan de muerto",calorias:350,porcion:"1 rebanada"},
{id:310,nombre:"Rosca de reyes",calorias:300,porcion:"1 rebanada"},
{id:311,nombre:"Mantecada",calorias:280,porcion:"1 pieza"},
{id:312,nombre:"Churro",calorias:120,porcion:"1 pieza"},
{id:313,nombre:"Pan tostado",calorias:30,porcion:"1 pieza"},
{id:314,nombre:"Hamburguesa sencilla",calorias:350,porcion:"1 pieza"},
{id:315,nombre:"Hamburguesa doble",calorias:550,porcion:"1 pieza"},
{id:316,nombre:"Big Mac",calorias:550,porcion:"1 pieza"},
{id:317,nombre:"McNuggets 6 piezas",calorias:280,porcion:"6 piezas"},
{id:318,nombre:"Pizza pepperoni",calorias:300,porcion:"1 rebanada"},
{id:319,nombre:"Pizza hawaiana",calorias:280,porcion:"1 rebanada"},
{id:320,nombre:"Pizza mexicana",calorias:320,porcion:"1 rebanada"},
{id:321,nombre:"Hot dog",calorias:300,porcion:"1 pieza"},
{id:322,nombre:"Burrito de frijol con queso",calorias:350,porcion:"1 pieza"},
{id:323,nombre:"Burrito de carne",calorias:450,porcion:"1 pieza"},
{id:324,nombre:"Sincronizada",calorias:380,porcion:"1 pieza"},
{id:325,nombre:"Sandwich de jamon",calorias:300,porcion:"1 pieza"},
{id:326,nombre:"Sandwich de pollo",calorias:350,porcion:"1 pieza"},
{id:327,nombre:"Wrap de pollo",calorias:320,porcion:"1 pieza"},
{id:328,nombre:"Papas McDonalds medianas",calorias:340,porcion:"1 porcion"},
{id:329,nombre:"Pollo KFC 1 pieza",calorias:320,porcion:"1 pieza"},
{id:330,nombre:"Subway 6 pulgadas",calorias:350,porcion:"1 pieza"},
{id:331,nombre:"Sushi California roll",calorias:350,porcion:"8 piezas"},
{id:332,nombre:"Alitas Buffalo",calorias:450,porcion:"6 piezas"},
{id:333,nombre:"Salsa verde",calorias:10,porcion:"2 cucharadas"},
{id:334,nombre:"Salsa roja",calorias:10,porcion:"2 cucharadas"},
{id:335,nombre:"Guacamole",calorias:80,porcion:"2 cucharadas"},
{id:336,nombre:"Pico de gallo",calorias:10,porcion:"2 cucharadas"},
{id:337,nombre:"Mayonesa",calorias:100,porcion:"1 cucharada"},
{id:338,nombre:"Ketchup",calorias:20,porcion:"1 cucharada"},
{id:339,nombre:"Mostaza",calorias:5,porcion:"1 cucharada"},
{id:340,nombre:"Valentina",calorias:0,porcion:"1 cucharada"},
{id:341,nombre:"Chamoy",calorias:30,porcion:"1 cucharada"},
{id:342,nombre:"Miel de abeja",calorias:60,porcion:"1 cucharada"},
{id:343,nombre:"Cerveza clara Corona",calorias:150,porcion:"1 lata 355ml"},
{id:344,nombre:"Cerveza oscura Negra Modelo",calorias:170,porcion:"1 lata 355ml"},
{id:345,nombre:"Michelada",calorias:200,porcion:"1 vaso"},
{id:346,nombre:"Tequila shot",calorias:65,porcion:"1 caballito"},
{id:347,nombre:"Mezcal shot",calorias:70,porcion:"1 caballito"},
{id:348,nombre:"Margarita",calorias:280,porcion:"1 copa"},
{id:349,nombre:"Paloma",calorias:180,porcion:"1 vaso"},
{id:350,nombre:"Vino tinto",calorias:125,porcion:"1 copa"},
{id:351,nombre:"Chiles rellenos de queso",calorias:350,porcion:"1 pieza"},
{id:352,nombre:"Chile en nogada",calorias:400,porcion:"1 pieza"},
{id:353,nombre:"Rajas con crema",calorias:200,porcion:"1 porcion"},
{id:354,nombre:"Nopales con huevo",calorias:200,porcion:"1 porcion"},
{id:355,nombre:"Picadillo de res",calorias:280,porcion:"1 porcion"},
{id:356,nombre:"Pollo en mole",calorias:400,porcion:"1 pieza"},
{id:357,nombre:"Tinga de pollo",calorias:250,porcion:"1 porcion"},
{id:358,nombre:"Cochinita pibil",calorias:300,porcion:"100g"},
{id:359,nombre:"Carne en su jugo",calorias:350,porcion:"1 tazon"},
{id:360,nombre:"Entomatadas",calorias:380,porcion:"3 piezas"},
{id:361,nombre:"Enfrijoladas",calorias:400,porcion:"3 piezas"},
{id:362,nombre:"Enmoladas",calorias:450,porcion:"3 piezas"},
{id:363,nombre:"Papas con chorizo",calorias:350,porcion:"1 porcion"},
{id:364,nombre:"Huevo con nopales",calorias:180,porcion:"1 porcion"},
{id:365,nombre:"Discada",calorias:300,porcion:"1 porcion"},
{id:366,nombre:"Alambre de res",calorias:350,porcion:"1 porcion"},
{id:367,nombre:"Carajillo",calorias:200,porcion:"1 copa"},
{id:368,nombre:"Ramen restaurante",calorias:500,porcion:"1 tazon"},
{id:369,nombre:"Pina colada",calorias:350,porcion:"1 vaso"},
{id:370,nombre:"Chicle sin azucar",calorias:5,porcion:"1 pieza"},
{id:371,nombre:"Chicharron preparado con cueritos",calorias:450,porcion:"1 pieza entera"},
{id:372,nombre:"Dorilocos / Tostilocos",calorias:550,porcion:"1 bolsa preparada"},
{id:373,nombre:"Esquites con mayonesa y queso",calorias:300,porcion:"1 vaso chico"},
{id:374,nombre:"Elote entero preparado (mayonesa, queso)",calorias:280,porcion:"1 pieza"},
{id:375,nombre:"Sopa Maruchan / Instantanea",calorias:320,porcion:"1 vaso"},
{id:376,nombre:"Takis Fuego",calorias:280,porcion:"1 bolsa chica (50g)"},
{id:377,nombre:"Cheetos Torciditos",calorias:250,porcion:"1 bolsa chica (45g)"},
{id:378,nombre:"Papas Sabritas saladas",calorias:240,porcion:"1 bolsa chica (40g)"},
{id:379,nombre:"Cacahuates Japoneses",calorias:230,porcion:"1 bolsa chica (50g)"},
{id:380,nombre:"Gomitas enchiladas / Chamoy",calorias:180,porcion:"1 puno (50g)"},
{id:381,nombre:"Gordita de chicharron prensado frita",calorias:400,porcion:"1 pieza"},
{id:382,nombre:"Pambazo de papa con chorizo",calorias:550,porcion:"1 pieza"},
{id:383,nombre:"Quesadilla frita con todo",calorias:350,porcion:"1 pieza"},
{id:384,nombre:"Taco de tripa frita",calorias:280,porcion:"1 taco"},
{id:385,nombre:"Taco de suadero con grasa",calorias:250,porcion:"1 taco"},
{id:386,nombre:"Guajolota (Torta de tamal)",calorias:750,porcion:"1 pieza"},
{id:387,nombre:"Torta ahogada",calorias:600,porcion:"1 pieza"},
{id:388,nombre:"Churros con azucar",calorias:200,porcion:"1 pieza mediana"},
{id:389,nombre:"Pan dulce (Concha)",calorias:260,porcion:"1 pieza"},
{id:390,nombre:"Gansito / Pinguinos",calorias:200,porcion:"1 pieza (50g)"},
{id:391,nombre:"Coca-Cola Regular",calorias:250,porcion:"1 botella (600ml)"},
{id:392,nombre:"Cerveza Michelada con Clamato",calorias:220,porcion:"1 vaso (500ml)"},
{id:393,nombre:"Boing de Mango o Guayaba",calorias:130,porcion:"1 envase (250ml)"},
  // Típica Mexicana
  {id:400,nombre:"Aporreadillo",calorias:320,porcion:"1 plato (200g)"},
  {id:401,nombre:"Enchiladas Verdes (con pollo y crema)",calorias:450,porcion:"3 piezas"},
  {id:402,nombre:"Enchiladas Rojas",calorias:430,porcion:"3 piezas"},
  {id:403,nombre:"Tacos al Pastor",calorias:180,porcion:"1 pieza (chica)"},
  {id:404,nombre:"Tacos de Bistec",calorias:210,porcion:"1 pieza"},
  {id:405,nombre:"Tacos de Suadero",calorias:250,porcion:"1 pieza"},
  {id:406,nombre:"Tacos de Carnitas (Surtida)",calorias:280,porcion:"1 pieza"},
  {id:407,nombre:"Tacos de Barbacoa",calorias:230,porcion:"1 pieza"},
  {id:408,nombre:"Consome de Barbacoa",calorias:150,porcion:"1 taza"},
  {id:409,nombre:"Gordita de Chicharron",calorias:400,porcion:"1 pieza"},
  {id:410,nombre:"Huarache sencillo",calorias:350,porcion:"1 pieza"},
  {id:411,nombre:"Sope sencillo",calorias:200,porcion:"1 pieza"},
  {id:412,nombre:"Sope con pollo y crema",calorias:280,porcion:"1 pieza"},
  {id:413,nombre:"Quesadilla frita de queso",calorias:320,porcion:"1 pieza"},
  {id:414,nombre:"Quesadilla al comal",calorias:180,porcion:"1 pieza"},
  {id:415,nombre:"Pancita / Menudo",calorias:280,porcion:"1 plato (300ml)"},
  {id:416,nombre:"Pozole Rojo (cerdo)",calorias:350,porcion:"1 plato (300ml)"},
  {id:417,nombre:"Pozole Blanco (pollo)",calorias:280,porcion:"1 plato (300ml)"},
  {id:418,nombre:"Tamal verde / dulce",calorias:420,porcion:"1 pieza"},
  {id:419,nombre:"Tamal Oaxaqueno",calorias:500,porcion:"1 pieza"},
  {id:420,nombre:"Tortas ahogadas",calorias:550,porcion:"1 pieza"},
  {id:421,nombre:"Chiles en nogada",calorias:650,porcion:"1 pieza"},
  {id:422,nombre:"Mole poblano con pollo",calorias:450,porcion:"1 porcion (200g)"},
  {id:423,nombre:"Chilaquiles rojos/verdes sencillos",calorias:350,porcion:"1 plato (200g)"},
  {id:424,nombre:"Chilaquiles con huevo",calorias:480,porcion:"1 plato"},
  {id:425,nombre:"Chilaquiles con pollo y crema",calorias:520,porcion:"1 plato"},
  {id:426,nombre:"Huevos a la mexicana",calorias:220,porcion:"2 huevos"},
  {id:427,nombre:"Huevos rancheros",calorias:350,porcion:"2 huevos con tortilla"},
  {id:428,nombre:"Huevos divorciados",calorias:380,porcion:"2 huevos con tortilla"},
  {id:429,nombre:"Molletes con queso",calorias:320,porcion:"2 mitades"},
  {id:430,nombre:"Bistec a la mexicana",calorias:310,porcion:"1 porcion (150g)"},
  {id:431,nombre:"Cochinita pibil",calorias:380,porcion:"1 porcion (150g)"},
  {id:432,nombre:"Flautas de pollo (fritas)",calorias:450,porcion:"3 piezas"},
  {id:433,nombre:"Pambazo de chorizo con papa",calorias:580,porcion:"1 pieza"},
  
  // Mariscos y Pescados
  {id:434,nombre:"Coctel de camaron",calorias:220,porcion:"1 copa mediana"},
  {id:435,nombre:"Aguachile de camaron",calorias:180,porcion:"1 plato (150g)"},
  {id:436,nombre:"Ceviche de pescado",calorias:150,porcion:"1 taza (150g)"},
  {id:437,nombre:"Tacos de pescado Capeado (Baja)",calorias:280,porcion:"1 pieza"},
  {id:438,nombre:"Tacos de camaron Capeado",calorias:290,porcion:"1 pieza"},
  {id:439,nombre:"Tacos de marlin",calorias:180,porcion:"1 pieza"},
  {id:440,nombre:"Mojarra frita",calorias:550,porcion:"1 pieza entera"},
  {id:441,nombre:"Filete de pescado al mojo de ajo",calorias:250,porcion:"1 filete (150g)"},
  {id:442,nombre:"Filete de pescado empanizado",calorias:380,porcion:"1 filete (150g)"},
  {id:443,nombre:"Sopa de mariscos",calorias:280,porcion:"1 plato (300ml)"},
  {id:444,nombre:"Caldo de camaron",calorias:210,porcion:"1 plato (300ml)"},
  {id:445,nombre:"Pulpo enamorado",calorias:310,porcion:"1 porcion (150g)"},
  {id:446,nombre:"Tostada de ceviche",calorias:120,porcion:"1 pieza"},
  
  // Chatarra y Rápidos
  {id:447,nombre:"Maruchan (Sopa instantanea)",calorias:380,porcion:"1 vaso (64g)"},
  {id:448,nombre:"Cheetos (bolsa chica)",calorias:160,porcion:"1 bolsa (30g)"},
  {id:449,nombre:"Doritos Nacho",calorias:240,porcion:"1 bolsa (48g)"},
  {id:450,nombre:"Papas Sabritas (Original)",calorias:220,porcion:"1 bolsa (42g)"},
  {id:451,nombre:"Tostitos preparados (con cueritos y cacahuates)",calorias:550,porcion:"1 porcion"},
  {id:452,nombre:"Ruffles Queso",calorias:240,porcion:"1 bolsa (45g)"},
  {id:453,nombre:"Takis Fuego",calorias:300,porcion:"1 bolsa (62g)"},
  {id:454,nombre:"Pizza Pepperoni (Domino's/Little Caesars)",calorias:280,porcion:"1 rebanada"},
  {id:455,nombre:"Hamburguesa Sencilla (McDonalds/Burger King)",calorias:250,porcion:"1 pieza"},
  {id:456,nombre:"Hamburguesa Doble Queso",calorias:450,porcion:"1 pieza"},
  {id:457,nombre:"Papas fritas (Francesas - Medianas)",calorias:350,porcion:"1 orden"},
  {id:458,nombre:"Nuggets de pollo",calorias:280,porcion:"6 piezas"},
  {id:459,nombre:"Hot Dog tradicional",calorias:300,porcion:"1 pieza"},
  {id:460,nombre:"Club Sandwich",calorias:450,porcion:"1 porcion"},
  {id:461,nombre:"Pollo Frito (KFC)",calorias:320,porcion:"1 pieza (pierna/muslo)"},
  {id:462,nombre:"Alitas BBQ / Buffalo",calorias:400,porcion:"6 piezas"},
  {id:463,nombre:"Nachos con queso",calorias:350,porcion:"1 porcion chica"},
  {id:464,nombre:"Papas a la francesa con queso y tocino",calorias:550,porcion:"1 porcion"},

  // Postres y Dulces
  {id:465,nombre:"Flan Napolitano",calorias:250,porcion:"1 rebanada"},
  {id:466,nombre:"Arroz con leche",calorias:220,porcion:"1 taza (150g)"},
  {id:467,nombre:"Churros con azucar",calorias:230,porcion:"1 pieza"},
  {id:468,nombre:"Churro relleno (cajeta/chocolate)",calorias:350,porcion:"1 pieza"},
  {id:469,nombre:"Pastel de Tres Leches",calorias:380,porcion:"1 rebanada"},
  {id:470,nombre:"Pastel de Chocolate",calorias:450,porcion:"1 rebanada"},
  {id:471,nombre:"Gelatina de Agua",calorias:80,porcion:"1 porcion (120g)"},
  {id:472,nombre:"Gelatina de Leche",calorias:150,porcion:"1 porcion (120g)"},
  {id:473,nombre:"Pan Dulce (Concha)",calorias:280,porcion:"1 pieza"},
  {id:474,nombre:"Pan Dulce (Cuernito)",calorias:250,porcion:"1 pieza"},
  {id:475,nombre:"Pan Dulce (Dona glaseada)",calorias:260,porcion:"1 pieza"},
  {id:476,nombre:"Pan Dulce (Dona de chocolate)",calorias:320,porcion:"1 pieza"},
  {id:477,nombre:"Pan Dulce (Oreja)",calorias:210,porcion:"1 pieza"},
  {id:478,nombre:"Helado de leche (Vainilla/Chocolate)",calorias:150,porcion:"1 bola (1/2 taza)"},
  {id:479,nombre:"Nieve de agua (Limon/Mango)",calorias:100,porcion:"1 bola (1/2 taza)"},
  {id:480,nombre:"Paleta de hielo (de agua)",calorias:70,porcion:"1 pieza"},
  {id:481,nombre:"Paleta de hielo (de leche)",calorias:150,porcion:"1 pieza"},
  {id:482,nombre:"Frappuccino moka (Starbucks)",calorias:400,porcion:"1 vaso (Alto)"},
  {id:483,nombre:"Brownie de chocolate",calorias:350,porcion:"1 pieza"},
  {id:484,nombre:"Galletas Oreo",calorias:160,porcion:"3 piezas"},
  {id:485,nombre:"Galletas Chokis",calorias:150,porcion:"3 piezas"},
  {id:486,nombre:"Gomitas enchiladas",calorias:180,porcion:"1 bolsa chica (50g)"},
  {id:487,nombre:"Chicharron preparado (con cueritos, crema, col)",calorias:350,porcion:"1 pieza"},
  {id:488,nombre:"Esquite con mayonesa y queso",calorias:320,porcion:"1 vaso chico"},
  {id:489,nombre:"Elote entero con mayonesa y queso",calorias:350,porcion:"1 pieza"},
  {id:490,nombre:"Crepa dulce (Nutella y Fresa)",calorias:450,porcion:"1 pieza"},
  {id:491,nombre:"Marquesita (Queso de bola y cajeta)",calorias:420,porcion:"1 pieza"},
// === DESAYUNOS COMPLETOS ===
{id:492,nombre:"Hotcakes (3 piezas con miel)",calorias:350,porcion:"3 piezas"},
{id:493,nombre:"Waffles (2 piezas con miel)",calorias:380,porcion:"2 piezas"},
{id:494,nombre:"Avena cocida con leche",calorias:180,porcion:"1 taza"},
{id:495,nombre:"Avena con fruta y miel",calorias:250,porcion:"1 taza"},
{id:496,nombre:"Cereal con leche entera",calorias:220,porcion:"1 taza"},
{id:497,nombre:"Cereal Zucaritas con leche",calorias:240,porcion:"1 taza"},
{id:498,nombre:"Cereal Cheerios con leche",calorias:200,porcion:"1 taza"},
{id:499,nombre:"Yogurt natural",calorias:100,porcion:"1 taza"},
{id:500,nombre:"Yogurt con fruta",calorias:150,porcion:"1 taza"},
{id:501,nombre:"Granola",calorias:210,porcion:"1/2 taza"},
{id:502,nombre:"Granola con yogurt y fruta",calorias:320,porcion:"1 porción"},
{id:503,nombre:"Pan tostado con mermelada",calorias:145,porcion:"2 rebanadas"},
{id:504,nombre:"Pan tostado con mantequilla",calorias:170,porcion:"2 rebanadas"},
{id:505,nombre:"Licuado de plátano con leche",calorias:220,porcion:"1 vaso 300ml"},
{id:506,nombre:"Licuado de mamey",calorias:250,porcion:"1 vaso 300ml"},
{id:507,nombre:"Smoothie verde (espinaca, piña, plátano)",calorias:160,porcion:"1 vaso 300ml"},
{id:508,nombre:"Smoothie de frutos rojos",calorias:170,porcion:"1 vaso 300ml"},
{id:509,nombre:"Chilaquiles verdes con pollo",calorias:480,porcion:"1 plato"},
{id:510,nombre:"Chilaquiles rojos con huevo",calorias:450,porcion:"1 plato"},
{id:511,nombre:"Molletes con frijol y queso",calorias:380,porcion:"2 mitades"},
{id:512,nombre:"Hot dog",calorias:310,porcion:"1 pieza"},
{id:513,nombre:"Pan francés (french toast)",calorias:340,porcion:"2 rebanadas"},
{id:514,nombre:"Fruta picada con granola y yogurt",calorias:280,porcion:"1 plato"},
// === SOPAS Y CALDOS ===
{id:515,nombre:"Caldo de pollo con verduras",calorias:220,porcion:"1 plato"},
{id:516,nombre:"Caldo de pollo con arroz",calorias:280,porcion:"1 plato"},
{id:517,nombre:"Sopa de fideo",calorias:150,porcion:"1 plato"},
{id:518,nombre:"Sopa de tortilla",calorias:230,porcion:"1 plato"},
{id:519,nombre:"Sopa azteca",calorias:250,porcion:"1 plato"},
{id:520,nombre:"Crema de elote",calorias:200,porcion:"1 plato"},
{id:521,nombre:"Crema de champiñones",calorias:190,porcion:"1 plato"},
{id:522,nombre:"Crema de espárragos",calorias:170,porcion:"1 plato"},
{id:523,nombre:"Caldo tlalpeño",calorias:260,porcion:"1 plato"},
{id:524,nombre:"Sopa de verduras",calorias:120,porcion:"1 plato"},
{id:525,nombre:"Sopa de lentejas",calorias:230,porcion:"1 plato"},
{id:526,nombre:"Caldo de res",calorias:300,porcion:"1 plato"},
{id:527,nombre:"Caldo de camarón",calorias:250,porcion:"1 plato"},
{id:528,nombre:"Consomé de pollo",calorias:90,porcion:"1 taza"},
{id:529,nombre:"Sopa de lima",calorias:210,porcion:"1 plato"},
{id:530,nombre:"Sopa de habas",calorias:200,porcion:"1 plato"},
{id:531,nombre:"Pozole rojo de puerco",calorias:380,porcion:"1 plato"},
{id:532,nombre:"Pozole verde de pollo",calorias:320,porcion:"1 plato"},
{id:533,nombre:"Menudo",calorias:350,porcion:"1 plato"},
// === ARROZ Y PASTAS ===
{id:534,nombre:"Arroz rojo mexicano",calorias:210,porcion:"1 taza"},
{id:535,nombre:"Arroz blanco",calorias:200,porcion:"1 taza"},
{id:536,nombre:"Arroz verde",calorias:220,porcion:"1 taza"},
{id:537,nombre:"Arroz con leche",calorias:260,porcion:"1 taza"},
{id:538,nombre:"Arroz con plátano frito",calorias:280,porcion:"1 taza"},
{id:539,nombre:"Espagueti rojo",calorias:300,porcion:"1 plato"},
{id:540,nombre:"Espagueti a la mantequilla",calorias:350,porcion:"1 plato"},
{id:541,nombre:"Espagueti a la boloñesa",calorias:420,porcion:"1 plato"},
{id:542,nombre:"Pasta alfredo",calorias:450,porcion:"1 plato"},
{id:543,nombre:"Pasta alfredo con pollo",calorias:520,porcion:"1 plato"},
{id:544,nombre:"Lasaña de carne",calorias:480,porcion:"1 porción"},
{id:545,nombre:"Lasaña de espinaca",calorias:380,porcion:"1 porción"},
{id:546,nombre:"Coditos con crema y jamón",calorias:380,porcion:"1 plato"},
{id:547,nombre:"Coditos con queso (mac & cheese)",calorias:400,porcion:"1 plato"},
{id:548,nombre:"Sopa de coditos",calorias:180,porcion:"1 plato"},
{id:549,nombre:"Pasta con pesto",calorias:410,porcion:"1 plato"},
{id:550,nombre:"Ravioles de queso con salsa",calorias:370,porcion:"1 plato"},
{id:551,nombre:"Fetuccini con camarones",calorias:460,porcion:"1 plato"},
// === FRIJOLES Y LEGUMINOSAS ===
{id:552,nombre:"Frijoles de olla",calorias:180,porcion:"1 taza"},
{id:553,nombre:"Frijoles refritos",calorias:240,porcion:"1 taza"},
{id:554,nombre:"Frijoles refritos con queso",calorias:300,porcion:"1 taza"},
{id:555,nombre:"Frijoles charros",calorias:290,porcion:"1 taza"},
{id:556,nombre:"Frijoles puercos",calorias:320,porcion:"1 taza"},
{id:557,nombre:"Frijoles negros de olla",calorias:185,porcion:"1 taza"},
{id:558,nombre:"Frijoles maneados (Sonora)",calorias:350,porcion:"1 taza"},
{id:559,nombre:"Lentejas guisadas",calorias:230,porcion:"1 taza"},
{id:560,nombre:"Lentejas con plátano y chorizo",calorias:310,porcion:"1 taza"},
{id:561,nombre:"Habas guisadas",calorias:190,porcion:"1 taza"},
{id:562,nombre:"Habas secas tostadas",calorias:140,porcion:"1/2 taza"},
{id:563,nombre:"Garbanzos guisados",calorias:210,porcion:"1 taza"},
{id:564,nombre:"Enfrijoladas",calorias:380,porcion:"3 piezas"},
// === LÁCTEOS ===
{id:565,nombre:"Leche entera",calorias:150,porcion:"1 vaso 240ml"},
{id:566,nombre:"Leche descremada",calorias:90,porcion:"1 vaso 240ml"},
{id:567,nombre:"Leche semidescremada",calorias:120,porcion:"1 vaso 240ml"},
{id:568,nombre:"Leche de almendra sin azúcar",calorias:30,porcion:"1 vaso 240ml"},
{id:569,nombre:"Leche de almendra con azúcar",calorias:60,porcion:"1 vaso 240ml"},
{id:570,nombre:"Leche de avena",calorias:120,porcion:"1 vaso 240ml"},
{id:571,nombre:"Leche de coco",calorias:75,porcion:"1 vaso 240ml"},
{id:572,nombre:"Leche de soya",calorias:105,porcion:"1 vaso 240ml"},
{id:573,nombre:"Queso panela",calorias:80,porcion:"50g"},
{id:574,nombre:"Queso Oaxaca",calorias:140,porcion:"50g"},
{id:575,nombre:"Queso cotija",calorias:105,porcion:"30g"},
{id:576,nombre:"Queso manchego mexicano",calorias:130,porcion:"40g"},
{id:577,nombre:"Queso crema Philadelphia",calorias:100,porcion:"30g"},
{id:578,nombre:"Queso amarillo (americano)",calorias:105,porcion:"1 rebanada"},
{id:579,nombre:"Queso doble crema",calorias:120,porcion:"40g"},
{id:580,nombre:"Queso Chihuahua",calorias:130,porcion:"40g"},
{id:581,nombre:"Crema agria",calorias:55,porcion:"2 cucharadas"},
{id:582,nombre:"Crema ácida Lala",calorias:60,porcion:"2 cucharadas"},
{id:583,nombre:"Mantequilla",calorias:100,porcion:"1 cucharada 14g"},
{id:584,nombre:"Margarina",calorias:80,porcion:"1 cucharada"},
{id:585,nombre:"Yogurt griego natural",calorias:130,porcion:"1 taza"},
{id:586,nombre:"Yogurt griego con fruta",calorias:160,porcion:"1 taza"},
{id:587,nombre:"Yogurt bebible Yakult",calorias:50,porcion:"1 botecito 80ml"},
{id:588,nombre:"Danonino",calorias:70,porcion:"1 pieza"},
{id:589,nombre:"Requesón",calorias:95,porcion:"1/2 taza"},
{id:590,nombre:"Jocoque",calorias:65,porcion:"1/4 taza"},
// === HUEVOS VARIADOS ===
{id:591,nombre:"Huevo cocido",calorias:78,porcion:"1 pieza"},
{id:592,nombre:"Huevo estrellado",calorias:110,porcion:"1 pieza"},
{id:593,nombre:"Huevos revueltos (2 piezas)",calorias:200,porcion:"2 piezas"},
{id:594,nombre:"Omelette de jamón y queso",calorias:310,porcion:"1 pieza (2 huevos)"},
{id:595,nombre:"Omelette de champiñones",calorias:250,porcion:"1 pieza (2 huevos)"},
{id:596,nombre:"Omelette de espinaca",calorias:230,porcion:"1 pieza (2 huevos)"},
{id:597,nombre:"Huevos con chorizo",calorias:340,porcion:"1 plato (2 huevos)"},
{id:598,nombre:"Huevos rancheros",calorias:360,porcion:"1 plato"},
{id:599,nombre:"Huevos a la mexicana",calorias:250,porcion:"1 plato (2 huevos)"},
{id:600,nombre:"Huevos motuleños",calorias:420,porcion:"1 plato"},
{id:601,nombre:"Huevos divorciados",calorias:380,porcion:"1 plato"},
{id:602,nombre:"Machaca con huevo",calorias:350,porcion:"1 plato"},
{id:603,nombre:"Huevos con nopales",calorias:220,porcion:"1 plato (2 huevos)"},
{id:604,nombre:"Huevos con jamón",calorias:280,porcion:"1 plato (2 huevos)"},
{id:605,nombre:"Huevos con ejotes",calorias:230,porcion:"1 plato (2 huevos)"},
{id:606,nombre:"Claras de huevo (4 claras)",calorias:68,porcion:"4 claras"},
// === BEBIDAS ===
{id:607,nombre:"Agua de horchata",calorias:170,porcion:"1 vaso 300ml"},
{id:608,nombre:"Agua de jamaica",calorias:90,porcion:"1 vaso 300ml"},
{id:609,nombre:"Agua de jamaica sin azúcar",calorias:10,porcion:"1 vaso 300ml"},
{id:610,nombre:"Agua de tamarindo",calorias:150,porcion:"1 vaso 300ml"},
{id:611,nombre:"Agua de limón",calorias:100,porcion:"1 vaso 300ml"},
{id:612,nombre:"Agua de limón sin azúcar",calorias:5,porcion:"1 vaso 300ml"},
{id:613,nombre:"Agua de piña",calorias:130,porcion:"1 vaso 300ml"},
{id:614,nombre:"Agua de guayaba",calorias:120,porcion:"1 vaso 300ml"},
{id:615,nombre:"Agua de sandía",calorias:100,porcion:"1 vaso 300ml"},
{id:616,nombre:"Agua de pepino con limón",calorias:40,porcion:"1 vaso 300ml"},
{id:617,nombre:"Jugo de naranja natural",calorias:110,porcion:"1 vaso 240ml"},
{id:618,nombre:"Jugo verde (nopal, piña, apio)",calorias:90,porcion:"1 vaso 300ml"},
{id:619,nombre:"Jugo de zanahoria",calorias:95,porcion:"1 vaso 240ml"},
{id:620,nombre:"Jugo de toronja",calorias:96,porcion:"1 vaso 240ml"},
{id:621,nombre:"Café americano sin azúcar",calorias:5,porcion:"1 taza"},
{id:622,nombre:"Café americano con azúcar",calorias:40,porcion:"1 taza"},
{id:623,nombre:"Café con leche",calorias:120,porcion:"1 taza"},
{id:624,nombre:"Café con leche descremada",calorias:70,porcion:"1 taza"},
{id:625,nombre:"Cappuccino",calorias:140,porcion:"1 taza"},
{id:626,nombre:"Café latte",calorias:190,porcion:"1 taza grande"},
{id:627,nombre:"Café moca",calorias:250,porcion:"1 taza grande"},
{id:628,nombre:"Frappuccino (Starbucks)",calorias:380,porcion:"1 vaso grande"},
{id:629,nombre:"Café de olla",calorias:80,porcion:"1 taza"},
{id:630,nombre:"Chocolate caliente Abuelita",calorias:200,porcion:"1 taza 240ml"},
{id:631,nombre:"Atole de vainilla",calorias:180,porcion:"1 taza 240ml"},
{id:632,nombre:"Atole de fresa",calorias:185,porcion:"1 taza 240ml"},
{id:633,nombre:"Atole de guayaba",calorias:175,porcion:"1 taza 240ml"},
{id:634,nombre:"Champurrado",calorias:220,porcion:"1 taza 240ml"},
{id:635,nombre:"Tepache",calorias:130,porcion:"1 vaso 300ml"},
{id:636,nombre:"Pulque natural",calorias:80,porcion:"1 vaso 250ml"},
{id:637,nombre:"Pulque curado de avena",calorias:140,porcion:"1 vaso 250ml"},
{id:638,nombre:"Cerveza clara (355ml)",calorias:145,porcion:"1 lata"},
{id:639,nombre:"Cerveza oscura (355ml)",calorias:160,porcion:"1 lata"},
{id:640,nombre:"Cerveza light (355ml)",calorias:100,porcion:"1 lata"},
{id:641,nombre:"Michelada",calorias:200,porcion:"1 vaso"},
{id:642,nombre:"Tequila (caballito)",calorias:65,porcion:"1 caballito 45ml"},
{id:643,nombre:"Mezcal (caballito)",calorias:70,porcion:"1 caballito 45ml"},
{id:644,nombre:"Ron con Coca-Cola",calorias:185,porcion:"1 vaso"},
{id:645,nombre:"Whisky solo",calorias:70,porcion:"1 trago 45ml"},
{id:646,nombre:"Whisky con refresco",calorias:190,porcion:"1 vaso"},
{id:647,nombre:"Vino tinto",calorias:125,porcion:"1 copa 150ml"},
{id:648,nombre:"Vino blanco",calorias:120,porcion:"1 copa 150ml"},
{id:649,nombre:"Sangría",calorias:150,porcion:"1 copa"},
{id:650,nombre:"Piña colada",calorias:300,porcion:"1 vaso"},
{id:651,nombre:"Margarita",calorias:275,porcion:"1 vaso"},
{id:652,nombre:"Coca-Cola (355ml)",calorias:140,porcion:"1 lata"},
{id:653,nombre:"Coca-Cola (600ml)",calorias:240,porcion:"1 botella"},
{id:654,nombre:"Coca-Cola Zero",calorias:0,porcion:"1 lata 355ml"},
{id:655,nombre:"Pepsi (355ml)",calorias:150,porcion:"1 lata"},
{id:656,nombre:"Sprite (355ml)",calorias:140,porcion:"1 lata"},
{id:657,nombre:"Fanta naranja (355ml)",calorias:160,porcion:"1 lata"},
{id:658,nombre:"Jarritos (355ml)",calorias:150,porcion:"1 botella"},
{id:659,nombre:"Jugo Del Valle néctar (250ml)",calorias:110,porcion:"1 caja"},
{id:660,nombre:"Jumex néctar (250ml)",calorias:115,porcion:"1 lata"},
{id:661,nombre:"Boing (500ml)",calorias:200,porcion:"1 bolsa"},
{id:662,nombre:"Red Bull (250ml)",calorias:110,porcion:"1 lata"},
{id:663,nombre:"Monster (473ml)",calorias:210,porcion:"1 lata"},
{id:664,nombre:"Gatorade (600ml)",calorias:140,porcion:"1 botella"},
{id:665,nombre:"Electrolit (625ml)",calorias:70,porcion:"1 botella"},
{id:666,nombre:"Agua mineral Peñafiel",calorias:0,porcion:"1 botella 600ml"},
{id:667,nombre:"Limonada mineral",calorias:80,porcion:"1 vaso 300ml"},
// === TORTILLAS Y PANES ===
{id:668,nombre:"Tortilla de maíz",calorias:55,porcion:"1 pieza"},
{id:669,nombre:"Tortilla de harina chica",calorias:90,porcion:"1 pieza"},
{id:670,nombre:"Tortilla de harina grande (burrera)",calorias:150,porcion:"1 pieza"},
{id:671,nombre:"Tortilla de nopal",calorias:25,porcion:"1 pieza"},
{id:672,nombre:"Tostada horneada",calorias:60,porcion:"1 pieza"},
{id:673,nombre:"Tostada frita",calorias:90,porcion:"1 pieza"},
{id:674,nombre:"Bolillo",calorias:180,porcion:"1 pieza"},
{id:675,nombre:"Telera",calorias:200,porcion:"1 pieza"},
{id:676,nombre:"Pan de caja Bimbo (blanco)",calorias:70,porcion:"1 rebanada"},
{id:677,nombre:"Pan de caja integral",calorias:65,porcion:"1 rebanada"},
{id:678,nombre:"Pan multigrano",calorias:70,porcion:"1 rebanada"},
{id:679,nombre:"Croissant",calorias:230,porcion:"1 pieza"},
{id:680,nombre:"Croissant con jamón y queso",calorias:340,porcion:"1 pieza"},
{id:681,nombre:"Baguette",calorias:250,porcion:"1/2 pieza"},
{id:682,nombre:"Pan pita integral",calorias:80,porcion:"1 pieza"},
{id:683,nombre:"Tortilla de harina integral",calorias:80,porcion:"1 pieza"},
// === SUSHI Y COMIDA JAPONESA ===
{id:684,nombre:"Roll California (8 piezas)",calorias:320,porcion:"8 piezas"},
{id:685,nombre:"Roll Philadelphia (8 piezas)",calorias:350,porcion:"8 piezas"},
{id:686,nombre:"Roll tempura (8 piezas)",calorias:420,porcion:"8 piezas"},
{id:687,nombre:"Roll de camarón empanizado (8 piezas)",calorias:440,porcion:"8 piezas"},
{id:688,nombre:"Roll volcán (8 piezas)",calorias:400,porcion:"8 piezas"},
{id:689,nombre:"Sashimi de salmón (6 cortes)",calorias:180,porcion:"6 cortes"},
{id:690,nombre:"Sashimi de atún (6 cortes)",calorias:160,porcion:"6 cortes"},
{id:691,nombre:"Nigiri de salmón (2 piezas)",calorias:120,porcion:"2 piezas"},
{id:692,nombre:"Edamames",calorias:120,porcion:"1 taza"},
{id:693,nombre:"Ramen de cerdo",calorias:450,porcion:"1 plato"},
{id:694,nombre:"Ramen de pollo",calorias:400,porcion:"1 plato"},
{id:695,nombre:"Gyoza (6 piezas)",calorias:240,porcion:"6 piezas"},
{id:696,nombre:"Tempura de camarón (4 piezas)",calorias:280,porcion:"4 piezas"},
{id:697,nombre:"Miso soup",calorias:45,porcion:"1 taza"},
{id:698,nombre:"Yakimeshi (arroz frito japonés)",calorias:380,porcion:"1 plato"},
// === COMIDA CHINA (ADAPTADA MX) ===
{id:699,nombre:"Arroz frito chino",calorias:370,porcion:"1 plato"},
{id:700,nombre:"Arroz frito con camarón",calorias:400,porcion:"1 plato"},
{id:701,nombre:"Pollo agridulce",calorias:420,porcion:"1 plato"},
{id:702,nombre:"Pollo con almendras",calorias:380,porcion:"1 plato"},
{id:703,nombre:"Chop suey de pollo",calorias:300,porcion:"1 plato"},
{id:704,nombre:"Chop suey de res",calorias:340,porcion:"1 plato"},
{id:705,nombre:"Chow mein de pollo",calorias:380,porcion:"1 plato"},
{id:706,nombre:"Wonton frito (6 piezas)",calorias:260,porcion:"6 piezas"},
{id:707,nombre:"Sopa wonton",calorias:180,porcion:"1 plato"},
{id:708,nombre:"Rollito primavera (2 piezas)",calorias:200,porcion:"2 piezas"},
{id:709,nombre:"Pollo kung pao",calorias:400,porcion:"1 plato"},
{id:710,nombre:"Costillas BBQ chinas",calorias:450,porcion:"1 porción"},
// === COMIDA ITALIANA ===
{id:711,nombre:"Pizza margarita (1 rebanada)",calorias:220,porcion:"1 rebanada"},
{id:712,nombre:"Pizza hawaiana (1 rebanada)",calorias:240,porcion:"1 rebanada"},
{id:713,nombre:"Pizza pepperoni (1 rebanada)",calorias:260,porcion:"1 rebanada"},
{id:714,nombre:"Pizza 4 quesos (1 rebanada)",calorias:280,porcion:"1 rebanada"},
{id:715,nombre:"Pizza mexicana (1 rebanada)",calorias:250,porcion:"1 rebanada"},
{id:716,nombre:"Pizza de la calle (1 rebanada grande)",calorias:350,porcion:"1 rebanada"},
{id:717,nombre:"Calzone",calorias:480,porcion:"1 pieza"},
{id:718,nombre:"Bruschetta (3 piezas)",calorias:180,porcion:"3 piezas"},
{id:719,nombre:"Risotto de champiñones",calorias:380,porcion:"1 plato"},
{id:720,nombre:"Risotto de mariscos",calorias:420,porcion:"1 plato"},
{id:721,nombre:"Carpaccio de res",calorias:200,porcion:"1 porción"},
{id:722,nombre:"Tiramisú",calorias:350,porcion:"1 porción"},
{id:723,nombre:"Panna cotta",calorias:280,porcion:"1 porción"},
// === COMPLEMENTOS Y ADEREZOS ===
{id:724,nombre:"Salsa verde cruda",calorias:15,porcion:"2 cucharadas"},
{id:725,nombre:"Salsa verde cocida",calorias:15,porcion:"2 cucharadas"},
{id:726,nombre:"Salsa roja",calorias:15,porcion:"2 cucharadas"},
{id:727,nombre:"Salsa de chile de árbol",calorias:10,porcion:"1 cucharada"},
{id:728,nombre:"Salsa de chipotle",calorias:20,porcion:"2 cucharadas"},
{id:729,nombre:"Guacamole",calorias:110,porcion:"1/4 taza"},
{id:730,nombre:"Pico de gallo",calorias:20,porcion:"1/4 taza"},
{id:731,nombre:"Mayonesa",calorias:95,porcion:"1 cucharada"},
{id:732,nombre:"Mayonesa light",calorias:45,porcion:"1 cucharada"},
{id:733,nombre:"Mostaza",calorias:5,porcion:"1 cucharadita"},
{id:734,nombre:"Ketchup",calorias:20,porcion:"1 cucharada"},
{id:735,nombre:"Salsa soya",calorias:10,porcion:"1 cucharada"},
{id:736,nombre:"Salsa Valentina",calorias:5,porcion:"1 cucharada"},
{id:737,nombre:"Salsa Maggi",calorias:5,porcion:"1 cucharadita"},
{id:738,nombre:"Salsa Tabasco",calorias:0,porcion:"1 cucharadita"},
{id:739,nombre:"Salsa inglesa",calorias:5,porcion:"1 cucharadita"},
{id:740,nombre:"Aderezo ranch",calorias:75,porcion:"1 cucharada"},
{id:741,nombre:"Aderezo César",calorias:80,porcion:"1 cucharada"},
{id:742,nombre:"Vinagreta balsámica",calorias:45,porcion:"1 cucharada"},
{id:743,nombre:"Aceite de oliva",calorias:120,porcion:"1 cucharada"},
{id:744,nombre:"Miel de abeja",calorias:65,porcion:"1 cucharada"},
{id:745,nombre:"Mermelada de fresa",calorias:50,porcion:"1 cucharada"},
{id:746,nombre:"Cajeta",calorias:70,porcion:"1 cucharada"},
{id:747,nombre:"Lechera (leche condensada)",calorias:65,porcion:"1 cucharada"},
{id:748,nombre:"Nutella",calorias:100,porcion:"1 cucharada"},
{id:749,nombre:"Crema de cacahuate",calorias:95,porcion:"1 cucharada"},
// === FRUTOS SECOS Y SNACKS SALUDABLES ===
{id:750,nombre:"Almendras naturales",calorias:165,porcion:"30g (23 piezas)"},
{id:751,nombre:"Nueces",calorias:185,porcion:"30g"},
{id:752,nombre:"Pistaches",calorias:160,porcion:"30g"},
{id:753,nombre:"Cacahuates naturales",calorias:170,porcion:"30g"},
{id:754,nombre:"Cacahuates enchilados",calorias:180,porcion:"30g"},
{id:755,nombre:"Cacahuates japoneses",calorias:160,porcion:"30g"},
{id:756,nombre:"Arándanos secos",calorias:130,porcion:"30g"},
{id:757,nombre:"Pasas",calorias:85,porcion:"30g"},
{id:758,nombre:"Semillas de girasol",calorias:165,porcion:"30g"},
{id:759,nombre:"Semillas de calabaza (pepitas)",calorias:150,porcion:"30g"},
{id:760,nombre:"Semillas de chía",calorias:140,porcion:"30g"},
{id:761,nombre:"Semillas de linaza",calorias:150,porcion:"30g"},
{id:762,nombre:"Barra de granola Nature Valley",calorias:190,porcion:"1 barra 42g"},
{id:763,nombre:"Barra de granola casera",calorias:150,porcion:"1 barra"},
{id:764,nombre:"Mix de frutos secos",calorias:175,porcion:"30g"},
{id:765,nombre:"Mix de frutos secos con chocolate",calorias:200,porcion:"30g"},
{id:766,nombre:"Dátiles",calorias:70,porcion:"2 piezas"},
{id:767,nombre:"Higos secos",calorias:60,porcion:"2 piezas"},
{id:768,nombre:"Coco deshidratado",calorias:95,porcion:"30g"},
{id:769,nombre:"Amaranto en barra",calorias:110,porcion:"1 barra"},
// === SUPLEMENTOS ===
{id:770,nombre:"Proteína whey en polvo (1 scoop)",calorias:120,porcion:"30g"},
{id:771,nombre:"Proteína caseína en polvo",calorias:120,porcion:"30g"},
{id:772,nombre:"Proteína vegana en polvo",calorias:110,porcion:"30g"},
{id:773,nombre:"Barrita proteica Quest",calorias:200,porcion:"1 barra 60g"},
{id:774,nombre:"Barrita proteica Think!",calorias:230,porcion:"1 barra"},
{id:775,nombre:"Barrita proteica Kirkland",calorias:190,porcion:"1 barra"},
{id:776,nombre:"Licuado proteico con plátano",calorias:300,porcion:"1 vaso"},
{id:777,nombre:"Licuado proteico con avena",calorias:350,porcion:"1 vaso"},
{id:778,nombre:"Creatina monohidratada",calorias:0,porcion:"5g"},
{id:779,nombre:"BCAA (aminoácidos)",calorias:10,porcion:"1 scoop"},
{id:780,nombre:"Ensure (suplemento alimenticio)",calorias:220,porcion:"1 botella 237ml"},
// === COMIDAS DE OFICINA / RÁPIDAS ===
{id:781,nombre:"Sándwich de jamón y queso",calorias:350,porcion:"1 pieza"},
{id:782,nombre:"Sándwich de atún",calorias:330,porcion:"1 pieza"},
{id:783,nombre:"Sándwich de pollo",calorias:370,porcion:"1 pieza"},
{id:784,nombre:"Sándwich club",calorias:450,porcion:"1 pieza"},
{id:785,nombre:"Wrap de pollo",calorias:380,porcion:"1 pieza"},
{id:786,nombre:"Wrap de atún",calorias:340,porcion:"1 pieza"},
{id:787,nombre:"Wrap vegetariano",calorias:300,porcion:"1 pieza"},
{id:788,nombre:"Ensalada César con pollo",calorias:350,porcion:"1 plato"},
{id:789,nombre:"Ensalada César sin pollo",calorias:220,porcion:"1 plato"},
{id:790,nombre:"Ensalada de atún",calorias:280,porcion:"1 plato"},
{id:791,nombre:"Ensalada verde mixta",calorias:80,porcion:"1 plato"},
{id:792,nombre:"Ensalada de pollo a la plancha",calorias:300,porcion:"1 plato"},
{id:793,nombre:"Ensalada de pasta",calorias:350,porcion:"1 plato"},
{id:794,nombre:"Bowl de arroz con pollo",calorias:420,porcion:"1 bowl"},
{id:795,nombre:"Bowl de arroz con salmón (poke)",calorias:450,porcion:"1 bowl"},
{id:796,nombre:"Maruchan (sopa instantánea)",calorias:380,porcion:"1 sobre"},
{id:797,nombre:"Cup Noodles",calorias:290,porcion:"1 vaso"},
{id:798,nombre:"Subway 6 pulgadas (pollo)",calorias:380,porcion:"1 pieza"},
{id:799,nombre:"Bagel con queso crema",calorias:350,porcion:"1 pieza"},
// === ANTOJITOS ADICIONALES ===
{id:800,nombre:"Tlacoyo de frijol",calorias:220,porcion:"1 pieza"},
{id:801,nombre:"Tlacoyo de requesón",calorias:200,porcion:"1 pieza"},
{id:802,nombre:"Tlacoyo de chicharrón",calorias:250,porcion:"1 pieza"},
{id:803,nombre:"Tlayuda",calorias:550,porcion:"1 pieza"},
{id:804,nombre:"Tlayuda con tasajo",calorias:620,porcion:"1 pieza"},
{id:805,nombre:"Memela con frijol y queso",calorias:230,porcion:"1 pieza"},
{id:806,nombre:"Garnacha",calorias:180,porcion:"1 pieza"},
{id:807,nombre:"Empanada de plátano",calorias:280,porcion:"1 pieza"},
{id:808,nombre:"Empanada de pollo",calorias:300,porcion:"1 pieza"},
{id:809,nombre:"Empanada de queso",calorias:260,porcion:"1 pieza"},
{id:810,nombre:"Empanada de mole",calorias:310,porcion:"1 pieza"},
{id:811,nombre:"Huarache con carne",calorias:420,porcion:"1 pieza"},
{id:812,nombre:"Huarache con nopales",calorias:280,porcion:"1 pieza"},
{id:813,nombre:"Sope con frijol y queso",calorias:250,porcion:"1 pieza"},
{id:814,nombre:"Sope con carne",calorias:320,porcion:"1 pieza"},
{id:815,nombre:"Gordita de chicharrón",calorias:300,porcion:"1 pieza"},
{id:816,nombre:"Gordita de migajas",calorias:280,porcion:"1 pieza"},
{id:817,nombre:"Pambazos",calorias:420,porcion:"1 pieza"},
{id:818,nombre:"Molote",calorias:280,porcion:"1 pieza"},
{id:819,nombre:"Chalupa poblana",calorias:200,porcion:"1 pieza"},
{id:820,nombre:"Pellizcada",calorias:190,porcion:"1 pieza"},
// === COMIDA RÁPIDA CADENAS ===
{id:821,nombre:"Hamburguesa sencilla (McDonald's)",calorias:250,porcion:"1 pieza"},
{id:822,nombre:"Big Mac",calorias:550,porcion:"1 pieza"},
{id:823,nombre:"McPollo",calorias:400,porcion:"1 pieza"},
{id:824,nombre:"Papas fritas McDonald's (medianas)",calorias:340,porcion:"1 porción"},
{id:825,nombre:"McNuggets (6 piezas)",calorias:280,porcion:"6 piezas"},
{id:826,nombre:"Whopper Burger King",calorias:660,porcion:"1 pieza"},
{id:827,nombre:"Pollo KFC (1 pieza original)",calorias:280,porcion:"1 pieza"},
{id:828,nombre:"Pollo KFC (1 pieza crispy)",calorias:320,porcion:"1 pieza"},
{id:829,nombre:"Carl's Jr. Famous Star",calorias:590,porcion:"1 pieza"},
{id:830,nombre:"Domino's pizza (1 reb. mediana pepperoni)",calorias:230,porcion:"1 rebanada"},
{id:831,nombre:"Little Caesars (1 rebanada)",calorias:220,porcion:"1 rebanada"},
// === EXTRAS Y MISCELÁNEOS ===
{id:832,nombre:"Elote en vaso (esquite)",calorias:280,porcion:"1 vaso"},
{id:833,nombre:"Elote hervido con mayonesa y queso",calorias:300,porcion:"1 pieza"},
{id:834,nombre:"Chicharrón de cerdo",calorias:160,porcion:"30g"},
{id:835,nombre:"Chicharrón preparado",calorias:280,porcion:"1 porción"},
{id:836,nombre:"Duritos preparados",calorias:250,porcion:"1 porción"},
{id:837,nombre:"Tostilocos",calorias:350,porcion:"1 porción"},
{id:838,nombre:"Dorilocos",calorias:380,porcion:"1 porción"},
{id:839,nombre:"Papas a la francesa",calorias:320,porcion:"1 porción mediana"},
{id:840,nombre:"Aros de cebolla",calorias:280,porcion:"1 porción"},
{id:841,nombre:"Nachos con queso",calorias:350,porcion:"1 porción"},
{id:842,nombre:"Totopos horneados",calorias:140,porcion:"30g"},
{id:843,nombre:"Palomitas de maíz (caseras)",calorias:100,porcion:"3 tazas"},
{id:844,nombre:"Palomitas de cine (medianas)",calorias:650,porcion:"1 bolsa mediana"},
{id:845,nombre:"Cacahuates De La Rosa (mazapán)",calorias:110,porcion:"1 pieza"},
{id:846,nombre:"Mazapán De La Rosa",calorias:110,porcion:"1 pieza"},
{id:847,nombre:"Obleas con cajeta",calorias:90,porcion:"1 pieza"},
{id:848,nombre:"Palanqueta de cacahuate",calorias:130,porcion:"1 pieza"},
{id:849,nombre:"Tamal de elote (dulce)",calorias:280,porcion:"1 pieza"},
{id:850,nombre:"Tamal de rajas con queso",calorias:300,porcion:"1 pieza"},
{id:851,nombre:"Tamal oaxaqueño de mole",calorias:350,porcion:"1 pieza"},
{id:852,nombre:"Tamales de dulce (piña/fresa)",calorias:250,porcion:"1 pieza"},
{id:853,nombre:"Birria de res",calorias:380,porcion:"1 plato"},
{id:854,nombre:"Quesabirria (3 tacos)",calorias:500,porcion:"3 piezas"},
{id:855,nombre:"Barbacoa de res",calorias:340,porcion:"100g"},
{id:856,nombre:"Mixiote de pollo",calorias:300,porcion:"1 pieza"},
{id:857,nombre:"Mole poblano con pollo",calorias:450,porcion:"1 plato"},
{id:858,nombre:"Mole negro oaxaqueño",calorias:470,porcion:"1 plato"},
{id:859,nombre:"Pipián verde con pollo",calorias:400,porcion:"1 plato"},
{id:860,nombre:"Tinga de pollo",calorias:250,porcion:"1 taza"},
{id:861,nombre:"Tinga de res",calorias:280,porcion:"1 taza"},
{id:862,nombre:"Picadillo de res",calorias:260,porcion:"1 taza"},
{id:863,nombre:"Chile relleno de queso (capeado)",calorias:350,porcion:"1 pieza"},
{id:864,nombre:"Chile relleno de picadillo",calorias:380,porcion:"1 pieza"},
{id:865,nombre:"Chiles en nogada",calorias:480,porcion:"1 pieza"},
{id:866,nombre:"Enchiladas suizas",calorias:400,porcion:"3 piezas"},
{id:867,nombre:"Enchiladas de mole",calorias:420,porcion:"3 piezas"},
{id:868,nombre:"Enchiladas potosinas",calorias:350,porcion:"3 piezas"},
{id:869,nombre:"Enmoladas",calorias:400,porcion:"3 piezas"},
{id:870,nombre:"Entomatadas",calorias:320,porcion:"3 piezas"},
{id:871,nombre:"Nopal asado",calorias:15,porcion:"1 pieza"},
{id:872,nombre:"Nopales en ensalada",calorias:60,porcion:"1 taza"},
{id:873,nombre:"Rajas con crema",calorias:220,porcion:"1 taza"},
{id:874,nombre:"Chayote hervido",calorias:25,porcion:"1 taza"},
{id:875,nombre:"Calabacitas con elote",calorias:120,porcion:"1 taza"},
{id:876,nombre:"Verdolagas con carne de cerdo",calorias:250,porcion:"1 plato"},
{id:877,nombre:"Romeritos con mole",calorias:350,porcion:"1 plato"},
{id:878,nombre:"Torta de milanesa",calorias:650,porcion:"1 pieza"},
{id:879,nombre:"Torta de jamón",calorias:420,porcion:"1 pieza"},
{id:880,nombre:"Torta de tamal (guajolota)",calorias:500,porcion:"1 pieza"},
{id:881,nombre:"Torta ahogada",calorias:480,porcion:"1 pieza"},
{id:882,nombre:"Torta cubana",calorias:750,porcion:"1 pieza"},
{id:883,nombre:"Burrito de carne asada",calorias:500,porcion:"1 pieza"},
{id:884,nombre:"Burrito de frijol con queso",calorias:350,porcion:"1 pieza"},
{id:885,nombre:"Burrito de machaca",calorias:450,porcion:"1 pieza"},
{id:886,nombre:"Quesadilla de queso (tortilla maíz)",calorias:250,porcion:"1 pieza"},
{id:887,nombre:"Quesadilla de chicharrón prensado",calorias:300,porcion:"1 pieza"},
{id:888,nombre:"Quesadilla de flor de calabaza",calorias:220,porcion:"1 pieza"},
{id:889,nombre:"Quesadilla de huitlacoche",calorias:240,porcion:"1 pieza"},
{id:890,nombre:"Sincronizada de jamón y queso",calorias:380,porcion:"1 pieza"},
{id:891,nombre:"Gringa al pastor",calorias:400,porcion:"1 pieza"},
{id:892,nombre:"Volován",calorias:280,porcion:"1 pieza"},
{id:893,nombre:"Cochinita pibil",calorias:300,porcion:"100g"},
{id:894,nombre:"Panuchos yucatecos",calorias:280,porcion:"2 piezas"},
{id:895,nombre:"Salbutes",calorias:250,porcion:"2 piezas"},
{id:896,nombre:"Papadzules",calorias:380,porcion:"1 plato"},
{id:897,nombre:"Poc chuc",calorias:320,porcion:"1 plato"},
{id:898,nombre:"Agua de chaya",calorias:60,porcion:"1 vaso 300ml"},
{id:899,nombre:"Marquesita yucateca",calorias:280,porcion:"1 pieza"},
{id:900,nombre:"Tacos dorados de papa (5 piezas)",calorias:400,porcion:"5 piezas"},
{id:901,nombre:"Flautas de pollo (3 piezas)",calorias:380,porcion:"3 piezas"},
{id:902,nombre:"Ceviche de camarón",calorias:180,porcion:"1 taza"},
{id:903,nombre:"Ceviche de pescado",calorias:160,porcion:"1 taza"},
{id:904,nombre:"Aguachile rojo",calorias:170,porcion:"1 plato"},
{id:905,nombre:"Tostada de ceviche",calorias:220,porcion:"1 pieza"},
{id:906,nombre:"Cóctel de camarón",calorias:250,porcion:"1 copa"},
{id:907,nombre:"Vuelve a la vida",calorias:280,porcion:"1 copa"},

];

export default function PacienteProfile() {
  const { currentUser: authContextUser } = useAuth();
  const userAuth = authContextUser || auth.currentUser;
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("progreso");
  const [pacienteDocId, setPacienteDocId] = useState(null);
  const [perfilPaciente, setPerfilPaciente] = useState({ 
    nombre: "...cargando...", 
    telefono: "", 
    fechaNacimiento: "", 
    fotoUrl: null, 
    tipoTratamiento: "", 
    membresia: null, 
    sellosLealtad: 0, 
    recompensasDisponibles: 0, 
    primerSelloFecha: null, 
    fechaRegistro: null, 
    recompensaElegida: null, 
    lealtadActiva: true 
  });
  const [progresoData, setProgresoData] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [reciboVisualizar, setReciboVisualizar] = useState(null);
  const [citas, setCitas] = useState([]);
  const [loadingCitas, setLoadingCitas] = useState(true);
  const [apoyoCuidados, setApoyoCuidados] = useState([]);
  const [apoyoLoading, setApoyoLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [consumos, setConsumos] = useState([]);
  const [loadingConsumos, setLoadingConsumos] = useState(false);
  const [elegirRecompensa, setElegirRecompensa] = useState(false);
  const [chartMode, setChartMode] = useState('acumulado');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [guardandoEleccion, setGuardandoEleccion] = useState(false);
  const [beneficiosPorNivel, setBeneficiosPorNivel] = useState({});

  // Tratamientos v2
  const [tratamientos, setTratamientos] = useState([]);
  const [tratamientoActivo, setTratamientoActivo] = useState(null);
  const [sesionesPorTrat, setSesionesPorTrat] = useState({});
  const [loadingTrat, setLoadingTrat] = useState(true);

  // Estados exclusivos Panel VIP Ultra HD
  const [autoAgendadoOpen, setAutoAgendadoOpen] = useState(false);
  const [checkinEnviado, setCheckinEnviado] = useState(null);
  const [checkinNota, setCheckinNota] = useState('');
  const [enviandoCheckin, setEnviandoCheckin] = useState(false);
  const [mostrarModalDuda, setMostrarModalDuda] = useState(false);
  const [vasosAguaHoy, setVasosAguaHoy] = useState(0);
  const [zoomFotoUrl, setZoomFotoUrl] = useState(null);
  const [faseInfoModal, setFaseInfoModal] = useState(null);
  const [mostrarModalInfoBienestar, setMostrarModalInfoBienestar] = useState(false);
    const [mostrarModalInfoRoadmap, setMostrarModalInfoRoadmap] = useState(false);
  const [tipoRoadmapSeleccionado, setTipoRoadmapSeleccionado] = useState('auto');

  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const handleFotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoFoto(true);
    try {
      const base64Foto = await comprimirImagenBase64(file, 600, 600, 0.82);
      if (!base64Foto) throw new Error("No se pudo comprimir la imagen.");

      setPerfilPaciente(prev => ({ ...prev, fotoUrl: base64Foto }));

      const docId = pacienteDocId || perfilPaciente?.id;
      if (docId) {
        await updateDoc(doc(db, "pacientes", docId), {
          fotoUrl: base64Foto,
          fotoPerfil: base64Foto,
          updatedAt: new Date().toISOString()
        });
      }

      if (userAuth?.uid) {
        try {
          await updateDoc(doc(db, "usuarios", userAuth.uid), {
            fotoUrl: base64Foto,
            photoURL: base64Foto,
            updatedAt: new Date().toISOString()
          });
        } catch (_) {}
      }

      alert("¡Foto de perfil guardada con éxito!");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la foto de perfil: " + (err.message || ""));
    } finally {
      setSubiendoFoto(false);
      if (e.target) e.target.value = "";
    }
  };

  // Nutrición & Ejercicio
  const [caloriasData, setCaloriasData] = useState([]);
  const [alimentosHoy, setAlimentosHoy] = useState([]);
  const [apoyoCompletadoHoy, setApoyoCompletadoHoy] = useState({});
  const [buscarAlimento, setBuscarAlimento] = useState("");

  // ==================== SEGUIMIENTO FÍSICO EN SEGUNDO PLANO (POINT 2) ====================
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [trackTime, setTrackTime] = useState(0);
  const [trackDistance, setTrackDistance] = useState(0);
  const [workoutType, setWorkoutType] = useState('Caminata');
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [historialEjercicio, setHistorialEjercicio] = useState([]);

  const workoutStartTimeRef = useRef(null);
  const workoutPausedDurationRef = useRef(0);
  const lastPauseTimestampRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastCoordsRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Asistente de voz
  const speak = (msg) => {
    if (speechEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(msg);
        u.lang = 'es-MX';
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      } catch(e) {}
    }
  };

  const loadHistorialEjercicio = async (pid) => {
    if (!pid) return;
    try {
      const trackers = await getDailyTrackers(pid, 30);
      const ejercicios = trackers
        .filter(t => t.tipo === 'ejercicio')
        .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
        .map(t => ({
          id: t.id || Date.now(),
          fecha: new Date(t.fecha + 'T00:00:00'),
          duracionSegundos: t.data?.duracionSegundos || 0,
          distanciaMetros: t.data?.distanciaMetros || 0,
          calorias: t.data?.caloriasQuemadas || Math.round((t.data?.distanciaMetros || 0) * 0.055),
          tipo: t.data?.tipo || 'Caminata'
        }));
      setHistorialEjercicio(ejercicios);
    } catch(e) { console.log('Error cargando historial ejercicio:', e); }
  };

  const startTracking = async (tipo = 'Caminata') => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Tu dispositivo o navegador no soporta geolocalización GPS.');
      return;
    }
    const now = Date.now();
    workoutStartTimeRef.current = now;
    workoutPausedDurationRef.current = 0;
    lastPauseTimestampRef.current = null;
    lastCoordsRef.current = null;
    setWorkoutType(tipo);
    setIsTracking(true);
    setIsPaused(false);
    setTrackTime(0);
    setTrackDistance(0);

    try {
      localStorage.setItem('alfra_active_workout', JSON.stringify({
        startTime: now,
        pausedDuration: 0,
        isTracking: true,
        isPaused: false,
        distance: 0,
        tipo
      }));
    } catch(e) {}

    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch(e) { console.log('Wake Lock no disponible:', e); }

    speak('Entrenamiento de ' + tipo + ' iniciado. Mantén tu ritmo.');

    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > 35) return;
        if (lastCoordsRef.current) {
          const prev = lastCoordsRef.current;
          const R = 6371e3;
          const dLat = (latitude - prev.latitude) * Math.PI / 180;
          const dLon = (longitude - prev.longitude) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(prev.latitude*Math.PI/180) * Math.cos(latitude*Math.PI/180) * Math.sin(dLon/2)**2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const dist = R * c;
          if (dist >= 2 && dist < 70) {
            setTrackDistance(prevD => {
              const newD = prevD + dist;
              try {
                const saved = JSON.parse(localStorage.getItem('alfra_active_workout') || '{}');
                saved.distance = newD;
                localStorage.setItem('alfra_active_workout', JSON.stringify(saved));
              } catch(e) {}
              return newD;
            });
          }
        }
        lastCoordsRef.current = { latitude, longitude };
      },
      (err) => console.warn('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const pauseTracking = () => {
    if (!isTracking || isPaused) return;
    setIsPaused(true);
    lastPauseTimestampRef.current = Date.now();
    try {
      const saved = JSON.parse(localStorage.getItem('alfra_active_workout') || '{}');
      saved.isPaused = true;
      saved.lastPause = Date.now();
      localStorage.setItem('alfra_active_workout', JSON.stringify(saved));
    } catch(e) {}
    speak('Entrenamiento pausado.');
  };

  const resumeTracking = () => {
    if (!isTracking || !isPaused) return;
    if (lastPauseTimestampRef.current) {
      workoutPausedDurationRef.current += (Date.now() - lastPauseTimestampRef.current);
      lastPauseTimestampRef.current = null;
    }
    setIsPaused(false);
    try {
      const saved = JSON.parse(localStorage.getItem('alfra_active_workout') || '{}');
      saved.isPaused = false;
      saved.pausedDuration = workoutPausedDurationRef.current;
      localStorage.setItem('alfra_active_workout', JSON.stringify(saved));
    } catch(e) {}
    speak('Reanudando entrenamiento.');
  };

  const stopTracking = async () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch(e) {}
      wakeLockRef.current = null;
    }
    const finalSec = trackTime;
    const finalMeters = trackDistance;
    const calQuemadas = Math.round((finalMeters * 0.055) + (finalSec * 0.06));
    const nuevaSesion = {
      id: Date.now(),
      fecha: new Date(),
      duracionSegundos: finalSec,
      distanciaMetros: finalMeters,
      calorias: calQuemadas,
      tipo: workoutType || 'Caminata'
    };
    setHistorialEjercicio(prev => [nuevaSesion, ...prev]);

    if (pacienteDocId) {
      try {
        await saveDailyTracker(pacienteDocId, 'ejercicio', {
          duracionSegundos: finalSec,
          distanciaMetros: finalMeters,
          caloriasQuemadas: calQuemadas,
          tipo: workoutType || 'Caminata',
          hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        });
      } catch(e) { console.error('Error guardando ejercicio:', e); }
    }
    try { localStorage.removeItem('alfra_active_workout'); } catch(e) {}
    setIsTracking(false);
    setIsPaused(false);
    speak('Sesión completada. Recorriste ' + (finalMeters / 1000).toFixed(2) + ' kilómetros y quemaste aproximadamente ' + calQuemadas + ' calorías.');
  };

  useEffect(() => {
    let interval;
    if (isTracking && !isPaused && workoutStartTimeRef.current) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - workoutStartTimeRef.current - workoutPausedDurationRef.current) / 1000));
        setTrackTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, isPaused]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isTracking && !isPaused && workoutStartTimeRef.current) {
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - workoutStartTimeRef.current - workoutPausedDurationRef.current) / 1000));
        setTrackTime(elapsed);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTracking, isPaused]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('alfra_active_workout');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.isTracking && data.startTime) {
          workoutStartTimeRef.current = data.startTime;
          workoutPausedDurationRef.current = data.pausedDuration || 0;
          setTrackDistance(data.distance || 0);
          if (data.tipo) setWorkoutType(data.tipo);
          setIsTracking(true);
          setIsPaused(!!data.isPaused);
          const now = Date.now();
          const elapsed = Math.max(0, Math.floor((now - data.startTime - (data.pausedDuration || 0)) / 1000));
          setTrackTime(elapsed);
          if (navigator.geolocation && !data.isPaused) {
            watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                if (accuracy > 35) return;
                if (lastCoordsRef.current) {
                  const prev = lastCoordsRef.current;
                  const R = 6371e3;
                  const dLat = (latitude - prev.latitude) * Math.PI / 180;
                  const dLon = (longitude - prev.longitude) * Math.PI / 180;
                  const a = Math.sin(dLat/2)**2 + Math.cos(prev.latitude*Math.PI/180) * Math.cos(latitude*Math.PI/180) * Math.sin(dLon/2)**2;
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  const dist = R * c;
                  if (dist >= 2 && dist < 70) {
                    setTrackDistance(prevD => prevD + dist);
                  }
                }
                lastCoordsRef.current = { latitude, longitude };
              },
              (e) => console.log(e),
              { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
            );
          }
        }
      }
    } catch(e) {}
  }, []);

  const formatTime = (sec) => {
    const hrs = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return hrs > 0 ? (hrs + ':' + m + ':' + s) : (m + ':' + s);
  };

  // ==================== VALIDACIÓN DE TRATAMIENTOS ACTIVOS ====================
  const tratamientosActivos = useMemo(() => {
    return (tratamientos || []).filter(t => t.activo !== false && t.status !== 'Cancelado' && t.status !== 'Finalizado');
  }, [tratamientos]);

  const tieneTratamientosActivos = tratamientosActivos.length > 0;

  const tieneCorporalActivo = useMemo(() => {
    return tratamientosActivos.some(t => {
      const txt = `${t.tipo || ''} ${t.nombre || ''}`.toLowerCase();
      return txt.includes('corporal') || txt.includes('lipo') || txt.includes('reduct') || txt.includes('reafirm') || txt.includes('celulitis') || txt.includes('moldeo') || txt.includes('cavit') || txt.includes('radiofrecuencia');
    });
  }, [tratamientosActivos]);

  const tieneFacialActivo = useMemo(() => {
    return tratamientosActivos.some(t => {
      const txt = `${t.tipo || ''} ${t.nombre || ''}`.toLowerCase();
      return txt.includes('facial') || txt.includes('dermapen') || txt.includes('peeling') || txt.includes('limpieza') || txt.includes('hidra') || txt.includes('antiedad') || txt.includes('envejec') || txt.includes('arruga') || txt.includes('cutan') || txt.includes('botox') || txt.includes('armoniza') || txt.includes('acne') || txt.includes('acné') || txt.includes('melasma');
    });
  }, [tratamientosActivos]);

  // Chequeo de si el paciente realmente tiene datos biométricos
  const tieneDatosBiometricos = useMemo(() => {
    if (perfilPaciente?.peso && parseFloat(perfilPaciente.peso) > 0) return true;
    if (perfilPaciente?.metaCalorica && parseInt(perfilPaciente.metaCalorica) > 0) return true;
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length > 0) {
      return sesionesPorTrat[tratamientoActivo.id].some(s => s?.medidas?.peso || s?.metasPaciente?.metaCalorica);
    }
    if (progresoData?.length > 0 && progresoData[0]?.peso) return true;
    return false;
  }, [perfilPaciente, tratamientoActivo, sesionesPorTrat, progresoData]);

  // ==================== RECOMENDACIONES DE TU ESPECIALISTA (POINT 4) ====================
  const recomendacionesEspecialista = useMemo(() => {
    if (!tieneTratamientosActivos) return [];

    const defaults = [
      { id: 'hidra_25l', texto: '💧 Hidratación Profunda', detalle: 'Tomar 2.5 L de agua natural al día para optimizar el drenaje linfático' },
      { id: 'evitar_calor', texto: '🚫 Cuidado Térmico Post-Tratamiento', detalle: 'Evitar saunas, vapor y exposición solar directa por 24 a 48 horas' },
      { id: 'crema_masaje', texto: '💆 Aplicación de Crema Reafirmante', detalle: 'Aplicar producto recomendado en la zona tratada con masaje ascendente' },
      { id: 'caminata_activa', texto: '🚶 Caminata Suave de 30 minutos', detalle: 'Activar el sistema circulatorio para eliminación de toxinas' },
      { id: 'cena_ligera', texto: '🥗 Cena Ligera y Baja en Sodio', detalle: 'Favorecer la desinflamación nocturna y regeneración celular' },
      { id: 'descanso_reparador', texto: '😴 Descanso Continuo de 7-8 Horas', detalle: 'Dormir las horas recomendadas para permitir reparación dérmica' }
    ];
    if (apoyoCuidados && apoyoCuidados.length > 0) {
      const custom = apoyoCuidados.map((c, idx) => ({
        id: c.id || `cuidado_${idx}`,
        texto: c.texto || c.categoria || c.tipo || 'Indicación de Especialista',
        detalle: c.instrucciones || c.detalle || 'Cuidado personalizado indicado en tu consulta'
      }));
      return [...custom, ...defaults.slice(custom.length)];
    }
    return defaults;
  }, [tieneTratamientosActivos, apoyoCuidados]);

  const recomendacionesCumplidasCount = useMemo(() => {
    return recomendacionesEspecialista.filter(r => !!apoyoCompletadoHoy[r.id]).length;
  }, [recomendacionesEspecialista, apoyoCompletadoHoy]);

  // ==================== ALGORITMO METABÓLICO CLÍNICO CIENTÍFICO (MIFFLIN-ST JEOR + ALFRA) ====================
  const diagnosticoMetabolico = useMemo(() => {
    if (!tieneDatosBiometricos) {
      return {
        tieneDatos: false,
        peso: null,
        estatura: null,
        edad: null,
        tmb: 0,
        tdee: 0,
        metaFinal: 0,
        objetivoClinico: 'Pendiente de Valoración',
        razonClinica: 'Tu meta calórica se calibrará en cabina cuando tu especialista registre tus datos biométricos.',
        macros: {
          proteina: { gramos: 0, kcal: 0, pct: 0 },
          grasas: { gramos: 0, kcal: 0, pct: 0 },
          carbs: { gramos: 0, kcal: 0, pct: 0 }
        }
      };
    }
    // 1. Obtener peso actual (última sesión clínica o perfil)
    let peso = 65;
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length > 0) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      const sUltima = sesiones[sesiones.length - 1];
      if (sUltima?.medidas?.peso) peso = parseFloat(sUltima.medidas.peso) || 65;
    } else if (perfilPaciente?.peso) {
      peso = parseFloat(perfilPaciente.peso) || 65;
    } else if (progresoData?.length > 0 && progresoData[0]?.peso) {
      peso = parseFloat(progresoData[0].peso) || 65;
    }

    // 2. Obtener estatura
    let estatura = 162;
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length > 0) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      const sUltima = sesiones[sesiones.length - 1];
      if (sUltima?.medidas?.estatura) estatura = parseFloat(sUltima.medidas.estatura) || 162;
    } else if (perfilPaciente?.estatura) {
      estatura = parseFloat(perfilPaciente.estatura) || 162;
    }

    // 3. Obtener edad
    let edad = 32;
    if (perfilPaciente?.fechaNacimiento) {
      const dNac = new Date(perfilPaciente.fechaNacimiento);
      if (!isNaN(dNac.getTime())) {
        const diffMs = Date.now() - dNac.getTime();
        edad = Math.max(18, Math.min(80, Math.floor(diffMs / (365.25 * 24 * 3600 * 1000))));
      }
    } else if (perfilPaciente?.edad) {
      edad = parseInt(perfilPaciente.edad) || 32;
    }

    // 4. Género
    const genero = (perfilPaciente?.genero || perfilPaciente?.sexo || 'Femenino').toLowerCase();
    const esMasculino = genero.startsWith('m') || genero.startsWith('h');

    // 5. Tasa Metabólica Basal (Ecuación Mifflin-St Jeor)
    let tmb = (10 * peso) + (6.25 * estatura) - (5 * edad);
    tmb = esMasculino ? (tmb + 5) : (tmb - 161);
    tmb = Math.round(tmb);

    // 6. Factor de Actividad Física (PAL)
    let factorActividad = 1.375;
    let nivelActividadTexto = "Actividad ligera (caminar / tareas diarias)";
    const sesionesEjercicioSemanales = (historialEjercicio || []).filter(e => {
      const d = new Date(e.fecha);
      return (Date.now() - d.getTime()) <= (7 * 24 * 3600 * 1000);
    }).length;

    if (isTracking || sesionesEjercicioSemanales >= 4) {
      factorActividad = 1.55;
      nivelActividadTexto = "Actividad constante (ejercicio regular)";
    } else if (sesionesEjercicioSemanales === 0 && !isTracking) {
      factorActividad = 1.2;
      nivelActividadTexto = "Días tranquilos / Oficina";
    }

    const tdee = Math.round(tmb * factorActividad);

    // 7. Ajuste según objetivo del tratamiento (explicación simple y clara)
    const tipoTrat = (perfilPaciente?.tipoTratamiento || tratamientoActivo?.tipo || tratamientoActivo?.nombre || 'Mixto').toLowerCase();
    let deficitKcal = -350;
    let objetivoClinico = "Quema de Grasa & Firmeza";
    let razonClinica = "En tus sesiones en cabina ablandamos y facilitamos la movilización de la grasa acumulada. Con esta meta de calorías, tu cuerpo aprovecha esa grasa como energía para eliminarla por completo, además de mantener la elasticidad cutánea.";

    if (tipoTrat.includes('reafirm') || tipoTrat.includes('tensado') || tipoTrat.includes('radiofrecuencia')) {
      deficitKcal = 0;
      objetivoClinico = "Firmeza & Piel Tonificada";
      razonClinica = "Consumes exactamente lo que tu cuerpo gasta para que toda tu energía se use en producir colágeno nuevo. Así la piel se pega al músculo y se compacta tu figura.";
    } else if (tipoTrat.includes('celulitis') || tipoTrat.includes('anticelul') || tipoTrat.includes('drenaje')) {
      deficitKcal = -200;
      objetivoClinico = "Desinflamar & Alisar Piel";
      razonClinica = "Una meta ligera para eliminar líquidos retenidos, desinflamar tu cuerpo y dejar tu piel con una textura mucho más suave y uniforme.";
    } else if (tipoTrat.includes('facial')) {
      deficitKcal = 0;
      objetivoClinico = "Piel Radiante & Luminosa";
      razonClinica = "Aporte ideal de nutrientes para hidratar tu rostro desde adentro, desvanecer líneas de expresión y darle a tu piel un brillo natural y descansado.";
    }

    // Piso biológico de seguridad
    const pisoSeguridad = esMasculino ? 1500 : 1200;
    const metaAlgoritmo = Math.max(pisoSeguridad, Math.min(3200, tdee + deficitKcal));

    // 8. Chequeo de Override de Especialista
    let metaFinal = metaAlgoritmo;
    let esPrescripcionManual = false;

    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length > 0) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      const sUltima = sesiones[sesiones.length - 1];
      if (sUltima?.metasPaciente?.metaCalorica) {
        metaFinal = parseInt(sUltima.metasPaciente.metaCalorica) || metaAlgoritmo;
        esPrescripcionManual = true;
      }
    } else if (perfilPaciente?.metaCalorica) {
      metaFinal = parseInt(perfilPaciente.metaCalorica) || metaAlgoritmo;
      esPrescripcionManual = true;
    }

    // 9. Macronutrientes Científicos:
    // Proteína 1.6 g/kg (estándar clínico antiflacidez)
    const gramosProteina = Math.round(peso * 1.6);
    const kcalProteina = gramosProteina * 4;

    // Grasas saludables: 25% del total
    const kcalGrasas = Math.round(metaFinal * 0.25);
    const gramosGrasas = Math.round(kcalGrasas / 9);

    // Carbohidratos complejos: El restante
    const kcalCarbs = Math.max(0, metaFinal - (kcalProteina + kcalGrasas));
    const gramosCarbs = Math.round(kcalCarbs / 4);

    return {
      peso,
      estatura,
      edad,
      genero: esMasculino ? 'Masculino' : 'Femenino',
      tmb,
      tdee,
      factorActividad,
      nivelActividadTexto,
      deficitKcal,
      objetivoClinico,
      razonClinica,
      metaFinal,
      esPrescripcionManual,
      macros: {
        proteina: { gramos: gramosProteina, kcal: kcalProteina, pct: Math.round((kcalProteina / metaFinal) * 100) },
        grasas: { gramos: gramosGrasas, kcal: kcalGrasas, pct: Math.round((kcalGrasas / metaFinal) * 100) },
        carbs: { gramos: gramosCarbs, kcal: kcalCarbs, pct: Math.round((kcalCarbs / metaFinal) * 100) }
      }
    };
  }, [perfilPaciente, tratamientoActivo, sesionesPorTrat, progresoData, historialEjercicio, isTracking]);

  const META_CALORIAS = diagnosticoMetabolico.metaFinal;

  // Macros consumidos estimados hoy
  const macrosHoy = useMemo(() => {
    const totalCal = alimentosHoy.reduce((s, a) => s + (a.calorias || 0), 0);
    // Estimación equilibrada a partir del diario
    const protG = Math.round((totalCal * 0.25) / 4);
    const grasasG = Math.round((totalCal * 0.25) / 9);
    const carbsG = Math.round((totalCal * 0.50) / 4);
    return { proteina: protG, grasas: grasasG, carbs: carbsG };
  }, [alimentosHoy]);

  const caloriasHoy = alimentosHoy.reduce((s,a) => s + a.calorias, 0);

  const caloriasDataTratamiento = useMemo(() => {
    if (!tratamientoActivo || (!tratamientoActivo.creadoEn && !tratamientoActivo.fechaInicio && !tratamientoActivo.createdAt)) return caloriasData;
    let fechaBase = tratamientoActivo.creadoEn || tratamientoActivo.fechaInicio || tratamientoActivo.createdAt;
    let inicioTrat = fechaBase.seconds ? new Date(fechaBase.seconds * 1000) : new Date(fechaBase);
    inicioTrat.setHours(0,0,0,0);
    const filtered = caloriasData.filter(d => {
        if (!d.fechaOriginal) return true;
        const tDate = new Date(d.fechaOriginal + 'T12:00:00');
        return tDate >= inicioTrat;
    });
    
    if (filtered.length === 0) {
        const today = new Date();
        const label = today.toLocaleDateString("es-MX",{month:"short",day:"numeric"});
        return [{ fecha: label, calorias: 0, fechaOriginal: today.toISOString().split('T')[0] }];
    }
    return filtered;
  }, [caloriasData, tratamientoActivo]);

  // ==================== GRÁFICA DE CALORÍAS (POINT 3) ====================
  const caloriasChartData = useMemo(() => {
    const days = [];
    const calMap = {};
    caloriasData.forEach(d => {
      if (d.fechaOriginal) calMap[d.fechaOriginal] = d.calorias;
      if (d.fecha) calMap[d.fecha] = d.calorias;
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    calMap[todayStr] = caloriasHoy;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const diaSemana = d.toLocaleDateString('es-MX', { weekday: 'short' });
      const diaNum = d.getDate();
      const label = (diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)) + ' ' + diaNum;
      const cal = calMap[dStr] !== undefined ? calMap[dStr] : (i === 0 ? caloriasHoy : 0);
      days.push({
        fecha: label,
        fechaCompleta: dStr,
        calorias: Number(cal) || 0,
        meta: META_CALORIAS || 1800
      });
    }
    return days;
  }, [caloriasData, caloriasHoy, META_CALORIAS]);

  // ==================== ÍNDICE DE BIENESTAR DINÁMICO (POINT 6) ====================
  const indiceBienestar = useMemo(() => {
    if (!tieneTratamientosActivos) return 0;
    let score = 20; // Base por tratamiento activo
    // Vasos de agua: +3 pts por cada vaso (hasta 30 pts)
    score += Math.min(30, (vasosAguaHoy || 0) * 3);
    // Recomendaciones cumplidas: +6 pts por cada recomendación completada
    const checks = recomendacionesEspecialista.filter(r => !!apoyoCompletadoHoy[r.id]).length;
    score += Math.min(30, checks * 6);
    // Alimentación registrada: +10 pts
    if (alimentosHoy && alimentosHoy.length > 0) score += 10;
    // Ejercicio en segundo plano activo o terminado hoy: +10 pts
    if (isTracking || historialEjercicio.length > 0) score += 10;
    return Math.min(100, Math.max(0, score));
  }, [tieneTratamientosActivos, vasosAguaHoy, apoyoCompletadoHoy, recomendacionesEspecialista, alimentosHoy, isTracking, historialEjercicio]);

  // Flip card membresía
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!userAuth) return;
    let unsubCitas = null;
    let unsubTrat = null;
    const safetyTimer = setTimeout(() => {
      setLoadingTrat(false);
    }, 3500);
    const load = async () => {
      try {
        const paciente = await getPacienteByUid(userAuth.uid, userAuth.email);
        if (paciente) {
          setPacienteDocId(paciente.id);
          setPerfilPaciente({
            id: paciente.id,
            docId: paciente.id,
            medicoTratanteId: paciente.medicoTratanteId || paciente.especialistaId || null,
            medicoTratante: paciente.medicoTratante || paciente.especialista || null,
            nombre: paciente.nombre || userAuth.displayName || userAuth.email?.split('@')[0] || "Paciente",
            telefono: paciente.telefono || paciente.phone || "",
            fechaNacimiento: paciente.fechaNacimiento || "",
            fotoUrl: paciente.fotoUrl || paciente.fotoPerfil || userAuth?.photoURL || null,
            tipoTratamiento: paciente.tipoTratamiento || "",
            membresia: (() => {
            let m = paciente.membresia || null;
            if (m && typeof m === "object" && (!m.codigo || !String(m.codigo).startsWith("MEM-"))) {
              const pacPart = String(paciente.id).replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "7024";
              const randPart = Math.floor(1000 + Math.random() * 9000);
              const autoCode = `MEM-${pacPart}-${randPart}`;
              m = { ...m, id: autoCode, codigo: autoCode };
              try {
                updateDoc(doc(db, "pacientes", paciente.id), {
                  "membresia.codigo": autoCode,
                  "membresia.id": autoCode
                }).catch(() => {});
              } catch (_) {}
            }
            return m;
          })(),
            sellosLealtad: paciente.sellosLealtad || 0,
            recompensasDisponibles: paciente.recompensasDisponibles || 0,
            primerSelloFecha: paciente.primerSelloFecha || null,
            fechaRegistro: paciente.fechaRegistro || paciente.createdAt || null,
            recompensaElegida: paciente.recompensaElegida || null,
            lealtadActiva: true,
            metaCalorica: paciente.metaCalorica || null
          });

          // 1. Seguimientos
          try {
            const seg = await getSeguimientosPaciente(paciente.id);
            setProgresoData((seg || []).slice(0,12).reverse().map(s=>({
              fecha: s.fechaRegistro ? new Date(s.fechaRegistro).toLocaleDateString("es-MX",{month:"short",day:"numeric"}) : "Hoy",
              peso: s.peso,
              imc: s.imc
            })));
          } catch(e) { console.warn("Aviso seguimientos:", e); }

          // 2. Recibos
          try {
            const rList = await getRecibosPaciente(paciente.id);
            setRecibos(rList || []);
          } catch(e) { console.warn("Aviso recibos:", e); }

          // 3. Citas en tiempo real
          try {
            unsubCitas = onCitasPacienteChange(paciente.id, (citasLive) => {
              setCitas(citasLive || []);
              setLoadingCitas(false);
            });
          } catch(e) {
            console.warn("Aviso citas listener:", e);
            setLoadingCitas(false);
          }

          // 4. Apoyo en casa
          try {
            const apoyo = await getApoyoEnCasa(paciente.id);
            setApoyoCuidados(apoyo || []);
            setApoyoLoading(false);
          } catch(e) {
            console.warn("Aviso apoyo en casa:", e);
            setApoyoLoading(false);
          }

          // 5. Tratamientos V2 y Sesiones (con escucha en tiempo real scoped e identificación multi-criterio)
          try {
            unsubTrat = onTratamientosPacienteChange(
              paciente.id,
              paciente.nombre,
              async (trList) => {
                try {
                  const safeList = trList || [];
                  setTratamientos(safeList);
                  if (safeList.length > 0) {
                    setTratamientoActivo(prev => {
                      if (prev && safeList.some(t => t.id === prev.id)) {
                        return safeList.find(t => t.id === prev.id);
                      }
                      return safeList[0];
                    });
                    try {
                      const sList = await getSesionesPaciente(paciente.id);
                      const sesMap = {};
                      (sList || []).forEach(s => {
                        const tId = s.tratamientoId || safeList[0].id;
                        if (!sesMap[tId]) sesMap[tId] = [];
                        sesMap[tId].push(s);
                      });
                      safeList.forEach(tr => {
                        if (!sesMap[tr.id]) sesMap[tr.id] = [];
                      });
                      setSesionesPorTrat(sesMap);
                    } catch (sesErr) {
                      console.warn("Aviso cargando sesiones del paciente:", sesErr);
                      setSesionesPorTrat({});
                    }
                  } else {
                    setTratamientoActivo(null);
                    setSesionesPorTrat({});
                  }
                } catch (innerErr) {
                  console.warn("Error procesando tratamientos recibidos:", innerErr);
                } finally {
                  setLoadingTrat(false);
                }
              },
              paciente.telefono
            );
          } catch(e) {
            console.warn("Aviso tratamientos v2 listener:", e);
            try {
              const trList = await getTratamientosPaciente(paciente.id, paciente.nombre, paciente.telefono);
              const safeList = trList || [];
              setTratamientos(safeList);
              if (safeList.length > 0) {
                setTratamientoActivo(safeList[0]);
                const sList = await getSesionesPaciente(paciente.id).catch(() => []);
                const sesMap = {};
                (sList || []).forEach(s => {
                  const tId = s.tratamientoId || safeList[0].id;
                  if (!sesMap[tId]) sesMap[tId] = [];
                  sesMap[tId].push(s);
                });
                safeList.forEach(tr => {
                  if (!sesMap[tr.id]) sesMap[tr.id] = [];
                });
                setSesionesPorTrat(sesMap);
              }
            } catch(eTr) { console.warn("Error fallback tratamientos:", eTr); }
            setLoadingTrat(false);
          }

          // 6. Nutrición
          try {
            const trackers = await getDailyTrackers(paciente.id, 14);
            const calMap = {};
            trackers.filter(t => t.tipo === "alimentacion").forEach(t => {
                calMap[t.fecha] = t.data?.totalCalorias || 0;
            });
            const dList = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split("T")[0];
                const label = d.toLocaleDateString("es-MX",{month:"short",day:"numeric"});
                dList.push({ fecha: label, calorias: calMap[dStr] || 0, fechaOriginal: dStr });
            }
            setCaloriasData(dList);

            const todayStr = new Date().toISOString().split("T")[0];
            const todayTracker = trackers.find(t => t.tipo === "alimentacion" && t.fecha === todayStr);
            if (todayTracker?.data?.alimentos) setAlimentosHoy(todayTracker.data.alimentos);

            // Hidratación
            const aguaTracker = trackers.find(t => t.tipo === "hidratacion" && t.fecha === todayStr);
            if (aguaTracker?.data?.vasos) setVasosAguaHoy(aguaTracker.data.vasos);

            const apoyoTracker = trackers.find(t => t.tipo === "apoyo" && t.fecha === todayStr);
            if (apoyoTracker?.data) setApoyoCompletadoHoy(apoyoTracker.data);
          } catch(err) { console.warn("Aviso nutricion:", err); }

          // 7. Historial de ejercicio
          try {
            await loadHistorialEjercicio(paciente.id);
          } catch(e) { console.warn("Aviso ejercicio:", e); }

          // 8. Membresía consumos
          if (paciente.membresia?.activa) {
            setLoadingConsumos(true);
            try {
              const q = query(collection(db,"consumos_membresia"),where("pacienteId","==",paciente.id));
              const snap = await getDocs(q);
              setConsumos(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
                const da=a.fecha?.toDate?a.fecha.toDate():new Date(a.fecha||0);
                const db2=b.fecha?.toDate?b.fecha.toDate():new Date(b.fecha||0);
                return db2-da;
              }));
            } catch { setConsumos([]); }
            setLoadingConsumos(false);
          }

          try {
            const bSnap = await getDoc(doc(db,"configuracion","beneficios_membresia"));
            if (bSnap.exists()) setBeneficiosPorNivel(bSnap.data().beneficios||{});
          } catch {}
        } else {
          setPerfilPaciente(prev => ({
            ...prev,
            nombre: userAuth.displayName || userAuth.email?.split('@')[0] || "Paciente",
            telefono: userAuth.phoneNumber || "",
            tipoTratamiento: "Mixto"
          }));
          setLoadingCitas(false);
          setApoyoLoading(false);
          setLoadingTrat(false);
        }
      } catch(err) {
        console.error("Error cargando perfil de paciente:", err);
        setApoyoLoading(false);
        setLoadingCitas(false);
        setLoadingTrat(false);
      } finally {
        setLoadingData(false);
      }
    };
    load();
    return () => { clearTimeout(safetyTimer); if (unsubCitas) unsubCitas(); if (unsubTrat) unsubTrat(); };
  }, [userAuth?.uid]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file||!pacienteDocId) return;
    try { 
      const { getStorage, ref, uploadBytes:ub, getDownloadURL:gdl } = await import("firebase/storage"); 
      const storage=getStorage(); 
      const sr=ref(storage,`pacientes/${pacienteDocId}/foto_perfil`); 
      await ub(sr,file); 
      const url=await gdl(sr); 
      await updateDoc(doc(db,"pacientes",pacienteDocId),{fotoUrl:url}); 
      setPerfilPaciente(p=>({...p,fotoUrl:url})); 
    } catch(err) { console.error(err); }
  };

  const handleSaveProfile = async () => {
    const docId = pacienteDocId || perfilPaciente?.id;
    if (!docId) return;
    try {
      await updateDoc(doc(db, "pacientes", docId), {
        nombre: perfilPaciente.nombre,
        fechaNacimiento: perfilPaciente.fechaNacimiento,
        fotoUrl: perfilPaciente.fotoUrl || null
      });
      alert("Perfil guardado con éxito.");
    } catch(err) { console.error(err); alert("Error al guardar perfil: " + err.message); }
  };

  const handleResetEmail = async () => { 
    if (!auth.currentUser?.email) return; 
    setSendingReset(true); 
    try { 
      await sendPasswordResetEmail(auth,auth.currentUser.email); 
      setResetSent(true); 
    } catch(err){console.error(err);} 
    setSendingReset(false); 
  };

  const handleElegirRecompensa = async (op) => { 
    if (!pacienteDocId||guardandoEleccion) return; 
    setGuardandoEleccion(true); 
    try { 
      await updateDoc(doc(db,"pacientes",pacienteDocId),{recompensaElegida:op,recompensasDisponibles:0}); 
      setPerfilPaciente(p=>({...p,recompensaElegida:op,recompensasDisponibles:0})); 
      setElegirRecompensa(false); 
    } catch(err){console.error(err);} 
    setGuardandoEleccion(false); 
  };

  const handleToggleCuidado = async (cuidadoId) => { 
    if (!pacienteDocId) return; 
    const newVal = !apoyoCompletadoHoy[cuidadoId]; 
    const newData = { ...apoyoCompletadoHoy, [cuidadoId]: newVal }; 
    setApoyoCompletadoHoy(newData); 
    try { await saveDailyTracker(pacienteDocId, "apoyo", newData); } catch (err) { console.error(err); } 
  };

  // Hidratación interactiva por vasos (Meta: 10 vasos = 2.5 Litros)
  const handleToggleVasoAgua = async (indexVaso) => {
    if (!pacienteDocId) return;
    const nuevoTotal = vasosAguaHoy === indexVaso ? indexVaso - 1 : indexVaso;
    const finalVal = Math.max(0, Math.min(10, nuevoTotal));
    setVasosAguaHoy(finalVal);
    try {
      await saveDailyTracker(pacienteDocId, "hidratacion", {
        vasos: finalVal,
        mililitros: finalVal * 250,
        fecha: new Date().toISOString()
      });
    } catch(e) { console.error("Error guardando agua:", e); }
  };

  // Micro Check-in Post-Sesión (Conectado con Recepción y Especialista)
  const handleEnviarCheckin = async (estado, notaCustom) => {
    if (!pacienteDocId) return;
    setEnviandoCheckin(true);
    try {
      const citaReciente = citas.find(c => c.status === "Completada" || c.status === "Pendiente Pase a Caja") || citas[0] || {};
      const payloadCheckin = {
        pacienteId: pacienteDocId,
        pacienteNombre: perfilPaciente.nombre || "Paciente ALFRA",
        pacienteTelefono: perfilPaciente.telefono || "",
        estado,
        nota: notaCustom || checkinNota || "",
        fecha: new Date().toISOString(),
        atendido: false,
        especialistaNombre: citaReciente?.especialistaNombre || "Clínica ALFRA",
        servicio: citaReciente?.servicio || "Tratamiento"
      };

      await addDoc(collection(db, "seguimiento_post_consulta"), payloadCheckin);
      await updateDoc(doc(db, "pacientes", pacienteDocId), {
        ultimoCheckinPostConsulta: payloadCheckin
      });

      
      // Disparar alerta en tiempo real para Recepción
      try {
        await addDoc(collection(db, "alertas_recepcion"), {
          ...payloadCheckin,
          tipo: 'checkin_post_consulta',
          mensaje: `El paciente ${payloadCheckin.pacienteNombre} respondió a su check-in post-sesión: ${estado.toUpperCase()} (${payloadCheckin.nota || 'Sin nota adicional'})`,
          leida: false,
          atendido: false,
          creadoEn: new Date().toISOString()
        });
      } catch (errAlert) {
        console.warn("Aviso alerta recepcion checkin:", errAlert);
      }
      setCheckinEnviado(estado);
      setMostrarModalDuda(false);
      setCheckinNota("");
      if (estado === 'duda') {
        try {
          const telClinica = '527535386018';
          const notaTexto = (notaCustom || checkinNota || '').trim();
          const textoDuda = `Hola Clínica ALFRA, soy ${(perfilPaciente.nombre || 'paciente de ALFRA').trim()}. Me comunico desde mi perfil en la app porque tengo una duda sobre mi tratamiento: "${notaTexto}".`;
          window.open(`https://wa.me/${telClinica}?text=${encodeURIComponent(textoDuda)}`, '_blank');
        } catch (eWa) {
          console.warn('Aviso apertura WhatsApp duda:', eWa);
        }
      }
    } catch(err) {
      console.error("Error guardando checkin post-consulta:", err);
    } finally {
      setEnviandoCheckin(false);
    }
  };

  const updateCantidad = async (index, delta) => {
    if (!pacienteDocId) return;
    let newList = [...alimentosHoy];
    let item = newList[index];
    let currentQty = item.cantidad || 1;
    let unitCal = item.calorias / currentQty;
    let newQty = currentQty + delta;
    
    if (newQty <= 0) {
        newList.splice(index, 1);
    } else {
        newList[index] = { ...item, cantidad: newQty, calorias: unitCal * newQty };
    }
    
    setAlimentosHoy(newList);
    try {
        const total = newList.reduce((s,a) => s+a.calorias, 0);
        await saveDailyTracker(pacienteDocId, "alimentacion", { alimentos: newList, totalCalorias: total, metaCalorias: META_CALORIAS });
        const todayLabel = new Date().toLocaleDateString("es-MX",{month:"short",day:"numeric"});
        setCaloriasData(prev => { 
          const exists = prev.find(p => p.fecha === todayLabel); 
          return exists ? prev.map(p => p.fecha === todayLabel ? {...p, calorias: total} : p) : [...prev, {fecha: todayLabel, calorias: total}]; 
        });
    } catch(err) { console.error(err); }
  };

  const handleAddAlimento = async (alimento, qty = 1) => {
    const isExisting = alimentosHoy.findIndex(x => x.nombre === alimento.nombre && x.porcion === alimento.porcion);
    let newList;
    if (isExisting >= 0) {
        const existing = alimentosHoy[isExisting];
        const currentQty = existing.cantidad || 1;
        const unitCal = existing.calorias / currentQty;
        newList = [...alimentosHoy];
        newList[isExisting] = { ...existing, cantidad: currentQty + qty, calorias: existing.calorias + (unitCal * qty), timestamp: new Date() };
        const [moved] = newList.splice(isExisting, 1);
        newList.unshift(moved);
    } else {
        newList = [{...alimento, cantidad: qty, calorias: alimento.calorias * qty, id:Date.now(), timestamp:new Date()}, ...alimentosHoy];
    }
    setAlimentosHoy(newList); setBuscarAlimento("");
    if (pacienteDocId) {
      try { 
        const total = newList.reduce((s,a) => s+a.calorias, 0); 
        await saveDailyTracker(pacienteDocId, "alimentacion", { alimentos: newList, totalCalorias: total, metaCalorias: META_CALORIAS });
        const todayLabel = new Date().toLocaleDateString("es-MX",{month:"short",day:"numeric"});
        setCaloriasData(prev => { 
          const exists = prev.find(p => p.fecha === todayLabel); 
          return exists ? prev.map(p => p.fecha === todayLabel ? {...p, calorias: total} : p) : [...prev, {fecha: todayLabel, calorias: total}]; 
        });
      } catch(err) { console.error(err); }
    }
  };

  const membresiaObj = getMembresiaObj(perfilPaciente.membresia, pacienteDocId);
  const tabs = [ 
    {key:"progreso", label:"Resumen", icon: Activity},
    {key:"miprogreso", label:"Progreso", icon: Sparkles},
    {key:"citas", label:"Citas", icon: Calendar},
    {key:"expediente", label:"Estilo de Vida", icon: Flame},
    {key:"pagos", label:"Pagos", icon: Receipt}, 
    ...(membresiaObj?.activa ? [{key:"membresia", label:"Membresía", icon: Crown}] : []), 
    {key:"config", label:"Config", icon: User} 
  ];

  let searchQty = 1;
  let searchQuery = buscarAlimento.toLowerCase().trim();
  const qtyMatch = searchQuery.match(/^(\d+)\s*(.*)/);
  if (qtyMatch) {
      searchQty = parseInt(qtyMatch[1]) || 1;
      searchQuery = qtyMatch[2].trim();
  }
  const alimentosFiltrados = searchQuery.length > 0 ? ALIMENTOS_CATALOGO.filter(a => a.nombre.toLowerCase().includes(searchQuery)) : [];

  const getFraseDelDia = () => {
    const frases = [
      "El autocuidado no es un lujo, es una inversión directa en tu calidad de vida.",
      "Cada paso que das hoy es un ladrillo en la construcción de tu bienestar futuro.",
      "Tu cuerpo es el único lugar en el que vas a vivir toda tu vida, trátalo con amor.",
      "La salud no lo es todo, pero sin ella, todo lo demás es nada.",
      "Pequeños progresos diarios suman grandes resultados a largo plazo.",
      "El descanso productivo es tan importante como el trabajo duro.",
      "No cuentes los días, haz que los días cuenten para tu salud.",
      "Tu mente siempre cree lo que le dices, háblale de salud y energía.",
      "El cuerpo logra lo que la mente cree.",
      "Invertir en ti mismo es la mejor decisión que harás en tu vida."
    ];
    const diaDelMes = new Date().getDate() || 1;
    return frases[diaDelMes % frases.length] || frases[0];
  };

  // Cálculos en tiempo real de la transformación y modo clínica
  const totalSesiones = useMemo(() => {
    return Object.values(sesionesPorTrat).reduce((acc, arr) => acc + arr.length, 0);
  }, [sesionesPorTrat]);

  const citaHoy = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return citas.find(c => {
      const fc = c.fecha || (c.fechaHora ? c.fechaHora.split("T")[0] : "");
      return fc === todayStr && c.status !== "Cancelada";
    });
  }, [citas]);

  const proximaCita = useMemo(() => {
    return citas
      .filter(c => c.status !== "Completada" && c.status !== "Cancelada")
      .sort((a,b) => new Date(a.fecha) - new Date(b.fecha))[0] || null;
  }, [citas]);

  const ultimaSesionConcluida = useMemo(() => {
    const all = [];
    Object.values(sesionesPorTrat).forEach(arr => all.push(...arr));
    return all.sort((a,b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
  }, [sesionesPorTrat]);

  // Resuelve la fase activa del Roadmap considerando el control manual del Especialista en Expediente Clínico (Propuesta 4 - Punto 3)
  const resolverFaseRoadmap = useCallback((tipoTarget) => {
    const tratEspecifico = tratamientos.find(t => {
      const tipo = (t.tipo || '').toLowerCase();
      const nom = (t.nombre || '').toLowerCase();
      if (tipoTarget === 'facial') {
        return tipo.includes('facial') || nom.includes('facial') || nom.includes('envejec') || nom.includes('antiedad') || nom.includes('dermapen') || nom.includes('peeling') || nom.includes('limpieza') || nom.includes('hidra') || nom.includes('acne') || nom.includes('acné') || nom.includes('melasma');
      }
      return tipo.includes('corporal') || nom.includes('corporal') || nom.includes('lipo') || nom.includes('reduct') || nom.includes('reafirm') || nom.includes('cavit') || nom.includes('radiofrecuencia');
    });
    const trat = tratEspecifico || (tratamientoActivo && (() => {
      const nom = (tratamientoActivo.nombre || '').toLowerCase();
      const tip = (tratamientoActivo.tipo || '').toLowerCase();
      if (tipoTarget === 'facial' && (tip.includes('facial') || nom.includes('facial') || nom.includes('envejec') || nom.includes('antiedad') || nom.includes('dermapen') || nom.includes('peeling') || nom.includes('limpieza') || nom.includes('hidra') || nom.includes('acne') || nom.includes('acné') || nom.includes('melasma'))) return tratamientoActivo;
      if (tipoTarget === 'corporal' && (tip.includes('corporal') || nom.includes('corporal') || nom.includes('lipo') || nom.includes('reduct') || nom.includes('reafirm'))) return tratamientoActivo;
      return null;
    })());
    const faseManual = trat?.faseRoadmapManual;

    if (faseManual && faseManual !== 'auto') {
      return {
        fase: Number(faseManual) || 1,
        esManual: true,
        tratamientoNombre: trat?.nombre || ''
      };
    }

    let fAuto = 1;
    if (totalSesiones >= 9) fAuto = 4;
    else if (totalSesiones >= 6) fAuto = 3;
    else if (totalSesiones >= 3) fAuto = 2;

    return {
      fase: fAuto,
      esManual: false,
      tratamientoNombre: trat?.nombre || ''
    };
  }, [tratamientos, tratamientoActivo, totalSesiones]);

  // Roadmap Corporal de 4 fases clínicas
  const roadmapCorporalFases = useMemo(() => {
    const { fase: fActual, esManual } = resolverFaseRoadmap('corporal');

    return [
      {
        num: 1,
        nombre: "Preparación & Desintoxicación",
        sub: "Sesiones 1 a 2",
        icono: Sparkles,
        explicacion: "Activamos tu sistema circulatorio y linfático. El tejido se descongestiona y se prepara para recibir la aparatología y nutrientes.",
        completada: fActual > 1,
        activa: fActual === 1,
        esManual
      },
      {
        num: 2,
        nombre: "Activación & Reducción Profunda",
        sub: "Sesiones 3 a 5",
        icono: Flame,
        explicacion: "Fase de máxima quema y movilización de grasa localizada. Notarás ligereza corporal y descenso acelerado de centímetros.",
        completada: fActual > 2,
        activa: fActual === 2,
        esManual
      },
      {
        num: 3,
        nombre: "Moldeo, Definición & Ajuste",
        sub: "Sesiones 6 a 8",
        icono: Target,
        explicacion: "Reafirmación de fibras de colágeno y elastina. Compactación de tejidos y perfilado de silueta para resultados estéticos notables.",
        completada: fActual > 3,
        activa: fActual === 3,
        esManual
      },
      {
        num: 4,
        nombre: "Consolidación & Mantenimiento VIP",
        sub: "Sesión 9+",
        icono: Trophy,
        explicacion: "Blindaje de resultados. Tu metabolismo basal se estabiliza para asegurar que el cambio permanezca en el tiempo.",
        completada: fActual === 4 && totalSesiones >= 12,
        activa: fActual === 4,
        esManual
      }
    ];
  }, [resolverFaseRoadmap, totalSesiones]);

  // Roadmap Facial Dermatológico de 4 fases clínicas
  const roadmapFacialFases = useMemo(() => {
    const { fase: fActual, esManual } = resolverFaseRoadmap('facial');

    return [
      {
        num: 1,
        nombre: "Preparación & Desintoxicación Epidérmica",
        sub: "Sesiones 1 a 2",
        icono: Sparkles,
        explicacion: "Higiene facial profunda, balance del manto hidrolipídico y eliminación de células queratinizadas para oxigenar tu piel.",
        completada: fActual > 1,
        activa: fActual === 1,
        esManual
      },
      {
        num: 2,
        nombre: "Renovación Celular & Regeneración",
        sub: "Sesiones 3 a 5",
        icono: Zap,
        explicacion: "Estimulación de la capa basal y unificación del tono cutáneo. Suaviza la textura y desvanece imperfecciones.",
        completada: fActual > 2,
        activa: fActual === 2,
        esManual
      },
      {
        num: 3,
        nombre: "Redensificación & Estímulo de Colágeno",
        sub: "Sesiones 6 a 8",
        icono: Target,
        explicacion: "Reactivación de fibroblastos para la producción natural de colágeno y elastina. Mayor firmeza, turgencia y atenuación de líneas.",
        completada: fActual > 3,
        activa: fActual === 3,
        esManual
      },
      {
        num: 4,
        nombre: "Luminosidad, Sellado & Blindaje Cutáneo",
        sub: "Sesión 9+",
        icono: Trophy,
        explicacion: "Efecto glow duradero, nutrición intensiva y sellado protector contra el fotoenvejecimiento y radicales libres.",
        completada: fActual === 4 && totalSesiones >= 12,
        activa: fActual === 4,
        esManual
      }
    ];
  }, [resolverFaseRoadmap, totalSesiones]);

  const esRoadmapFacialActivo = useMemo(() => {
    if (tipoRoadmapSeleccionado === 'facial') return true;
    if (tipoRoadmapSeleccionado === 'corporal') return false;
    if (tieneFacialActivo && !tieneCorporalActivo) return true;
    return false;
  }, [tipoRoadmapSeleccionado, tieneFacialActivo, tieneCorporalActivo]);

  const roadmapFases = esRoadmapFacialActivo ? roadmapFacialFases : roadmapCorporalFases;

  const progresoGlobalPct = useMemo(() => {
    if (totalSesiones > 0) {
      return Math.min(100, Math.round((totalSesiones / 10) * 100));
    }
    const info = esRoadmapFacialActivo ? resolverFaseRoadmap('facial') : resolverFaseRoadmap('corporal');
    if (info.esManual && info.fase > 1) {
      return Math.min(100, Math.round(((info.fase - 1) / 4) * 100 + 10));
    }
    return 0;
  }, [totalSesiones, esRoadmapFacialActivo, resolverFaseRoadmap]);

  // Cálculos de equivalencias humanas
  const equivalenciasProgreso = useMemo(() => {
    let diffPeso = 0;
    let diffCintura = 0;
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]?.length >= 2) {
      const sArr = sesionesPorTrat[tratamientoActivo.id];
      const p1 = parseFloat(sArr[0]?.medidas?.peso) || 0;
      const pU = parseFloat(sArr[sArr.length - 1]?.medidas?.peso) || 0;
      if (p1 && pU) diffPeso = (p1 - pU).toFixed(1);

      const c1 = parseFloat(sArr[0]?.medidas?.cintura) || 0;
      const cU = parseFloat(sArr[sArr.length - 1]?.medidas?.cintura) || 0;
      if (c1 && cU) diffCintura = (c1 - cU).toFixed(1);
    }
    const tallasAprox = Math.max(0, Math.round(Number(diffCintura) / 3.5));
    const bloquesGrasa = Math.max(0, Math.round(Number(diffPeso) * 4)); // Bloques de 250g

    return {
      diffPeso: Number(diffPeso),
      diffCintura: Number(diffCintura),
      tallasAprox,
      bloquesGrasa
    };
  }, [tratamientoActivo, sesionesPorTrat]);

﻿  return (
    <div className="space-y-6 pb-28 max-w-4xl mx-auto px-3 sm:px-6 animate-in fade-in duration-500">
      
      {/* 1. HERO HEADER ALFRA VIP ULTRA HD */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 rounded-3xl p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden border border-teal-500/20">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Sparkles size={160} className="text-teal-400"/></div>
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"/>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex gap-4 items-center">
            <div className="relative group cursor-pointer" onClick={() => { const inp = document.getElementById("global-foto-upload"); if(inp) inp.click(); }}>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-teal-400/30 shadow-2xl bg-slate-800 flex items-center justify-center shrink-0 ring-4 ring-teal-500/10">
                {perfilPaciente.fotoUrl ? <img src={perfilPaciente.fotoUrl} alt="" className="w-full h-full object-cover"/> : <User size={36} className="text-teal-200/50"/>}
              </div>
              <button 
                type="button"
                className="absolute bottom-0 right-0 bg-emerald-500 text-white p-2 rounded-full shadow-lg border-2 border-slate-900 hover:bg-emerald-400 transition-all z-20 hover:scale-110"
                title="Cambiar foto de perfil"
              >
                <Camera size={14} fill="currentColor" />
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{perfilPaciente.nombre}</h1>
                {membresiaObj?.activa && (
                  <span className="text-[9px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Crown size={11} fill="currentColor"/> Membresía {membresiaObj.nivel ? membresiaObj.nivel : "VIP"}
                  </span>
                )}
              </div>
              <p className="text-teal-200/70 text-xs font-medium flex items-center gap-2">
                {tieneTratamientosActivos && (
                  <span className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-lg border border-teal-500/30 font-bold">
                    {tieneCorporalActivo && tieneFacialActivo ? 'Tratamiento Integral' : tieneCorporalActivo ? 'Tratamiento Corporal' : 'Tratamiento Facial'}
                  </span>
                )}
                <span>{perfilPaciente.telefono || 'Sin teléfono'}</span>
              </p>
              {tieneTratamientosActivos && (
                <div className="pt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Índice de Bienestar ALFRA: {indiceBienestar}% · {indiceBienestar >= 85 ? 'Nivel Óptimo' : indiceBienestar >= 70 ? 'Excelente Ritmo' : 'Activo'}
                </span>
              </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setAutoAgendadoOpen(true)}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Calendar size={15} /> Agendar Cita
            </button>
            <a
              href={`https://wa.me/527535386018?text=${encodeURIComponent(`Hola Clínica ALFRA, soy ${(perfilPaciente.nombre || 'paciente de ALFRA').trim()}. Me comunico desde mi perfil en la app para atención personalizada.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider border border-white/20 transition-all flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer"
            >
              <MessageSquare size={15} className="text-emerald-400" /> Atención Personalizada
            </a>
          </div>
        </div>
      </div>

      <input
        id="global-foto-upload"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFotoUpload}
      />

      {/* 2. TABS DE NAVEGACIÓN ULTRA HD AL INICIO (POINT 7) */}
      <div className="flex flex-wrap gap-2 px-1 sticky top-2 z-20 bg-slate-900/95 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-xl">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 border-teal-300 shadow-md shadow-teal-500/20 scale-105 font-black"
                  : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={14} className={isActive ? "text-slate-950" : "text-teal-400"} />
              {t.label}
            </button>
          );
        })}
      </div>

﻿      {/* ==================== TAB RESUMEN ==================== */}
      {activeTab === "progreso" && (
        <div className="space-y-5 animate-in fade-in">
          {/* MODO BIENVENIDA VIP EN CLÍNICA (SI TIENE CITA HOY) */}
          {citaHoy && (citaHoy.status === 'Confirmada' || citaHoy.status === 'En Cabina' || citaHoy.status === 'Pendiente Pase a Caja') && (
            <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-3xl p-5 border-2 border-emerald-400/40 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-emerald-400/20 rounded-2xl text-emerald-300 border border-emerald-400/30 shrink-0">
                  <Sparkles size={24} className="animate-spin" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Modo Atención en Clínica Activo</span>
                  <h3 className="text-sm sm:text-base font-black text-white">¡Bienvenida a Clínica ALFRA! Tu cabina está lista.</h3>
                  <p className="text-xs text-teal-100/80 mt-0.5">Disfruta tu sesión de {citaHoy.servicio || "tratamiento"}. Nuestro equipo te consentirá hoy.</p>
                </div>
              </div>
            </div>
          )}

          {/* POINT 1: TARJETA DE LEALTAD VIP (100% INCONDICIONAL Y VISIBLE AL INICIO DE RESUMEN) */}
          {/* Tarjeta de Lealtad - foto llena todo el recuadro */}
          <Card className="shadow-lg overflow-hidden">
            <div className="flex gap-3">
              <div className="w-[100px] h-[130px] rounded-2xl overflow-hidden border-2 shadow-lg shrink-0" style={{borderColor:"rgba(32,178,170,0.3)"}}>
                {perfilPaciente.fotoUrl ? <img src={perfilPaciente.fotoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center"><User size={32} className="text-gray-400"/></div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <img src="/logo.png" alt="ALFRA" className="h-12 object-contain" />
                  <span className="text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-turquesa to-cyan-400 text-white px-2 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={8}/>VIP</span>
                </div>
                <p className="text-[9px] text-gray-500 leading-snug">En clinica ALFRA nuestro compromiso es con tu bienestar.</p>
                <p className="text-[9px] text-gray-500 leading-snug font-bold">Gracias por confiar en nuestras manos para resaltar tu belleza natural</p>
                <p className="text-[9px] text-gray-400 mt-1 italic">{perfilPaciente.nombre?.split(" ")[0]}, cada visita es un paso hacia tu mejor versión.</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{color:"#20B2AA"}}>Lealtad</span>
                  <span className="text-lg font-black text-gray-800">{perfilPaciente.sellosLealtad||0}</span>
                  <span className="text-gray-400 text-xs">/7</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 justify-center">{Array.from({length:7}).map((_,i)=>{const filled=i<(perfilPaciente.sellosLealtad||0); return <div key={i} className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${filled?"bg-gradient-to-br from-turquesa to-cyan-400 border-turquesa text-white shadow-md":"border-gray-200 text-gray-300"}`}><Sparkles size={14}/></div>;})}</div>
            <div className="flex justify-between items-center mt-3">
              <div className="text-[9px] text-gray-400"><p className="font-bold">Paciente</p><p>{perfilPaciente.nombre}</p>{perfilPaciente.primerSelloFecha&&<p>Desde {new Date(perfilPaciente.primerSelloFecha).toLocaleDateString("es-MX",{month:"short",year:"numeric"})}</p>}</div>
              <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Acumula 7 visitas - desbloquea beneficios exclusivos</p>
            </div>
          </Card>



          {/* POINT 6: ÍNDICE DE BIENESTAR ALFRA DINÁMICO */}
          {!tieneTratamientosActivos ? (
            <Card className="shadow-lg border-2 border-teal-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950 text-white p-5 rounded-3xl overflow-hidden relative">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-2xl bg-teal-500/10 border-2 border-teal-400/40 flex items-center justify-center shrink-0 shadow-inner text-teal-300">
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                        🌱 Pendiente de Activación
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">Índice de Bienestar ALFRA</h3>
                      <button 
                        type="button" 
                        onClick={() => setMostrarModalInfoBienestar(true)}
                        className="text-teal-400 hover:text-teal-200 transition-colors cursor-pointer"
                        title="¿Qué es el Índice de Bienestar ALFRA?"
                      >
                        <Info size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-teal-200/70 mt-0.5">Se activará de forma personalizada cuando inicies tu plan de tratamiento en cabina.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarModalInfoBienestar(true)}
                  className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-teal-300 font-black text-xs uppercase tracking-wider border border-teal-500/30 transition-all cursor-pointer shrink-0"
                >
                  ¿Qué es y cómo funciona?
                </button>
              </div>
            </Card>
          ) : (
            <Card className="shadow-lg border-2 border-teal-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950 text-white p-5 rounded-3xl overflow-hidden relative">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-2xl bg-teal-500/10 border-2 border-teal-400/40 flex flex-col items-center justify-center shrink-0 shadow-inner">
                    <span className="text-3xl font-black text-teal-300 tracking-tight">{indiceBienestar}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-teal-400/70">/ 100</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                        {indiceBienestar >= 85 ? "✨ Nivel Óptimo ALFRA" : indiceBienestar >= 70 ? "🌟 Excelente Ritmo" : indiceBienestar >= 50 ? "👍 En Progreso Activo" : "🌱 Iniciando el Día"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">Índice de Bienestar ALFRA</h3>
                      <button 
                        type="button" 
                        onClick={() => setMostrarModalInfoBienestar(true)}
                        className="text-teal-400 hover:text-teal-200 transition-colors cursor-pointer"
                        title="¿Qué es el Índice de Bienestar ALFRA?"
                      >
                        <Info size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-teal-200/70 mt-0.5">Se actualiza en tiempo real con tu agua, ejercicio y recomendaciones cumplidas.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                  <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400">💧 Agua</p>
                    <p className="text-xs font-black text-cyan-300">+{Math.min(30, vasosAguaHoy * 3)} pts</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                    <p className="text-[10px] font-bold text-gray-400">📋 Cuidados</p>
                    <p className="text-xs font-black text-teal-300">+{Math.min(30, recomendacionesCumplidasCount * 6)} pts</p>
                  </div>
                </div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 mt-4 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400 transition-all duration-700 shadow-sm"
                  style={{ width: `${indiceBienestar}%` }}
                />
              </div>
            </Card>
          )}

          {/* Modal Informativo: ¿Qué es el Índice de Bienestar ALFRA? */}
          {mostrarModalInfoBienestar && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-slate-900 border border-teal-500/30 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">¿Qué es el Índice de Bienestar ALFRA?</h3>
                      <p className="text-[10px] text-teal-300/80">Tu métrica integral de salud, belleza y disciplina</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setMostrarModalInfoBienestar(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  El <strong>Índice de Bienestar ALFRA</strong> es un indicador clínico inteligente (de 0 a 100%) que evalúa la sinergia entre tus sesiones en cabina y tus hábitos diarios en casa. Se actualiza en tiempo real con 4 pilares:
                </p>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                    <span className="text-lg">💧</span>
                    <div>
                      <p className="font-black text-cyan-300">1. Hidratación Celular (hasta 30 pts)</p>
                      <p className="text-[11px] text-gray-400">Tomar 2.5 L diarios de agua natural para optimizar el drenaje linfático y la respuesta de la aparatología.</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                    <span className="text-lg">📋</span>
                    <div>
                      <p className="font-black text-teal-300">2. Cuidados de la Especialista (hasta 30 pts)</p>
                      <p className="text-[11px] text-gray-400">Cumplimiento de las recomendaciones post-sesión indicadas en tu expediente clínico.</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                    <span className="text-lg">🥗</span>
                    <div>
                      <p className="font-black text-emerald-300">3. Nutrición Consciente (hasta 10 pts)</p>
                      <p className="text-[11px] text-gray-400">Registro de alimentos en tu diario para mantener estabilidad metabólica sin picos de inflamación.</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                    <span className="text-lg">🏃‍♀️</span>
                    <div>
                      <p className="font-black text-amber-300">4. Activación Física (hasta 10 pts)</p>
                      <p className="text-[11px] text-gray-400">Movilidad diaria (caminata o entrenamiento) para movilizar toxinas y mejorar la firmeza dérmica.</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarModalInfoBienestar(false)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer"
                >
                  Entendido, ¡gracias!
                </button>
              </div>
            </div>
          )}

          {/* ==================== ROADMAP CLÍNICO DE TRANSFORMACIÓN (POINT 3) ==================== */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Compass size={18} className="text-turquesa" />
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                    {esRoadmapFacialActivo ? 'Tu Roadmap Facial Dermatológico' : 'Tu Roadmap Corporal Clínico'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMostrarModalInfoRoadmap(true)}
                    className="text-turquesa hover:text-teal-700 transition-colors cursor-pointer"
                    title="¿Cómo funciona tu Roadmap Clínico?"
                  >
                    <Info size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  {esRoadmapFacialActivo ? 'Sigue de cerca en qué fase biológica se encuentra tu piel' : 'Sigue de cerca en qué fase biológica se encuentra tu cuerpo'}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Selector para explorar Facial o Corporal */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setTipoRoadmapSeleccionado('corporal')}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      !esRoadmapFacialActivo ? 'bg-white text-turquesa shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🌸 Corporal
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoRoadmapSeleccionado('facial')}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      esRoadmapFacialActivo ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    ✨ Facial
                  </button>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-turquesa bg-turquesa/10 px-3 py-1 rounded-full border border-turquesa/20">
                    {totalSesiones > 0 ? `${totalSesiones} Sesiones • ${progresoGlobalPct}% del Plan` : (tratamientoActivo?.faseRoadmapManual && tratamientoActivo.faseRoadmapManual !== 'auto' ? `Fase ${tratamientoActivo.faseRoadmapManual} • Ajustada en Cabina` : '0 Sesiones • Pendiente de inicio')}
                  </span>
                </div>
              </div>
            </div>

            {/* Barra de progreso visual */}
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-teal-400 via-turquesa to-emerald-500 h-full rounded-full transition-all duration-1000 shadow-sm"
                style={{ width: `${Math.max(totalSesiones > 0 ? 10 : 0, progresoGlobalPct)}%` }}
              />
            </div>

            {/* Grid de las 4 fases biológicas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {roadmapFases.map((fase) => {
                const Icon = fase.icono;
                return (
                  <div 
                    key={fase.num}
                    onClick={() => setFaseInfoModal(fase)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      fase.activa
                        ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-400 shadow-md ring-2 ring-teal-400/20' 
                        : fase.completada
                        ? 'bg-gray-50/80 border-gray-200 opacity-90'
                        : 'bg-white border-gray-150 hover:border-turquesa/40 hover:bg-gray-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          fase.activa ? 'bg-teal-600 text-white' : fase.completada ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          FASE {fase.num}
                        </span>
                        <Icon size={14} className={fase.activa ? 'text-teal-600' : 'text-gray-400'} />
                      </div>
                      <h4 className="text-xs font-black text-gray-800 leading-tight mb-1">{fase.nombre}</h4>
                      <p className="text-[10px] text-gray-500 font-bold">{fase.sub}</p>
                    </div>
                    <div className="pt-2 flex items-center justify-between text-[9px] font-black uppercase text-teal-600">
                      <span>{fase.activa ? '📍 En curso' : fase.completada ? '✅ Completada' : '⏳ Siguiente'}</span>
                      <Info size={11} className="text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aviso explicativo al pie de tarjeta */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-gray-100 text-[11px] text-gray-500">
              <span className="italic">
                {tratamientoActivo?.faseRoadmapManual && tratamientoActivo.faseRoadmapManual !== 'auto' ? '🩺 Fase clínica ajustada de manera personalizada por tu Especialista.' : (totalSesiones === 0 ? '💡 Tu especialista activará tu primera fase conforme asistas a tus sesiones en cabina.' : '🌿 Cada fase está sincronizada con la regeneración biológica de tu tejido.')}
              </span>
              <button
                type="button"
                onClick={() => setMostrarModalInfoRoadmap(true)}
                className="text-turquesa font-bold hover:underline shrink-0 cursor-pointer"
              >
                ¿Cómo se controlan las fases? ➔
              </button>
            </div>
          </div>

          {/* Modal Informativo: ¿Cómo funciona tu Roadmap Clínico? */}
          {mostrarModalInfoRoadmap && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-slate-900 border border-teal-500/30 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300">
                      <Compass size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">¿Cómo funciona tu Roadmap Clínico?</h3>
                      <p className="text-[10px] text-teal-300/80">Protocolo biológico de transformación paso a paso</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setMostrarModalInfoRoadmap(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  En <strong>Clínica ALFRA</strong> no realizamos sesiones al azar. Tu tratamiento se organiza en un <strong>Roadmap de 4 Fases Biológicas</strong> adaptado al ritmo celular de tu cuerpo o piel:
                </p>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <p className="font-black text-cyan-300 flex items-center gap-1.5">
                      <span>🌸</span> Roadmap Corporal (Modelado & Reducción)
                    </p>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      <strong>Fase 1 (Desintoxicación):</strong> Se drena retención de líquidos y toxinas preparando el tejido circulatorio.<br/>
                      <strong>Fase 2 (Reducción Profunda):</strong> Se moviliza grasa localizada mediante aparatología especializada.<br/>
                      <strong>Fase 3 (Firmeza & Moldeo):</strong> Se reactiva la síntesis de colágeno y elastina para tensar la piel.<br/>
                      <strong>Fase 4 (Consolidación):</strong> Se fija el resultado biológico evitando rebotes.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <p className="font-black text-purple-300 flex items-center gap-1.5">
                      <span>✨</span> Roadmap Facial (Dermatológico & Rejuvenecimiento)
                    </p>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      <strong>Fase 1 (Higiene Profunda):</strong> Se desobstruyen poros, se oxigena la epidermis y se estabiliza el pH.<br/>
                      <strong>Fase 2 (Regeneración Dérmica):</strong> Se bioestimula la dermis con activos puros y aparatología regenerativa.<br/>
                      <strong>Fase 3 (Unificación de Tono & Firmeza):</strong> Se corrigen imperfecciones, manchas y textura cutánea.<br/>
                      <strong>Fase 4 (Luminosidad & Protección):</strong> Se sella la barrera lipídica para un efecto radiante y duradero.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-200">
                    <p className="font-black text-[11px]">🩺 ¿Cómo se controla tu avance?</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed">
                      En cada cita, tu especialista registra en tu <strong>Expediente Clínico</strong> las medidas, parámetros y evolución de cabina. El sistema actualiza en tiempo real tu fase activa y tu porcentaje de avance.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarModalInfoRoadmap(false)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer"
                >
                  Entendido, ¡Muchas Gracias!
                </button>
              </div>
            </div>
          )}


          {tieneTratamientosActivos && (
          <>
          {/* POINT 4: RECOMENDACIONES DE TU ESPECIALISTA (100% INTERACTIVAS, 100% PERSONALIZADAS) */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-teal-500/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300">
                  <Stethoscope size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Recomendaciones de tu Especialista</h3>
                  <p className="text-xs text-teal-300/80">Indicaciones para potenciar los resultados de tu tratamiento</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  {recomendacionesCumplidasCount} de {recomendacionesEspecialista.length} cumplidas hoy
                </span>
              </div>
            </div>

            {/* Barra de progreso de recomendaciones */}
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.round((recomendacionesCumplidasCount / Math.max(1, recomendacionesEspecialista.length)) * 100)}%` }}
              />
            </div>

            {/* Lista interactiva de recomendaciones con checklist */}
            <div className="space-y-2 pt-1">
              {recomendacionesEspecialista.map((r, i) => {
                const checked = !!apoyoCompletadoHoy[r.id];
                return (
                  <button
                    key={r.id || i}
                    type="button"
                    onClick={() => handleToggleCuidado(r.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                      checked
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                        checked ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold' : 'border-white/20 text-transparent hover:border-teal-400'
                      }`}>
                        {checked ? <Check size={16} /> : <div className="w-2 h-2 rounded-full bg-white/20" />}
                      </div>
                      <div>
                        <p className={`text-xs font-black ${checked ? 'line-through opacity-70 text-emerald-300' : 'text-white'}`}>
                          {r.texto}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                          {r.detalle}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0 ${
                      checked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-gray-400'
                    }`}>
                      {checked ? "Cumplida" : "Marcar"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Micro Check-in Post-Sesión */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Heart size={14} className="text-rose-400" /> ¿Cómo te has sentido tras tu última sesión?
                </p>
                {checkinEnviado && (
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    ✓ Check-in Registrado
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleEnviarCheckin("excelente", "Me he sentido excelente")}
                  disabled={enviandoCheckin}
                  className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    checkinEnviado === "excelente"
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                      : "bg-white/5 hover:bg-white/10 text-gray-200 border-white/10"
                  }`}
                >
                  🤩 Excelente
                </button>
                <button
                  type="button"
                  onClick={() => handleEnviarCheckin("bien", "Evolución normal")}
                  disabled={enviandoCheckin}
                  className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    checkinEnviado === "bien"
                      ? "bg-teal-600 text-white border-teal-500 shadow-md"
                      : "bg-white/5 hover:bg-white/10 text-gray-200 border-white/10"
                  }`}
                >
                  🙂 Bien, normal
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarModalDuda(true)}
                  className="p-2.5 rounded-xl border bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  🤔 Tengo una duda
                </button>
              </div>

              {mostrarModalDuda && (
                <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-2.5 animate-in fade-in">
                  <p className="text-xs text-amber-200 font-bold">
                    Escribe tu duda o inquietud. Nuestro equipo y especialista se comunicarán contigo para atenderla de inmediato:
                  </p>
                  <textarea
                    value={checkinNota}
                    onChange={(e) => setCheckinNota(e.target.value)}
                    placeholder="Ej. Siento ligero calor en la zona tratada o tengo dudas sobre mis cuidados..."
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-white outline-none focus:ring-2 focus:ring-amber-400"
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setMostrarModalDuda(false)}
                      className="px-3 py-1 rounded-xl bg-white/10 text-gray-300 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnviarCheckin("duda", checkinNota)}
                      disabled={enviandoCheckin || !checkinNota.trim()}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {enviandoCheckin ? "Enviando..." : "Enviar a Recepción & Especialista"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CONTROL DE HIDRATACIÓN DIARIA */}
          <div className="space-y-2 bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-3xl border border-teal-500/20 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                <Droplets size={14} className="text-cyan-400" /> Meta de Hidratación Diaria ({vasosAguaHoy * 250} ml / 2,500 ml)
              </span>
              <span className="text-xs font-bold text-gray-400">{vasosAguaHoy}/10 vasos</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 pt-1">
              {Array.from({ length: 10 }).map((_, i) => {
                const numVaso = i + 1;
                const lleno = vasosAguaHoy >= numVaso;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleToggleVasoAgua(numVaso)}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      lleno 
                        ? 'bg-gradient-to-t from-cyan-600 to-teal-400 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 scale-105' 
                        : 'bg-white/5 border-white/10 text-gray-500 hover:border-teal-400/50'
                    }`}
                    title={`Vaso #${numVaso} (250ml)`}
                  >
                    <Droplets size={16} fill={lleno ? "currentColor" : "none"} />
                    <span className="text-[9px] font-black">{numVaso}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* POINT 2: ACTIVIDAD FÍSICA EN SEGUNDO PLANO (TRACKER RÁPIDO) */}
          
          </>
          )}

          <Card className="shadow-xl border-2 border-orange-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-orange-950 text-white p-5 rounded-3xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500/20 rounded-2xl text-orange-400 border border-orange-500/30">
                  <Footprints size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Rastreador Deportivo en Segundo Plano</span>
                    {isTracking && (
                      <span className="flex items-center gap-1 bg-green-500/20 text-green-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-green-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> GPS & WakeLock Activo
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white">{workoutType || 'Caminata'} Deportiva</h4>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveTab("expediente")} 
                className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                Ver Historial Completo <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-white/5 rounded-2xl p-4 border border-white/10 text-center mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tiempo</p>
                <p className="text-2xl font-black text-white tabular-nums tracking-tight mt-0.5">{formatTime(trackTime)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Distancia</p>
                <p className="text-2xl font-black text-teal-300 tabular-nums tracking-tight mt-0.5">{(trackDistance / 1000).toFixed(2)} <span className="text-xs">km</span></p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Calorías</p>
                <p className="text-2xl font-black text-orange-400 tabular-nums tracking-tight mt-0.5">{Math.round((trackDistance * 0.055) + (trackTime * 0.06))} <span className="text-xs">kcal</span></p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {!isTracking ? (
                <button
                  type="button"
                  onClick={() => startTracking("Caminata")}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Play fill="currentColor" size={15} /> Iniciar Ejercicio
                </button>
              ) : (
                <>
                  {!isPaused ? (
                    <button
                      type="button"
                      onClick={pauseTracking}
                      className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Pause size={15} /> Pausar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={resumeTracking}
                      className="flex-1 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play fill="currentColor" size={15} /> Reanudar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopTracking}
                    className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Square fill="currentColor" size={15} /> Terminar y Guardar
                  </button>
                </>
              )}
            </div>
          </Card>

          {/* POINT 3: GRÁFICA DE CALORÍAS HOY VS META (AREACHART RECHARTS) */}
          <Card className="shadow-lg border-2 border-teal-500/20 bg-gradient-to-br from-slate-900 to-slate-950 text-white p-5 rounded-3xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">Nutrición & Balance Energético</span>
                <h4 className="text-base font-black text-white">Gráfica de Consumo Calórico Semanal</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-teal-300 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                  Hoy: {caloriasHoy} kcal / {META_CALORIAS} meta
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("expediente")}
                  className="text-xs text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  Registrar Alimentos <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="h-48 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={caloriasChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="caloriasGradientResumen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#20B2AA" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#20B2AA" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="fecha" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} domain={[0, 'dataMax + 400']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "1px solid rgba(45,212,191,0.3)", color: "#fff", fontSize: "11px", padding: "8px 12px" }}
                    formatter={(value, name) => [`${value} kcal`, name === "calorias" ? "Consumidas" : "Meta"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="calorias" 
                    stroke="#20B2AA" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#caloriasGradientResumen)" 
                    name="calorias"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="meta" 
                    stroke="#F59E0B" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                    dot={false}
                    name="meta"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* PRÓXIMA CITA */}
          {proximaCita && (
            <Card className="shadow-lg border-l-4 border-l-turquesa p-5 bg-gradient-to-r from-teal-50/50 to-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-turquesa/10 rounded-2xl text-turquesa">
                    <Calendar size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-turquesa">Próxima Cita Programada</span>
                    <h4 className="font-black text-base text-gray-800">{proximaCita.servicio || proximaCita.motivo || "Cita de Seguimiento"}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      📅 {proximaCita.fecha} · ⏰ {proximaCita.hora} · Con {proximaCita.especialistaNombre || 'Especialista asignada'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${
                    proximaCita.status === "Confirmada" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {proximaCita.status || "Agendada"}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* INSPIRACIÓN DIARIA ALFRA */}
          <Card className="relative overflow-hidden border border-teal-500/30 bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 rounded-3xl shadow-lg group !p-0">
            <div className="p-6 sm:p-7 flex items-center gap-4 text-white">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Sparkle size={24} className="text-teal-200" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-300">Inspiración Diaria ALFRA</p>
                <p className="text-sm sm:text-base font-medium text-white/95 leading-relaxed mt-0.5">"{getFraseDelDia()}"</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "miprogreso" && (
        <div className="space-y-5 animate-in fade-in pb-8">
          <div className="text-center space-y-1 mb-2">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Tu Transformación en Clínica ALFRA</h2>
            <p className="text-xs text-gray-500 font-bold">Métricas clínicas, fotos de evolución y registro milimétrico</p>
          </div>

{/* 3. ROADMAP DE TRANSFORMACIÓN CLÍNICA (ÚNICAMENTE SI HAY TRATAMIENTO ACTIVO) */}
      {tieneTratamientosActivos && (
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass size={18} className="text-turquesa" />
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                {esRoadmapFacialActivo ? 'Tu Roadmap Facial Dermatológico' : 'Tu Roadmap Corporal Clínico'}
              </h3>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              {esRoadmapFacialActivo ? 'Sigue de cerca en qué fase biológica se encuentra tu piel' : 'Sigue de cerca en qué fase biológica se encuentra tu cuerpo'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {tieneFacialActivo && tieneCorporalActivo && (
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setTipoRoadmapSeleccionado('facial')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    esRoadmapFacialActivo ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  💆‍♀️ Facial
                </button>
                <button
                  type="button"
                  onClick={() => setTipoRoadmapSeleccionado('corporal')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    !esRoadmapFacialActivo ? 'bg-white text-turquesa shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ✨ Corporal
                </button>
              </div>
            )}
            <div className="text-right">
              <span className="text-xs font-black text-turquesa bg-turquesa/10 px-3 py-1 rounded-full border border-turquesa/20">
                {totalSesiones} Sesiones Realizadas · {progresoGlobalPct}% del Plan Maestro
              </span>
            </div>
          </div>
        </div>

        {!tieneTratamientosActivos ? (
          <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-1">
            <Compass size={32} className="mx-auto text-turquesa/50 mb-1" />
            <p className="text-xs font-bold text-gray-700">Tu Roadmap se activará con tu primera sesión</p>
            <p className="text-[11px] text-gray-400">Una vez que la especialista inicie tu tratamiento, verás aquí el avance fase por fase.</p>
          </div>
        ) : (
          <>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-teal-400 via-turquesa to-emerald-500 h-full rounded-full transition-all duration-1000 shadow-sm"
                style={{ width: `${progresoGlobalPct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {roadmapFases.map((fase) => {
                const Icon = fase.icono;
                return (
                  <div 
                    key={fase.num}
                    onClick={() => setFaseInfoModal(fase)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      fase.activa 
                        ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-400 shadow-md ring-2 ring-teal-400/20' 
                        : fase.completada
                        ? 'bg-gray-50/80 border-gray-200 opacity-90'
                        : 'bg-white border-gray-100 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          fase.activa ? 'bg-teal-600 text-white' : fase.completada ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                        }`}>
                          FASE {fase.num}
                        </span>
                        <Icon size={14} className={fase.activa ? 'text-teal-600' : 'text-gray-400'} />
                      </div>
                      <h4 className="text-xs font-black text-gray-800 leading-tight mb-1">{fase.nombre}</h4>
                      <p className="text-[10px] text-gray-500 font-bold">{fase.sub}</p>
                    </div>
                    <div className="pt-2 flex items-center justify-between text-[9px] font-black uppercase text-teal-600">
                      <span>{fase.activa ? '📍 En curso' : fase.completada ? '✅ Completada' : '⏳ Siguiente'}</span>
                      <Info size={11} className="text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>

            {faseInfoModal && (
              <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200/60 text-xs text-teal-900 flex items-start justify-between gap-3 animate-in fade-in">
                <div className="space-y-1">
                  <p className="font-black uppercase tracking-wider text-[11px] text-teal-800">
                    💡 ¿Qué sucede durante la Fase {faseInfoModal.num} ({faseInfoModal.nombre})?
                  </p>
                  <p className="leading-relaxed">{faseInfoModal.explicacion}</p>
                </div>
                <button onClick={() => setFaseInfoModal(null)} className="text-teal-700 hover:text-teal-950 font-bold text-xs p-1 cursor-pointer">
                  ✕
                </button>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {loadingTrat ? (
            <div className="py-16 flex items-center justify-center gap-3 text-gray-300">
              <RefreshCw className="animate-spin" size={24} />
              <span className="text-sm font-bold">Cargando tu historial...</span>
            </div>
          ) : tratamientos.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-gray-100">
              <Activity size={48} className="mx-auto text-gray-100 mb-4" />
              <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Sin tratamientos registrados aún</p>
              <p className="text-gray-300 text-[10px] mt-1">La especialista creará tu expediente en la próxima sesión.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 justify-center mb-2">
                {tratamientos.map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => setTratamientoActivo(tr)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border cursor-pointer ${
                      tratamientoActivo?.id === tr.id
                        ? "bg-slate-900 text-white border-transparent shadow-md scale-105"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {tr.tipo === "Corporal" ? "🌿" : "✨"} {tr.nombre}
                  </button>
                ))}
              </div>

              {tratamientoActivo && (() => {
                const sesiones = sesionesPorTrat[tratamientoActivo.id] || [];
                const tratTipoStr = String(tratamientoActivo.tipo || '').toLowerCase();
                const tratNombreStr = String(tratamientoActivo.nombre || '').toLowerCase();
                const isFacialTrat = tratTipoStr === 'facial' ||
                                     tratTipoStr.includes('facial') ||
                                     tratNombreStr.includes('facial') ||
                                     tratNombreStr.includes('envejecimiento') ||
                                     tratNombreStr.includes('antiedad') ||
                                     tratNombreStr.includes('dermapen') ||
                                     tratNombreStr.includes('peeling') ||
                                     tratNombreStr.includes('limpieza') ||
                                     tratNombreStr.includes('hidra') ||
                                     tratNombreStr.includes('acné') ||
                                     tratNombreStr.includes('acne') ||
                                     tratNombreStr.includes('melasma') ||
                                     tratNombreStr.includes('botox') ||
                                     tratNombreStr.includes('arrugas');
                const isCorporal = !isFacialTrat;

                const chartData = isCorporal ? sesiones
                  .map((s, i) => ({
                    sesion: "#" + (i + 1),
                    peso: parseFloat(s.medidas?.peso) || null,
                    cintura: parseFloat(s.medidas?.cintura) || null,
                    abdomen: parseFloat(s.medidas?.abdomen) || null,
                    cadera: parseFloat(s.medidas?.cadera) || null,
                    brazo: parseFloat(s.medidas?.brazo) || null,
                    pierna: parseFloat(s.medidas?.pierna) || null
                  }))
                  .filter((s) => s.peso || s.cintura || s.abdomen || s.cadera || s.brazo || s.pierna) : [];

                const sesionesConFoto = sesiones.filter((s) => s.fotosSesion?.length > 0);
                const tieneFotosReales = sesionesConFoto.length >= 2;
                const primeraFoto = tieneFotosReales ? sesionesConFoto[0].fotosSesion[0].url : (sesionesConFoto[0]?.fotosSesion?.[0]?.url || null);
                const ultimaFoto = tieneFotosReales ? sesionesConFoto[sesionesConFoto.length - 1].fotosSesion[0].url : null;

                const fInfo = isFacialTrat ? resolverFaseRoadmap('facial') : resolverFaseRoadmap('corporal');
                const nombreFaseFacial = fInfo.fase === 1 ? 'Higiene & Desintoxicación Epidérmica'
                  : fInfo.fase === 2 ? 'Regeneración Celular & Colágeno'
                  : fInfo.fase === 3 ? 'Redensificación Tisular'
                  : 'Mantenimiento Preventivo';
                const nombreFaseCorporal = fInfo.fase === 1 ? 'Desintoxicación & Drenaje Tisular'
                  : fInfo.fase === 2 ? 'Reducción & Lipólisis Focalizada'
                  : fInfo.fase === 3 ? 'Moldeo & Drenaje Linfático'
                  : 'Tonificación & Mantenimiento';

                const tieneReduccionCorporal = isCorporal && sesiones.length >= 2 && (equivalenciasProgreso.diffPeso > 0 || equivalenciasProgreso.diffCintura > 0);

                return (
                  <div className="space-y-5">
                    {/* HERO CARD CLÍNICO DINÁMICO (DIFERENCIADO FACIAL VS CORPORAL) */}
                    {isFacialTrat ? (
                      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 rounded-3xl p-6 text-white border border-purple-500/30 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-purple-400" /> Protocolo Facial & Dermatológico Avanzado
                          </span>
                          <span className="text-xs font-bold text-gray-400">
                            {sesiones.length} {sesiones.length === 1 ? "sesión registrada" : "sesiones registradas"}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                            ✨ Evolución Cutánea: <span className="text-purple-300">{tratamientoActivo.nombre}</span>
                          </h3>
                          <p className="text-xs text-gray-300 mt-1">
                            Protocolo médico-estético enfocado en la bioestimulación celular, colágeno y tonicidad dérmica.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">Fase Biológica</p>
                            <p className="text-lg font-black text-white mt-1">Fase {fInfo.fase}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{nombreFaseFacial}</p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-pink-300">Salud Dérmica</p>
                            <p className="text-lg font-black text-white mt-1">{sesiones.length > 0 ? "En Evolución" : "Por Iniciar"}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {sesiones.length > 0 ? "Respuesta cutánea activa" : "Evaluación inicial programada"}
                            </p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Sesiones Cumplidas</p>
                            <p className="text-lg font-black text-white mt-1">
                              {sesiones.length} {tratamientoActivo.numSesionesTotal > 0 ? `/ ${tratamientoActivo.numSesionesTotal}` : "Visitas"}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Constancia en cabina</p>
                          </div>
                        </div>
                      </div>
                    ) : tieneReduccionCorporal ? (
                      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 rounded-3xl p-6 text-white border border-teal-500/20 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1.5">
                            <Trophy size={14} className="text-amber-400" /> Transformación Medida al Milímetro
                          </span>
                          <span className="text-xs font-bold text-gray-400">{sesiones.length} sesiones auditadas</span>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                          ?? Has reducido <span className="text-teal-300">{equivalenciasProgreso.diffPeso} kg</span> y{" "}
                          <span className="text-teal-300">{equivalenciasProgreso.diffCintura} cm de contorno</span> desde tu primera consulta.
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-300">Tallas de Ropa</p>
                            <p className="text-xl font-black text-white mt-1">-{equivalenciasProgreso.tallasAprox || 0} Talla(s)</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Ajuste holgado en tu guardarropa</p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Grasa Localizada</p>
                            <p className="text-xl font-black text-white mt-1">~{equivalenciasProgreso.bloquesGrasa || 0} Bloques</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Equivalente a paquetes de 250g movilizados</p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Racha de Constancia</p>
                            <p className="text-xl font-black text-white mt-1">{totalSesiones} Visitas</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Compromiso firme con tu salud</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 rounded-3xl p-6 text-white border border-teal-500/20 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1.5">
                            <Activity size={14} className="text-teal-400" /> Monitoreo y Evolución Corporal
                          </span>
                          <span className="text-xs font-bold text-gray-400">
                            {sesiones.length} {sesiones.length === 1 ? "sesión registrada" : "sesiones registradas"}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                            📍 Monitoreo Clínico: <span className="text-teal-300">{tratamientoActivo.nombre}</span>
                          </h3>
                          <p className="text-xs text-gray-300 mt-1">
                            Protocolo enfocado en lipólisis, drenaje linfático y tonicidad tisular registrado con precisión en cada sesión.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-300">Fase Corporal</p>
                            <p className="text-lg font-black text-white mt-1">Fase {fInfo.fase}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{nombreFaseCorporal}</p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Medición en Cabina</p>
                            <p className="text-lg font-black text-white mt-1">{sesiones.length > 0 ? "Métricas en Curso" : "Línea Base Lista"}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{sesiones.length > 0 ? "Seguimiento biométrico activo" : "Primera sesión de valoración"}</p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Sesiones Cumplidas</p>
                            <p className="text-lg font-black text-white mt-1">
                              {sesiones.length} {tratamientoActivo.numSesionesTotal > 0 ? `/ ${tratamientoActivo.numSesionesTotal}` : "Visitas"}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Constancia en cabina</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* COMPARATIVA VISUAL ANTES VS DESPUÉS (HONESTA Y CLÍNICA - SIN FOTOS FALSAS) */}
                    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            <Sliders size={16} className={isFacialTrat ? "text-purple-600" : "text-turquesa"} />
                            Comparativa Visual Clínica (Antes vs Después)
                          </h4>
                          <p className="text-xs text-gray-500 font-medium">
                            {tieneFotosReales
                              ? "Desliza con tu dedo o ratón horizontalmente para comparar"
                              : "Documentación fotográfica de tu evolución clínica en cabina"}
                          </p>
                        </div>
                        {tieneFotosReales ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                            Expediente Real
                          </span>
                        ) : sesionesConFoto.length === 1 ? (
                          <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                            1 Foto en Expediente
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-gray-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                            Pendiente de Cabina
                          </span>
                        )}
                      </div>

                      {tieneFotosReales ? (
                        <div className="max-w-xl mx-auto pt-2">
                          <BeforeAfterSlider
                            beforeUrl={primeraFoto}
                            afterUrl={ultimaFoto}
                            beforeLabel="Sesión 1 (Inicial)"
                            afterLabel={`Sesión #${sesionesConFoto.length} (Evolución)`}
                          />
                        </div>
                      ) : sesionesConFoto.length === 1 ? (
                        <div className="max-w-md mx-auto pt-2 text-center space-y-3">
                          <div 
                            className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-gray-100 group cursor-pointer"
                            onClick={() => setZoomFotoUrl(primeraFoto)}
                          >
                            <img src={primeraFoto} alt="Fotografía Inicial" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <span className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-amber-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-amber-500/30">
                              Fotografía Inicial (Línea Base)
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed px-4">
                            📸 Tu fotografía inicial está registrada en tu expediente. En tu siguiente sesión en cabina tu especialista tomará la foto de evolución y se activará automáticamente el slider interactivo táctil de Antes y Después.
                          </p>
                        </div>
                      ) : (
                        <div className="py-8 px-4 text-center bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 max-w-xl mx-auto space-y-3">
                          <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center ${isFacialTrat ? 'bg-purple-100 text-purple-600' : 'bg-teal-100 text-teal-600'}`}>
                            <Camera size={24} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-black text-gray-800 uppercase tracking-wider">
                              Fotografías Clínicas en Cabina
                            </p>
                            <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
                              Para garantizar un seguimiento médico-estético honesto y estandarizado, las fotos se capturan directamente en cabina por tu especialista bajo condiciones controladas de luz y ángulo. En cuanto registres tus primeras sesiones fotográficas, aquí podrás comparar interactivamente tu evolución Antes y Después.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    
{chartData.length > 0 && (
                      <Card className="shadow-lg p-5">
                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-3">Evolución de Medidas por Sesión</h4>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="sesion" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                              <Tooltip />
                              <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="#20b2aa" strokeWidth={3} dot={{ r: 4 }} />
                              <Line type="monotone" dataKey="cintura" name="Cintura (cm)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="abdomen" name="Abdomen (cm)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    )}

                    <div className="space-y-3 pt-2">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Historial Clínico de Sesiones</h4>
                      {sesiones.map((ses, idx) => (
                        <Card key={ses.id || idx} className="shadow-sm border-0 ring-1 ring-gray-100 p-4 relative overflow-hidden hover:shadow-md transition-all">
                          <div className={`absolute top-0 left-0 w-1.5 h-full ${isCorporal ? "bg-teal-500" : "bg-purple-500"}`} />
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white px-2.5 py-1 rounded-md">
                              SESIÓN #{sesiones.length - idx}
                            </span>
                            <span className="text-xs font-bold text-gray-500">
                              {new Date(ses.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          </div>

                          {ses.notas && (
                            <div className="mt-3 p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs text-gray-700 leading-relaxed">
                              <p className="text-[10px] font-black text-teal-800 uppercase tracking-wider mb-1">Notas de la Especialista:</p>
                              {ses.notas}
                            </div>
                          )}

                          {ses.fotosSesion?.length > 0 && (
                            <div className="mt-3 flex gap-2 flex-wrap">
                              {ses.fotosSesion.map((f, fi) => (
                                <button
                                  key={fi}
                                  type="button"
                                  onClick={() => setZoomFotoUrl(f.url)}
                                  className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 hover:scale-105 transition-transform cursor-pointer"
                                >
                                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* TAB CITAS */}


      {activeTab === "citas" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-base font-black text-gray-800 uppercase tracking-wider">Tus Citas en ALFRA</h3>
            <button
              onClick={() => setAutoAgendadoOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-turquesa hover:text-slate-950 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar size={14} /> Nueva Cita
            </button>
          </div>

          {loadingCitas ? (
            <p className="text-center text-gray-400 text-sm py-8">Cargando citas...</p>
          ) : citas.length === 0 ? (
            <Card className="text-center py-12">
              <Calendar size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 font-bold text-sm">Sin citas programadas</p>
              <button
                onClick={() => setAutoAgendadoOpen(true)}
                className="mt-3 px-4 py-2 bg-turquesa text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Agendar mi primera cita
              </button>
            </Card>
          ) : (
            citas.map((c, i) => (
              <Card key={i} className="shadow-sm hover:shadow-md transition-all p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-gray-800">{c.servicio || c.motivo || "Cita de Seguimiento"}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">📅 {c.fecha} · ⏰ {c.hora} · {c.especialistaNombre || 'Clínica ALFRA'}</p>
                  </div>
                  <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${
                    c.status === "Confirmada" ? "bg-emerald-100 text-emerald-800" : c.status === "Completada" ? "bg-teal-100 text-teal-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {c.status || "Pendiente"}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB ESTILO DE VIDA (TRACKER GPS + NUTRICIÓN) */}


      {activeTab === "expediente" && (
        <div className="space-y-5 animate-in fade-in pb-10">
          <Card className="shadow-xl border-0 ring-1 ring-turquesa/20 bg-gradient-to-b from-turquesa/5 to-white relative overflow-hidden">
            <div className="p-5 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-turquesa/10 flex items-center justify-center mb-2">
                <Footprints size={24} className="text-turquesa" />
              </div>
              <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight text-center">Rastreador GPS Deportivo</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center mb-4">50% Clínica · 50% Tu Compromiso en Casa</p>
              
              <div className="w-full bg-gray-900 rounded-3xl p-6 text-center shadow-inner relative overflow-hidden mb-4">
                <div className="absolute top-0 right-0 p-4 opacity-5"><MapPin size={100} className="text-white"/></div>
                <div className="relative z-10 flex justify-center items-end gap-2 mb-2">
                  <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{formatTime(trackTime)}</span>
                </div>
                <div className="relative z-10 flex justify-around mt-4 border-t border-gray-700/50 pt-4">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Distancia</p>
                    <p className="text-xl font-bold text-turquesa">{(trackDistance / 1000).toFixed(2)} <span className="text-xs">km</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Calorías Estimadas</p>
                    <p className="text-xl font-bold text-orange-400">{Math.floor(trackDistance * 0.05)} <span className="text-xs">kcal</span></p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                {!isTracking ? (
                  <button onClick={startTracking} className="flex-1 bg-turquesa text-white py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-turquesa/90 transition-all flex justify-center items-center gap-2 shadow-md cursor-pointer">
                    <Play fill="currentColor" size={16}/> Iniciar Caminata / Trote
                  </button>
                ) : (
                  <button onClick={stopTracking} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-600 transition-all flex justify-center items-center gap-2 shadow-md animate-pulse cursor-pointer">
                    <Square fill="currentColor" size={16}/> Terminar Rutina
                  </button>
                )}
              </div>
            </div>
            
            {historialEjercicio.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3">Tus últimas rutas registradas</p>
                <div className="space-y-2">
                  {historialEjercicio.map(rec => (
                    <div key={rec.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-turquesa/10 rounded-lg"><Navigation size={14} className="text-turquesa"/></div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">Caminata al aire libre</p>
                          <p className="text-[10px] text-gray-400">{new Date(rec.fecha).toLocaleDateString()} · {formatTime(rec.duracionSegundos)} min</p>
                        </div>
                      </div>
                      <span className="font-black text-turquesa">{(rec.distanciaMetros / 1000).toFixed(2)} km</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="shadow-sm">
            <h3 className="font-bold text-sm text-gray-700 mb-1">Diario de Alimentación</h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-3">Registra lo que consumes hoy</p>
            <div className="bg-turquesa/5 p-4 rounded-2xl border border-turquesa/10 flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-turquesa">Ingesta Calórica</span>
                <div className="flex items-end gap-2 text-gray-800">
                  <span className="text-3xl font-black leading-none">{caloriasHoy}</span>
                  <span className="text-sm font-bold opacity-60">/ {META_CALORIAS} kcal</span>
                </div>
              </div>
              <div className="w-14 h-14 rounded-full border-4 border-turquesa/20 flex items-center justify-center font-black text-xs text-turquesa" style={{ borderTopColor: "#20b2aa" }}>
                {Math.min(100, Math.round(caloriasHoy / META_CALORIAS * 100))}%
              </div>
            </div>

            
          {/* TARJETA ULTRA HD DE NUTRICIÓN INTELIGENTE (EXPLICACIÓN SIMPLE Y CLARA ORIENTADA A RESULTADOS) */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 shadow-2xl border-2 border-teal-500/30 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0 shadow-inner">
                  <Activity size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/30">
                      Nutrición Inteligente ALFRA
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                      diagnosticoMetabolico.esPrescripcionManual 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {diagnosticoMetabolico.esPrescripcionManual ? '📋 Recomendación de tu Especialista' : '✨ Calculado para tu Cuerpo'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">Tus Calorías y Nutrientes para Ver Resultados</h3>
                  <p className="text-xs text-teal-200/80 font-medium">La cantidad exacta que necesitas comer para quemar la grasa trabajada en cabina y mantener tu piel firme</p>
                </div>
              </div>
              <div className="bg-teal-500/10 border border-teal-400/30 rounded-2xl px-4 py-2 text-center sm:text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">Meta Diaria</span>
                <p className="text-3xl font-black text-white tracking-tight">{META_CALORIAS} <span className="text-xs text-teal-300 font-bold">kcal/día</span></p>
              </div>
            </div>

            {!diagnosticoMetabolico.tieneDatos ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto text-teal-300">
                <Flame size={22} />
              </div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">Tu Plan Metabólico y Calórico Personalizado</h4>
              <p className="text-xs text-gray-300 max-w-md mx-auto leading-relaxed">
                Para calcular tu requerimiento energético exacto y asignarte una meta nutricional adaptada a tu cuerpo, tu especialista registrará tu peso, estatura y valoración corporal en cabina.
              </p>
            </div>
          ) : (
            <>
              {/* FÓRMULA CLÍNICA PASO A PASO EXPLICADA SIMPLE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">1. Lo que quemas en reposo</p>
                <p className="text-xl font-black text-teal-300 mt-1">{diagnosticoMetabolico.tmb} <span className="text-xs font-normal">kcal</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">Lo que tu cuerpo gasta en automático para vivir</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">2. Lo que quemas en tu día</p>
                <p className="text-xl font-black text-cyan-300 mt-1">{diagnosticoMetabolico.tdee} <span className="text-xs font-normal">kcal</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">Con tu movimiento diario ({diagnosticoMetabolico.nivelActividadTexto})</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">3. Tu meta para bajar tallas</p>
                <p className={`text-xl font-black mt-1 ${diagnosticoMetabolico.deficitKcal < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diagnosticoMetabolico.metaFinal} <span className="text-xs font-normal">kcal</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{diagnosticoMetabolico.objetivoClinico}</p>
              </div>
            </div>

            {/* EXPLICACIÓN SIMPLE ORIENTADA A RESULTADOS */}
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-100/90 leading-relaxed">
              <p className="font-black text-teal-300 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                <Sparkles size={13} /> ¿Por qué funciona esta meta para ti?
              </p>
              <p>{diagnosticoMetabolico.razonClinica}</p>
            </div>

            {/* DISTRIBUCIÓN DE NUTRIENTES */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Flame size={14} className="text-orange-400" /> Lo que tu cuerpo necesita al día
                </h4>
                <span className="text-[10px] font-bold text-gray-400">Para moldear tu figura</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Proteína */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-400">🥩 Proteína (Tu escudo)</span>
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md">{diagnosticoMetabolico.macros.proteina.gramos} g</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
                      <span>Hoy: {macrosHoy.proteina} g</span>
                      <span className="text-white font-black">Meta: {diagnosticoMetabolico.macros.proteina.gramos} g</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((macrosHoy.proteina / Math.max(1, diagnosticoMetabolico.macros.proteina.gramos)) * 100))}%` }}/>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">Pollo, pescado, huevo, queso panela. Clave para nutrir las fibras musculares y favorecer la tonicidad y elasticidad de tus tejidos.</p>
                </div>

                {/* Grasas Saludables */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-amber-300">🥑 Grasas Buenas (Piel suave)</span>
                    <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md">{diagnosticoMetabolico.macros.grasas.gramos} g</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
                      <span>Hoy: {macrosHoy.grasas} g</span>
                      <span className="text-white font-black">Meta: {diagnosticoMetabolico.macros.grasas.gramos} g</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((macrosHoy.grasas / Math.max(1, diagnosticoMetabolico.macros.grasas.gramos)) * 100))}%` }}/>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">Aguacate, almendras, aceite de oliva. Le dan brillo a tu piel y flexibilidad a tus tejidos.</p>
                </div>

                {/* Carbohidratos Complejos */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-cyan-300">🌾 Carbohidratos (Energía limpia)</span>
                    <span className="text-[10px] font-black bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md">{diagnosticoMetabolico.macros.carbs.gramos} g</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
                      <span>Hoy: {macrosHoy.carbs} g</span>
                      <span className="text-white font-black">Meta: {diagnosticoMetabolico.macros.carbs.gramos} g</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.round((macrosHoy.carbs / Math.max(1, diagnosticoMetabolico.macros.carbs.gramos)) * 100))}%` }}/>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">Avena, verduras, fruta, arroz. Energía para tu día a día sin distensión abdominal.</p>
                </div>
              </div>
            </div>
            </>
          )}
          </div>
{/* POINT 3: GRÁFICA DE CALORÍAS COMPLETA EN ESTILO DE VIDA */}
            <div className="mb-5 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-800">Historial de Calorías vs Meta Diaria (7 Días)</h4>
                  <p className="text-[10px] text-gray-400">Monitoreo continuo de ingesta energética para potenciar resultados clínicos</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-turquesa bg-turquesa/10 px-2.5 py-1 rounded-full border border-turquesa/20">
                    Meta: {META_CALORIAS} kcal
                  </span>
                  <span className="text-[11px] font-black text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                    Hoy: {caloriasHoy} kcal
                  </span>
                </div>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={caloriasChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="caloriasGradientExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#20B2AA" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#20B2AA" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} domain={[0, 'dataMax + 400']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "none", color: "#fff", fontSize: "11px", padding: "8px 12px" }}
                      formatter={(value, name) => [`${value} kcal`, name === "calorias" ? "Consumo" : "Meta"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calorias" 
                      stroke="#20B2AA" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#caloriasGradientExp)" 
                      name="calorias"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="meta" 
                      stroke="#F59E0B" 
                      strokeWidth={2} 
                      strokeDasharray="4 4" 
                      dot={false}
                      name="meta"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
<div className="relative mb-4">
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-turquesa outline-none shadow-sm"
                placeholder="Busca alimentos rápidos (Ej. Manzana, Pollo, Ensalada)..."
                value={buscarAlimento}
                onChange={e => setBuscarAlimento(e.target.value)}
              />
              {buscarAlimento.length > 0 && alimentosFiltrados.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl z-20 mt-2 max-h-48 overflow-y-auto">
                  {alimentosFiltrados.map(a => (
                    <div 
                      key={a.id} 
                      className="p-3 border-b border-gray-50 hover:bg-turquesa/5 flex justify-between items-center cursor-pointer" 
                      onClick={() => handleAddAlimento(a, searchQty)}
                    >
                      <div>
                        <span className="font-bold text-gray-800 text-sm">{searchQty > 1 ? `${searchQty}x ` : ''}{a.nombre}</span>
                        <span className="text-[10px] text-gray-400 font-bold block">{a.porcion}</span>
                      </div>
                      <span className="font-black text-turquesa text-sm">+{a.calorias * searchQty} kcal</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {alimentosHoy.length === 0 ? (
                <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No has registrado alimentos hoy</p>
                </div>
              ) : (
                alimentosHoy.map((a, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                    <div>
                      <span className="font-bold text-gray-800 text-sm">{a.nombre}</span>
                      <span className="text-[10px] text-gray-400 block mb-1">
                        {a.porcion} · {new Date(a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || Date.now())).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={(e) => { e.stopPropagation(); updateCantidad(i, -1); }} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-200 cursor-pointer">-</button>
                        <span className="text-xs font-black text-gray-700 w-4 text-center">{a.cantidad || 1}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateCantidad(i, 1); }} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-200 cursor-pointer">+</button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-black text-turquesa text-lg">+{a.calorias}</span>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">kcal</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB PAGOS */}


      {activeTab === "pagos" && (
        <div className="space-y-3 animate-in fade-in">
          <h3 className="text-base font-black text-gray-800 uppercase tracking-wider mb-2">Tus Recibos Digitales Oficiales</h3>
          {recibos.length === 0 ? (
            <Card className="text-center py-12">
              <Receipt size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm">Sin recibos registrados en tu cuenta</p>
            </Card>
          ) : (
            recibos.map((r, i) => (
              <Card key={i} onClick={() => setReciboVisualizar(r)} className="shadow-sm cursor-pointer hover:shadow-md hover:border-turquesa/50 transition-all active:scale-95 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{r.concepto || r.servicio || "Pago en Clínica"}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {r.fecha ? new Date(r.fecha.seconds ? r.fecha.seconds * 1000 : r.fecha).toLocaleDateString("es-MX") : "--"}
                    </p>
                  </div>
                  <span className="font-black text-turquesa text-base">
                    ${Number(r.total || r.monto || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-3 flex items-center gap-1">
                  <FileText size={10} className="text-turquesa" /> Toca para ver recibo con firma digital
                </p>
              </Card>
            ))
          )}
        </div>
      )}

      {/* MODAL RECIBO DIGITAL */}
      {reciboVisualizar && (
        <ReciboDigital 
          isOpen={!!reciboVisualizar} 
          onClose={() => setReciboVisualizar(null)} 
          datosRecibo={{
            folio: reciboVisualizar.id || 'N/A',
            fecha: reciboVisualizar.fecha ? new Date(reciboVisualizar.fecha.seconds ? reciboVisualizar.fecha.seconds * 1000 : reciboVisualizar.fecha).toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString(),
            pacienteNombre: perfilPaciente.nombre || 'Paciente',
            concepto: reciboVisualizar.concepto || reciboVisualizar.servicio || "Pago en Clínica",
            monto: Number(reciboVisualizar.total || reciboVisualizar.monto || 0),
            metodoPago: reciboVisualizar.metodoPago || "Efectivo",
            atiende: reciboVisualizar.atiende || "Clínica Alfra",
            sucursal: "Matriz"
          }}
        />
      )}

      {/* MEMBRESIA CON FLIP CARD (CON ID UNICO Y CODIGO DE BARRAS) */}
      {activeTab === "membresia" && membresiaObj && (
        <div className="space-y-4 animate-in fade-in">
          <div className="text-center space-y-1 mb-2">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Mi Membresía</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Credencial exclusiva y beneficios</p>
          </div>

          <style>{`
            .flip-card {
              background-color: transparent;
              perspective: 1200px;
              height: 230px;
              width: 100%;
              max-width: 480px;
              margin: 0 auto;
            }
            .flip-card-inner {
              position: relative;
              width: 100%;
              height: 100%;
              transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
              transform-style: preserve-3d;
              -webkit-transform-style: preserve-3d;
            }
            .flip-card.flipped .flip-card-inner {
              transform: rotateY(180deg);
            }
            .flip-card-front, .flip-card-back {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              -webkit-backface-visibility: hidden !important;
              backface-visibility: hidden !important;
              border-radius: 24px;
              overflow: hidden;
            }
            .flip-card-front {
              transform: rotateY(0deg);
              z-index: 2;
            }
            .flip-card-back {
              transform: rotateY(180deg);
              z-index: 1;
            }
            .flip-card.flipped .flip-card-front {
              opacity: 0;
              pointer-events: none;
              visibility: hidden;
              transition: opacity 0.2s 0.2s, visibility 0.2s 0.2s;
            }
            .flip-card.flipped .flip-card-back {
              z-index: 3;
            }
          `}</style>

          <div className={`flip-card ${flipped ? "flipped" : ""}`}>
            <div className="flip-card-inner">
              {/* FRENTE */}
              <div className={`flip-card-front bg-white border-2 flex h-full ${
                membresiaObj.nivel === "Platinum" ? "border-gray-800" :
                membresiaObj.nivel === "Oro" ? "border-amber-400" :
                membresiaObj.nivel === "Plata" ? "border-gray-300" : "border-orange-400"
              }`}>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(105deg, transparent 55%, ${
                      membresiaObj.nivel === "Platinum" ? "rgba(0,0,0,0.05)" :
                      membresiaObj.nivel === "Oro" ? "rgba(251,191,36,0.05)" :
                      membresiaObj.nivel === "Plata" ? "rgba(156,163,175,0.05)" : "rgba(249,115,22,0.05)"
                    } 55%)`
                  }}
                />
                <div className="flex flex-col items-center justify-center px-3 gap-1.5" style={{ width: "32%", borderRight: "1px solid rgba(0,0,0,0.05)" }}>
                  <div className="relative">
                    <div
                      className="absolute -inset-[2.5px] rounded-2xl"
                      style={{
                        background: membresiaObj.nivel === "Platinum" ? "linear-gradient(135deg,#000,#4b5563)" :
                                    membresiaObj.nivel === "Oro" ? "linear-gradient(135deg,#fbbf24,#d97706)" :
                                    membresiaObj.nivel === "Plata" ? "linear-gradient(135deg,#9ca3af,#4b5563)" : "linear-gradient(135deg,#f97316,#c2410c)"
                      }}
                    />
                    {perfilPaciente.fotoUrl ? (
                      <img src={perfilPaciente.fotoUrl} alt={perfilPaciente.nombre} className="relative object-cover border-2 border-white shadow-lg rounded-2xl" style={{ width: "100px", height: "120px" }} />
                    ) : (
                      <div className="relative border-2 border-white shadow-lg rounded-2xl flex items-center justify-center bg-gray-200" style={{ width: "100px", height: "120px" }}>
                        <User size={40} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">Paciente</p>
                  <p className="text-xs font-black text-gray-800 text-center leading-tight line-clamp-2">{perfilPaciente.nombre}</p>
                </div>

                <div className="flex-1 flex flex-col justify-between p-3.5 relative z-10">
                  <div className="flex items-start justify-between">
                    <img src="/logo.png" alt="ALFRA" className="h-12 object-contain" />
                    <span className="text-[8px] font-black uppercase tracking-[0.15em] bg-gradient-to-r from-gray-800 to-black text-white px-3 py-1 rounded-bl-2xl rounded-tr-2xl flex items-center gap-1 shadow-xs">
                      <Crown size={10} /> Miembro
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Crown size={14} className="text-yellow-400" />
                      <p
                        className="text-sm font-black uppercase tracking-wider"
                        style={{
                          color: membresiaObj.nivel === "Platinum" ? "#1f2937" :
                                 membresiaObj.nivel === "Oro" ? "#d97706" :
                                 membresiaObj.nivel === "Plata" ? "#6b7280" : "#ea580c"
                        }}
                      >
                        Membresía {membresiaObj.nivel}
                      </p>
                    </div>
                    <p className="text-[9px] text-gray-500">¡Disfruta de tus beneficios exclusivos! 🌟</p>
                    <p className="text-[9px] text-gray-400 italic">Eres nuestro paciente VIP</p>
                  </div>

                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-3.5 py-2 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Horas Disponibles</p>
                      <p className="text-lg font-black">{membresiaObj.horas || 0} <span className="text-xs font-medium opacity-60">hrs</span></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFlipped(true)}
                      className="bg-white/10 hover:bg-white/25 active:scale-95 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow cursor-pointer"
                      title="Ver reverso con código de barras"
                    >
                      <RotateCw size={12} />
                      <span>Ver Código</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* REVERSO: ID ÚNICO Y CÓDIGO DE BARRAS (TOTALMENTE INDEPENDIENTE) */}
              <div
                className={`flip-card-back bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white border-2 flex flex-col justify-between p-4 shadow-2xl relative ${
                  membresiaObj.nivel === "Platinum" ? "border-cyan-400/50" :
                  membresiaObj.nivel === "Oro" ? "border-amber-400/50" :
                  membresiaObj.nivel === "Plata" ? "border-slate-300/50" : "border-orange-400/50"
                }`}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Crown size={14} className="text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-200">
                      Credencial Digital VIP • ALFRA
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-turquesa border border-turquesa/30">
                    ID: {membresiaObj.codigo}
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner my-auto">
                  <Barcode39 value={membresiaObj.codigo} width={260} height={54} />
                  <p className="text-[11px] font-mono font-black text-gray-900 tracking-[0.25em] mt-1 uppercase">
                    {membresiaObj.codigo}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <p className="text-[8px] text-gray-400 tracking-wide font-medium leading-tight max-w-[280px]">
                    ID único e intransferible. Presenta este código en recepción para tus sesiones y beneficios VIP.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFlipped(false)}
                    className="bg-turquesa hover:bg-turquesa/80 active:scale-95 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-md cursor-pointer"
                    title="Volver al frente"
                  >
                    <RotateCw size={12} />
                    <span>Frente</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Beneficios */}
          <Card className="shadow-sm">
            <h3 className="text-base font-black text-gray-800 uppercase mb-3 flex items-center gap-2">
              <Crown size={18} className="text-turquesa" />
              Beneficios de tu Nivel {membresiaObj.nivel}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {(beneficiosPorNivel[membresiaObj.nivel] || []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No hay beneficios específicos registrados para este nivel.</p>
              ) : (
                (beneficiosPorNivel[membresiaObj.nivel] || []).map((b, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
                    <span className="text-turquesa text-xl">✨</span>
                    <p className="text-sm font-black text-gray-800">{b}</p>
                  </div>
                ))
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-4 text-center">
              Recarga más horas para subir de nivel
            </p>
          </Card>

          {/* Historial de Consumos */}
          <Card className="shadow-sm">
            <h3 className="text-base font-black text-gray-800 uppercase mb-3 flex items-center gap-2">
              <Zap size={18} className="text-turquesa" />
              Historial de Consumos
            </h3>
            {loadingConsumos ? (
              <p className="text-gray-400 text-sm text-center">Cargando...</p>
            ) : consumos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No has realizado consumos aún.</p>
            ) : (
              <div className="space-y-2">
                {consumos.map((c, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-bold text-sm text-gray-800">{c.servicio || c.concepto || "Consumo"}</p>
                      <p className="text-[10px] text-gray-400">
                        {c.fecha?.toDate ? c.fecha.toDate().toLocaleDateString("es-MX") : c.fecha ? new Date(c.fecha).toLocaleDateString("es-MX") : "--"}
                      </p>
                    </div>
                    <span className="font-black text-turquesa text-sm">{c.horas || 0} hrs</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "config" && (
        <div className="space-y-4 animate-in fade-in">
          <Card className="shadow-sm">
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-turquesa/30 shadow-lg cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {perfilPaciente.fotoUrl ? <img src={perfilPaciente.fotoUrl} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full bg-gray-100 flex items-center justify-center"><Camera size={24} className="text-gray-400"/></div>}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-turquesa font-bold cursor-pointer">Cambiar foto de perfil</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nombre Completo</label>
                <input type="text" value={perfilPaciente.nombre} onChange={e => setPerfilPaciente(p => ({ ...p, nombre: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-turquesa/20 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha de Nacimiento</label>
                <input type="date" value={perfilPaciente.fechaNacimiento} onChange={e => setPerfilPaciente(p => ({ ...p, fechaNacimiento: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-turquesa/20 outline-none" />
              </div>
              <Button variant="primary" fullWidth onClick={handleSaveProfile}>Guardar Cambios</Button>
            </div>
          </Card>
          <Card className="shadow-sm">
            <h3 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2"><Lock size={16}/> Seguridad de tu Cuenta</h3>
            <p className="text-xs text-gray-500 mb-3">Recibe un correo seguro para restablecer o cambiar tu contraseña.</p>
            {resetSent ? (
              <p className="text-xs text-emerald-600 font-bold">✓ Correo enviado con éxito. Revisa tu bandeja de entrada.</p>
            ) : (
              <Button variant="outline" fullWidth onClick={handleResetEmail} disabled={sendingReset}>
                {sendingReset ? "Enviando..." : "Restablecer Contraseña por Correo"}
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* MODAL AUTO-AGENDADO INTELIGENTE */}
      <AutoAgendadoModal
        isOpen={autoAgendadoOpen}
        onClose={() => setAutoAgendadoOpen(false)}
        paciente={{ ...perfilPaciente, id: pacienteDocId || perfilPaciente?.id, medicoTratanteId: perfilPaciente?.medicoTratanteId, medicoTratante: perfilPaciente?.medicoTratante }}
        onAgendado={() => {
          setAutoAgendadoOpen(false);
          alert("¡Tu cita ha sido agendada con éxito! Aparece ya en tu listado.");
        }}
      />

      {/* MODAL ZOOM DE FOTO DE EVOLUCIÓN */}
      {zoomFotoUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setZoomFotoUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img src={zoomFotoUrl} alt="Foto Ampliada" className="rounded-2xl max-w-full max-h-[85vh] object-contain shadow-2xl border border-white/20" />
            <button
              onClick={() => setZoomFotoUrl(null)}
              className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

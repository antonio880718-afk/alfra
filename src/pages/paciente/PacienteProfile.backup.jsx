import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import ReciboDigital from "../../components/ui/ReciboDigital";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from "recharts";
import {   Calendar, Activity, User, Lock, Gift, Camera, Bell, FileText, Receipt, CheckCircle, Mail, Crown, Heart, Stethoscope, Sparkles, ChevronRight, Zap, RefreshCw, Search, RotateCw , Flame, Award, Target, MapPin, Play, Square, Timer, Navigation, Footprints, Trophy, ShieldCheck , Star } from 'lucide-react';
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { db } from "../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { getPacienteByUid } from "../../services/pacientesService";
import { getSeguimientosPaciente, getApoyoEnCasa, getDailyTrackers, saveDailyTracker } from "../../services/seguimientoService";
import { getRecibosPaciente } from "../../services/recibosService";
import { getCitasByPaciente, onCitasPacienteChange } from "../../services/citasService";
import { getTratamientosPaciente, getSesionesPaciente, MEDIDAS_CORPORALES } from "../../services/tratamientosService";
import Barcode39 from "../../components/ui/Barcode39";

const auth = getAuth();
const getMembresiaObj = (m) => { if (!m) return null; if (typeof m === "object" && m.nivel) return m; return null; };

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
  const [perfilPaciente, setPerfilPaciente] = useState({ nombre:"...cargando...", telefono:"", fechaNacimiento:"", fotoUrl:null, tipoTratamiento:"Mixto", membresia: null, sellosLealtad:0, recompensasDisponibles:0, primerSelloFecha: null, fechaRegistro:null, recompensaElegida: null, lealtadActiva:true });
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
  const handleFotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const localUrl = URL.createObjectURL(file);
      setPerfilPaciente(prev => ({...prev, fotoUrl: localUrl}));
      alert("¡Foto de perfil actualizada exitosamente!");
    } catch(err) {
      console.error(err);
      alert("Error al actualizar la foto.");
    }
  };

  // Nutricion
  const [caloriasData, setCaloriasData] = useState([]);
  const [alimentosHoy, setAlimentosHoy] = useState([]);
  const [apoyoCompletadoHoy, setApoyoCompletadoHoy] = useState({});
  const [buscarAlimento, setBuscarAlimento] = useState("");

  const [isTracking, setIsTracking] = useState(false);
  const [trackTime, setTrackTime] = useState(0);
  const [trackDistance, setTrackDistance] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [lastPos, setLastPos] = useState(null);
  const [historialEjercicio, setHistorialEjercicio] = useState([]);

  useEffect(() => {
    let interval;
    if (isTracking) {
      interval = setInterval(() => { setTrackTime(t => t + 1); }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  const loadHistorialEjercicio = async (pid) => {
    if (!pid) return;
    try {
        const trackers = await getDailyTrackers(pid, 30);
        const ejercicios = trackers
            .filter(t => t.tipo === "ejercicio")
            .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
            .map(t => ({
                id: t.id || Date.now(),
                fecha: new Date(t.fecha + "T00:00:00"),
                duracionSegundos: t.data?.duracionSegundos || 0,
                distanciaMetros: t.data?.distanciaMetros || 0
            }));
        setHistorialEjercicio(ejercicios);
    } catch(e) { console.log("Error cargando historial ejercicio:", e); }
  };

  const wakeLockRef = React.useRef(null);
  const startTracking = async () => {
    if (!navigator.geolocation) return alert("Tu navegador no soporta GPS");
    setIsTracking(true);
    setTrackTime(0);
    setTrackDistance(0);
    setLastPos(null);
    // Mantener pantalla encendida
    try {
        if ('wakeLock' in navigator) {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
    } catch(e) { console.log('Wake Lock no disponible:', e); }
    const id = navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        // Filtrar lecturas imprecisas (>30m de error)
        if (accuracy > 30) return;
        setLastPos(prev => {
            if (prev) {
                const R = 6371e3;
                const lat1 = prev.latitude * Math.PI/180;
                const lat2 = latitude * Math.PI/180;
                const deltaLat = (latitude-prev.latitude) * Math.PI/180;
                const deltaLon = (longitude-prev.longitude) * Math.PI/180;
                const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                          Math.cos(lat1) * Math.cos(lat2) *
                          Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const d = R * c;
                // Filtrar saltos GPS irreales (>50 km/h = ~14 m/s)
                if (d < 50) {
                    setTrackDistance(td => td + d);
                }
            }
            return { latitude, longitude };
        });
    }, (err) => {
        console.error("GPS Error:", err);
        if (err.code === 1) {
            alert("Por favor permite el acceso a tu ubicación para rastrear tu distancia real.");
        }
    }, { enableHighAccuracy: true, maximumAge: 0 });
    setWatchId(id);
  };

  const stopTracking = async () => {
    setIsTracking(false);
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    // Liberar Wake Lock
    try { if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; } } catch(e) {}
    
    if (trackTime > 0) {
        const newRecord = {
            id: Date.now(),
            fecha: new Date(),
            duracionSegundos: trackTime,
            distanciaMetros: trackDistance
        };
        setHistorialEjercicio([newRecord, ...historialEjercicio]);
        // Guardar en Firebase
        if (pacienteDocId) {
            try {
                await saveDailyTracker(pacienteDocId, "ejercicio", {
                    duracionSegundos: trackTime,
                    distanciaMetros: trackDistance,
                    caloriasQuemadas: Math.floor(trackDistance * 0.05),
                    hora: new Date().toLocaleTimeString("es-MX", {hour:"2-digit", minute:"2-digit"})
                });
            } catch(e) { console.error("Error guardando ejercicio:", e); }
        }
        alert("¡Rutina de ejercicio guardada en tu expediente!");
        setTrackTime(0);
        setTrackDistance(0);
    }
  };
  
  const formatTime = (sec) => {
    const m = Math.floor(sec/60).toString().padStart(2, '0');
    const s = (sec%60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const META_CALORIAS = React.useMemo(() => {
    let meta = parseInt(perfilPaciente?.metaCalorica);
    if (tratamientoActivo && sesionesPorTrat[tratamientoActivo.id]) {
      const sesiones = sesionesPorTrat[tratamientoActivo.id];
      if (sesiones.length > 0) {
        // Buscar la meta de la sesión más reciente
        const ultimaSesion = sesiones[sesiones.length - 1];
        if (ultimaSesion.metasPaciente?.metaCalorica) {
            meta = parseInt(ultimaSesion.metasPaciente.metaCalorica);
        }
      }
    }
    return meta || 1500;
  }, [perfilPaciente, tratamientoActivo, sesionesPorTrat]);
  const caloriasHoy = alimentosHoy.reduce((s,a) => s + a.calorias, 0);
  const caloriasDataTratamiento = React.useMemo(() => {
    if (!tratamientoActivo || (!tratamientoActivo.creadoEn && !tratamientoActivo.fechaInicio && !tratamientoActivo.createdAt)) return caloriasData;
    let fechaBase = tratamientoActivo.creadoEn || tratamientoActivo.fechaInicio || tratamientoActivo.createdAt;
    let inicioTrat = fechaBase.seconds ? new Date(fechaBase.seconds * 1000) : new Date(fechaBase);
    inicioTrat.setHours(0,0,0,0);
    const filtered = caloriasData.filter(d => {
        if (!d.fechaOriginal) return true;
        const tDate = new Date(d.fechaOriginal + 'T12:00:00');
        return tDate >= inicioTrat;
    });
    
    // Si no hay datos, agregar un punto de hoy para que la gráfica se dibuje
    if (filtered.length === 0) {
        const today = new Date();
        const label = today.toLocaleDateString("es-MX",{month:"short",day:"numeric"});
        return [{ fecha: label, calorias: 0, fechaOriginal: today.toISOString().split('T')[0] }];
    }
    return filtered;
  }, [caloriasData, tratamientoActivo]);

  // Flip card
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (!userAuth) return;
    let unsubCitas = null;
    const load = async () => {
      try {
        const paciente = await getPacienteByUid(userAuth.uid, userAuth.email);
        if (paciente) {
          setPacienteDocId(paciente.id);
          setPerfilPaciente({
            nombre: paciente.nombre || userAuth.displayName || userAuth.email?.split('@')[0] || "Paciente",
            telefono: paciente.telefono || paciente.phone || "",
            fechaNacimiento: paciente.fechaNacimiento || "",
            fotoUrl: paciente.fotoUrl || null,
            tipoTratamiento: paciente.tipoTratamiento || "Mixto",
            membresia: paciente.membresia || null,
            sellosLealtad: paciente.sellosLealtad || 0,
            recompensasDisponibles: paciente.recompensasDisponibles || 0,
            primerSelloFecha: paciente.primerSelloFecha || null,
            fechaRegistro: paciente.fechaRegistro || paciente.createdAt || null,
            recompensaElegida: paciente.recompensaElegida || null,
            lealtadActiva: paciente.lealtadActiva !== false,
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

          // 4. Apoyo en casa / Cuidados
          try {
            const tr = await getTratamientosPaciente(paciente.id);
            let mergedCuidados = [];
            for (const act of (tr || [])) {
              const actCuidados = await getApoyoEnCasa(act.id);
              if (actCuidados && actCuidados.length > 0) {
                mergedCuidados = [...mergedCuidados, ...actCuidados];
              }
            }
            const uniqueCuidados = Array.from(new Map(mergedCuidados.map(item => [item.texto || item.id, item])).values());
            setApoyoCuidados(uniqueCuidados);
          } catch(e) { console.warn("Aviso apoyo:", e); }
          setApoyoLoading(false);

          // 5. Tratamientos y Sesiones v2
          try {
            const trats = await getTratamientosPaciente(paciente.id);
            setTratamientos(trats || []);
            if (trats && trats.length > 0) setTratamientoActivo(trats[0]);
            const sesAll = await getSesionesPaciente(paciente.id);
            const byTrat = {};
            (sesAll || []).forEach(s => {
              if (!byTrat[s.tratamientoId]) byTrat[s.tratamientoId] = [];
              byTrat[s.tratamientoId].push(s);
            });
            setSesionesPorTrat(byTrat);
          } catch(err) { console.warn("Aviso tratamientos:", err); }
          setLoadingTrat(false);

          // 6. Nutricion y Trackers
          try {
            const trackers = await getDailyTrackers(paciente.id, 100);
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
            const calData = (trackers || [])
              .filter(t => t.tipo === "alimentacion")
              .sort((a,b) => new Date(a.fecha) - new Date(b.fecha))
              .map(t => ({
                fecha: new Date(t.fecha+"T00:00:00").toLocaleDateString("es-MX",{month:"short",day:"numeric"}),
                calorias: t.data?.totalCalorias || 0,
                fechaOriginal: t.fecha
              }));
            setCaloriasData(calData);
            const todayTracker = (trackers || []).find(t => t.tipo === "alimentacion" && t.fecha === todayStr);
            if (todayTracker?.data?.alimentos) setAlimentosHoy(todayTracker.data.alimentos);
            const apoyoTracker = (trackers || []).find(t => t.tipo === "apoyo" && t.fecha === todayStr);
            if (apoyoTracker?.data) setApoyoCompletadoHoy(apoyoTracker.data);
          } catch(err) { console.warn("Aviso nutricion:", err); }

          // 7. Historial de ejercicio
          try {
            await loadHistorialEjercicio(paciente.id);
          } catch(e) { console.warn("Aviso ejercicio:", e); }

          // 8. Membresia consumos
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
          // Si paciente no se pudo resolver, inicializar con datos de usuario
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
    return () => { if (unsubCitas) unsubCitas(); };
  }, [userAuth?.uid]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file||!pacienteDocId) return;
    try { const { getStorage, ref, uploadBytes:ub, getDownloadURL:gdl } = await import("firebase/storage"); const storage=getStorage(); const sr=ref(storage,`pacientes/${pacienteDocId}/foto_perfil`); await ub(sr,file); const url=await gdl(sr); await updateDoc(doc(db,"pacientes",pacienteDocId),{fotoUrl:url}); setPerfilPaciente(p=>({...p,fotoUrl:url})); } catch(err) { console.error(err); }
  };
  const handleSaveProfile = async () => { if (!pacienteDocId) return; try { await updateDoc(doc(db,"pacientes",pacienteDocId),{nombre:perfilPaciente.nombre,fechaNacimiento:perfilPaciente.fechaNacimiento}); alert("Perfil guardado."); } catch(err) { console.error(err); } };
  const handleResetEmail = async () => { if (!auth.currentUser?.email) return; setSendingReset(true); try { await sendPasswordResetEmail(auth,auth.currentUser.email); setResetSent(true); } catch(err){console.error(err);} setSendingReset(false); };
  const handleElegirRecompensa = async (op) => { if (!pacienteDocId||guardandoEleccion) return; setGuardandoEleccion(true); try { await updateDoc(doc(db,"pacientes",pacienteDocId),{recompensaElegida:op,recompensasDisponibles:0}); setPerfilPaciente(p=>({...p,recompensaElegida:op,recompensasDisponibles:0})); setElegirRecompensa(false); } catch(err){console.error(err);} setGuardandoEleccion(false); };
  const handleToggleCuidado = async (cuidadoId) => { if (!pacienteDocId) return; const newVal = !apoyoCompletadoHoy[cuidadoId]; const newData = { ...apoyoCompletadoHoy, [cuidadoId]: newVal }; setApoyoCompletadoHoy(newData); try { await saveDailyTracker(pacienteDocId, "apoyo", newData); } catch (err) { console.error(err); } };
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
          setCaloriasData(prev => { const exists = prev.find(p => p.fecha === todayLabel); return exists ? prev.map(p => p.fecha === todayLabel ? {...p, calorias: total} : p) : [...prev, {fecha: todayLabel, calorias: total}]; });
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
        try { const total = newList.reduce((s,a) => s+a.calorias, 0); await saveDailyTracker(pacienteDocId, "alimentacion", { alimentos: newList, totalCalorias: total, metaCalorias: META_CALORIAS });
          const todayLabel = new Date().toLocaleDateString("es-MX",{month:"short",day:"numeric"});
          setCaloriasData(prev => { const exists = prev.find(p => p.fecha === todayLabel); return exists ? prev.map(p => p.fecha === todayLabel ? {...p, calorias: total} : p) : [...prev, {fecha: todayLabel, calorias: total}]; });
        } catch(err) { console.error(err); }
      }
    };

  const membresiaObj = getMembresiaObj(perfilPaciente.membresia);
  const tabs = [ {key:"progreso",label:"Resumen"},{key:"miprogreso",label:"Progreso"},{key:"citas",label:"Citas"},{key:"expediente",label:"Estilo de Vida"},{key:"pagos",label:"Pagos"}, ...(membresiaObj?.activa?[{key:"membresia",label:"Membresia"}]:[]), {key:"config",label:"Config"} ];
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
      "No cuentes los das, haz que los das cuenten para tu salud.",
      "Tu mente siempre cree lo que le dices, háblale de salud y energía.",
      "El cuerpo logra lo que la mente cree.",
      "Invertir en ti mismo es la mejor decisión financiera y de vida que harás."
    ];
    const diaDelMes = new Date().getDate() || 1;
    return frases[diaDelMes % frases.length] || frases[0];
  };

  return (
    <div className="space-y-4 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-turquesa rounded-b-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5"><Sparkles size={100}/></div>
        <div className="relative z-10 flex gap-4 items-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-turquesa/30 shadow-lg bg-gray-100 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => { const inp = document.getElementById("global-foto-upload"); if(inp) inp.click(); }}>
              {perfilPaciente.fotoUrl ? <img src={perfilPaciente.fotoUrl} alt="" className="w-full h-full object-cover"/> : <User size={32} className="text-gray-400"/>}
            </div>
            <button 
              className="absolute bottom-0 right-0 bg-emerald-400 text-white p-1.5 rounded-full shadow-md border-2 border-slate-800 hover:bg-emerald-500 transition-colors z-20"
              onClick={() => { const inp = document.getElementById("global-foto-upload"); if(inp) inp.click(); }}
              title="Cambiar foto de perfil"
            >
              <Camera size={12} fill="currentColor" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap"><h1 className="text-lg font-black text-white truncate">{perfilPaciente.nombre}</h1>{membresiaObj?.activa && <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-400 text-white px-2 py-0.5 rounded-full">Paciente Prime</span>}</div>
            <p className="text-white/60 text-xs mt-0.5">✨ {perfilPaciente.tipoTratamiento} • {perfilPaciente.telefono}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 px-1">{tabs.map(t=><button key={t.key} onClick={()=>setActiveTab(t.key)} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${activeTab===t.key?"bg-white text-gray-800 border-gray-200 shadow-md":"text-gray-400 border-gray-100 hover:bg-gray-50"}`}>{t.label}</button>)}</div>

                  {/* RESUMEN */}
      {activeTab==="progreso"&&(<div className="space-y-4 animate-in fade-in">
        <Card className="relative overflow-hidden border border-teal-500/30 bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 rounded-3xl shadow-lg group !p-0">
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-teal-300/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-teal-300/30 transition-colors duration-1000" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-emerald-400/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-teal-200/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
          
          <div className="relative z-10 p-6 sm:p-8 flex flex-row items-center justify-center min-h-[160px] gap-6 max-w-3xl mx-auto">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-white/20 shrink-0 rotate-[-10deg]">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <div className="relative flex-1">
                <p className="text-lg md:text-xl font-medium text-white/95 leading-relaxed text-left" style={{textWrap: "balance", textShadow: "0 2px 4px rgba(0,0,0,0.1)"}}>
                  "{getFraseDelDia()}"
                </p>
              </div>

            
          </div>
        </Card>

        {/* Próxima Cita */}
        {citas.length>0 && (()=>{
          const proxima = citas.filter(c=>c.status!=="Completada"&&c.status!=="Cancelada").sort((a,b)=>new Date(a.fecha)-new Date(b.fecha))[0];
          if(!proxima) return null;
          return <Card className="shadow-sm border-l-4 border-l-turquesa">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-turquesa/10 rounded-xl"><Calendar size={20} className="text-turquesa"/></div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-turquesa mb-0.5">Próxima Cita</p>
                <p className="font-bold text-sm text-gray-800">{proxima.servicio||proxima.motivo||"Cita programada"}</p>
                <p className="text-xs text-gray-500 mt-0.5">{proxima.fecha} • {proxima.hora}</p>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${proxima.status==="Confirmada"?"bg-green-50 text-green-600":"bg-blue-50 text-blue-600"}`}>{proxima.status||"Pendiente"}</span>
            </div>
          </Card>;
        })()}

        {/* Resumen Rápido */}
        <div className="grid grid-cols-2 gap-3">
          <Card onClick={() => setActiveTab("miprogreso")} className="shadow-sm text-center py-3 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 group">
            <Activity size={20} className="mx-auto text-turquesa mb-1 group-hover:scale-110 transition-transform"/>
            <p className="text-2xl font-black text-gray-800">{Object.values(sesionesPorTrat).reduce((acc, arr) => acc + arr.length, 0)}</p>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Visitas</p>
            </Card>
          <Card onClick={() => setActiveTab("citas")} className="shadow-sm text-center py-3 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 group">
            <Calendar size={20} className="mx-auto text-acero mb-1 group-hover:scale-110 transition-transform"/>
            <p className="text-2xl font-black text-gray-800">{citas.filter(c=>c.status!=="Completada"&&c.status!=="Cancelada").length}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Citas Pendientes</p>
          </Card>
          <Card onClick={() => setActiveTab("pagos")} className="shadow-sm text-center py-3 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 group">
            <Receipt size={20} className="mx-auto text-purple-500 mb-1 group-hover:scale-110 transition-transform"/>
            <p className="text-2xl font-black text-gray-800">{recibos.length}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Pagos</p>
          </Card>
          <Card onClick={() => setActiveTab("miprogreso")} className="shadow-sm text-center py-3 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all active:scale-95 group">
            <Stethoscope size={20} className="mx-auto text-cyan-600 mb-1 group-hover:scale-110 transition-transform"/>
            <p className="text-2xl font-black text-gray-800">{perfilPaciente.tipoTratamiento||"--"}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Tratamiento</p>
          </Card>
        </div>

        {/* Info de Registro */}
        {perfilPaciente.fechaRegistro && (
          <Card className="shadow-sm bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-xl"><Gift size={18} className="text-gray-500"/></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Paciente ALFRA desde</p>
                <p className="font-bold text-sm text-gray-700">{new Date(perfilPaciente.fechaRegistro.seconds ? perfilPaciente.fechaRegistro.seconds*1000 : perfilPaciente.fechaRegistro).toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
            </div>
          </Card>
        )}


        {/* ═══════ WIDGET MI DÍA - Calorías + Ejercicio ═══════ */}
        <Card className="shadow-lg border-0 ring-1 ring-turquesa/20 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-4 -m-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-turquesa/20 flex items-center justify-center">
                            <Zap size={16} className="text-turquesa" />
                        </div>
                        <div>
                            <h3 className="text-white font-black text-sm uppercase tracking-tight">Mi Día</h3>
                            <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest">Calorías + Actividad</p>
                        </div>
                    </div>
                    <button onClick={() => setActiveTab("expediente")} className="text-[9px] font-bold text-turquesa uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1">
                        Ver todo <ChevronRight size={12}/>
                    </button>
                </div>
            </div>

            {/* Fila de resumen rápido */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Calorías consumidas hoy */}
                <div className="bg-gradient-to-br from-turquesa/5 to-cyan-50 p-3 rounded-2xl border border-turquesa/10 relative overflow-hidden">
                    <div className="absolute -right-2 -top-2 opacity-5"><Flame size={60}/></div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-turquesa mb-1">Calorías Hoy</p>
                    <div className="flex items-end gap-1">
                        <span className="text-2xl font-black text-gray-800 leading-none">{caloriasHoy}</span>
                        <span className="text-[10px] font-bold text-gray-400 mb-0.5">/ {META_CALORIAS}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{
                            width: `${Math.min(100, Math.round(caloriasHoy/META_CALORIAS*100))}%`,
                            background: caloriasHoy > META_CALORIAS ? '#ef4444' : 'linear-gradient(90deg, #20b2aa, #06b6d4)'
                        }}/>
                    </div>
                    <p className="text-[9px] font-bold mt-1" style={{color: caloriasHoy > META_CALORIAS ? '#ef4444' : '#20b2aa'}}>
                        {caloriasHoy > META_CALORIAS ? `+${caloriasHoy - META_CALORIAS} exceso` : `Faltan ${META_CALORIAS - caloriasHoy} kcal`}
                    </p>
                </div>

                {/* Ejercicio hoy */}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-3 rounded-2xl border border-orange-100 relative overflow-hidden">
                    <div className="absolute -right-2 -top-2 opacity-5"><Footprints size={60}/></div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-1">Ejercicio</p>
                    {isTracking ? (
                        <div>
                            <div className="flex items-end gap-1">
                                <span className="text-2xl font-black text-gray-800 leading-none tabular-nums">{formatTime(trackTime)}</span>
                            </div>
                            <p className="text-[10px] font-bold text-turquesa mt-1">{(trackDistance / 1000).toFixed(2)} km recorridos</p>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[9px] font-bold text-green-600">GPS Activo</span>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-end gap-1">
                                <span className="text-2xl font-black text-gray-800 leading-none">{Math.floor((historialEjercicio[0]?.distanciaMetros || 0) / 1000 * 100) / 100}</span>
                                <span className="text-[10px] font-bold text-gray-400 mb-0.5">km últ.</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 mt-1">
                                {historialEjercicio.length > 0 ? `${historialEjercicio.length} sesiones` : 'Sin sesiones'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Acciones rápidas */}
            <div className="flex gap-2">
                <button onClick={() => setActiveTab("expediente")} className="flex-1 bg-turquesa/10 text-turquesa py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-turquesa hover:text-white transition-all flex items-center justify-center gap-1.5 border border-turquesa/20">
                    <Flame size={14}/> Registrar Comida
                </button>
                {!isTracking ? (
                    <button onClick={startTracking} className="flex-1 bg-orange-50 text-orange-500 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-1.5 border border-orange-200">
                        <Play fill="currentColor" size={12}/> Iniciar Ejercicio
                    </button>
                ) : (
                    <button onClick={stopTracking} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all flex items-center justify-center gap-1.5 animate-pulse shadow-md">
                        <Square fill="currentColor" size={12}/> Detener
                    </button>
                )}
            </div>
        </Card>

        {/* Tarjeta de Lealtad - foto llena todo el recuadro */}
        {perfilPaciente.lealtadActiva !== false && (
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
        )}

        {perfilPaciente.lealtadActiva !== false && (
          <Card className="shadow-sm bg-gradient-to-r from-turquesa to-cyan-500 text-white"><div className="flex items-center gap-3"><Heart size={24}/><div><h3 className="font-black uppercase tracking-wider text-sm">Aliada de tu propio Bienestar</h3><p className="text-white/80 text-xs">Has sellado el pacto ALFRA. Juntas crearemos magia.</p></div></div></Card>
        )}
  
        {/* Plan de Cuidados en Casa (Interactivo) */}
        <Card className="shadow-sm border-turquesa/20">
          <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><CheckCircle size={16} className="text-turquesa"/>Plan de Cuidados en Casa</h3>
          {apoyoLoading?<p className="text-gray-400 text-sm">Cargando...</p>:apoyoCuidados.length===0?<p className="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-xl">El especialista no ha asignado cuidados en casa.</p>:
          <div className="space-y-2">
            {apoyoCuidados.map((c,i)=>{
              const checked = !!apoyoCompletadoHoy[c.id];
              return (
                <button key={c.id || i} onClick={()=>handleToggleCuidado(c.id)} className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${checked ? 'border-turquesa bg-turquesa/5' : 'border-gray-100 bg-white hover:border-turquesa/30'}`}>
                  <div className="flex items-center gap-3 text-left">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-turquesa border-turquesa text-white' : 'border-gray-300'}`}>
                      {checked ? <CheckCircle size={14}/> : <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${checked ? 'text-turquesa line-through opacity-70' : 'text-gray-700'}`}>{c.texto || c.categoria || c.tipo || "Cuidado"}</p>
                      {c.instrucciones&&<p className="text-[10px] text-gray-500 mt-0.5">{c.instrucciones}</p>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>}
        </Card>

        {progresoData.length>0&&<Card className="shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-3">Peso (kg)</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={progresoData} margin={{top:5,right:20,left:-20,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><Tooltip/><Line type="monotone" dataKey="peso" stroke="#20b2aa" strokeWidth={3} dot={{r:4,fill:"#20b2aa"}}/></LineChart></ResponsiveContainer></div></Card>}
      </div>)}

      {/* PROGRESO - TRATAMIENTOS V2 */}
      {activeTab==="miprogreso"&&(<div className="space-y-4 animate-in fade-in pb-8">
        <div className="text-center space-y-1 mb-4">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Mi Progreso Clínico</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Historial detallado de tus tratamientos</p>
        </div>
        {loadingTrat?<div className="py-16 flex items-center justify-center gap-3 text-gray-300"><RefreshCw className="animate-spin" size={24}/><span className="text-sm font-bold">Cargando tu historial...</span></div>
        :tratamientos.length===0?<div className="py-16 text-center bg-white rounded-3xl border border-dashed border-gray-100"><Activity size={48} className="mx-auto text-gray-100 mb-4"/><p className="text-gray-400 font-black uppercase tracking-widest text-xs">Sin tratamientos registrados aún</p><p className="text-gray-300 text-[10px] mt-1">La especialista creará tu expediente en la próxima sesión.</p></div>
        :<>
          <div className="flex flex-wrap gap-2 justify-center mb-4">{tratamientos.map(tr=><button key={tr.id} onClick={()=>setTratamientoActivo(tr)} className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${tratamientoActivo?.id===tr.id?(tr.tipo==="Corporal"?"bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent shadow-md":"bg-gradient-to-r from-purple-500 to-purple-600 text-white border-transparent shadow-md"):"bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>{tr.tipo==="Corporal"?"🔥":"✨"} {tr.nombre}</button>)}</div>
          {tratamientoActivo&&(()=>{
            const sesiones = sesionesPorTrat[tratamientoActivo.id]||[];
            const isCorporal = tratamientoActivo.tipo==="Corporal";
                        const chartData = sesiones.map((s,i)=>({sesion:"#"+(i+1), peso:parseFloat(s.medidas?.peso)||null, cintura:parseFloat(s.medidas?.cintura)||null, abdomen:parseFloat(s.medidas?.abdomen)||null, cadera:parseFloat(s.medidas?.cadera)||null, brazo:parseFloat(s.medidas?.brazo)||null, pierna:parseFloat(s.medidas?.pierna)||null})).filter(s=>s.peso||s.cintura||s.abdomen||s.cadera||s.brazo||s.pierna);
            
            return <div className="space-y-4">
              
              {/* WIDGET DE VICTORIAS (Total Lost) EXACTO AL PLAN */}
              {sesiones.length >= 2 && chartData.length >= 2 && (()=>{
                  const primerPeso = chartData[0].peso;
                  const ultimoPeso = chartData[chartData.length - 1].peso;
                  const diffPeso = primerPeso && ultimoPeso ? (primerPeso - ultimoPeso).toFixed(1) : 0;
                  
                  const primeraCintura = chartData[0].cintura;
                  const ultimaCintura = chartData[chartData.length - 1].cintura;
                  const diffCintura = primeraCintura && ultimaCintura ? (primeraCintura - ultimaCintura).toFixed(1) : 0;
                  
                  const metaPeso = 10; // Meta mock de 10kg
                  const progresoMeta = Math.min(100, Math.max(0, (diffPeso / metaPeso) * 100));

                  if (true) {
                      return (
                          <Card className="shadow-xl bg-gradient-to-br from-gray-900 to-black border-0 py-6 px-5 flex flex-col relative overflow-hidden mb-4">
                              <div className="absolute top-0 right-0 opacity-10"><Flame size={120} className="text-orange-500"/></div>
                              
                              <h3 className="text-xl font-black text-white relative z-10 leading-tight mb-4">
                                  🔥 ¡Has bajado <span className="text-turquesa">{diffPeso} kg</span> y <span className="text-turquesa">{diffCintura} cm</span> en total desde el día uno!
                              </h3>
                              
                              <div className="relative z-10">
                                  <div className="flex justify-between items-end mb-1">
                                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Progreso a meta final (10 kg)</span>
                                      <span className="text-xs font-black text-turquesa">{progresoMeta.toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-800 rounded-full h-3">
                                      <div className="bg-gradient-to-r from-turquesa to-cyan-400 h-3 rounded-full transition-all duration-1000" style={{width: `${progresoMeta}%`}}></div>
                                  </div>
                              </div>
                          </Card>
                      );
                  }
                  return null;
              })()}

              {/* RECONOCIMIENTO DE RACHAS Y LOGROS */}
              {sesiones.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {/* RACHA DINÁMICA */}
                      {(()=>{
                          // Lógica para calcular racha real de semanas
                          let racha = 1;
                          const sorted = [...sesiones].sort((a,b)=>new Date(b.fecha) - new Date(a.fecha)); // más recientes primero
                          for (let i = 0; i < sorted.length - 1; i++) {
                              const f1 = new Date(sorted[i].fecha);
                              const f2 = new Date(sorted[i+1].fecha);
                              const diffTime = Math.abs(f1 - f2);
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              
                              if (diffDays <= 10) {
                                  racha++;
                              } else {
                                  break;
                              }
                          }
                          
                          if (racha >= 2) {
                              return (
                                  <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-orange-500/20 transform hover:-translate-y-1 transition-transform cursor-default">
                                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                          <Flame className="text-white animate-pulse" size={24} fill="currentColor" />
                                      </div>
                                      <div>
                                          <p className="text-white font-black text-lg leading-none uppercase tracking-tight mb-1">¡Racha de Fuego!</p>
                                          <p className="text-white/80 text-[11px] font-bold">Llevas {racha} sesiones continuas sin faltar.</p>
                                      </div>
                                  </div>
                              );
                          } else {
                              return (
                                  <div className="bg-gradient-to-r from-gray-400 to-gray-500 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-gray-500/20 transform hover:-translate-y-1 transition-transform cursor-default">
                                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                          <Flame className="text-white" size={24} />
                                      </div>
                                      <div>
                                          <p className="text-white font-black text-lg leading-none uppercase tracking-tight mb-1">¡Inicia tu Racha!</p>
                                          <p className="text-white/80 text-[11px] font-bold">Asiste a tu próxima sesión sin falta.</p>
                                      </div>
                                  </div>
                              );
                          }
                      })()}
                      
                      {/* LOGRO POR PÉRDIDA DINÁMICO */}
                      {(()=>{
                          const primerPeso = chartData[0]?.peso;
                          const ultimoPeso = chartData[chartData.length - 1]?.peso;
                          const diff = primerPeso && ultimoPeso ? (primerPeso - ultimoPeso) : 0;
                          
                          if (diff >= 10) {
                              return (
                                  <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-purple-500/20 transform hover:-translate-y-1 transition-transform cursor-default">
                                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                          <Crown className="text-white" size={24} fill="currentColor" />
                                      </div>
                                      <div>
                                          <p className="text-white font-black text-lg leading-none uppercase tracking-tight mb-1">¡Transformación!</p>
                                          <p className="text-white/80 text-[11px] font-bold">¡Impresionante! Has bajado {diff.toFixed(1)}kg.</p>
                                      </div>
                                  </div>
                              );
                          } else if (diff >= 5) {
                              return (
                                  <div className="bg-gradient-to-r from-emerald-400 to-green-600 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-green-500/20 transform hover:-translate-y-1 transition-transform cursor-default">
                                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                          <Star className="text-white" size={24} fill="currentColor" />
                                      </div>
                                      <div>
                                          <p className="text-white font-black text-lg leading-none uppercase tracking-tight mb-1">¡Imparable!</p>
                                          <p className="text-white/80 text-[11px] font-bold">Has superado la barrera de los 5kg.</p>
                                      </div>
                                  </div>
                              );
                          } else if (diff >= 2) {
                              return (
                                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-yellow-500/20 transform hover:-translate-y-1 transition-transform cursor-default">
                                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                          <Trophy className="text-white" size={24} fill="currentColor" />
                                      </div>
                                      <div>
                                          <p className="text-white font-black text-lg leading-none uppercase tracking-tight mb-1">¡Rompiendo Límites!</p>
                                          <p className="text-white/80 text-[11px] font-bold">Has bajado {diff.toFixed(1)}kg en total.</p>
                                      </div>
                                  </div>
                              );
                          } else if (diff > 0) {
                              return (
                                  <div className="bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-blue-500/20 transform hover:-translate-y-1 transition-transform cursor-default">
                                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                          <ShieldCheck className="text-white" size={24} fill="currentColor" />
                                      </div>
                                      <div>
                                          <p className="text-white font-black text-lg leading-none uppercase tracking-tight mb-1">¡Buen Comienzo!</p>
                                          <p className="text-white/80 text-[11px] font-bold">Tu cuerpo responde ({diff.toFixed(1)}kg menos).</p>
                                      </div>
                                  </div>
                              );
                          } else {
                              return (
                                  <div className="bg-gradient-to-r from-cyan-400 to-teal-500 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-cyan-500/20 transform hover:-translate-y-1 transition-transform cursor-default">
                                      <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                          <Heart className="text-white" size={24} fill="currentColor" />
                                      </div>
                                      <div>
                                          <p className="text-white font-black text-lg leading-none uppercase tracking-tight mb-1">¡Sigue Adelante!</p>
                                          <p className="text-white/80 text-[11px] font-bold">La constancia es la clave del éxito.</p>
                                      </div>
                                  </div>
                              );
                          }
                      })()}
                  </div>
              )}

              {/* ANTES Y DESPUÉS GALLERY */}
              {(()=>{
                  const sesionesConFoto = sesiones.filter(s => s.fotosSesion?.length > 0);
                  if (sesionesConFoto.length >= 2) {
                      const primera = sesionesConFoto[0];
                      const ultima = sesionesConFoto[sesionesConFoto.length - 1];
                      return (
                          <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white overflow-hidden mb-4 relative pl-8">
                              <div className="absolute top-0 left-0 bottom-0 w-8 bg-gray-900 flex items-center justify-center border-r border-gray-800">
                                  <span className="text-white text-[9px] font-black uppercase tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                      EL ESPEJO NO MIENTE
                                  </span>
                              </div>
                              <div className="p-4 bg-gray-50 flex gap-4 overflow-x-auto snap-x">
                                  <div className="snap-center min-w-[140px] flex flex-col items-center">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Día 1</p>
                                      <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-md ring-2 ring-gray-200">
                                          <img src={primera.fotosSesion[0].url} alt="Antes" className="w-full h-full object-cover grayscale opacity-80"/>
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-center text-turquesa animate-pulse">
                                      <ChevronRight size={32} />
                                  </div>
                                  <div className="snap-center min-w-[140px] flex flex-col items-center">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-turquesa mb-2">Hoy</p>
                                      <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-xl ring-4 ring-turquesa">
                                          <img src={ultima.fotosSesion[ultima.fotosSesion.length-1].url} alt="Después" className="w-full h-full object-cover"/>
                                      </div>
                                  </div>
                              </div>
                          </Card>
                      );
                  }
                  return null;
              })()}

              {/* GRÁFICA ORIGINAL DE EVOLUCIÓN DE MEDIDAS */}
              {chartData.length>=2 && <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white mb-4 relative pl-8">
                <div className="absolute top-0 left-0 bottom-0 w-8 bg-turquesa flex items-center justify-center">
                    <span className="text-white text-[9px] font-black uppercase tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        EVOLUCIÓN CORPORAL
                    </span>
                </div>
                <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center">
                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest flex items-center gap-1.5"><Activity size={14} className="text-turquesa"/> Histórico de Medidas</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Múltiples Indicadores</p>
                </div>
                <div className="h-56 p-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{top:25,right:15,left:-20,bottom:0}}>
                        <defs>
                            <linearGradient id="colorPesoTrat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#20b2aa" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#20b2aa" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCinturaTrat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorAbdomenTrat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCaderaTrat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorBrazoTrat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorPiernaTrat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                        <XAxis dataKey="sesion" fontSize={10} tickLine={false} axisLine={false} stroke="#9ca3af"/>
                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} fontSize={10} tickLine={false} axisLine={false} stroke="#9ca3af"/>
                        <Tooltip contentStyle={{borderRadius:12,border:"none",boxShadow:"0 10px 15px -3px rgba(0,0,0,0.1)",fontSize:11}}/>
                        
                        {chartData.some(d=>d.peso)&&<Area type="monotone" dataKey="peso" stroke="#20b2aa" fillOpacity={1} fill="url(#colorPesoTrat)" strokeWidth={3} dot={{r:4, fill:"#fff", stroke:"#20b2aa", strokeWidth:2}} activeDot={{r:6, fill:"#fff", stroke:"#20b2aa", strokeWidth:3}} name="Peso">
        <LabelList dataKey="peso" position="top" offset={10} fill="#20b2aa" fontSize={11} fontWeight="bold" formatter={(v) => v != null ? v : ''} />
    </Area>}
                        {chartData.some(d=>d.cintura)&&<Area type="monotone" dataKey="cintura" stroke="#6366f1" fillOpacity={1} fill="url(#colorCinturaTrat)" strokeWidth={3} dot={{r:4, fill:"#fff", stroke:"#6366f1", strokeWidth:2}} activeDot={{r:6, fill:"#fff", stroke:"#6366f1", strokeWidth:3}} name="Cintura">
        <LabelList dataKey="cintura" position="top" offset={10} fill="#6366f1" fontSize={11} fontWeight="bold" formatter={(v) => v != null ? v : ''} />
    </Area>}
                        {chartData.some(d=>d.abdomen)&&<Area type="monotone" dataKey="abdomen" stroke="#f59e0b" fillOpacity={1} fill="url(#colorAbdomenTrat)" strokeWidth={3} dot={{r:4, fill:"#fff", stroke:"#f59e0b", strokeWidth:2}} activeDot={{r:6, fill:"#fff", stroke:"#f59e0b", strokeWidth:3}} name="Abdomen">
        <LabelList dataKey="abdomen" position="top" offset={10} fill="#f59e0b" fontSize={11} fontWeight="bold" formatter={(v) => v != null ? v : ''} />
    </Area>}
                        {chartData.some(d=>d.cadera)&&<Area type="monotone" dataKey="cadera" stroke="#ec4899" fillOpacity={1} fill="url(#colorCaderaTrat)" strokeWidth={3} dot={{r:4, fill:"#fff", stroke:"#ec4899", strokeWidth:2}} activeDot={{r:6, fill:"#fff", stroke:"#ec4899", strokeWidth:3}} name="Cadera">
        <LabelList dataKey="cadera" position="top" offset={10} fill="#ec4899" fontSize={11} fontWeight="bold" formatter={(v) => v != null ? v : ''} />
    </Area>}
                        {chartData.some(d=>d.brazo)&&<Area type="monotone" dataKey="brazo" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorBrazoTrat)" strokeWidth={3} dot={{r:4, fill:"#fff", stroke:"#8b5cf6", strokeWidth:2}} activeDot={{r:6, fill:"#fff", stroke:"#8b5cf6", strokeWidth:3}} name="Brazo">
        <LabelList dataKey="brazo" position="top" offset={10} fill="#8b5cf6" fontSize={11} fontWeight="bold" formatter={(v) => v != null ? v : ''} />
    </Area>}
                        {chartData.some(d=>d.pierna)&&<Area type="monotone" dataKey="pierna" stroke="#10b981" fillOpacity={1} fill="url(#colorPiernaTrat)" strokeWidth={3} dot={{r:4, fill:"#fff", stroke:"#10b981", strokeWidth:2}} activeDot={{r:6, fill:"#fff", stroke:"#10b981", strokeWidth:3}} name="Pierna">
        <LabelList dataKey="pierna" position="top" offset={10} fill="#10b981" fontSize={11} fontWeight="bold" formatter={(v) => v != null ? v : ''} />
    </Area>}
                    </AreaChart>
                </ResponsiveContainer>
              </div></Card>}

              {/* GRÁFICA DE PÉRDIDA NETA (Desde 0 hacia abajo) */}
              {chartData.length>=2 && (()=>{
                  // Calculate net loss starting from 0 for each session
                  const primerPeso = chartData[0].peso;
                  const chartDataNeta = chartData.map(d => ({
                      ...d,
                      perdidaNeta: d.peso && primerPeso ? parseFloat((d.peso - primerPeso).toFixed(1)) : 0
                  }));

                  return <Card className="shadow-sm border-0 ring-1 ring-gray-100 bg-white mb-4 relative pl-8">
                    <div className="absolute top-0 left-0 bottom-0 w-8 bg-red-500 flex items-center justify-center">
                        <span className="text-white text-[9px] font-black uppercase tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                            PÉRDIDA NETA
                        </span>
                    </div>
                    <div className="h-56 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartDataNeta} margin={{top:25,right:15,left:-20,bottom:0}}>
                            <defs>
                                <linearGradient id="colorPerdidaNeta" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.6}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                            <XAxis dataKey="sesion" fontSize={10} tickLine={false} axisLine={false} stroke="#9ca3af"/>
                            {/* YAxis domain automatically handles negative values */}
                            <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#9ca3af" tickFormatter={(v) => `${v} kg`}/>
                            <Tooltip 
                                contentStyle={{borderRadius:12,border:"none",boxShadow:"0 10px 15px -3px rgba(0,0,0,0.1)",fontSize:11}}
                                formatter={(value) => [`${value} kg`, 'Pérdida']}
                            />
                            {/* Usamos el fill de color rojo/verde indicando bajada */}
                            <Area type="monotone" dataKey="perdidaNeta" stroke="#ef4444" fillOpacity={1} fill="url(#colorPerdidaNeta)" strokeWidth={3} dot={{r:4, fill:"#fff", stroke:"#ef4444", strokeWidth:2}} activeDot={{r:6, fill:"#fff", stroke:"#ef4444", strokeWidth:3}} name="Pérdida Neta">
        <LabelList dataKey="perdidaNeta" position="top" offset={10} fill="#ef4444" fontSize={11} fontWeight="bold" formatter={(v) => v != null ? v : ''} />
    </Area>
                        </AreaChart>
                    </ResponsiveContainer>
                  </div></Card>;
              })()}

              {/* DIARIO DE SESIONES CON FLECHAS */}
              {sesiones.length===0?<div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-100"><p className="text-gray-400 text-sm font-bold">No hay sesiones en este tratamiento aun.</p></div>
              :<div className="space-y-4">
                  <h3 className="font-black text-sm text-gray-800 uppercase tracking-tight mt-6 px-1 flex items-center gap-2"><Activity size={18} className="text-turquesa"/> Diario de Sesiones</h3>
                  {[...sesiones].reverse().map((ses,idx)=>{
                      const chronIndex = sesiones.length - 1 - idx;
                      const prevSes = chronIndex > 0 ? sesiones[chronIndex - 1] : null;
                      
                      const getDiffLabel = (key, unit) => {
                          if (!prevSes || !prevSes.medidas || !ses.medidas || !prevSes.medidas[key] || !ses.medidas[key]) return null;
                          const current = parseFloat(ses.medidas[key]);
                          const prev = parseFloat(prevSes.medidas[key]);
                          const diff = (current - prev).toFixed(1);
                          if (diff < 0) return <span className="text-green-600 font-black px-1.5 py-0.5 rounded-md bg-green-50 animate-pulse inline-flex items-center gap-1">(<Activity size={10}/> ↓ {Math.abs(diff)} {unit})</span>;
                          if (diff > 0) return <span className="text-red-500 font-bold px-1.5 py-0.5 rounded-md bg-red-50 inline-flex items-center gap-1">(↑ {diff} {unit})</span>;
                          return null;
                      };

                      return <Card key={ses.id} className="shadow-sm border-0 bg-white ring-1 ring-gray-100 overflow-hidden relative transition-all hover:shadow-md">
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${isCorporal?"bg-cyan-400":"bg-purple-400"}`}></div>
                    
                    <div className="pl-4 pr-1 py-1">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md ${isCorporal?"bg-cyan-50 text-cyan-600":"bg-purple-50 text-purple-600"}`}>SESIÓN #${sesiones.length-idx}</span>
                                <div>
                                    <p className="text-sm font-black text-gray-800">{new Date(ses.fecha).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}</p>
                                </div>
                            </div>
                            {ses.medidas?.peso&&<span className="text-xs font-black text-gray-800 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">Peso: {ses.medidas.peso} kg {getDiffLabel('peso', 'kg')}</span>}
                        </div>
                        
                        {ses.protocolo?.subtitulo&&<p className="text-[10px] text-gray-500 font-bold mt-3 uppercase tracking-wider">{ses.protocolo.subtitulo}</p>}
                        
                        {ses.medidas && Object.keys(ses.medidas).some(k=>k!=="imc"&&ses.medidas[k]) && <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-dashed border-gray-100">{MEDIDAS_CORPORALES.filter(m=>ses.medidas[m.key]).map(m=><span key={m.key} className="text-[10px] bg-gray-50 px-2 py-1.5 rounded-md font-bold text-gray-600 flex items-center gap-1 shadow-sm"><Activity size={10} className="text-gray-400"/> {m.label}: <span className="text-turquesa">{ses.medidas[m.key]} {m.unit}</span> {getDiffLabel(m.key, m.unit)}</span>)}{ses.medidas?.imc&&<span className={`text-[10px] px-2 py-1.5 rounded-md font-bold shadow-sm flex items-center gap-1 ${parseFloat(ses.medidas.imc)>25?"bg-red-50 text-red-600":"bg-green-50 text-green-600"}`}><Activity size={10}/> IMC: {ses.medidas.imc} {getDiffLabel('imc', '')}</span>}</div>}
                        
                        {ses.fotosSesion?.length>0&&<div className="mt-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Camera size={12} className="text-turquesa"/> Evidencia Gráfica</p>
                            <div className="flex gap-3 flex-wrap">{ses.fotosSesion.map((f,fi)=><a key={fi} href={f.url} target="_blank" rel="noreferrer" className="w-20 h-20 rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-105 border-2 border-white ring-1 ring-gray-200"><img src={f.url} alt="" className="w-full h-full object-cover"/></a>)}</div>
                        </div>}
                        
                        {ses.notas && (
                        <div className="mt-4 p-3.5 bg-gradient-to-r from-turquesa/5 to-cyan-50 rounded-xl border border-turquesa/10">
                            <p className="text-[9px] font-black text-turquesa uppercase tracking-widest mb-2 flex items-center gap-1.5"><Heart size={12}/> Recomendaciones del Especialista</p>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{ses.notas}</p>
                        </div>
                        )}
                    </div>
                </Card>})}</div>}
            </div>;
          })()}
        </>}
      </div>)}
{/* CITAS */}
      {activeTab==="citas"&&(<div className="space-y-3 animate-in fade-in">{loadingCitas?<p className="text-center text-gray-400 text-sm py-8">Cargando citas...</p>:citas.length===0?<Card className="text-center py-8"><p className="text-gray-400 text-sm">Sin citas programadas</p></Card>:citas.map((c,i)=><Card key={i} className="shadow-sm"><div className="flex justify-between items-start"><div><p className="font-bold text-sm text-gray-800">{c.servicio||c.motivo||"Cita"}</p><p className="text-xs text-gray-500 mt-1">{c.fecha} • {c.hora}</p></div><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.status==="Confirmada"?"bg-green-50 text-green-600":c.status==="Agendada"?"bg-blue-50 text-blue-600":"bg-yellow-50 text-yellow-600"}`}>{c.status||"Pendiente"}</span></div></Card>)}</div>)}

      {activeTab==="expediente"&&(<div className="space-y-4 animate-in fade-in pb-10">
        
        {/* TRACKER DE EJERCICIO */}
        <Card className="shadow-lg border-0 ring-1 ring-turquesa/20 bg-gradient-to-b from-turquesa/5 to-white relative overflow-hidden">
            <div className="p-4 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-turquesa/10 flex items-center justify-center mb-3">
                    <Footprints size={24} className="text-turquesa" />
                </div>
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight text-center">Rastreador GPS</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center mb-4">50% Clínica / 50% Tu Esfuerzo</p>
                
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
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Calorías Quemadas</p>
                            {/* Roughly 0.05 kcal per meter walking */}
                            <p className="text-xl font-bold text-orange-400">{Math.floor(trackDistance * 0.05)} <span className="text-xs">kcal</span></p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 w-full">
                    {!isTracking ? (
                        <button onClick={startTracking} className="flex-1 bg-turquesa text-white py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-turquesa/90 transition-all flex justify-center items-center gap-2 shadow-md">
                            <Play fill="currentColor" size={16}/> Iniciar Rutina
                        </button>
                    ) : (
                        <button onClick={stopTracking} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-600 transition-all flex justify-center items-center gap-2 shadow-md animate-pulse">
                            <Square fill="currentColor" size={16}/> Terminar
                        </button>
                    )}
                </div>
            </div>
            
            {historialEjercicio.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3">Tus últimas rutas</p>
                    <div className="space-y-2">
                        {historialEjercicio.map(rec => (
                            <div key={rec.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-turquesa/10 rounded-lg"><Navigation size={14} className="text-turquesa"/></div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">Caminata al aire libre</p>
                                        <p className="text-[10px] text-gray-400">{new Date(rec.fecha).toLocaleDateString()} • {formatTime(rec.duracionSegundos)} min</p>
                                    </div>
                                </div>
                                <span className="font-black text-turquesa">{(rec.distanciaMetros / 1000).toFixed(2)} km</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>

        <Card className="shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-1">Mi Historial Nutricional</h3><p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-3">Calorias consumidas (7 dias)</p>
          <div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={caloriasDataTratamiento.slice(-7)} margin={{top:5,right:20,left:-20,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><Tooltip/><Line type="step" dataKey={()=>META_CALORIAS} stroke="#fb923c" strokeWidth={2} strokeDasharray="5 5" name="Meta" dot={false}/>
                                            <Line type="monotone" dataKey="calorias" stroke="#20b2aa" strokeWidth={4} dot={{r:6,fill:"#20b2aa",strokeWidth:2,stroke:"#fff"}}/></LineChart></ResponsiveContainer></div>
        </Card>
        <Card className="shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-1">Diario de Alimentacion</h3><p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-3">Cuida tu ingesta hoy</p>
          <div className="bg-turquesa/5 p-4 rounded-2xl border border-turquesa/10 flex items-center justify-between mb-4">
            <div><span className="text-[10px] font-black uppercase tracking-widest text-turquesa">Ingesta Calorica</span><div className="flex items-end gap-2 text-gray-800"><span className="text-3xl font-black leading-none">{caloriasHoy}</span><span className="text-sm font-bold opacity-60">/ {META_CALORIAS} kcal</span></div></div>
            <div className="w-14 h-14 rounded-full border-4 border-turquesa/20 flex items-center justify-center font-black text-xs text-turquesa" style={{borderTopColor:"#20b2aa"}}>{Math.min(100,Math.round(caloriasHoy/META_CALORIAS*100))}%</div>
          </div>
          {caloriasData.length>0&&<div className="mb-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm"><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Historial Calorico</h4><div className="h-36"><ResponsiveContainer width="100%" height="100%"><LineChart data={caloriasData} margin={{top:5,right:20,left:-20,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><Tooltip contentStyle={{borderRadius:12,border:"none",boxShadow:"0 4px 6px -1px rgb(0 0 0 / 0.1)"}}/><Line type="step" dataKey={()=>META_CALORIAS} stroke="#fb923c" strokeWidth={2} strokeDasharray="5 5" name="Meta" dot={false}/><Line type="monotone" dataKey="calorias" name="Consumo" stroke="#20b2aa" strokeWidth={4} dot={{r:4,fill:"#20b2aa",strokeWidth:2,stroke:"#fff"}}/></LineChart></ResponsiveContainer></div></div>}
          <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-turquesa focus:border-transparent transition-all font-medium text-gray-700 text-sm" placeholder="Busca alimentos rápidos..." value={buscarAlimento} onChange={e=>setBuscarAlimento(e.target.value)}/>
            {buscarAlimento.length>0&&alimentosFiltrados.length>0&&<div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl z-20 mt-2 max-h-48 overflow-y-auto">{alimentosFiltrados.map(a=><div key={a.id} className="p-3 border-b border-gray-50 hover:bg-turquesa/5 flex justify-between items-center cursor-pointer" onClick={()=>handleAddAlimento(a, searchQty)}><div><span className="font-bold text-gray-800 text-sm">{searchQty > 1 ? `${searchQty}x ` : ''}{a.nombre}</span><span className="text-[10px] text-gray-400 font-bold block">{a.porcion}</span></div><span className="font-black text-turquesa text-sm">+{a.calorias * searchQty} kcal</span></div>)}</div>}
          </div>
          
          <div className="flex gap-2 mb-4">
             <input type="number" id="manualCal" placeholder="Kcal" className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-turquesa focus:border-transparent text-sm font-bold text-gray-700 text-center shadow-inner" />
             <input type="text" id="manualDesc" placeholder="Registro manual (Ej. 1 Rebanada Pizza)" className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-turquesa focus:border-transparent text-sm shadow-inner" />
             <button onClick={()=>{
                 const calInput = document.getElementById('manualCal');
                 const descInput = document.getElementById('manualDesc');
                 const cal = parseInt(calInput.value);
                 const desc = descInput.value || 'Alimento';
                 if(cal > 0) {
                     handleAddAlimento({ nombre: desc, porcion: 'Manual', calorias: cal });
                     calInput.value = '';
                     descInput.value = '';
                 }
             }} className="bg-[#0f172a] text-white px-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-turquesa hover:text-[#0f172a] transition-all shadow-md">Añadir</button>
          </div>

          <div className="space-y-2">{alimentosHoy.length===0?<div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200"><p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No has registrado alimentos hoy</p></div>:alimentosHoy.map((a,i)=><div key={i} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
            <div>
              <span className="font-bold text-gray-800 text-sm">{a.nombre}</span>
              <span className="text-[10px] text-gray-400 block mb-1">{a.porcion}   {new Date(a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || Date.now())).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={(e) => { e.stopPropagation(); updateCantidad(i, -1); }} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-200 transition-colors">-</button>
                <span className="text-xs font-black text-gray-700 w-4 text-center">{a.cantidad || 1}</span>
                <button onClick={(e) => { e.stopPropagation(); updateCantidad(i, 1); }} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 font-bold hover:bg-gray-200 transition-colors">+</button>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-black text-turquesa text-lg">+{a.calorias}</span>
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">kcal</span>
            </div>
          </div>)}</div>
        
        </Card>
      </div>)}
      {/* PAGOS */}
      {activeTab==="pagos"&&(<div className="space-y-3 animate-in fade-in">
    {recibos.length===0?<Card className="text-center py-8"><p className="text-gray-400 text-sm">Sin recibos registrados</p></Card>
    :recibos.map((r,i)=>(
        <Card key={i} onClick={() => setReciboVisualizar(r)} className="shadow-sm cursor-pointer hover:shadow-md hover:border-turquesa/50 transition-all active:scale-95">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-sm text-gray-800">{r.concepto||r.servicio||"Pago"}</p>
                    <p className="text-xs text-gray-500 mt-1">{r.fecha ? new Date(r.fecha.seconds?r.fecha.seconds*1000:r.fecha).toLocaleDateString("es-MX"):"--"}</p>
                </div>
                <span className="font-black text-turquesa">${Number(r.total||r.monto||0).toLocaleString("es-MX",{minimumFractionDigits:2})}</span>
            </div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-3 flex items-center gap-1"><FileText size={10} className="text-turquesa"/> Toca para ver recibo</p>
        </Card>
    ))}
</div>)}

{/* Modal Visualizar Recibo usando ReciboDigital */}
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

      {/* MEMBRESIA CON FLIP CARD */}
      {activeTab==="membresia"&&membresiaObj&&(
        <div className="space-y-4 animate-in fade-in">
          <div className="text-center space-y-1 mb-2"><h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Mi Membresia</h2><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Credencial exclusiva y beneficios</p></div>
          <style>{`
            .flip-card{background-color:transparent;perspective:1000px;height:220px;width:100%;max-width:480px;margin:0 auto;}
            .flip-card-inner{position:relative;width:100%;height:100%;transition:transform 0.6s;transformástyle:preserve-3d;}
            .flip-card.flipped .flip-card-inner{transform:rotateY(180deg);}
            .flip-card-front,.flip-card-back{position:absolute;width:100%;height:100%;-webkit-backface-visibility:hidden;backface-visibility:hidden;border-radius:24px;overflow:hidden;}
            .flip-card-back{transform:rotateY(180deg);}
          `}</style>
          <div className={`flip-card ${flipped?"flipped":""}`}>
            <div className="flip-card-inner">
              {/* FRENTE */}
              <div className={`flip-card-front bg-white border-2 flex h-full ${membresiaObj.nivel==="Platinum"?"border-gray-800":membresiaObj.nivel==="Oro"?"border-amber-400":membresiaObj.nivel==="Plata"?"border-gray-300":"border-orange-400"}`}>
                <div className="absolute inset-0" style={{background:`linear-gradient(105deg, transparent 55%, ${membresiaObj.nivel==="Platinum"?"rgba(0,0,0,0.05)":membresiaObj.nivel==="Oro"?"rgba(251,191,36,0.05)":membresiaObj.nivel==="Plata"?"rgba(156,163,175,0.05)":"rgba(249,115,22,0.05)"} 55%)`}}/>
                <div className="flex flex-col items-center justify-center px-3 gap-2" style={{width:"32%",borderRight:"1px solid rgba(0,0,0,0.05)"}}>
                  <div className="relative">
                    <div className="absolute -inset-[2.5px] rounded-2xl" style={{background:membresiaObj.nivel==="Platinum"?"linear-gradient(135deg,#000,#4b5563)":membresiaObj.nivel==="Oro"?"linear-gradient(135deg,#fbbf24,#d97706)":membresiaObj.nivel==="Plata"?"linear-gradient(135deg,#9ca3af,#4b5563)":"linear-gradient(135deg,#f97316,#c2410c)"}}/>
                    {perfilPaciente.fotoUrl?<img src={perfilPaciente.fotoUrl} alt={perfilPaciente.nombre} className="relative object-cover border-2 border-white shadow-lg rounded-2xl" style={{width:"100px",height:"125px"}}/>:<div className="relative border-2 border-white shadow-lg rounded-2xl flex items-center justify-center bg-gray-200" style={{width:"100px",height:"125px"}}><User size={40} className="text-gray-400"/></div>}
                  </div>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-1">Paciente</p>
                  <p className="text-xs font-black text-gray-800 text-center leading-tight">{perfilPaciente.nombre}</p>
                </div>
                <div className="flex-1 flex flex-col justify-between p-4 relative z-10">
                  <div className="flex items-start justify-between">
                    <img src="/logo.png" alt="ALFRA" className="h-14 object-contain"/>
                    <span className="text-[8px] font-black uppercase tracking-[0.15em] bg-gradient-to-r from-gray-800 to-black text-white px-3 py-1 rounded-bl-2xl rounded-tr-2xl flex items-center gap-1"><Crown size={10}/> Miembro</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5"><Crown size={14} className="text-yellow-400"/><p className="text-sm font-black uppercase tracking-wider" style={{color:membresiaObj.nivel==="Platinum"?"#1f2937":membresiaObj.nivel==="Oro"?"#d97706":membresiaObj.nivel==="Plata"?"#6b7280":"#ea580c"}}>Membresia {membresiaObj.nivel}</p></div>
                    <p className="text-[9px] text-gray-500">Disfruta de tus beneficios exclusivos! 🌟</p>
                    <p className="text-[9px] text-gray-400 italic">Eres nuestro paciente VIP!</p>
                  </div>
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-4 py-2.5 rounded-2xl flex items-center justify-between">
                    <div><p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Horas</p><p className="text-xl font-black">{membresiaObj.horas||0} <span className="text-xs font-medium opacity-60">hrs</span></p></div>
                    <button onClick={()=>setFlipped(true)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors" title="Ver reverso"><RotateCw size={16}/></button>
                  </div>
                </div>
                {membresiaObj.codigo&&<div className="absolute bottom-2 left-0 right-0 text-center"><p className="text-gray-300 text-[8px] font-mono tracking-widest">{membresiaObj.codigo}</p></div>}
              </div>
              {/* REVERSO */}
              <div className={`flip-card-back bg-white border-2 flex flex-col justify-between p-4 ${membresiaObj.nivel==="Platinum"?"border-gray-800":membresiaObj.nivel==="Oro"?"border-amber-400":membresiaObj.nivel==="Plata"?"border-gray-300":"border-orange-400"}`} style={{position:"relative"}}>
                <div className="absolute inset-0" style={{background:"linear-gradient(105deg, transparent 40%, rgba(0,0,0,0.03) 40%)"}}/>
                <div className="absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl bg-gradient-to-r from-gray-800 to-black text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-1.5 z-10"><Crown size={12}/> {membresiaObj.codigo}</div>
                <div className="relative z-10 flex flex-col items-center justify-between h-full">
                  <Barcode39 value={membresiaObj.codigo} width={240} height={60} />
                  <p className="text-xs font-black tracking-widest text-gray-800 mt-1">{membresiaObj.codigo}</p>
                  <div style={{width:"200px",height:"70px",marginTop:"8px"}}><img src="/logo.png" alt="ALFRA" style={{width:"100%",height:"100%",objectFit:"contain"}}/></div>
                  <div className="w-full flex justify-between items-center border-t pt-2 mt-auto" style={{borderColor:"rgba(0,0,0,0.05)"}}>
                    <p className="text-[9px] text-gray-400 font-medium">Uso exclusivo en Clinica ALFRA</p>
                    <button onClick={()=>setFlipped(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-full transition-colors" title="Ver frente"><RotateCw size={16}/></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Beneficios */}
          <Card className="shadow-sm"><h3 className="text-base font-black text-gray-800 uppercase mb-3 flex items-center gap-2"><Crown size={18} className="text-turquesa"/>Beneficios de tu Nivel {membresiaObj.nivel}</h3>
            <div className="grid grid-cols-1 gap-3">{(beneficiosPorNivel[membresiaObj.nivel]||[]).length===0?<p className="text-sm text-gray-400 text-center py-4">No hay beneficios especificos registrados para este nivel.</p>:(beneficiosPorNivel[membresiaObj.nivel]||[]).map((b,i)=><div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl"><span className="text-turquesa text-xl">✨</span><p className="text-sm font-black text-gray-800">{b}</p></div>)}</div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-4 text-center">Recarga mas horas para subir de nivel</p>
          </Card>
          {/* Historial de Consumos */}
          <Card className="shadow-sm"><h3 className="text-base font-black text-gray-800 uppercase mb-3 flex items-center gap-2"><Zap size={18} className="text-turquesa"/>Historial de Consumos</h3>
            {loadingConsumos?<p className="text-gray-400 text-sm text-center">Cargando...</p>:consumos.length===0?<p className="text-sm text-gray-400 text-center py-4">No has realizado consumos aun.</p>:<div className="space-y-2">{consumos.map((c,i)=><div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><div><p className="font-bold text-sm text-gray-800">{c.servicio||c.concepto||"Consumo"}</p><p className="text-[10px] text-gray-400">{c.fecha?.toDate?c.fecha.toDate().toLocaleDateString("es-MX"):c.fecha ? new Date(c.fecha).toLocaleDateString("es-MX"):"--"}</p></div><span className="font-black text-turquesa text-sm">{c.horas||0} hrs</span></div>)}</div>}
          </Card>
        </div>
      )}
      {/* CONFIG */}
      {activeTab==="config"&&(<div className="space-y-4 animate-in fade-in">
        <Card className="shadow-sm"><div className="flex flex-col items-center gap-3 mb-4"><div className="w-20 h-20 rounded-full overflow-hidden border-2 border-turquesa/30 shadow-lg" onClick={()=>fileInputRef.current?.click()}>{perfilPaciente.fotoUrl?<img src={perfilPaciente.fotoUrl} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full bg-gray-100 flex items-center justify-center"><Camera size={24} className="text-gray-400"/></div>}</div><button onClick={()=>fileInputRef.current?.click()} className="text-xs text-turquesa font-bold">Cambiar foto</button></div>
          <div className="space-y-3"><div><label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nombre</label><input type="text" value={perfilPaciente.nombre} onChange={e=>setPerfilPaciente(p=>({...p,nombre:e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-turquesa/20 outline-none"/></div><div><label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha de nacimiento</label><input type="date" value={perfilPaciente.fechaNacimiento} onChange={e=>setPerfilPaciente(p=>({...p,fechaNacimiento:e.target.value}))} className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-turquesa/20 outline-none"/></div>
            <Button variant="primary" fullWidth onClick={handleSaveProfile}>Guardar cambios</Button>
          </div>
        </Card>
        <Card className="shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><Lock size={16}/>Seguridad</h3><p className="text-xs text-gray-500 mb-3">Recibe un correo para restablecer tu contraseña.</p>{resetSent?<p className="text-xs text-green-600 font-bold">✓ Correo enviado. Revisa tu bandeja.</p>:<Button variant="outline" fullWidth onClick={handleResetEmail} disabled={sendingReset}>{sendingReset?"Enviando...":"Restablecer contraseña"}</Button>}</Card>
      </div>)}
    </div>
  );
}













import React, { useState, useRef, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, Activity, User, Lock, Gift, Camera, Bell, FileText, Receipt, CheckCircle, Mail, Crown, Heart, Stethoscope, Sparkles, ChevronRight, Zap, RefreshCw, Search, RotateCw } from "lucide-react";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { db } from "../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { getPacienteByUid } from "../../services/pacientesService";
import { getSeguimientosPaciente, getApoyoEnCasa, getDailyTrackers, saveDailyTracker } from "../../services/seguimientoService";
import { getRecibosPaciente } from "../../services/recibosService";
import { getCitasByPaciente } from "../../services/citasService";
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
{id:370,nombre:"Chicle sin azucar",calorias:5,porcion:"1 pieza"}
];

export default function PacienteProfile() {
  const userAuth = auth.currentUser;
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("progreso");
  const [pacienteDocId, setPacienteDocId] = useState(null);
  const [perfilPaciente, setPerfilPaciente] = useState({ nombre:"...cargando...", telefono:"", fechaNacimiento:"", fotoUrl:null, tipoTratamiento:"Mixto", membresia:null, sellosLealtad:0, recompensasDisponibles:0, primerSelloFecha:null, fechaRegistro:null, recompensaElegida:null, lealtadActiva:true });
  const [progresoData, setProgresoData] = useState([]);
  const [recibos, setRecibos] = useState([]);
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
  const [guardandoEleccion, setGuardandoEleccion] = useState(false);
  const [beneficiosPorNivel, setBeneficiosPorNivel] = useState({});
  // Tratamientos v2
  const [tratamientos, setTratamientos] = useState([]);
  const [tratamientoActivo, setTratamientoActivo] = useState(null);
  const [sesionesPorTrat, setSesionesPorTrat] = useState({});
  const [loadingTrat, setLoadingTrat] = useState(true);
  // Nutricion
  const [caloriasData, setCaloriasData] = useState([]);
  const [alimentosHoy, setAlimentosHoy] = useState([]);
  const [apoyoCompletadoHoy, setApoyoCompletadoHoy] = useState({});
  const [buscarAlimento, setBuscarAlimento] = useState("");
  const META_CALORIAS = 1500;
  const caloriasHoy = alimentosHoy.reduce((s,a) => s + a.calorias, 0);
  // Flip card
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (!userAuth) return;
    const load = async () => {
      try {
        const paciente = await getPacienteByUid(userAuth.uid);
        if (paciente) {
          setPacienteDocId(paciente.id);
          setPerfilPaciente({ nombre:paciente.nombre||"", telefono:paciente.telefono||paciente.phone||"", fechaNacimiento:paciente.fechaNacimiento||"", fotoUrl:paciente.fotoUrl||null, tipoTratamiento:paciente.tipoTratamiento||"Mixto", membresia:paciente.membresia||null, sellosLealtad:paciente.sellosLealtad||0, recompensasDisponibles:paciente.recompensasDisponibles||0, primerSelloFecha:paciente.primerSelloFecha||null, fechaRegistro:paciente.fechaRegistro||paciente.createdAt||null, recompensaElegida:paciente.recompensaElegida||null, lealtadActiva:paciente.lealtadActiva !== false });
          const seg = await getSeguimientosPaciente(paciente.id);
          setProgresoData(seg.slice(0,12).reverse().map(s=>({ fecha:new Date(s.fechaRegistro).toLocaleDateString("es-MX",{month:"short",day:"numeric"}), peso:s.peso, imc:s.imc })));
          setRecibos(await getRecibosPaciente(paciente.id));
          try { const cp = await getCitasByPaciente(paciente.id); setCitas(cp.filter(c=>c.status!=="Cancelada")); } catch { setCitas([]); }
          setLoadingCitas(false);
          setApoyoCuidados((await getApoyoEnCasa(paciente.id))||[]);
          setApoyoLoading(false);
          // Tratamientos v2
          try {
            const trats = await getTratamientosPaciente(paciente.id);
            setTratamientos(trats);
            if (trats.length > 0) setTratamientoActivo(trats[0]);
            const sesAll = await getSesionesPaciente(paciente.id);
            const byTrat = {};
            sesAll.forEach(s => { if (!byTrat[s.tratamientoId]) byTrat[s.tratamientoId] = []; byTrat[s.tratamientoId].push(s); });
            setSesionesPorTrat(byTrat);
          } catch(err) { console.error("Error tratamientos:", err); }
          setLoadingTrat(false);
          // Nutricion - trackers
          try {
            const trackers = await getDailyTrackers(paciente.id, 100);
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
            const calData = trackers.filter(t => t.tipo === "alimentacion").sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).map(t => ({ fecha: new Date(t.fecha+"T00:00:00").toLocaleDateString("es-MX",{month:"short",day:"numeric"}), calorias: t.data?.totalCalorias || 0 }));
            setCaloriasData(calData);
            const todayTracker = trackers.find(t => t.tipo === "alimentacion" && t.fecha === todayStr);
            if (todayTracker?.data?.alimentos) setAlimentosHoy(todayTracker.data.alimentos); const apoyoTracker = trackers.find(t => t.tipo === "apoyo" && t.fecha === todayStr); if (apoyoTracker?.data) setApoyoCompletadoHoy(apoyoTracker.data);
          } catch(err) { console.error("Error nutricion:", err); }
          // Membresia consumos
          if (paciente.membresia?.activa) {
            setLoadingConsumos(true);
            try { const q=query(collection(db,"consumos_membresia"),where("pacienteId","==",paciente.id)); const snap=await getDocs(q); setConsumos(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{ const da=a.fecha?.toDate?a.fecha.toDate():new Date(a.fecha||0); const db2=b.fecha?.toDate?b.fecha.toDate():new Date(b.fecha||0); return db2-da; })); } catch { setConsumos([]); }
            setLoadingConsumos(false);
          }
          try { const bSnap = await getDoc(doc(db,"configuracion","beneficios_membresia")); if (bSnap.exists()) setBeneficiosPorNivel(bSnap.data().beneficios||{}); } catch {}
        }
      } catch(err) { console.error(err); setApoyoLoading(false); setLoadingCitas(false); setLoadingTrat(false); }
      finally { setLoadingData(false); }
    };
    load();
  }, [userAuth]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file||!pacienteDocId) return;
    try { const { getStorage, ref, uploadBytes:ub, getDownloadURL:gdl } = await import("firebase/storage"); const storage=getStorage(); const sr=ref(storage,`pacientes/${pacienteDocId}/foto_perfil`); await ub(sr,file); const url=await gdl(sr); await updateDoc(doc(db,"pacientes",pacienteDocId),{fotoUrl:url}); setPerfilPaciente(p=>({...p,fotoUrl:url})); } catch(err) { console.error(err); }
  };
  const handleSaveProfile = async () => { if (!pacienteDocId) return; try { await updateDoc(doc(db,"pacientes",pacienteDocId),{nombre:perfilPaciente.nombre,fechaNacimiento:perfilPaciente.fechaNacimiento}); alert("Perfil guardado."); } catch(err) { console.error(err); } };
  const handleResetEmail = async () => { if (!auth.currentUser?.email) return; setSendingReset(true); try { await sendPasswordResetEmail(auth,auth.currentUser.email); setResetSent(true); } catch(err){console.error(err);} setSendingReset(false); };
  const handleElegirRecompensa = async (op) => { if (!pacienteDocId||guardandoEleccion) return; setGuardandoEleccion(true); try { await updateDoc(doc(db,"pacientes",pacienteDocId),{recompensaElegida:op,recompensasDisponibles:0}); setPerfilPaciente(p=>({...p,recompensaElegida:op,recompensasDisponibles:0})); setElegirRecompensa(false); } catch(err){console.error(err);} setGuardandoEleccion(false); };
  const handleToggleCuidado = async (cuidadoId) => { if (!pacienteDocId) return; const newVal = !apoyoCompletadoHoy[cuidadoId]; const newData = { ...apoyoCompletadoHoy, [cuidadoId]: newVal }; setApoyoCompletadoHoy(newData); try { await saveDailyTracker(pacienteDocId, "apoyo", newData); } catch (err) { console.error(err); } };`n    const handleAddAlimento = async (alimento) => {
    const newList = [{...alimento, id:Date.now(), timestamp:new Date}, ...alimentosHoy];
    setAlimentosHoy(newList); setBuscarAlimento("");
    if (pacienteDocId) {
      try { const total = newList.reduce((s,a) => s+a.calorias, 0); await saveDailyTracker(pacienteDocId, "alimentacion", { alimentos: newList, totalCalorias: total, metaCalorias: META_CALORIAS });
        const todayLabel = new Date().toLocaleDateString("es-MX",{month:"short",day:"numeric"});
        setCaloriasData(prev => { const exists = prev.find(p => p.fecha === todayLabel); return exists ? prev.map(p => p.fecha === todayLabel ? {...p, calorias: total} : p) : [...prev, {fecha: todayLabel, calorias: total}]; });
      } catch(err) { console.error(err); }
    }
  };

  const membresiaObj = getMembresiaObj(perfilPaciente.membresia);
  const tabs = [ {key:"progreso",label:"Resumen"},{key:"miprogreso",label:"Progreso"},{key:"citas",label:"Citas"},{key:"expediente",label:"Nutricion"},{key:"pagos",label:"Pagos"}, ...(membresiaObj?.activa?[{key:"membresia",label:"Membresia"}]:[]), {key:"config",label:"Config"} ];
  const alimentosFiltrados = ALIMENTOS_CATALOGO.filter(a => a.nombre.toLowerCase().includes(buscarAlimento.toLowerCase()));
  return (
    <div className="space-y-4 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <div className="relative rounded-[2rem] overflow-hidden shadow-lg" style={{background:"linear-gradient(135deg, #1a2a3a 0%, #2d4a5a 50%, #20B2AA 100%)"}}>
        <div className="relative z-10 p-5 flex items-center gap-4">
          <div className="relative">
            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden border-2 shadow-lg" style={{borderColor:"rgba(32,178,170,0.5)"}} onClick={()=>fileInputRef.current?.click()}>
              {perfilPaciente.fotoUrl ? <img src={perfilPaciente.fotoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center"><User size={28} className="text-white/40"/></div>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
            <button onClick={()=>fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 bg-[#25D366] text-white rounded-full p-1.5 shadow-lg"><Camera size={12}/></button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap"><h1 className="text-lg font-black text-white truncate">{perfilPaciente.nombre}</h1>{membresiaObj?.activa && <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-400 text-white px-2 py-0.5 rounded-full">Paciente Prime</span>}</div>
            <p className="text-white/60 text-xs mt-0.5">💎 {perfilPaciente.tipoTratamiento} · {perfilPaciente.telefono}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 px-1">{tabs.map(t=><button key={t.key} onClick={()=>setActiveTab(t.key)} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${activeTab===t.key?"bg-white text-gray-800 border-gray-200 shadow-md":"text-gray-400 border-gray-100 hover:bg-gray-50"}`}>{t.label}</button>)}</div>

      {/* RESUMEN */}
      {activeTab==="progreso"&&(<div className="space-y-4 animate-in fade-in">
        <Card className="shadow-sm bg-gradient-to-r from-turquesa/5 to-cyan-50 border-turquesa/10"><div className="flex items-start gap-3"><div className="p-2 bg-turquesa/10 rounded-xl"><Sparkles size={18} className="text-turquesa"/></div><div><p className="text-[10px] font-black uppercase tracking-widest text-turquesa mb-1">Frase de Bienestar</p><p className="text-sm font-bold text-gray-700 italic leading-relaxed">"El autocuidado no es un lujo, es una inversion directa en tu calidad de vida."</p></div></div></Card>

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

        {progresoData.length>0&&<Card className="shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-3">Peso (kg)</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={progresoData} margin={{top:5,right:20,left:-20,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><Tooltip/><Line type="monotone" dataKey="peso" stroke="#20b2aa" strokeWidth={3} dot={{r:4,fill:"#20b2aa"}}/></LineChart></ResponsiveContainer></div></Card>}
      </div>)}
      {/* PROGRESO - TRATAMIENTOS V2 */}
      {activeTab==="miprogreso"&&(<div className="space-y-4 animate-in fade-in">
        <div className="text-center space-y-1 mb-2"><h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Mi Progreso</h2><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Historial de sesiones por tratamiento</p></div>
        {loadingTrat?<div className="py-16 flex items-center justify-center gap-3 text-gray-300"><RefreshCw className="animate-spin" size={24}/><span className="text-sm font-bold">Cargando tu historial...</span></div>
        :tratamientos.length===0?<div className="py-16 text-center bg-white rounded-3xl border border-dashed border-gray-100"><Activity size={48} className="mx-auto text-gray-100 mb-4"/><p className="text-gray-400 font-black uppercase tracking-widest text-xs">Sin tratamientos registrados aun</p><p className="text-gray-300 text-[10px] mt-1">La especialista creara tu expediente en la proxima sesion.</p></div>
        :<>
          <div className="flex flex-wrap gap-2">{tratamientos.map(tr=><button key={tr.id} onClick={()=>setTratamientoActivo(tr)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${tratamientoActivo?.id===tr.id?(tr.tipo==="Corporal"?"bg-cyan-600 text-white border-transparent shadow-lg":"bg-purple-600 text-white border-transparent shadow-lg"):"bg-white text-gray-500 border-gray-200"}`}>{tr.tipo==="Corporal"?"💪":"✨"} {tr.nombre}</button>)}</div>
          {tratamientoActivo&&(()=>{
            const sesiones = sesionesPorTrat[tratamientoActivo.id]||[];
            const isCorporal = tratamientoActivo.tipo==="Corporal";
            const chartData = sesiones.map((s,i)=>({sesion:`#${i+1}`, peso:parseFloat(s.medidas?.peso)||null, cintura:parseFloat(s.medidas?.cintura)||null})).filter(s=>s.peso||s.cintura);
            return <div className="space-y-3">
              {isCorporal && chartData.length>=2 && <Card className="shadow-sm"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Evolucion de Medidas</p><div className="h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{top:4,right:8,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="sesion" fontSize={10} tickLine={false} axisLine={false} stroke="#9ca3af"/><YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#9ca3af"/><Tooltip contentStyle={{borderRadius:12,border:"1px solid #e5e7eb",fontSize:11}}/>{chartData.some(d=>d.peso)&&<Line type="monotone" dataKey="peso" stroke="#20b2aa" strokeWidth={2.5} dot={{r:4,fill:"#20b2aa"}} name="Peso"/>}{chartData.some(d=>d.cintura)&&<Line type="monotone" dataKey="cintura" stroke="#6366f1" strokeWidth={2} dot={{r:3,fill:"#6366f1"}} name="Cintura"/>}</LineChart></ResponsiveContainer></div></Card>}
              {sesiones.length===0?<div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-100"><p className="text-gray-400 text-sm font-bold">No hay sesiones en este tratamiento aun.</p></div>
              :<div className="space-y-3">{[...sesiones].reverse().map((ses,idx)=><Card key={ses.id} className="shadow-sm overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full ${isCorporal?"bg-cyan-50 text-cyan-600":"bg-purple-50 text-purple-600"}`}>#{sesiones.length-idx}</span>
                    <div><p className="text-sm font-black text-gray-800">{new Date(ses.fecha).toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"})}</p>{ses.protocolo?.subtitulo&&<p className="text-[10px] text-gray-400 font-bold">{ses.protocolo.subtitulo}</p>}</div>
                  </div>
                  {ses.medidas?.peso&&<span className="text-sm font-black text-gray-800 bg-gray-100 px-3 py-1 rounded-full">{ses.medidas.peso} kg</span>}
                </div>
                {isCorporal && ses.medidas && Object.keys(ses.medidas).some(k=>k!=="imc"&&ses.medidas[k]) && <div className="flex flex-wrap gap-1.5 py-2">{MEDIDAS_CORPORALES.filter(m=>ses.medidas[m.key]).map(m=><span key={m.key} className="text-[10px] bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full font-bold text-gray-700">{m.label}: <span className="text-turquesa">{ses.medidas[m.key]} {m.unit}</span></span>)}{ses.medidas?.imc&&<span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${parseFloat(ses.medidas.imc)>25?"bg-red-50 text-red-500 border-red-100":"bg-green-50 text-green-600 border-green-100"}`}>IMC: {ses.medidas.imc}</span>}</div>}
                {ses.fotosSesion?.length>0&&<div className="flex gap-2 flex-wrap pt-2">{ses.fotosSesion.map((f,fi)=><a key={fi} href={f.url} target="_blank" rel="noreferrer" className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white shadow-md ring-1 ring-gray-100"><img src={f.url} alt="" className="w-full h-full object-cover"/></a>)}</div>}
              </Card>)}</div>}
            </div>;
          })()}
        </>}
      </div>)}

      {/* CITAS */}
      {activeTab==="citas"&&(<div className="space-y-3 animate-in fade-in">{loadingCitas?<p className="text-center text-gray-400 text-sm py-8">Cargando citas...</p>:citas.length===0?<Card className="text-center py-8"><p className="text-gray-400 text-sm">Sin citas programadas</p></Card>:citas.map((c,i)=><Card key={i} className="shadow-sm"><div className="flex justify-between items-start"><div><p className="font-bold text-sm text-gray-800">{c.servicio||c.motivo||"Cita"}</p><p className="text-xs text-gray-500 mt-1">{c.fecha} · {c.hora}</p></div><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.status==="Confirmada"?"bg-green-50 text-green-600":c.status==="Agendada"?"bg-blue-50 text-blue-600":"bg-yellow-50 text-yellow-600"}`}>{c.status||"Pendiente"}</span></div></Card>)}</div>)}
      {/* NUTRICION - COMPLETO */}
      {activeTab==="expediente"&&(<div className="space-y-4 animate-in fade-in">
        <Card className="shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-1">Mi Historial Nutricional</h3><p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-3">Calorias consumidas (7 dias)</p>
          <div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={caloriasData.slice(-7)} margin={{top:5,right:20,left:-20,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><Tooltip/><Line type="monotone" dataKey="calorias" stroke="#20b2aa" strokeWidth={4} dot={{r:6,fill:"#20b2aa",strokeWidth:2,stroke:"#fff"}}/></LineChart></ResponsiveContainer></div>
        </Card>
        <Card className="shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-1">Diario de Alimentacion</h3><p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-3">Cuida tu ingesta hoy</p>
          <div className="bg-turquesa/5 p-4 rounded-2xl border border-turquesa/10 flex items-center justify-between mb-4">
            <div><span className="text-[10px] font-black uppercase tracking-widest text-turquesa">Ingesta Calorica</span><div className="flex items-end gap-2 text-gray-800"><span className="text-3xl font-black leading-none">{caloriasHoy}</span><span className="text-sm font-bold opacity-60">/ {META_CALORIAS} kcal</span></div></div>
            <div className="w-14 h-14 rounded-full border-4 border-turquesa/20 flex items-center justify-center font-black text-xs text-turquesa" style={{borderTopColor:"#20b2aa"}}>{Math.min(100,Math.round(caloriasHoy/META_CALORIAS*100))}%</div>
          </div>
          {caloriasData.length>0&&<div className="mb-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm"><h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Historial Calorico</h4><div className="h-36"><ResponsiveContainer width="100%" height="100%"><LineChart data={caloriasData} margin={{top:5,right:20,left:-20,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false}/><Tooltip contentStyle={{borderRadius:12,border:"none",boxShadow:"0 4px 6px -1px rgb(0 0 0 / 0.1)"}}/><Line type="step" dataKey={()=>META_CALORIAS} stroke="#fb923c" strokeWidth={2} strokeDasharray="5 5" name="Meta" dot={false}/><Line type="monotone" dataKey="calorias" name="Consumo" stroke="#20b2aa" strokeWidth={4} dot={{r:4,fill:"#20b2aa",strokeWidth:2,stroke:"#fff"}}/></LineChart></ResponsiveContainer></div></div>}
          <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input type="text" className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-turquesa focus:border-transparent transition-all font-medium text-gray-700 text-sm" placeholder="Busca alimentos registrados..." value={buscarAlimento} onChange={e=>setBuscarAlimento(e.target.value)}/>
            {buscarAlimento.length>0&&alimentosFiltrados.length>0&&<div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl z-20 mt-2 max-h-48 overflow-y-auto">{alimentosFiltrados.map(a=><div key={a.id} className="p-3 border-b border-gray-50 hover:bg-turquesa/5 flex justify-between items-center cursor-pointer" onClick={()=>handleAddAlimento(a)}><div><span className="font-bold text-gray-800 text-sm">{a.nombre}</span><span className="text-[10px] text-gray-400 font-bold block">{a.porcion}</span></div><span className="font-black text-turquesa text-sm">+{a.calorias} kcal</span></div>)}</div>}
          </div>
          <div className="space-y-2">{alimentosHoy.length===0?<div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200"><p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No has registrado alimentos hoy</p></div>:alimentosHoy.map((a,i)=><div key={i} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm"><div><span className="font-bold text-gray-800 text-sm">{a.nombre}</span><span className="text-[10px] text-gray-400 block">{a.porcion}</span></div><span className="font-black text-turquesa">{a.calorias} kcal</span></div>)}</div>
        </Card>
        <Card className="shadow-sm"><h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><FileText size={16} className="text-turquesa"/>Plan de Cuidados en Casa</h3>
          {apoyoLoading?<p className="text-gray-400 text-sm">Cargando...</p>:apoyoCuidados.length===0?<p className="text-gray-400 text-sm text-center py-4">Sin cuidados asignados aun.</p>:apoyoCuidados.map((c,i)=><Card key={i} className="mb-2 border-turquesa/10"><p className="font-bold text-turquesa text-sm">{c.categoria||c.tipo||"Cuidado"}</p>{c.instrucciones&&<p className="text-xs text-gray-600 mt-1">{c.instrucciones}</p>}</Card>)}
        </Card>
      </div>)}
      {/* PAGOS */}
      {activeTab==="pagos"&&(<div className="space-y-3 animate-in fade-in">{recibos.length===0?<Card className="text-center py-8"><p className="text-gray-400 text-sm">Sin recibos registrados</p></Card>:recibos.map((r,i)=><Card key={i} className="shadow-sm"><div className="flex justify-between items-start"><div><p className="font-bold text-sm text-gray-800">{r.concepto||r.servicio||"Pago"}</p><p className="text-xs text-gray-500 mt-1">{r.fecha?new Date(r.fecha.seconds?r.fecha.seconds*1000:r.fecha).toLocaleDateString("es-MX"):"--"}</p></div><span className="font-black text-turquesa">${Number(r.total||r.monto||0).toLocaleString("es-MX",{minimumFractionDigits:2})}</span></div></Card>)}</div>)}

      {/* MEMBRESIA CON FLIP CARD */}
      {activeTab==="membresia"&&membresiaObj&&(
        <div className="space-y-4 animate-in fade-in">
          <div className="text-center space-y-1 mb-2"><h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Mi Membresia</h2><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Credencial exclusiva y beneficios</p></div>
          <style>{`
            .flip-card{background-color:transparent;perspective:1000px;height:220px;width:100%;max-width:480px;margin:0 auto;}
            .flip-card-inner{position:relative;width:100%;height:100%;transition:transform 0.6s;transform-style:preserve-3d;}
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
            {loadingConsumos?<p className="text-gray-400 text-sm text-center">Cargando...</p>:consumos.length===0?<p className="text-sm text-gray-400 text-center py-4">No has realizado consumos aun.</p>:<div className="space-y-2">{consumos.map((c,i)=><div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><div><p className="font-bold text-sm text-gray-800">{c.servicio||c.concepto||"Consumo"}</p><p className="text-[10px] text-gray-400">{c.fecha?.toDate?c.fecha.toDate().toLocaleDateString("es-MX"):c.fecha?new Date(c.fecha).toLocaleDateString("es-MX"):"--"}</p></div><span className="font-black text-turquesa text-sm">{c.horas||0} hrs</span></div>)}</div>}
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
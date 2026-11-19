/**
 * Servicio Nutricional Clínico ALFRA basado en Bioimpedancia OMRON HBF-514C
 * Generación automática de planes calóricos, distribución de macronutrientes,
 * tiempos de comida, lista de compras semanal y programación de alertas al celular.
 */
import { LocalNotifications } from '@capacitor/local-notifications';

export const ALERTA_COMIDAS_HORARIOS_DEFAULT = [
    { id: 101, hora: 8, minuto: 30, titulo: '🍳 Desayuno Nutricional ALFRA', cuerpo: 'Es momento de tu primer alimento. Revisa tus opciones en la App para activar tu metabolismo.' },
    { id: 102, hora: 11, minuto: 30, titulo: '🍏 Colación Matutina ALFRA', cuerpo: 'Tu refrigerio saludable te mantendrá saciada y activa.' },
    { id: 103, hora: 14, minuto: 30, titulo: '🥗 Comida Principal ALFRA', cuerpo: 'Hora de comer. Proteína magra y vegetales para potenciar tu tratamiento corporal.' },
    { id: 104, hora: 17, minuto: 30, titulo: '🍵 Colación Vespertina ALFRA', cuerpo: 'Momento de hidratación y semillas para apoyar el drenaje linfático.' },
    { id: 105, hora: 20, minuto: 30, titulo: '🥑 Cena Ligera ALFRA', cuerpo: 'Cena ligera para facilitar tu descanso y optimizar la recuperación tisular.' }
];

export const ALERTA_AGUA_HORAS = [10, 12, 16, 18];

/**
 * Calcula el plan nutricional automático adaptado a la bioimpedancia OMRON HBF-514C
 */
export const calcularPlanNutricionalOmron = ({
    peso = 70,
    estatura = 160,
    edad = 30,
    sexo = 'femenino',
    rmKcal = 0, // Metabolismo basal directo de la OMRON
    grasaPct = 30,
    musculoPct = 25,
    grasaVisceral = 4,
    bmi = 27
}) => {
    const pesoNum = Math.max(35, Number(peso) || 70);
    const estNum = Math.max(120, Number(estatura) || 160);
    const edadNum = Math.max(15, Number(edad) || 30);
    const rmNum = Number(rmKcal) || 0;

    // 1. Tasa Metabólica Basal (BMR)
    let bmr = rmNum;
    if (!bmr || bmr < 800) {
        if (sexo === 'masculino') {
            bmr = Math.round((10 * pesoNum) + (6.25 * estNum) - (5 * edadNum) + 5);
        } else {
            bmr = Math.round((10 * pesoNum) + (6.25 * estNum) - (5 * edadNum) - 161);
        }
    }

    // 2. Gasto Energético Total con actividad moderada en cabina
    const factorActividad = 1.3;
    const gastoEnergeticoTotal = Math.round(bmr * factorActividad);

    // 3. Déficit Lipolítico para Tratamiento Corporal (-18%)
    const pisoCalorico = sexo === 'masculino' ? 1500 : 1250;
    const metaCalorias = Math.max(pisoCalorico, Math.round(gastoEnergeticoTotal * 0.82));

    // 4. Macronutrientes
    const gramosProteina = Math.round(pesoNum * 1.6);
    const kcalProteina = gramosProteina * 4;

    const kcalGrasas = Math.round(metaCalorias * 0.28);
    const gramosGrasas = Math.round(kcalGrasas / 9);

    const kcalCarbos = Math.max(300, metaCalorias - kcalProteina - kcalGrasas);
    const gramosCarbos = Math.round(kcalCarbos / 4);

    // 5. Hidratación recomendada (35 ml por kg + 500 ml para drenaje)
    const litrosAguaRecomendados = Math.round(((pesoNum * 35) + 500) / 100) / 10;
    const vasosAguaAlDia = Math.round((litrosAguaRecomendados * 1000) / 250);

    // 6. Menú en 5 tiempos equilibrados
    const menus = {
        desayuno: {
            titulo: 'Desayuno',
            horario: '08:30 hrs',
            caloriasAprox: Math.round(metaCalorias * 0.25),
            opciones: [
                {
                    nombre: 'Omelette Verde Revitalizante',
                    descripcion: '2 claras + 1 huevo entero con espinacas y champiñones, 1 rebanada de pan integral tostado y 1/3 de aguacate.',
                    ingredientes: ['Huevos', 'Espinacas', 'Champiñones', 'Pan integral', 'Aguacate']
                },
                {
                    nombre: 'Tazón de Avena y Chía Antioxidante',
                    descripcion: '1/2 taza de avena cocida en leche vegetal sin azúcar, 1 cucharada de chía, canela y 1/2 taza de frutos rojos frescos.',
                    ingredientes: ['Avena en hojuelas', 'Semillas de chía', 'Leche de almendras sin azúcar', 'Frutos rojos']
                },
                {
                    nombre: 'Pannini Ligero de Pavo y Panela',
                    descripcion: '2 rebanadas de pan de grano, 3 rebanadas de pechuga de pavo, 40g de queso panela fresco, rodajas de jitomate y albahaca.',
                    ingredientes: ['Pan multigrano', 'Pechuga de pavo', 'Queso panela', 'Jitomate']
                }
            ]
        },
        colacionManana: {
            titulo: 'Colación Matutina',
            horario: '11:30 hrs',
            caloriasAprox: Math.round(metaCalorias * 0.10),
            opciones: [
                {
                    nombre: 'Manzana Verde con Almendras',
                    descripcion: '1 manzana verde en rodajas con 10 almendras naturales (grasas buenas y fibra saciante).',
                    ingredientes: ['Manzana verde', 'Almendras naturales']
                },
                {
                    nombre: 'Yogur Griego con Semillas de Girasol',
                    descripcion: '1/2 taza de yogur griego natural sin azúcar con 1 cucharadita de semillas de girasol.',
                    ingredientes: ['Yogur griego sin azúcar', 'Semillas de girasol']
                },
                {
                    nombre: 'Pepinos con Limón y Chía',
                    descripcion: '1 taza de bastones de pepino fresco con limón, pizca de sal marina y chía espolvoreada.',
                    ingredientes: ['Pepino', 'Limón', 'Semillas de chía']
                }
            ]
        },
        comida: {
            titulo: 'Comida Principal',
            horario: '14:30 hrs',
            caloriasAprox: Math.round(metaCalorias * 0.35),
            opciones: [
                {
                    nombre: 'Pechuga a las Hierbas Finas con Quinoa',
                    descripcion: '140g de pechuga de pollo a la plancha, 1/2 taza de quinoa cocida y ensalada abundante (espinaca, pepino, calabacita) con 1 cucharadita de aceite de oliva.',
                    ingredientes: ['Pechuga de pollo', 'Quinoa', 'Espinacas', 'Calabacitas', 'Aceite de oliva extra virgen']
                },
                {
                    nombre: 'Filete de Pescado Blanco al Limón con Camote',
                    descripcion: '150g de filete de pescado empapelado con rodajas de limón y cilantro, acompañado de 1/2 taza de camote al vapor y brócoli salteado.',
                    ingredientes: ['Filete de pescado blanco', 'Camote', 'Brócoli', 'Limón']
                },
                {
                    nombre: 'Fajitas de Res Magras con Pimientos y Arroz Integral',
                    descripcion: '120g de filete de res en fajitas salteadas con pimiento morrón tricolor y cebolla, servidas con 1/3 de taza de arroz integral.',
                    ingredientes: ['Filete de res magro', 'Pimientos morrones', 'Cebolla', 'Arroz integral']
                }
            ]
        },
        colacionTarde: {
            titulo: 'Colación Vespertina',
            horario: '17:30 hrs',
            caloriasAprox: Math.round(metaCalorias * 0.10),
            opciones: [
                {
                    nombre: 'Infusión Drenante + Nueces',
                    descripcion: '1 taza de té verde o infusión de cola de caballo sin azúcar con 4 mitades de nuez de castilla.',
                    ingredientes: ['Té verde o infusión drenante', 'Nueces de castilla']
                },
                {
                    nombre: 'Tostada de Maíz con Hummus y Pepino',
                    descripcion: '1 tostada horneada con 2 cucharadas de hummus y rodajas finas de pepino con paprika.',
                    ingredientes: ['Tostadas horneadas', 'Hummus', 'Pepino']
                },
                {
                    nombre: 'Gelatina Ligera con Proteína',
                    descripcion: '1 porción de gelatina light con 1 cucharada de queso cottage bajo en grasa.',
                    ingredientes: ['Gelatina sin azúcar', 'Queso cottage bajo en grasa']
                }
            ]
        },
        cena: {
            titulo: 'Cena Ligera',
            horario: '20:30 hrs',
            caloriasAprox: Math.round(metaCalorias * 0.20),
            opciones: [
                {
                    nombre: 'Ensalada Tibia de Salmón o Atún en Agua',
                    descripcion: '1 lata de atún en agua o 100g de salmón desmenuzado sobre cama de lechugas mixtas, espárragos al vapor y vinagre balsámico.',
                    ingredientes: ['Atún en agua o salmón', 'Lechugas mixtas', 'Espárragos', 'Vinagre balsámico']
                },
                {
                    nombre: 'Calabacitas Rellenas de Pollo Deshebrado',
                    descripcion: '2 calabacitas redondas ahuecadas y horneadas con 90g de pollo deshebrado en salsa de jitomate natural con una pizca de orégano.',
                    ingredientes: ['Calabacitas', 'Pechuga de pollo', 'Jitomate', 'Orégano']
                },
                {
                    nombre: 'Crema Ligera de Champiñones sin Lácteos',
                    descripcion: 'Crema casera de champiñones licuados con fondo de verduras natural, acompañada de 60g de cubitos de queso panela asado.',
                    ingredientes: ['Champiñones', 'Caldo vegetal', 'Queso panela']
                }
            ]
        }
    };

    // 7. Lista del súper semanal clasificada por pasillos
    const listaSuper = [
        {
            categoria: 'Frutas y Vegetales Frescos',
            icon: '🥦',
            items: ['Espinacas baby', 'Champiñones frescos', 'Pepinos', 'Calabacitas', 'Brócoli', 'Jitomates', 'Pimientos morrones', 'Manzanas verdes', 'Frutos rojos frescos', 'Limones', 'Camote']
        },
        {
            categoria: 'Proteínas Magras, Aves y Pescados',
            icon: '🥩',
            items: ['Pechuga de pollo limpia', 'Filete de pescado blanco fresco', 'Filete de res magro', 'Huevos frescos', 'Pechuga de pavo baja en sodio', 'Atún en agua']
        },
        {
            categoria: 'Lácteos Ligeros y Refris',
            icon: '🥛',
            items: ['Queso panela fresco', 'Yogur griego natural sin azúcar', 'Queso cottage bajo en grasa']
        },
        {
            categoria: 'Granos, Cereales Integrales y Semillas',
            icon: '🌾',
            items: ['Avena en hojuelas', 'Quinoa', 'Arroz integral', 'Pan multigrano integral', 'Tostadas de maíz horneadas']
        },
        {
            categoria: 'Grasas Saludables y Despensa',
            icon: '🥑',
            items: ['Aguacates', 'Almendras naturales sin sal', 'Nueces de castilla', 'Semillas de chía', 'Aceite de oliva extra virgen']
        },
        {
            categoria: 'Infusiones Drenantes y Té',
            icon: '🍵',
            items: ['Té verde', 'Té de cola de caballo o manzanilla', 'Gelatina sin azúcar']
        }
    ];

    return {
        metabolismoBasal: bmr,
        gastoEnergeticoTotal,
        metaCalorias,
        gramosProteina,
        gramosGrasas,
        gramosCarbos,
        litrosAguaRecomendados,
        vasosAguaAlDia,
        biometriaOmron: {
            peso: pesoNum,
            estatura: estNum,
            grasaPct: Number(grasaPct) || 0,
            musculoPct: Number(musculoPct) || 0,
            grasaVisceral: Number(grasaVisceral) || 0,
            rmKcal: rmNum,
            bmi: Number(bmi) || 0
        },
        menus,
        listaSuper,
        fechaGeneracion: new Date().toISOString()
    };
};

/**
 * Programa las alertas locales directamente en el celular del paciente
 */
export const programarAlertasNutricionalesLocales = async () => {
    try {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') {
            console.warn('Permiso de notificaciones locales no otorgado.');
            return false;
        }

        const idsAlertas = [
            ...ALERTA_COMIDAS_HORARIOS_DEFAULT.map(a => a.id),
            ...ALERTA_AGUA_HORAS.map((h, idx) => 200 + idx)
        ];
        try {
            await LocalNotifications.cancel({ notifications: idsAlertas.map(id => ({ id })) });
        } catch (_) {}

        const notifications = [];

        // 5 comidas diarias
        ALERTA_COMIDAS_HORARIOS_DEFAULT.forEach(c => {
            notifications.push({
                id: c.id,
                title: c.titulo,
                body: c.cuerpo,
                schedule: {
                    on: {
                        hour: c.hora,
                        minute: c.minuto
                    },
                    repeats: true,
                    allowWhileIdle: true
                },
                sound: 'default'
            });
        });

        // 4 avisos de hidratación
        ALERTA_AGUA_HORAS.forEach((hora, idx) => {
            notifications.push({
                id: 200 + idx,
                title: '💧 Hidratación ALFRA',
                body: 'Bebe 1 vaso de agua (250 ml) para apoyar a tu cuerpo en el drenaje y eliminación de toxinas.',
                schedule: {
                    on: {
                        hour: hora,
                        minute: 0
                    },
                    repeats: true,
                    allowWhileIdle: true
                },
                sound: 'default'
            });
        });

        await LocalNotifications.schedule({ notifications });
        return true;
    } catch (err) {
        console.warn('Error programando alertas locales nutricionales:', err);
        return false;
    }
};

/**
 * Cancela las alertas nutricionales del celular
 */
export const cancelarAlertasNutricionalesLocales = async () => {
    try {
        const idsAlertas = [
            ...ALERTA_COMIDAS_HORARIOS_DEFAULT.map(a => a.id),
            ...ALERTA_AGUA_HORAS.map((h, idx) => 200 + idx)
        ];
        await LocalNotifications.cancel({ notifications: idsAlertas.map(id => ({ id })) });
        return true;
    } catch (e) {
        return false;
    }
};

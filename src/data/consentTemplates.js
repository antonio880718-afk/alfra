/**
 * Catálogo Extendido de Consentimientos Informados Clínicos de Clínica ALFRA
 * Incluye procedimientos Faciales, Corporales, Láser, y Documentos Legales Generales.
 */
export const CONSENT_TEMPLATES = [
  // ─── FACIALES ─────────────────────────────────────────────────────────────
  {
    id: "fac_botox",
    name: "Aplicación de Toxina Botulínica (Botox / Dysport)",
    categoria: "Facial",
    type: "Facial",
    tituloPdf: "CONSENTIMIENTO INFORMADO: APLICACIÓN DE TOXINA BOTULÍNICA",
    procedimiento: "Infiltración intramuscular o intradérmica de toxina botulínica purificada en zonas hiperquinéticas (frente, entrecejo, patas de gallo, bruxismo o bandas platismales) para modular la contracción muscular y atenuar líneas de expresión.",
    beneficios: "Relajación controlada de músculos de expresión, prevención y desvanecimiento de arrugas dinámicas, rejuvenecimiento del tercio superior del rostro.",
    riesgos: "Eritema leve o edema puntual en sitios de inyección, pequeños hematomas transitorios, cefalea leve en las primeras 24-48 horas. Raras veces ptosis palpebral temporal reversible o asimetría corregible en el retoque a los 15 días.",
    cuidados: "No acostarse ni recostarse en las siguientes 4 horas. No masajear ni frotar la zona tratada durante 24 horas. Evitar ejercicio intenso, saunas, albercas y consumo de alcohol durante 48 horas.",
    declaracion: "Declaro que he sido informado(a) sobre el mecanismo de acción de la toxina botulínica, su duración promedio (3 a 6 meses) y que los resultados óptimos se evalúan entre los 10 y 15 días posteriores a la sesión. Certifico que no padezco enfermedades neuromusculares (miastenia gravis, ELA), ni me encuentro embarazada o en lactancia."
  },
  {
    id: "fac_hialuronico",
    name: "Relleno y Armonización Facial con Ácido Hialurónico",
    categoria: "Facial",
    type: "Facial",
    tituloPdf: "CONSENTIMIENTO INFORMADO: IMPLANTE DÉRMICO DE ÁCIDO HIALURÓNICO",
    procedimiento: "Infiltración subdérmica o supraperióstica de ácido hialurónico reticulado estéril mediante aguja fina o microcánula para reposición de volúmenes, perfilado de labios, proyección de mentón, pómulos o corrección de surcos nasogenianos.",
    beneficios: "Restauración volumétrica inmediata, definición de contornos faciales, hidratación dérmica profunda y estimulación indirecta de colágeno.",
    riesgos: "Inflamación local transitoria (24 a 72 horas), eritema, sensibilidad al tacto, formación de hematomas leves. Raras veces asimetría transitoria por edema, nódulos palpables o reacción alérgica.",
    cuidados: "Aplicar frío local indirecto si hay edema. No frotar ni presionar intensamente la zona inyectada por 48 horas. Evitar exposición solar directa, fuentes extremas de calor (baños de vapor/saunas) y actividades deportivas extenuantes durante 72 horas.",
    declaracion: "Comprendo que el ácido hialurónico es un compuesto reabsorbible y biocompatible con duración promedio de 9 a 18 meses según el reticulado y mi metabolismo basal. He informado de cualquier relleno permanente previo y declaro no presentar infecciones activas en piel."
  },
  {
    id: "fac_peeling",
    name: "Peeling Químico Médico (Superficial / Medio)",
    categoria: "Facial",
    type: "Facial",
    tituloPdf: "CONSENTIMIENTO INFORMADO: PROCEDIMIENTO DE PEELING QUÍMICO",
    procedimiento: "Aplicación tópica de soluciones químicas dermatológicas (AHA, BHA, Ácido Salicílico, Glicólico, Mandélico, TCA o Retinoico) para exfoliación controlada de capas epidérmicas y estimulación de regeneración celular.",
    beneficios: "Atenuación de manchas y discromías, desobstrucción de poros, mejoría en secuelas de acné, unificación del tono cutáneo y aumento de luminosidad.",
    riesgos: "Sensación transitoria de calor o ardor durante la aplicación, enrojecimiento temporal, descamación visible entre el día 2 y 7, resequedad cutánea. En casos de fotoprotección deficiente: hiperpigmentación postinflamatoria.",
    cuidados: "Uso obligatorio y estricto de protector solar FPS 50+ cada 3-4 horas. No arrancar ni tirar de las pielecillas descamadas. Hidratación intensiva según prescripción y no aplicar exfoliantes físicos o ácidos en casa por 10 días.",
    declaracion: "Acepto seguir estrictamente el protocolo de fotoprotección y entiendo que arrancar piel en descamación puede ocasionar manchas o cicatrices. Certifico que no he consumido isotretinoína oral en los últimos 6 meses."
  },
  {
    id: "fac_limpieza_hidrafacial",
    name: "Limpieza Facial Profunda, Hidrafacial y Desincrustación",
    categoria: "Facial",
    type: "Facial",
    tituloPdf: "CONSENTIMIENTO INFORMADO: HIGIENE FACIAL PROFUNDA E HIDRAFACIAL",
    procedimiento: "Protocolo integral de higiene facial que combina limpieza dérmica, exfoliación enzimática/mecánica, vapor de ozono, desincrustación de comedones, hidro-dermoabrasión con sueros nutritivos, alta frecuencia y mascarilla descongestiva.",
    beneficios: "Desobstrucción profunda de folículos pilosebáceos, eliminación de impurezas y células muertas, oxigenación dérmica, reducción del brillo graso e hidratación intensiva.",
    riesgos: "Eritema leve temporal posterior a la extracción, ligera sensibilidad en pieles hiperreactivas durante las primeras 12 a 24 horas.",
    cuidados: "No maquillarse en las 12 horas posteriores a la sesión. Utilizar crema calmante y protector solar FPS 50+. Evitar piscinas y actividades que generen sudoración extrema el día del tratamiento.",
    declaracion: "Doy mi consentimiento para la valoración y extracción manual/instrumental de impurezas conforme al criterio cosmiátrico de la especialista."
  },
  {
    id: "fac_microneedling",
    name: "Microneedling / Dermapen con Bioactivos y Péptidos",
    categoria: "Facial",
    type: "Facial",
    tituloPdf: "CONSENTIMIENTO INFORMADO: MICRONEEDLING Y BIOESTIMULACIÓN DÉRMICA",
    procedimiento: "Terapia de inducción de colágeno mediante microagujas automatizadas de grado quirúrgico que generan microcanales en la epidermis/dermis para facilitar la penetración transepidérmica de activos estériles (ácido hialurónico, péptidos, vitaminas).",
    beneficios: "Estimulación masiva de colágeno y elastina, mejoría en textura dérmica, cicatrices atróficas de acné, reducción del tamaño de poros y rejuvenecimiento dérmico.",
    riesgos: "Enrojecimiento similar a quemadura solar leve (1 a 3 días), edema transitorio, ligera sensación de tirantez o calor, microdescamación fina.",
    cuidados: "No tocarse el rostro con manos sin lavar. Usar únicamente los productos estériles recomendados en las primeras 24 horas. Evitar maquillaje por 24 horas y exposición solar directa por 7 días.",
    declaracion: "Certifico que no cuento con lesiones de acné inflamatorio activo, herpes simple activo ni historial de cicatrización queloide en la zona facial."
  },
  {
    id: "fac_radiofrecuencia",
    name: "Radiofrecuencia Facial y Tensado Cutáneo (HIFU / Bipolar)",
    categoria: "Facial",
    type: "Facial",
    tituloPdf: "CONSENTIMIENTO INFORMADO: RADIOFRECUENCIA FACIAL Y TENSADO CUTÁNEO",
    procedimiento: "Aplicación de energía electromagnética o ultrasonido focalizado para generar un calentamiento dérmico controlado que contrae las fibras elásticas existentes y promueve la neocolagénesis.",
    beneficios: "Efecto lifting no invasivo, reafirmación del óvalo facial, atenuación de flacidez en mejillas, surcos y cuello.",
    riesgos: "Eritema y ligero calor en la zona tratada que cede en un par de horas. Excepcionalmente inflamación leve transitoria.",
    cuidados: "Mantener excelente hidratación oral post-sesión. Aplicar gel descongestivo o protector solar de amplio espectro. No lavar la zona con agua excesivamente caliente el mismo día.",
    declaracion: "Confirmo que no soy portador(a) de marcapasos, desfibriladores ni implantes metálicos en rostro o cráneo, y no me encuentro en estado de gestación."
  },
  {
    id: "fac_hilos_bioestimuladores",
    name: "Hilos Tensores / Bioestimuladores Dérmicos (Radiesse / Sculptra)",
    categoria: "Facial",
    type: "Facial",
    tituloPdf: "CONSENTIMIENTO INFORMADO: BIOESTIMULADORES E HILOS TENSORES",
    procedimiento: "Colocación subdérmica de hilos reabsorbibles (PDO/PLLA) o inyección de hidroxiapatita de calcio / ácido poliláctico para tracción tisular e inducción colagénica progresiva.",
    beneficios: "Soporte estructural de tejidos caídos, redensificación cutánea profunda y rejuvenecimiento a mediano y largo plazo.",
    riesgos: "Dolor o molestia a la palpación durante 3 a 7 días, inflamación, equimosis (moretones), sensación transitoria de tirantez al gesticular.",
    cuidados: "Limitar la gesticulación exagerada o aperturas bucales amplias por 7 días. Dormir boca arriba las primeras noches. No realizar masajes faciales ni tratamientos con aparatología en la zona por 30 días.",
    declaracion: "Entiendo que el resultado de bioestimulación es progresivo (alcanzando su máximo entre el segundo y tercer mes) y acepto las revisiones médicas de control."
  },

  // ─── CORPORALES ────────────────────────────────────────────────────────────
  {
    id: "corp_aparatologia_integral",
    name: "Aparatología Reductiva: Cavitación, Radiofrecuencia y Vacumterapia",
    categoria: "Corporal",
    type: "Corporal",
    tituloPdf: "CONSENTIMIENTO INFORMADO: APARATOLOGÍA REDUCTIVA Y MOLDEO CORPORAL",
    procedimiento: "Sesión combinada que emplea ultrasonido cavitacional para disgregación de tejido adiposo localizado, vacumterapia para drenaje linfático mecánico y radiofrecuencia para tensado cutáneo.",
    beneficios: "Reducción de circunferencia corporal, movilización de acúmulos grasos resistentes, mejoría en aspecto de celulitis y compactación de tejidos.",
    riesgos: "Eritema temporal por succión o calor, sensación de calor interno, ligero zumbido ótico temporal durante cavitación, posible aparición de petequias o hematomas leves por vacumterapia.",
    cuidados: "Beber mínimo 2 a 2.5 litros de agua natural al día para facilitar la excreción linfática y renal de ácidos grasos. Realizar 30 minutos de actividad cardiovascular el mismo día. Seguir el plan nutricional asignado.",
    declaracion: "Entiendo que la aparatología actúa movilizando la grasa, pero su eliminación fisiológica definitiva depende de mi hidratación y gasto calórico (Principio 50/50). Certifico no padecer insuficiencia hepática, renal ni portar marcapasos."
  },
  {
    id: "corp_hidrolipoclasia_enzimas",
    name: "Hidrolipoclasia Ultrasónica y Lipoenzimas Recombinantes (PBSerum)",
    categoria: "Corporal",
    type: "Corporal",
    tituloPdf: "CONSENTIMIENTO INFORMADO: HIDROLIPOCLASIA Y ENZIMAS RECOMBINANTES",
    procedimiento: "Infiltración estéril de solución hipotónica y/o cóctel de enzimas recombinantes (Lipasa, Colagenasa, Hialuronidasa) en tejido celular subcutáneo, seguida de ultrasonido focalizado para lisis de adipocitos y reestructuración fibrilar.",
    beneficios: "Eliminación efectiva de grasa localizada rebelde, degradación de fibrosis celulítica, remodelado de cintura, abdomen, flancos o muslos.",
    riesgos: "Sensación de ardor o dolor moderado durante la infusión, inflamación local (edema de 3 a 5 días), calor en la zona, equimosis frecuentes en sitios de punción.",
    cuidados: "Uso continuo de faja compresiva post-procedimiento si es indicado. Evitar ingesta de grasas saturadas y carbohidratos refinados por 72 horas. Ingesta abundante de líquidos y no exponer la zona al sol si hay hematomas.",
    declaracion: "Certifico no ser alérgico(a) a los componentes de la fórmula ni padecer trastornos de tiroides no controlados, hemofilia o estar en tratamiento anticoagulante."
  },
  {
    id: "corp_maderoterapia_drenaje",
    name: "Maderoterapia Corporal, Masaje Reductivo y Drenaje Linfático",
    categoria: "Corporal",
    type: "Corporal",
    tituloPdf: "CONSENTIMIENTO INFORMADO: MADEROTERAPIA Y TERAPIA MANUAL REDUCTIVA",
    procedimiento: "Técnica holística y mecánica que utiliza instrumentos anatómicos de madera pulida y maniobras vigorosas de masaje para modelar el contorno, activar la microcirculación y estimular los ganglios linfáticos.",
    beneficios: "Alivio de retención de líquidos, moldeado de silueta, reducción de nódulos de celulitis, relajación muscular profunda y oxigenación celular.",
    riesgos: "Sensibilidad o dolorimiento muscular tipo post-entrenamiento (primeras 24-48 horas), eritema, posibilidad de pequeños moretones en personas con fragilidad capilar.",
    cuidados: "Mantenerse hidratado(a). No consumir alimentos pesados inmediatamente después de la sesión. Si hay dolorimiento, aplicar compresas tibias o analgésico de venta libre si se requiere.",
    declaracion: "Autorizo a la especialista a realizar maniobras de masaje y maderoterapia en las zonas acordadas y he manifestado mi umbral de presión adecuado."
  },
  {
    id: "corp_criolipolisis",
    name: "Criolipólisis: Reducción No Invasiva por Frío Controlado",
    categoria: "Corporal",
    type: "Corporal",
    tituloPdf: "CONSENTIMIENTO INFORMADO: PROCEDIMIENTO DE CRIOLIPÓLISIS",
    procedimiento: "Aplicación de frío médico controlado (-5°C a -10°C) mediante aplicadores con succión de vacío sobre pliegues de adiposidad para inducir la apoptosis (muerte celular programada) de adipocitos sin dañar la piel circundante.",
    beneficios: "Reducción medible del 20% al 30% del grosor de la capa grasa tratada en una a tres sesiones espaciadas.",
    riesgos: "Sensación intensa de frío y tirantez los primeros minutos. Posterior entumecimiento o adormecimiento temporal de la piel (1 a 4 semanas), eritema, edema y sensibilidad táctil.",
    cuidados: "Masaje post-aplicador inmediato realizado por la clínica. No aplicar calor directo inmediatamente. Continuar con vida habitual y registrar avance en las semanas 4 a 12.",
    declaracion: "Certifico que no padezco crioglobulinemia, enfermedad por crioaglutininas, hemoglobinuria paroxística por frío ni síndrome de Raynaud."
  },
  {
    id: "corp_anticelulitis_ondas_rusas",
    name: "Tratamiento Anticelulitis, Reafirmación y Electroestimulación (Ondas Rusas)",
    categoria: "Corporal",
    type: "Corporal",
    tituloPdf: "CONSENTIMIENTO INFORMADO: REAFIRMACIÓN Y ELECTROESTIMULACIÓN MUSCULAR",
    procedimiento: "Colocación de electrodos en grupos musculares estratégicos para emitir corrientes de media frecuencia que inducen contracciones musculares rítmicas e intensas combinadas con geles tensores activos.",
    beneficios: "Tonificación muscular, levantamiento y firmeza de glúteos, drenaje de toxinas y reducción de flacidez dérmica y muscular.",
    riesgos: "Fatiga o agujetas musculares al día siguiente, enrojecimiento transitorio bajo los parches.",
    cuidados: "Adecuada ingesta de proteínas e hidratación para apoyar la recuperación de fibras musculares.",
    declaracion: "Confirmo que no poseo implantes de estimulación cardíaca, prótesis metálicas en la zona tratada ni antecedentes de epilepsia."
  },
  {
    id: "corp_papada_cuello",
    name: "Perfilado Reductivo de Papada y Cuello (Enzimas + Radiofrecuencia)",
    categoria: "Corporal",
    type: "Mixto",
    tituloPdf: "CONSENTIMIENTO INFORMADO: TRATAMIENTO REDUCTIVO DE PAPADA Y CUELLO",
    procedimiento: "Protocolo para la disminución del tejido graso submentoniano y tensado de la piel del cuello mediante aparatología y/o activos lipolíticos localizados.",
    beneficios: "Definición del ángulo mandibular, adelgazamiento del cuello y reducción visible del doble mentón.",
    riesgos: "Sensación de tirantez, inflamación local de 2 a 4 días, posibles hematomas pequeños.",
    cuidados: "Dormir con almohada que mantenga el cuello en posición neutral. Usar mentonera elástica si fue recomendada por la especialista. Evitar masajes bruscos en los primeros días.",
    declaracion: "Otorgo mi conformidad para el abordaje submentoniano y declaro no tener afecciones tiroideas descompensadas."
  },

  // ─── LÁSER Y FOTOTERAPIA ──────────────────────────────────────────────────
  {
    id: "laser_depilacion",
    name: "Depilación Láser Diodo / Fotodepilación IPL Médica",
    categoria: "Láser",
    type: "Mixto",
    tituloPdf: "CONSENTIMIENTO INFORMADO: DEPILACIÓN LÁSER DIODO / IPL",
    procedimiento: "Emisión de pulsos lumínicos con longitud de onda específica absorbida selectivamente por la melanina del folículo piloso para inhibir permanentemente el crecimiento capilar.",
    beneficios: "Eliminación progresiva del 85% al 95% del vello no deseado, erradicación de foliculitis y mejoría notable en la textura cutánea.",
    riesgos: "Sensación de calor o piquete durante el disparo, eritema perifolicular transitorio (horas), ligero edema. Raras veces hipo o hiperpigmentación si hubo exposición solar reciente.",
    cuidados: "No exponer la zona al sol ni utilizar camas de bronceado 15 días antes ni 15 días después. Rasurar la zona 24 horas antes con rastrillo (no cera ni pinzas). Uso diario de protector solar.",
    declaracion: "Certifico que no he usado cera, pinzas ni decolorantes en las últimas 3 semanas, no estoy tomando medicamentos fotosensibilizantes y mi piel no ha sido bronceada recientemente."
  },
  {
    id: "laser_manchas_rejuvenecimiento",
    name: "Tratamiento Láser para Manchas, Léntigos y Rejuvenecimiento",
    categoria: "Láser",
    type: "Facial",
    tituloPdf: "CONSENTIMIENTO INFORMADO: TRATAMIENTO LÁSER DE LESIONES PIGMENTADAS",
    procedimiento: "Fototermólisis fraccionada selectiva dirigida a acúmulos melánicos y pigmentos epidérmicos para fragmentación celular y posterior aclaramiento fisiológico.",
    beneficios: "Desvanecimiento de manchas solares, léntigos seniles, aclaramiento del fotodaño y estimulación dérmica profunda.",
    riesgos: "Oscurecimiento transitorio de las manchas tratadas (formación de microcostras finas que caen solas en 7 a 10 días), enrojecimiento y sensación de calor.",
    cuidados: "Protección solar rigurosa FPS 50+ cada 3 horas. No tallar la cara ni forzar la caída de microcostras. Lavar con limpiador syndet suave.",
    declaracion: "Acepto que las manchas de origen hormonal (como melasma) requieren control crónico y fotoprotección permanente para evitar reactivaciones."
  },

  // ─── GENERALES Y CARTAS COMPROMISO ─────────────────────────────────────────
  {
    id: "gen_compromiso_50_50",
    name: "Carta Compromiso y Corresponsabilidad de Paciente ALFRA (Principio 50/50)",
    categoria: "General",
    type: "General",
    tituloPdf: "CARTA COMPROMISO Y CORRESPONSABILIDAD DEL PACIENTE (PRINCIPIO 50/50)",
    procedimiento: "Acuerdo voluntario de corresponsabilidad clínica para tratamientos corporales, reductivos, faciales y metabólicos en Clínica ALFRA.",
    beneficios: "Maximización y aceleración de resultados clínicos estéticos, prevención de rebotes y consolidación a largo plazo de objetivos corporales y dérmicos.",
    riesgos: "La falta de apego a las indicaciones de nutrición, hidratación y ejercicio puede reducir hasta en un 60% la efectividad de las tecnologías aplicadas en cabina.",
    cuidados: "Cumplimiento de la meta de ingesta calórica diaria. Consumo de al menos 2 litros de agua natural al día. Registro de hábitos en la App ALFRA. Asistencia puntual a citas programadas.",
    declaracion: "Yo, paciente de Clínica ALFRA, entiendo y acepto formalmente que el 50% de mis resultados depende de la calidad de la aparatología y protocolos en cabina, y el 50% restante indispensable depende de mi compromiso diario en casa con mis hábitos, nutrición e hidratación. Me comprometo a cumplir cabalmente las indicaciones de mi especialista."
  },
  {
    id: "gen_procedimientos_esteticos",
    name: "Consentimiento General para Procedimientos Cosmetológicos y Estéticos",
    categoria: "General",
    type: "General",
    tituloPdf: "CONSENTIMIENTO INFORMADO GENERAL PARA ATENCIÓN ESTÉTICA Y COSMETOLÓGICA",
    procedimiento: "Autorización general para valoraciones clínicas, aparatología estética de cabina, protocolos tópicos, masajes y formulaciones dermocosméticas en Clínica ALFRA.",
    beneficios: "Atención personalizada, seguimiento evolutivo en expediente clínico digital, optimización de la salud y estética integral.",
    riesgos: "Sensibilidad cutánea, enrojecimiento temporal, reacciones alérgicas imprevistas a formulaciones cosméticas.",
    cuidados: "Reportar de inmediato cualquier síntoma inhabitual al canal de WhatsApp de la clínica (+527535386018) o a través de la App en el botón 'Tengo una duda'.",
    declaracion: "He respondido con total veracidad a la Ficha Médica y Anamnesis, sin omitir alergias, antecedentes patológicos, cirugías ni sospecha de embarazo. Autorizo al equipo de especialistas de Clínica ALFRA a realizar los tratamientos prescritos en mi plan de atención."
  },
  {
    id: "gen_fotografia_expediente",
    name: "Consentimiento para Toma de Fotografía Clínica y Resguardo de Expediente",
    categoria: "General",
    type: "General",
    tituloPdf: "CONSENTIMIENTO INFORMADO DE REGISTRO FOTOGRÁFICO Y EXPEDIENTE CLÍNICO",
    procedimiento: "Captura de fotografías clínicas estandarizadas de avance (antes, durante y después del tratamiento) y registro biométrico/medidas corporales.",
    beneficios: "Auditoría objetiva de resultados, comparativas evolutivas precisas y control de calidad médica del tratamiento.",
    riesgos: "Ningún riesgo para la salud. El material se almacena de forma encriptada bajo estándares médicos de estricta confidencialidad.",
    cuidados: "No aplica.",
    declaracion: "Otorgo mi consentimiento expreso para que el personal de Clínica ALFRA realice el registro fotográfico y de medidas de mi tratamiento. Comprendo que este material forma parte de mi expediente clínico confidencial y no será publicado sin mi autorización explícita previa."
  }
];

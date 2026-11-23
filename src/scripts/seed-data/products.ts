// Generated once from the storefront fixture modules/catalog/infrastructure/fixtures/{chargers,power-banks,cables,hubs-and-docks,wireless-charging,audio,storage,apple}.ts, in the order of index.ts
// (MIGEANJE-STORE-APP/src); see docs/seed-plan.md, "Data sources".

import type { SeedProduct } from "./types"

/**
 * The 19 products in F1 "featured" order. The Apple line has no prices (R9):
 * its F1 reference prices are dropped on purpose.
 */
export const PRODUCTS: SeedProduct[] = [
  {
    slug: "anker-nano-charger-45w-smart-display",
    name: "Nano Charger 45W Smart Display",
    model: "A121D",
    brand: "anker",
    category: "cargadores",
    summary:
      "Cargador USB-C de 45 W del tamaño de un cubo, con pantalla que muestra la potencia y la temperatura mientras cargas.",
    specs: {
      maxPower: 45,
      maxPortPower: 45,
      usbCPorts: 1,
      usbAPorts: 0,
      protocols: ["USB PD", "PPS"],
      display: true,
      dimensions: "34 × 35.5 × 40 mm",
      weight: 75,
    },
    options: [
      {
        key: "color",
        label: "Color",
      },
    ],
    variants: [
      {
        sku: "ANK-A121D-WHT",
        options: {
          color: "Blanco",
        },
        priceCentimos: 24890,
        availability: "backorder",
      },
      {
        sku: "ANK-A121D-BLK",
        options: {
          color: "Negro",
        },
        priceCentimos: 24890,
        availability: "backorder",
      },
      {
        sku: "ANK-A121D-BLU",
        options: {
          color: "Azul",
        },
        priceCentimos: 24890,
        availability: "backorder",
      },
      {
        sku: "ANK-A121D-ORG",
        options: {
          color: "Naranja",
        },
        priceCentimos: 24890,
        availability: "backorder",
      },
    ],
    tags: ["gan", "carga rápida", "usb-c", "iphone", "compacto"],
  },
  {
    slug: "anker-prime-charger-100w-3-puertos",
    name: "Prime Charger 100W, 3 puertos",
    model: "A2688",
    brand: "anker",
    category: "cargadores",
    summary:
      "Tres puertos (2 USB-C y 1 USB-A) para cargar tu laptop, celular y audífonos con un solo enchufe.",
    specs: {
      maxPower: 100,
      maxPortPower: 100,
      usbCPorts: 2,
      usbAPorts: 1,
      display: false,
      dimensions: "43.5 × 29 × 67.8 mm",
      weight: 170,
    },
    options: [],
    variants: [
      {
        sku: "ANK-A2688",
        options: {},
        priceCentimos: 18990,
        availability: "in_stock",
      },
    ],
    tags: ["gan", "laptop", "usb-c", "usb-a", "viaje"],
    expertReview: {
      verdict:
        "El cargador que reemplaza a todos los de tu mochila: 100 W para una laptop y puertos de sobra para el resto.",
      forWhom: [
        "Tienes una laptop USB-C de hasta 100 W y quieres un solo cargador",
        "Viajas y cargas laptop, celular y audífonos en una sola noche",
      ],
      notFor: [
        "Necesitas 100 W para tu laptop mientras cargas otros equipos: con varios puertos a la vez el máximo combinado es 89 W",
        "Solo cargas un celular: un cargador de 30 a 45 W es más pequeño y barato",
      ],
      rubric: [
        {
          criterion: "Potencia",
          score: 5,
          note: "100 W por un solo puerto alcanzan para la mayoría de laptops USB-C.",
        },
        {
          criterion: "Uso con varios equipos",
          score: 4,
          note: "Tres puertos, pero el total baja a 89 W al usar más de uno.",
        },
        {
          criterion: "Portabilidad",
          score: 4,
          note: "170 g y enchufe compacto; más grande que un cargador de celular.",
        },
        {
          criterion: "Relación precio-calidad",
          score: 5,
          note: "Por lo que cuesta, reemplaza dos o tres cargadores.",
        },
      ],
    },
  },
  {
    slug: "anker-prime-charger-160w-3-puertos-smart-display",
    name: "Prime Charger 160W, 3 puertos, Smart Display",
    model: "A2687",
    brand: "anker",
    category: "cargadores",
    summary:
      "160 W repartidos en tres puertos USB-C, con pantalla para ver la potencia de cada puerto. Pensado para laptops exigentes.",
    specs: {
      maxPower: 160,
      maxPortPower: 140,
      usbCPorts: 3,
      usbAPorts: 0,
      protocols: ["USB PD 3.1"],
      display: true,
      dimensions: "65 × 52 × 35 mm",
      weight: 220,
    },
    options: [],
    variants: [
      {
        sku: "ANK-A2687",
        options: {},
        priceCentimos: 34990,
        availability: "backorder",
      },
    ],
    tags: ["gan", "laptop", "usb-c", "macbook pro", "pd 3.1"],
  },
  {
    slug: "anker-maggo-power-bank-10k-slim",
    name: "MagGo Power Bank 10K Slim",
    model: "A1664",
    brand: "anker",
    category: "power-banks",
    summary:
      "Batería magnética delgada con Qi2 de 15 W: se pega a tu iPhone y lo carga sin cables. También carga por USB-C a 30 W.",
    specs: {
      capacity: 10000,
      maxPortPower: 30,
      ports: "1 × USB-C (entrada y salida)",
      inputPower: 30,
      wireless: true,
      wirelessPower: 15,
      dimensions: "104 × 70.6 × 14.7 mm",
      weight: 215.9,
    },
    options: [
      {
        key: "color",
        label: "Color",
      },
    ],
    variants: [
      {
        sku: "ANK-A1664-BLK",
        options: {
          color: "Negro",
        },
        priceCentimos: 19990,
        availability: "in_stock",
      },
      {
        sku: "ANK-A1664-WHT",
        options: {
          color: "Blanco",
        },
        priceCentimos: 19990,
        availability: "in_stock",
      },
      {
        sku: "ANK-A1664-TEA",
        options: {
          color: "Verde azulado",
        },
        priceCentimos: 19990,
        availability: "in_stock",
      },
      {
        sku: "ANK-A1664-PNK",
        options: {
          color: "Rosado",
        },
        priceCentimos: 19990,
        availability: "in_stock",
      },
    ],
    tags: ["magsafe", "qi2", "inalámbrico", "iphone", "magnético"],
  },
  {
    slug: "anker-prime-power-bank-20k-220w",
    name: "Prime Power Bank 20K 220W",
    model: "A110B",
    brand: "anker",
    category: "power-banks",
    summary:
      "20 100 mAh y 220 W en total para cargar una laptop y dos equipos más. Se recarga a 100 W y muestra todo en su pantalla.",
    specs: {
      capacity: 20100,
      maxPower: 220,
      maxPortPower: 140,
      ports: "2 × USB-C (hasta 140 W), 1 × USB-A (22.5 W)",
      inputPower: 100,
      wireless: false,
      display: true,
      dimensions: "44 × 50 × 147 mm",
      weight: 510,
    },
    options: [],
    variants: [
      {
        sku: "ANK-A110B",
        options: {},
        priceCentimos: 64890,
        availability: "in_stock",
      },
    ],
    tags: ["laptop", "usb-c", "pd 3.1", "viaje"],
  },
  {
    slug: "ugreen-nexode-power-bank-25000mah-200w",
    name: "Nexode Power Bank 25000 mAh 200W",
    model: "35525",
    brand: "ugreen",
    category: "power-banks",
    summary:
      "25 000 mAh (90 Wh) y 200 W en total: hasta 140 W por el primer USB-C y 100 W por el segundo para cargar dos laptops.",
    specs: {
      capacity: 25000,
      maxPower: 200,
      maxPortPower: 140,
      ports: "2 × USB-C (140 W y 100 W), 1 × USB-A",
      wireless: false,
      display: true,
      weight: 508,
    },
    options: [],
    variants: [
      {
        sku: "UGR-35525",
        options: {},
        priceCentimos: 32890,
        availability: "in_stock",
      },
    ],
    tags: ["laptop", "usb-c", "pd 3.1", "viaje", "90 wh"],
    expertReview: {
      verdict:
        "La batería para trabajar fuera de casa: carga dos laptops a la vez y queda por debajo de los 100 Wh.",
      forWhom: [
        "Trabajas con laptop en viajes, coworkings o fuera de la oficina",
        "Quieres cargar laptop y celular a la vez sin buscar enchufe",
      ],
      notFor: [
        "Buscas algo para el bolsillo: pesa alrededor de medio kilo",
        "Solo cargas tu celular: una de 10 000 mAh te basta y pesa menos de la mitad",
      ],
      rubric: [
        {
          criterion: "Potencia",
          score: 5,
          note: "140 W por un puerto y 200 W en total cubren laptops exigentes.",
        },
        {
          criterion: "Capacidad",
          score: 5,
          note: "90 Wh: de las más grandes que suelen aceptarse en cabina (revisa la regla de tu aerolínea).",
        },
        {
          criterion: "Portabilidad",
          score: 2,
          note: "Unos 508 g: va en la mochila, no en el bolsillo.",
        },
        {
          criterion: "Información en pantalla",
          score: 4,
          note: "La pantalla muestra la carga restante y la potencia de salida.",
        },
      ],
    },
  },
  {
    slug: "anker-prime-cable-usb-c-240w-trenzado",
    name: "Prime Cable USB-C a USB-C 240W trenzado",
    model: "A88E2",
    brand: "anker",
    category: "cables",
    summary:
      "Cable USB-C certificado USB-IF que soporta hasta 240 W, con trenzado de material reciclado probado para más de 300 000 dobleces.",
    specs: {
      connectors: "USB-C a USB-C",
      maxPower: 240,
      maxCurrent: 5,
      dataSpeed: 480,
      certification: "USB-IF",
      jacket: "Trenzado de material reciclado",
      bendLifespan: 300000,
    },
    options: [
      {
        key: "length",
        label: "Longitud",
      },
    ],
    variants: [
      {
        sku: "ANK-A88E2-090",
        options: {
          length: "0.9 m",
        },
        priceCentimos: 8990,
        availability: "in_stock",
      },
      {
        sku: "ANK-A88E2-180",
        options: {
          length: "1.8 m",
        },
        priceCentimos: 9990,
        availability: "in_stock",
      },
    ],
    tags: ["usb-c", "240 w", "laptop", "trenzado", "usb-if"],
  },
  {
    slug: "ugreen-cable-usb-c-a-lightning-mfi-trenzado",
    name: "Cable USB-C a Lightning MFi trenzado",
    model: "60759 / 60761",
    brand: "ugreen",
    category: "cables",
    summary:
      "Cable con certificación MFi de Apple para cargar rápido iPhone y iPad con conector Lightning, con recubrimiento de nailon trenzado.",
    specs: {
      connectors: "USB-C a Lightning",
      maxCurrent: 3,
      dataSpeed: 480,
      certification: "Apple MFi",
      jacket: "Nailon trenzado",
    },
    options: [
      {
        key: "length",
        label: "Longitud",
      },
    ],
    variants: [
      {
        sku: "UGR-60759",
        options: {
          length: "1 m",
        },
        priceCentimos: 5490,
        availability: "in_stock",
      },
      {
        sku: "UGR-60761",
        options: {
          length: "2 m",
        },
        priceCentimos: 7890,
        availability: "in_stock",
      },
    ],
    tags: ["lightning", "iphone", "mfi", "carga rápida", "trenzado"],
  },
  {
    slug: "ugreen-revodok-pro-210-10-en-1",
    name: "Revodok Pro 210 Hub USB-C 10 en 1",
    model: "15534",
    brand: "ugreen",
    category: "hubs-y-docks",
    summary:
      "Hub USB-C con dos HDMI, Ethernet Gigabit, lectores SD y microSD y carga de hasta 85 W a tu laptop.",
    specs: {
      portCount: 10,
      hostConnection: "USB-C",
      videoOutputs: "2 × HDMI",
      maxResolution: "4K a 60 Hz en dos pantallas u 8K a 30 Hz en una",
      laptopCharging: 85,
      maxDataSpeed: 5,
      ethernet: 1,
      cardReader: true,
      adapterIncluded: false,
      dimensions: "140 × 57 × 16 mm",
    },
    options: [],
    variants: [
      {
        sku: "UGR-15534",
        options: {},
        priceCentimos: 19890,
        availability: "backorder",
      },
    ],
    tags: ["hub", "usb-c", "hdmi", "doble monitor", "ethernet", "windows"],
    expertReview: {
      verdict:
        "Excelente hub para Windows y para una pantalla externa en Mac. Ojo: en macOS las dos HDMI muestran la misma imagen.",
      forWhom: [
        "Usas una laptop con Windows y quieres dos monitores extendidos",
        "Tienes una Mac y te basta con un monitor externo, más Ethernet y lector de tarjetas",
      ],
      notFor: [
        "Quieres dos monitores extendidos en tu Mac: macOS no soporta MST, así que ambas pantallas muestran la misma imagen",
        "Necesitas transferir archivos grandes muy rápido: sus puertos USB llegan a 5 Gbps",
      ],
      rubric: [
        {
          criterion: "Conectividad",
          score: 5,
          note: "Dos HDMI, Ethernet, SD, microSD y puertos USB-C y USB-A en un solo cable.",
        },
        {
          criterion: "Compatibilidad con Mac",
          score: 2,
          note: "En macOS las dos HDMI duplican la misma imagen; solo una pantalla extendida.",
        },
        {
          criterion: "Carga a tu laptop",
          score: 4,
          note: "Recibe hasta 100 W de tu cargador y entrega hasta 85 W a la laptop.",
        },
        {
          criterion: "Velocidad de datos",
          score: 3,
          note: "5 Gbps: suficiente para memorias y discos externos comunes.",
        },
      ],
    },
  },
  {
    slug: "ugreen-revodok-max-213-thunderbolt-4-13-en-1",
    name: "Revodok Max 213 Dock Thunderbolt 4 13 en 1",
    model: "25054A",
    brand: "ugreen",
    category: "hubs-y-docks",
    summary:
      "Dock Thunderbolt 4 de escritorio con tres puertos de 40 Gbps, DisplayPort 1.4, Ethernet de 2.5 Gb y adaptador GaN de 180 W incluido.",
    specs: {
      portCount: 13,
      hostConnection: "Thunderbolt 4",
      videoOutputs: "1 × DisplayPort 1.4 y puertos Thunderbolt 4",
      laptopCharging: 90,
      maxDataSpeed: 40,
      ethernet: 2.5,
      cardReader: true,
      adapterIncluded: true,
    },
    options: [],
    variants: [
      {
        sku: "UGR-25054A",
        options: {},
        priceCentimos: 94990,
        availability: "backorder",
      },
    ],
    tags: ["dock", "thunderbolt 4", "displayport", "ethernet", "escritorio"],
  },
  {
    slug: "anker-maggo-estacion-de-carga-3-en-1-plegable",
    name: "MagGo Estación de carga 3 en 1 plegable",
    model: "A25M8",
    brand: "anker",
    category: "carga-inalambrica",
    summary:
      "Carga tu iPhone (Qi2, 15 W), tu Apple Watch y tus AirPods a la vez. Se pliega en un cubo de 6 cm e incluye adaptador de 40 W.",
    specs: {
      devices: 3,
      standard: "Qi2",
      maxPhonePower: 15,
      watchCharger: true,
      adapterIncluded: true,
      foldable: true,
      dimensions: "60 × 60 × 36 mm (plegada)",
    },
    options: [
      {
        key: "color",
        label: "Color",
      },
    ],
    variants: [
      {
        sku: "ANK-A25M8-BLK",
        options: {
          color: "Negro",
        },
        priceCentimos: 39990,
        availability: "in_stock",
      },
      {
        sku: "ANK-A25M8-WHT",
        options: {
          color: "Blanco",
        },
        priceCentimos: 39990,
        availability: "in_stock",
      },
      {
        sku: "ANK-A25M8-PNK",
        options: {
          color: "Rosado",
        },
        priceCentimos: 39990,
        availability: "in_stock",
      },
      {
        sku: "ANK-A25M8-TEA",
        options: {
          color: "Verde azulado",
        },
        priceCentimos: 39990,
        availability: "in_stock",
      },
    ],
    tags: ["magsafe", "qi2", "apple watch", "airpods", "viaje", "plegable"],
    expertReview: {
      verdict:
        "La forma más ordenada de cargar iPhone, Apple Watch y AirPods de viaje: todo en un cubo y con el adaptador en la caja.",
      forWhom: [
        "Usas iPhone, Apple Watch y AirPods y viajas seguido",
        "Quieres una sola estación en tu velador, sin cables sueltos",
      ],
      notFor: [
        "Tienes un iPhone 16 o 17 y quieres la carga inalámbrica más rápida: aquí el iPhone carga a 15 W, no a 25 W",
        "No usas Apple Watch: una base 2 en 1 te sale más a cuenta",
      ],
      rubric: [
        {
          criterion: "Portabilidad",
          score: 5,
          note: "Plegada mide 6 × 6 cm: entra en cualquier bolsillo de la mochila.",
        },
        {
          criterion: "Velocidad de carga",
          score: 3,
          note: "Qi2 a 15 W para el iPhone; correcta, pero ya hay bases de 25 W.",
        },
        {
          criterion: "Todo incluido",
          score: 5,
          note: "Trae el adaptador de 40 W: no tienes que comprar nada más.",
        },
        {
          criterion: "Compatibilidad",
          score: 4,
          note: "Pensada para el ecosistema Apple; con otros celulares Qi solo aprovechas parte.",
        },
      ],
    },
  },
  {
    slug: "ugreen-magflow-qi2-25w-2-en-1-plegable",
    name: "MagFlow Qi2 25W 2 en 1 plegable",
    model: "55960",
    brand: "ugreen",
    category: "carga-inalambrica",
    summary:
      "Base plegable Qi2.2 que carga tu iPhone hasta a 25 W y tus audífonos a 5 W, con un USB-C extra para el cable de tu Apple Watch.",
    specs: {
      devices: 2,
      standard: "Qi2.2",
      maxPhonePower: 25,
      watchCharger: false,
      adapterIncluded: false,
      foldable: true,
    },
    options: [],
    variants: [
      {
        sku: "UGR-55960",
        options: {},
        priceCentimos: 18890,
        availability: "in_stock",
      },
    ],
    tags: ["magsafe", "qi2", "qi2.2", "25 w", "airpods", "plegable"],
    expertReview: {
      verdict:
        "Carga inalámbrica de 25 W a buen precio, siempre que tengas un iPhone reciente y un adaptador de 45 W.",
      forWhom: [
        "Tienes un iPhone 16 o 17 y quieres la carga inalámbrica más rápida",
        "Ya tienes un buen cargador USB-C de 45 W o más",
      ],
      notFor: [
        "Tu iPhone es del 12 al 15: carga a 15 W, igual que una base Qi2 normal",
        "No tienes adaptador: no viene en la caja y con uno pequeño no llega a 25 W",
      ],
      rubric: [
        {
          criterion: "Velocidad de carga",
          score: 5,
          note: "Hasta 25 W con Qi2.2 en iPhone 16 y 17.",
        },
        {
          criterion: "Todo incluido",
          score: 2,
          note: "Sin adaptador; necesitas uno de 45 W o más para la carga máxima.",
        },
        {
          criterion: "Versatilidad",
          score: 4,
          note: "Base para audífonos y un USB-C extra para el cable de tu Apple Watch.",
        },
        {
          criterion: "Relación precio-calidad",
          score: 4,
          note: "Buen precio para una base de 25 W si ya tienes el adaptador.",
        },
      ],
    },
  },
  {
    slug: "soundcore-liberty-5",
    name: "Liberty 5",
    model: "A3957",
    brand: "soundcore",
    category: "audio",
    summary:
      "Audífonos in-ear con cancelación de ruido adaptativa 3.0, drivers de 9.2 mm, LDAC y Bluetooth 5.4. Resistentes al agua y al sudor (IP55).",
    specs: {
      formFactor: "In-ear",
      anc: true,
      ldac: true,
      batteryAnc: 8,
      batteryWithCase: 32,
      heartRate: false,
      waterResistance: "IP55",
      bluetooth: "5.4",
      weight: "4.6 g por audífono",
    },
    options: [
      {
        key: "color",
        label: "Color",
      },
    ],
    variants: [
      {
        sku: "SND-A3957-BLK",
        options: {
          color: "Negro",
        },
        priceCentimos: 18990,
        availability: "in_stock",
      },
      {
        sku: "SND-A3957-WHT",
        options: {
          color: "Blanco",
        },
        priceCentimos: 18990,
        availability: "in_stock",
      },
      {
        sku: "SND-A3957-NVY",
        options: {
          color: "Azul marino",
        },
        priceCentimos: 18990,
        availability: "in_stock",
      },
      {
        sku: "SND-A3957-APR",
        options: {
          color: "Durazno",
        },
        priceCentimos: 18990,
        availability: "in_stock",
      },
    ],
    tags: ["audífonos", "inalámbricos", "anc", "ldac", "android", "bluetooth"],
    expertReview: {
      verdict:
        "Cancelación de ruido y sonido de gama alta a un precio de gama media. En Android con LDAC rinden al máximo.",
      forWhom: [
        "Usas un celular Android compatible con LDAC",
        "Quieres buena cancelación de ruido para el transporte público sin gastar de más",
      ],
      notFor: [
        "Usas iPhone y quieres aprovechar el LDAC: el iPhone no lo soporta y usa AAC",
        "Buscas integración total con el ecosistema Apple (cambio automático entre equipos)",
      ],
      rubric: [
        {
          criterion: "Cancelación de ruido",
          score: 4,
          note: "Adaptativa 3.0: se ajusta sola al ruido del entorno.",
        },
        {
          criterion: "Calidad de sonido",
          score: 4,
          note: "Drivers de 9.2 mm y LDAC para audio de alta resolución en Android.",
        },
        {
          criterion: "Batería",
          score: 4,
          note: "8 h con cancelación de ruido y 32 h en total con el estuche.",
        },
        {
          criterion: "Relación precio-calidad",
          score: 5,
          note: "Funciones de audífonos que cuestan bastante más.",
        },
      ],
    },
  },
  {
    slug: "soundcore-space-one-pro",
    name: "Space One Pro",
    model: "A3062",
    brand: "soundcore",
    category: "audio",
    summary:
      "Audífonos over-ear plegables con cancelación de ruido adaptativa 3.0, LDAC y hasta 40 horas de batería con la cancelación activa (60 horas sin ella).",
    specs: {
      formFactor: "Over-ear",
      anc: true,
      ldac: true,
      batteryAnc: 40,
      heartRate: false,
      weight: "286.2 g",
    },
    options: [
      {
        key: "color",
        label: "Color",
      },
    ],
    variants: [
      {
        sku: "SND-A3062-BLK",
        options: {
          color: "Negro",
        },
        priceCentimos: 41990,
        availability: "in_stock",
      },
      {
        sku: "SND-A3062-CRM",
        options: {
          color: "Blanco crema",
        },
        priceCentimos: 41990,
        availability: "in_stock",
      },
    ],
    tags: ["audífonos", "over-ear", "anc", "ldac", "plegables", "viaje"],
  },
  {
    slug: "ugreen-nasync-dxp4800-plus",
    name: "NASync DXP4800 Plus",
    model: "35260",
    brand: "ugreen",
    category: "almacenamiento",
    summary:
      "NAS de 4 bahías con Intel Pentium Gold, 8 GB DDR5, dos ranuras M.2 NVMe y red de 10 Gb y 2.5 Gb. Se vende sin discos.",
    specs: {
      type: "NAS",
      drives: "4 bahías SATA y 2 ranuras M.2 NVMe",
      sataSupport: true,
      maxCapacity: 144,
      maxSpeed: 10,
      connectivity: "Ethernet 10 Gb y 2.5 Gb, USB-C 10 Gbps, HDMI 4K",
      processor: "Intel Pentium Gold 8505 (5 núcleos)",
      memory: "8 GB DDR5 (ampliable a 64 GB)",
    },
    options: [],
    variants: [
      {
        sku: "UGR-35260",
        options: {},
        priceCentimos: 349990,
        availability: "in_stock",
      },
    ],
    tags: ["nas", "respaldo", "nube privada", "10gbe", "servidor"],
    expertReview: {
      verdict:
        "Una nube privada potente para tu casa u oficina pequeña, con red de 10 Gb y espacio para crecer. Los discos van por separado.",
      forWhom: [
        "Quieres respaldar las fotos y archivos de toda la familia sin pagar suscripciones",
        "Editas video o trabajas con archivos grandes y tienes (o planeas) una red de 10 Gb",
      ],
      notFor: [
        "Buscas algo listo para usar: tienes que comprar los discos y configurarlo",
        "Solo necesitas respaldar una laptop: un disco externo es más simple y barato",
      ],
      rubric: [
        {
          criterion: "Rendimiento",
          score: 5,
          note: "Procesador de 5 núcleos, DDR5 y caché en M.2 NVMe.",
        },
        {
          criterion: "Conectividad",
          score: 5,
          note: "10 Gb y 2.5 Gb de red, USB-C de 10 Gbps y salida HDMI.",
        },
        {
          criterion: "Facilidad de uso",
          score: 3,
          note: "La configuración inicial pide algo de tiempo y conocimientos de red.",
        },
        {
          criterion: "Capacidad de crecer",
          score: 5,
          note: "Hasta 144 TB en las bahías y RAM ampliable a 64 GB.",
        },
      ],
    },
  },
  {
    slug: "ugreen-carcasa-ssd-m2-nvme-10gbps",
    name: "Carcasa para SSD M.2 NVMe 10 Gbps",
    model: "70532",
    brand: "ugreen",
    category: "almacenamiento",
    summary:
      "Carcasa de aluminio sin herramientas que convierte un SSD M.2 NVMe en un disco externo de 10 Gbps. Incluye cables USB-C y USB-A.",
    specs: {
      type: "Carcasa para SSD",
      drives: "1 SSD M.2 NVMe (M key y B+M key, 2242 y 2280)",
      sataSupport: false,
      maxSpeed: 10,
      connectivity: "USB-C 10 Gbps (UASP y TRIM)",
      toolFree: true,
    },
    options: [],
    variants: [
      {
        sku: "UGR-70532",
        options: {},
        priceCentimos: 13890,
        availability: "in_stock",
      },
    ],
    tags: ["ssd", "nvme", "m.2", "disco externo", "usb-c"],
    expertReview: {
      verdict:
        "La manera más barata de tener un disco externo rápido: reutiliza un SSD NVMe y llega a 10 Gbps. No sirve para SSD SATA.",
      forWhom: [
        "Cambiaste el SSD de tu laptop y quieres reutilizar el anterior",
        "Necesitas mover archivos grandes entre equipos a buena velocidad",
      ],
      notFor: [
        "Tu SSD M.2 es SATA: esta carcasa solo acepta NVMe",
        "Quieres la máxima velocidad de un SSD NVMe moderno: 10 Gbps es menos de lo que el disco puede dar",
      ],
      rubric: [
        {
          criterion: "Velocidad",
          score: 4,
          note: "10 Gbps por USB-C, con UASP y TRIM.",
        },
        {
          criterion: "Instalación",
          score: 5,
          note: "Sin herramientas: abres, colocas el SSD y cierras.",
        },
        {
          criterion: "Compatibilidad",
          score: 3,
          note: "NVMe M key y B+M key de 2242 y 2280; no acepta SATA.",
        },
        {
          criterion: "Relación precio-calidad",
          score: 5,
          note: "Barata y con cables USB-C y USB-A incluidos.",
        },
      ],
    },
  },
  {
    slug: "macbook-air-13-m5",
    name: "MacBook Air de 13 pulgadas (M5)",
    brand: "apple",
    category: "laptops",
    summary:
      "Laptop delgada de 1.23 kg con chip M5, pantalla de 13.6 pulgadas, hasta 18 horas de batería, MagSafe 3 y Wi-Fi 7.",
    specs: {
      chip: "Apple M5",
      cpuCores: 10,
      screenSize: 13.6,
      resolution: "2560 × 1664",
      battery: 18,
      weight: 1.23,
      ports: "MagSafe 3 y 2 × Thunderbolt 4",
      wifi: "Wi-Fi 7",
    },
    options: [
      {
        key: "chip",
        label: "Chip",
      },
      {
        key: "memory",
        label: "Memoria unificada",
      },
      {
        key: "storage",
        label: "Almacenamiento",
      },
      {
        key: "color",
        label: "Color",
      },
    ],
    variants: [
      {
        sku: "APL-MBA13-M5-G8-16-512-SKY",
        options: {
          chip: "M5 (CPU de 10 núcleos, GPU de 8 núcleos)",
          memory: "16 GB",
          storage: "512 GB",
          color: "Azul cielo",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-MBA13-M5-G8-16-512-SLV",
        options: {
          chip: "M5 (CPU de 10 núcleos, GPU de 8 núcleos)",
          memory: "16 GB",
          storage: "512 GB",
          color: "Plata",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-MBA13-M5-G8-16-512-STL",
        options: {
          chip: "M5 (CPU de 10 núcleos, GPU de 8 núcleos)",
          memory: "16 GB",
          storage: "512 GB",
          color: "Blanco estelar",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-MBA13-M5-G8-16-512-MID",
        options: {
          chip: "M5 (CPU de 10 núcleos, GPU de 8 núcleos)",
          memory: "16 GB",
          storage: "512 GB",
          color: "Medianoche",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-MBA13-M5-G10-24-1TB-SKY",
        options: {
          chip: "M5 (CPU de 10 núcleos, GPU de 10 núcleos)",
          memory: "24 GB",
          storage: "1 TB",
          color: "Azul cielo",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-MBA13-M5-G10-24-1TB-SLV",
        options: {
          chip: "M5 (CPU de 10 núcleos, GPU de 10 núcleos)",
          memory: "24 GB",
          storage: "1 TB",
          color: "Plata",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-MBA13-M5-G10-24-1TB-STL",
        options: {
          chip: "M5 (CPU de 10 núcleos, GPU de 10 núcleos)",
          memory: "24 GB",
          storage: "1 TB",
          color: "Blanco estelar",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-MBA13-M5-G10-24-1TB-MID",
        options: {
          chip: "M5 (CPU de 10 núcleos, GPU de 10 núcleos)",
          memory: "24 GB",
          storage: "1 TB",
          color: "Medianoche",
        },
        availability: "unavailable",
      },
    ],
    tags: ["macbook", "laptop", "macos", "apple silicon"],
  },
  {
    slug: "ipad-air-11-m4",
    name: "iPad Air de 11 pulgadas (M4)",
    brand: "apple",
    category: "tablets",
    summary:
      "iPad Air con chip M4, 12 GB de memoria, Wi-Fi 7 y compatibilidad con el Apple Pencil Pro.",
    specs: {
      chip: "Apple M4",
      cpuCores: 8,
      gpuCores: 9,
      memory: 12,
      screenSize: 11,
      wifi: "Wi-Fi 7",
      pencil: "Apple Pencil Pro",
    },
    options: [
      {
        key: "storage",
        label: "Almacenamiento",
      },
      {
        key: "color",
        label: "Color",
      },
    ],
    variants: [
      {
        sku: "APL-IPADAIR11-M4-128-BLU",
        options: {
          storage: "128 GB",
          color: "Azul",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-128-PRP",
        options: {
          storage: "128 GB",
          color: "Morado",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-128-STL",
        options: {
          storage: "128 GB",
          color: "Blanco estelar",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-128-GRY",
        options: {
          storage: "128 GB",
          color: "Gris espacial",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-256-BLU",
        options: {
          storage: "256 GB",
          color: "Azul",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-256-PRP",
        options: {
          storage: "256 GB",
          color: "Morado",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-256-STL",
        options: {
          storage: "256 GB",
          color: "Blanco estelar",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-256-GRY",
        options: {
          storage: "256 GB",
          color: "Gris espacial",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-512-BLU",
        options: {
          storage: "512 GB",
          color: "Azul",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-512-PRP",
        options: {
          storage: "512 GB",
          color: "Morado",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-512-STL",
        options: {
          storage: "512 GB",
          color: "Blanco estelar",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-512-GRY",
        options: {
          storage: "512 GB",
          color: "Gris espacial",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-1TB-BLU",
        options: {
          storage: "1 TB",
          color: "Azul",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-1TB-PRP",
        options: {
          storage: "1 TB",
          color: "Morado",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-1TB-STL",
        options: {
          storage: "1 TB",
          color: "Blanco estelar",
        },
        availability: "unavailable",
      },
      {
        sku: "APL-IPADAIR11-M4-1TB-GRY",
        options: {
          storage: "1 TB",
          color: "Gris espacial",
        },
        availability: "unavailable",
      },
    ],
    tags: ["ipad", "tablet", "ipados", "apple pencil"],
  },
  {
    slug: "airpods-pro-3",
    name: "AirPods Pro 3",
    model: "MFHP4",
    brand: "apple",
    category: "audio",
    summary:
      "Audífonos in-ear con chip H2, cancelación de ruido activa, sensor de frecuencia cardiaca y estuche con carga MagSafe, Qi y USB-C.",
    specs: {
      formFactor: "In-ear",
      anc: true,
      ldac: false,
      batteryAnc: 8,
      batteryWithCase: 24,
      heartRate: true,
      waterResistance: "IP57",
      weight: "5.55 g por audífono",
    },
    options: [],
    variants: [
      {
        sku: "APL-MFHP4",
        options: {},
        availability: "unavailable",
      },
    ],
    tags: ["airpods", "audífonos", "anc", "iphone", "inalámbricos"],
  },
]

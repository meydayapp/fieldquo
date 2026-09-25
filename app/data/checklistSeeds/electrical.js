// app/data/checklistSeeds/electrical.js — see ./_build.js for the format.
// The inspection report follows the shape Jobber showed: main panel ticks,
// sub-panel fields (a model number, a conductor dropdown), then a signature.
import { C, S, I, IO, CK, TX, NU, SE, SL, PH, R, O } from "./_build.js";
import { T_PREP, T_WORK, T_TESTS, T_WRAP, T_SIGNOFF, scopeConfirmed, cleanedUp, clientSignature, photoBefore, photoAfter } from "./_common.js";

const EL = ["electrical", "lighting", "solar_energy", "security_systems", "smart_home"];
const conductor = [["Copper", "Aluminium", "Copper-clad aluminium"], ["Cuivre", "Aluminium", "Aluminium cuivré"], ["Cobre", "Aluminio", "Aluminio recubierto de cobre"], ["Rame", "Alluminio", "Alluminio ramato"], ["Kupfer", "Aluminium", "Kupferkaschiertes Aluminium"], ["Мідь", "Алюміній", "Алюміній з мідним покриттям"], ["Tanso", "Aluminyo", "Aluminyong may tanso"]];

export const CHECKLISTS = [
  C("fq.cl.electrical.inspection_report", { trades: EL },
    ["Electrical inspection report", "Rapport d'inspection électrique", "Informe de inspección eléctrica", "Rapporto di ispezione elettrica", "Elektro-Prüfbericht", "Звіт про огляд електрики", "Ulat ng inspeksiyon sa kuryente"],
    [
      S(["Main panel", "Panneau principal", "Tablero principal", "Quadro principale", "Hauptverteilung", "Головний щит", "Main panel"], [
        I(NU, R, "Service size (amps)", "Capacité de l'entrée (A)", "Capacidad del servicio (A)", "Potenza della fornitura (A)", "Hausanschluss (A)", "Потужність вводу (А)", "Laki ng serbisyo (amps)"),
        I(CK, R, "Breakers labelled", "Disjoncteurs identifiés", "Interruptores rotulados", "Interruttori etichettati", "Sicherungen beschriftet", "Автомати підписано", "May label ang mga breaker"),
        I(CK, R, "Grounding and bonding verified", "Mise à la terre et continuité vérifiées", "Puesta a tierra y equipotencial verificadas", "Messa a terra ed equipotenziale verificate", "Erdung und Potentialausgleich geprüft", "Заземлення й вирівнювання потенціалів перевірено", "Nasuri ang grounding at bonding"),
        I(SL, R, "Signs of heat, corrosion or double-tapping", "Traces de chaleur, corrosion ou double raccordement", "Señales de calor, corrosión o doble conexión", "Segni di surriscaldamento, corrosione o doppi collegamenti", "Hitzespuren, Korrosion oder Doppelklemmung", "Сліди перегріву, корозії чи подвійного підключення", "Senyales ng init, kalawang o double-tap"),
        I(PH, O, "Panel photo", "Photo du panneau", "Foto del tablero", "Foto del quadro", "Foto der Verteilung", "Фото щита", "Larawan ng panel"),
      ]),
      S(["Sub-panel", "Sous-panneau", "Subtablero", "Sottoquadro", "Unterverteilung", "Вторинний щит", "Sub-panel"], [
        I(TX, O, "Panel model", "Modèle du panneau", "Modelo del tablero", "Modello del quadro", "Verteilermodell", "Модель щита", "Model ng panel"),
        IO(SE, O, ["Conductor material", "Matériau des conducteurs", "Material del conductor", "Materiale dei conduttori", "Leitermaterial", "Матеріал провідників", "Materyal ng conductor"], conductor),
        I(SL, O, "Feeder and neutral/ground separation", "Artère et séparation neutre/terre", "Alimentador y separación neutro/tierra", "Linea di alimentazione e separazione neutro/terra", "Zuleitung und N/PE-Trennung", "Живлення й розділення нуля та землі", "Feeder at hiwalay na neutral/ground"),
      ]),
      S(["Devices", "Appareils", "Dispositivos", "Dispositivi", "Geräte", "Пристрої", "Mga device"], [
        I(SL, R, "GFCI and AFCI protection tested", "Protection DDFT et DDFA testée", "Protección GFCI y AFCI probada", "Protezioni differenziali e AFCI provate", "FI- und AFDD-Schutz geprüft", "ПЗВ і захист від дуги перевірено", "Nasubok ang GFCI at AFCI"),
        I(SL, O, "Smoke and CO alarms", "Avertisseurs de fumée et de CO", "Alarmas de humo y CO", "Rilevatori di fumo e CO", "Rauch- und CO-Melder", "Датчики диму й чадного газу", "Smoke at CO alarm"),
        I(TX, O, "Deficiencies found", "Déficiences relevées", "Deficiencias encontradas", "Carenze rilevate", "Festgestellte Mängel", "Виявлені недоліки", "Nakitang kakulangan"),
      ]),
      S(T_SIGNOFF, [clientSignature()]),
    ]),

  C("fq.cl.electrical.service_call", { trades: EL, autoAddFor: ["electrical"] },
    ["Electrical service call", "Appel de service électrique", "Servicio eléctrico", "Intervento elettrico", "Elektro-Serviceeinsatz", "Електромонтажний виклик", "Serbisyo sa kuryente"],
    [
      S(T_PREP, [
        scopeConfirmed(),
        photoBefore(),
        I(CK, R, "Circuit tested dead with a proven meter", "Circuit vérifié hors tension avec un testeur éprouvé", "Circuito comprobado sin tensión con un medidor probado", "Circuito verificato fuori tensione con strumento testato", "Spannungsfreiheit mit geprüftem Messgerät festgestellt", "Відсутність напруги перевірено справним приладом", "Nasubok na patay ang circuit gamit ang maaasahang metro"),
      ]),
      S(T_WORK, [
        I(TX, R, "Work done and materials used", "Travaux faits et matériel utilisé", "Trabajo hecho y material usado", "Lavoro fatto e materiale usato", "Ausgeführte Arbeit und Material", "Виконані роботи й матеріали", "Ginawang trabaho at materyales"),
        I(CK, R, "Connections torqued and covers on", "Connexions serrées au couple et couvercles posés", "Conexiones apretadas y tapas puestas", "Connessioni serrate e coperchi montati", "Klemmen angezogen, Abdeckungen montiert", "З'єднання затягнуто, кришки встановлено", "Mahigpit ang koneksyon at may takip"),
      ]),
      S(T_TESTS, [I(SL, R, "Circuit tested live and working", "Circuit testé sous tension et fonctionnel", "Circuito probado con tensión y funcionando", "Circuito provato in tensione e funzionante", "Stromkreis unter Spannung geprüft, funktioniert", "Коло перевірено під напругою, працює", "Nasubok na may kuryente at gumagana")]),
      S(T_WRAP, [photoAfter(), cleanedUp(), clientSignature()]),
    ]),
];

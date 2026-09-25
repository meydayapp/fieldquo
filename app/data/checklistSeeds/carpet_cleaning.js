// app/data/checklistSeeds/carpet_cleaning.js — see ./_build.js for the format.
import { C, S, I, IO, CK, TX, SE, SL, R, O } from "./_build.js";
import { T_PREP, T_WORK, T_WRAP } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.carpet.cleaning", { trades: ["carpet_cleaning", "furniture_upholstery"], autoAddFor: ["carpet_cleaning"] },
    ["Carpet cleaning", "Nettoyage de tapis", "Limpieza de alfombras", "Pulizia di moquette e tappeti", "Teppichreinigung", "Чищення килимів", "Paglilinis ng carpet"],
    [
      S(T_PREP, [
        I(SL, R, "Carpet condition", "État du tapis", "Estado de la alfombra", "Stato della moquette", "Zustand des Teppichs", "Стан килима", "Kondisyon ng carpet"),
        I(TX, O, "Stains and problem areas", "Taches et zones à problème", "Manchas y zonas problemáticas", "Macchie e zone critiche", "Flecken und Problemstellen", "Плями й проблемні ділянки", "Mantsa at problemang bahagi"),
        I(CK, R, "Furniture moved and protected", "Meubles déplacés et protégés", "Muebles movidos y protegidos", "Mobili spostati e protetti", "Möbel umgestellt und geschützt", "Меблі переставлено й захищено", "Nailipat at protektado ang muwebles"),
      ]),
      S(T_WORK, [
        I(CK, R, "Vacuumed first", "Aspiré d'abord", "Aspirado primero", "Aspirato prima", "Zuerst gesaugt", "Спершу пропилососено", "Na-vacuum muna"),
        I(CK, R, "Traffic lanes and spots pre-treated", "Passages et taches prétraités", "Zonas de paso y manchas pretratadas", "Zone di passaggio e macchie pretrattate", "Laufstraßen und Flecken vorbehandelt", "Прохідні зони й плями попередньо оброблено", "Na-pretreat ang daanan at mantsa"),
        IO(SE, R, ["Cleaning method", "Méthode de nettoyage", "Método de limpieza", "Metodo di pulizia", "Reinigungsverfahren", "Метод чищення", "Paraan ng paglilinis"],
          [["Hot water extraction", "Low moisture", "Dry compound"], ["Extraction à l'eau chaude", "Faible humidité", "Poudre sèche"], ["Extracción con agua caliente", "Baja humedad", "Compuesto seco"], ["Estrazione ad acqua calda", "Bassa umidità", "Polvere secca"], ["Sprühextraktion", "Feuchtarm", "Trockenpulver"], ["Екстракція гарячою водою", "Низька вологість", "Суха суміш"], ["Hot water extraction", "Mababang halumigmig", "Dry compound"]]),
        I(CK, R, "Rinsed and extracted with overlapping passes", "Rincé et extrait en passes qui se chevauchent", "Enjuagado y extraído con pasadas superpuestas", "Risciacquato ed estratto con passate sovrapposte", "Gespült und abgesaugt, Bahnen überlappend", "Промито й відсмоктано з перекриттям", "Binanlawan at na-extract nang magkakapatong"),
        I(CK, O, "Air movers set up", "Ventilateurs de séchage installés", "Ventiladores de secado instalados", "Ventilatori di asciugatura posizionati", "Trocknungsgebläse aufgestellt", "Сушильні вентилятори встановлено", "Naka-set ang air mover"),
      ]),
      S(T_WRAP, [
        I(SL, R, "Stains after cleaning", "Taches après le nettoyage", "Manchas después de limpiar", "Macchie dopo la pulizia", "Flecken nach der Reinigung", "Плями після чищення", "Mantsa pagkatapos maglinis"),
        I(TX, O, "Drying and ventilation advice given", "Conseils de séchage et d'aération donnés", "Consejos de secado y ventilación dados", "Consigli di asciugatura e aerazione dati", "Trocknungs- und Lüftungstipps gegeben", "Поради з сушіння й провітрювання", "Payo sa pagpapatuyo at bentilasyon"),
        I(TX, O, "Care instructions given", "Conseils d'entretien donnés", "Instrucciones de cuidado dadas", "Istruzioni di cura date", "Pflegehinweise gegeben", "Інструкції з догляду надано", "Naibigay ang gabay sa pag-aalaga"),
      ]),
    ]),
];

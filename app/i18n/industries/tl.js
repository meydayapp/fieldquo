// app/i18n/industries/tl.js — see en.js for structure and rationale.
//
// Drafted rather than natively written. Uses the conversational Taglish
// register most Filipino tradespeople actually read — English loanwords for
// business terms (quote, invoice, schedule) rather than forced Tagalog
// coinages, which read as stilted. Worth a native speaker's pass.

const tl = {
  chrome: {
    startTrial: "Simulan ang libreng subok",
    talkToUs: "Kausapin kami",
    noCard: "Walang kailangang credit card.",
    videoSoon: "Malapit nang mailabas ang product walkthrough",
    videoDemoPrefix: "Gusto mo ba ng live na demo?",
    videoDemoLink: "Mag-book ng demo",
    soundFamiliar: "Pamilyar ba?",
    painIntro:
      "Ito ang mga bagay na tahimik na nauubos ang pera ng mga negosyong {trade}. At ito ang ginagawa ng FieldQuo sa bawat isa.",
    ctaTitle: "Subukan sa susunod mong trabahong {trade}",
    ctaBody:
      "I-set up ang presyo mo, magpadala ng isang quote, at tingnan kung nakakatipid ka ng isang gabi. Iyon lang ang test.",
    nearby: "Para din sa mga kaugnay na trabaho",
  },

  trades: {
    cleaning: {
      label: "Paglilinis",
      headline:
        "Software sa paglilinis na nagpapanatiling maayos ang paulit-ulit na trabaho",
      description:
        "Ang residential at commercial cleaning ay umiikot sa paulit-ulit na visit, nagpapalit-palit na crew, at masikip na margin bawat trabaho. Pinagsasama ng FieldQuo ang schedule, checklist at invoice sa isang lugar.",
      pains: [
        {
          pain: "Manu-manong binu-book muli ang mga regular na kliyente kada linggo",
          fix: "I-set ang dalas nang isang beses at kusa nang uulit ang schedule, may tamang crew sa bawat visit.",
        },
        {
          pain: "May nalalaktawang hakbang ang crew at napapansin ng kliyente bago mo pa",
          fix: "Checklist bawat trabaho na tinitsek ng team sa telepono, para pareho ang standard kahit sino ang pumunta.",
        },
        {
          pain: "Naiipon ang maliliit na invoice na hindi nababayaran dahil hindi sulit habulin",
          fix: "Awtomatikong follow-up sa overdue na invoice, at makakabayad online ang kliyente mismo sa email.",
        },
        {
          pain: "Hindi mo alam kung aling kontrata ang totoong kumikita",
          fix: "Nasusubaybayan ang oras bawat trabaho at ikinukumpara sa siningil mo, kaya maaga mong nakikita ang lugi.",
        },
      ],
    },

    "construction-contracting": {
      label: "Konstruksyon at Kontrata",
      headline:
        "Construction software na pinoprotektahan ang margin mo sa bawat bid",
      description:
        "Lumalawak na scope, mga subcontractor, at presyo ng materyales na nagbabago sa pagitan ng pag-quote at pagsimula. Pinagdudugtong ng FieldQuo ang bid, schedule at totoong gastos para alam mo ang lagay ng proyekto.",
      pains: [
        {
          pain: "Isang gabi ang inaabot ng bid at may nakakalimutan pa rin",
          fix: "Gawin mula sa sarili mong may-presyong katalogo at nagagamit-muling scope group — pagtitipon na lang ang bid, hindi pagsusulat mula sa wala.",
        },
        {
          pain: "Nagbabago ang presyo ng materyales bago pa magsimula ang trabaho",
          fix: "Pagsubaybay sa gastos ng materyales na may kasaysayan ng presyo, para naka-base sa presyo ngayon ang quote mo, hindi noong nakaraang season.",
        },
        {
          pain: "Pasalitang napag-usapan ang mga pagbabago at nakakalimutan sa pag-invoice",
          fix: "I-revise ang quote, ipa-aprubahan ulit online, at kusang makikita sa invoice ang pagbabago.",
        },
        {
          pain: "Nalalaman mong lugi ang proyekto kapag tapos na",
          fix: "Naitatala ang labor, materyales at gastos habang tumatakbo ang trabaho, hindi binabalikan pagkatapos.",
        },
      ],
    },

    electrical: {
      label: "Elektrikal",
      headline: "Software para sa electrician na nakaikot sa service call",
      description:
        "Sa pagitan ng service call, panel upgrade at inspeksyon, mabilis maipon ang papeles. Kinakaya ito ng FieldQuo para mapunta sa mabababayarang trabaho ang lisensyadong oras mo.",
      pains: [
        {
          pain: "Nasisira ng emergency call ang nakaplanong araw",
          fix: "I-drag ang trabaho sa ibang oras at awtomatikong maaabisuhan ang apektadong kliyente at crew.",
        },
        {
          pain: "Ang pag-quote ng panel upgrade ay pag-uulit ng parehong line item",
          fix: "Nakasave na service catalogue na may sarili mong rate — piliin, ayusin, ipadala.",
        },
        {
          pain: "Nasa telepono lang ng iba ang litrato at notes ng inspeksyon",
          fix: "Nakakabit sa record ng trabaho ang litrato at notes, kaya mahahanap kapag nagtanong ang kliyente o inspector makalipas ang buwan.",
        },
        {
          pain: "Hinuhulaan ang oras ng apprentice tuwing sahuran",
          fix: "Time entry sa totoong trabaho, inaprubahan ng supervisor, diretso sa bayad.",
        },
      ],
    },

    hvac: {
      label: "HVAC",
      headline:
        "HVAC software para sa seasonal na dagsa at maintenance contract",
      description:
        "Dalawang dagsa at dalawang tahimik na panahon ang taon mo. Tinutulungan ka ng FieldQuo na kayanin ang dagsa nang walang naiiwan, at panatilihing tumutulo ang kita mula sa maintenance sa tahimik na buwan.",
      pains: [
        {
          pain: "Mas marami ang tawag sa unang init kaysa kayang i-schedule",
          fix: "Booking page na nagpapakita ng totoong availability, para sila na mismo ang pumili sa bakanteng oras sa halip na maghintay sa telepono.",
        },
        {
          pain: "Nakakalimutan ang maintenance agreement hanggang tumawag ang kliyente",
          fix: "Paulit-ulit na visit na naka-schedule nang maaga na may awtomatikong paalala — kusang nabu-book ang trabahong may kontrata.",
        },
        {
          pain: "Dumarating ang tech na hindi alam kung anong equipment ang nasa site",
          fix: "Buong history ng kliyente at trabaho sa telepono nila, kasama kung ano ang ginawa noong huling bisita.",
        },
        {
          pain: "Napupunta sa unang sumagot ang quote para sa install",
          fix: "Gawin at ipadala ang quote mula sa labas ng bahay; makaka-aprubahan online ang kliyente nang hindi hinihintay na makabalik ka sa opisina.",
        },
      ],
    },

    handyman: {
      label: "Handyman",
      headline: "Software para sa trabahong hindi kailanman magkapareho",
      description:
        "Maraming maliliit na trabaho, iba't ibang klase, at presyong kailangang mabilis pero hindi pabaya. Pinapanatili ng FieldQuo na katumbas lang ng laki ng trabaho ang papeles.",
      pains: [
        {
          pain: "Magkakaiba ang bawat trabaho, kaya walang nagagamit muli",
          fix: "Katalogo ng karaniwan mong gawain at rate na pinagsasama-sama mo, kahit gaano kakaiba ang kombinasyon.",
        },
        {
          pain: "Parang hindi sulit ang pormal na quote sa maliit na trabaho, tapos pinagtatalunan",
          fix: "Magpadala ng quote mula sa telepono sa wala pang isang minuto — nakasulat ang pag-apruba ng kliyente, at may record.",
        },
        {
          pain: "Kalahating araw ang napupunta sa tawagan para mag-schedule",
          fix: "Sila na mismo ang nagbu-book sa mga oras na talagang bakante ka.",
        },
        {
          pain: "Hindi maayos na naitatala ang bayad na cash at e-transfer",
          fix: "Itala ang anumang paraan ng bayad sa invoice, para tugma ang libro sa totoong nangyari.",
        },
      ],
    },

    landscaping: {
      label: "Landscaping",
      headline:
        "Landscaping software para sa design build at seasonal na crew",
      description:
        "Design-build na proyekto, seasonal na tauhan, at panahong binabago ang linggo mo. Pinagsasama ng FieldQuo ang quote, crew at gastos kapag paulit-ulit nagbabago ang plano.",
      pains: [
        {
          pain: "Binabago ng ulan ang linggo at kailangang sabihan ang lahat",
          fix: "Ilipat ang trabaho sa calendar at awtomatikong maaabisuhan ang apektadong kliyente at crew.",
        },
        {
          pain: "Mahaba ang design-build na quote at ilang araw bago matapos",
          fix: "Pagsama-samahin ang scope sa mga seksyon na may litrato — malinaw basahin at mabilis gawin ang malaking quote.",
        },
        {
          pain: "Mahirap tantiyahin ang gastos sa labor dahil seasonal ang tauhan",
          fix: "Naitatala ang oras bawat trabaho at bawat tao, kaya alam mo ang totoong gastos sa labor ng proyekto.",
        },
        {
          pain: "Tahimik na kinakain ng halaman at materyales ang margin",
          fix: "Subaybayan ang gastos sa materyales na may kasaysayan ng presyo, at ikumpara sa quote mo.",
        },
      ],
    },

    "lawn-care": {
      label: "Pag-aalaga ng Damuhan",
      headline: "Lawn care software na ginawa para sa siksik na ruta",
      description:
        "Malaking dami, maliit na bayad, at kitang nakadepende sa kung gaano kasiksik ang ruta mo. Pinapatakbo ng FieldQuo ang paulit-ulit na visit at singilin nang may pinakakaunting papeles bawat hinto.",
      pains: [
        {
          pain: "Trabaho na mag-isa ang muling pag-book ng parehong lingguhang kliyente",
          fix: "I-set ang dalas nang isang beses — kusang nabubuo ang mga visit na may kalakip na tamang crew.",
        },
        {
          pain: "Isang gabi ang inaabot ng pag-invoice ng dose-dosenang maliliit na account",
          fix: "Bumuo ng invoice mula sa mga natapos na visit nang sabay-sabay, may online payment link.",
        },
        {
          pain: "Nasisingil pa rin ang nalaktawan o naulanan na visit",
          fix: "Markahan sa field kung natapos o nalaktawan ang visit, at susunod ang singil sa totoong nangyari.",
        },
        {
          pain: "Hindi mo masabi kung aling ruta ang sulit panatilihin",
          fix: "Kita at oras bawat trabaho, para makita kung aling account ang sulit sa biyahe.",
        },
      ],
    },

    painting: {
      label: "Pagpipinta",
      headline: "Painting software para sa quote na talagang inaaprubahan",
      description:
        "Sa quote napapanalunan ang pagpipinta — linaw, litrato, at makarating bago ang dalawa pa. Tinutulungan ka ng FieldQuo na makapagpadala ng propesyonal na quote sa parehong araw.",
      pains: [
        {
          pain: "Ikatlong quote ka at ikaw pa ang pinakamabagal magpadala",
          fix: "Gawin ang quote sa site gamit ang sarili mong rate at ipadala bago ka pa umalis.",
        },
        {
          pain: "Hindi maintindihan ng kliyente kung ano ang kasama kaya tumatawad",
          fix: "Detalyadong scope na may litrato at malinaw na inclusion, kaya tungkol sa trabaho ang usapan, hindi sa numero.",
        },
        {
          pain: "Pasalitang napag-usapan ang kulay at paghahanda, tapos pinagtatalunan",
          fix: "Nasa aprubadong quote ito, may timestamp, kasama ang online na pag-apruba ng kliyente.",
        },
        {
          pain: "Mas mahal ang pintura at materyales kaysa sa inasahan mo",
          fix: "Pagsubaybay sa gastos ng materyales na may kasaysayan, para manatiling tama ang mga assumption mo sa pag-quote.",
        },
      ],
    },

    plumbing: {
      label: "Tubero",
      headline: "Plumbing software para sa emergency at nakaplanong trabaho",
      description:
        "Hindi iginagalang ng emergency ang schedule, at kailangan pa ring gawin ang papeles. Pinapatakbo ng FieldQuo ang dispatch, history at invoicing kahit walang opisina.",
      pains: [
        {
          pain: "Isang emergency call, sabog ang punong-punong araw",
          fix: "I-reschedule ang apektadong trabaho sa ilang tap; maaabisuhan ang kliyente at crew nang hindi ka tumatawag.",
        },
        {
          pain: "Alas-diyes ng gabi ka nag-i-invoice dahil punong-puno ang araw",
          fix: "Gawing invoice ang natapos na trabaho doon mismo, may payment link na magagamit agad ng kliyente.",
        },
        {
          pain: "Walang nakakaalala kung ano ang ginawa dito noong huli",
          fix: "Buong history bawat kliyente, kasama ang litrato at notes, nasa telepono ng tech.",
        },
        {
          pain: "Libre ang callback dahil walang naitala noong una",
          fix: "Bawat bisita ay record — ano ang pinalitan, kailan, at sa anong kasunduan.",
        },
      ],
    },

    "pressure-washing": {
      label: "Pressure Washing",
      headline:
        "Pressure washing software para sa mabilis na quote at mabilis na tapos",
      description:
        "Maiikling trabaho, malaking dami, at quote na madalas galing lang sa litrato. Pinapanatili ng FieldQuo na sapat kagaan ang papeles para sulit pa rin sa dalawang oras na trabaho.",
      pains: [
        {
          pain: "Ang pag-quote mula sa litrato ay panghuhula at pag-asa",
          fix: "Presyo kada sukat mula sa sarili mong katalogo, para pare-pareho ang tantiya sa bawat trabaho.",
        },
        {
          pain: "Sa maiikling trabaho, parang sobra-sobra ang papeles",
          fix: "Quote, schedule at invoice mula sa telepono — ilang minuto lang bawat isa.",
        },
        {
          pain: "Nauubos ang araw sa pagtawid ng lungsod para sa magkakalayong trabaho",
          fix: "Tingnan nang sabay-sabay ang mga trabaho sa araw para maayos mong mapagsama-sama.",
        },
        {
          pain: "Nasa camera roll lang ang before-and-after na litrato",
          fix: "Nakakabit sa trabaho ang litrato — gamit sa reklamo at sa marketing mamaya.",
        },
      ],
    },

    roofing: {
      label: "Pagbububong",
      headline:
        "Roofing software para sa malalaking quote at koordinasyon ng crew",
      description:
        "Mahahalagang trabaho, nakadepende sa panahon, at kliyenteng kailangang kumbinsihin bago pumirma. Tinutulungan ka ng FieldQuo na mag-quote nang malinaw at panatilihing magkaugnay ang crew kapag napanalunan mo.",
      pains: [
        {
          pain: "Isang linyang email lang ang natatanggap ng limang-digit na quote, tapos wala nang sagot",
          fix: "Detalyadong quote na may scope, litrato at options na inaaprubahan online ng kliyente — may awtomatikong follow-up kapag natahimik sila.",
        },
        {
          pain: "Inilipat ng panahon ang schedule at huli nang nalaman ng crew",
          fix: "Isang beses lang mag-reschedule; kusang lalabas ang abiso sa crew at kliyente.",
        },
        {
          pain: "Nasa isip mo lang ang deposit at hulugang bayad",
          fix: "Itala ang deposit at bahagyang bayad sa invoice, at laging nakikita ng dalawang panig ang balanse.",
        },
        {
          pain: "Tahimik na kinakain ng nasayang na materyales ang margin",
          fix: "Subaybayan ang gastos sa materyales bawat trabaho at ikumpara sa inilaan mo sa quote.",
        },
      ],
    },

    "tree-care": {
      label: "Pag-aalaga ng Puno",
      headline:
        "Tree care software para sa delikado at mahalagang trabaho",
      description:
        "Kagamitan, kaligtasan ng crew, at trabahong pinepresyuhan sa hatol at hindi sa rate card. Pinapanatili ng FieldQuo na malinaw ang record mula pagsusuri hanggang invoice.",
      pains: [
        {
          pain: "Sa hatol nakabase ang presyo ng bawat trabaho at walang maikumpara",
          fix: "Nananatiling mahahanap ang dating trabaho kasama ang scope, litrato at huling presyo — may batayan ang hatol mo.",
        },
        {
          pain: "Napag-uusapan sa site ang panganib pero hindi naisusulat",
          fix: "Nakakabit sa trabaho ang notes, litrato at checklist bago pa dumating ang crew.",
        },
        {
          pain: "Sabay-sabay dumarating ang emergency pagkatapos ng bagyo",
          fix: "Tumanggap ng request sa pamamagitan ng form at unahin ang mahalaga nang hindi tumutunog nang tuloy-tuloy ang telepono.",
        },
        {
          pain: "Hindi nakikita sa presyo ang oras ng kagamitan at crew",
          fix: "Pagsubaybay ng oras bawat trabaho kumpara sa siningil mo, para may basehan ang pag-ayos ng presyo.",
        },
      ],
    },
  },
};

export default tl;

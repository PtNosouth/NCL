/* ── three languages ──────────────────────────────────────────────────────
   The pages are written in English, so English is the source of truth: every
   translatable string is keyed by its own English text. Switching language walks the
   document, swaps what matches and remembers the original; switching back to English
   restores it. Anything without a translation simply stays English -- the site never
   shows a blank or a key.

   Arabic also flips `dir`, which the stylesheets use to mirror the deck. */
(function () {
  'use strict'

  var KEY = 'ncl:lang'
  var LANGS = ['en', 'zh', 'ar']
  var LABEL = { en: 'EN', zh: '中文', ar: 'العربية' }
  var TITLE = { en: 'English', zh: '简体中文', ar: 'العربية' }

  /* English → [中文, العربية] */
  var T = {
    /* nav + shared chrome */
    'Home': ['首页', 'الرئيسية'],
    'Products': ['产品', 'المنتجات'],
    'Achievements': ['专利', 'الإنجازات'],
    'Projects': ['项目', 'المشاريع'],
    'Enquire': ['咨询', 'استفسار'],
    'Menu': ['菜单', 'القائمة'],
    'Guangdong · Worldwide': ['广东 · 全球', 'قوانغدونغ · عالميًا'],
    'Trade and private commissions · worldwide delivery.': ['商业与私人订制 · 全球交付', 'مشاريع تجارية وخاصة · توصيل عالمي'],
    'Close': ['关闭', 'إغلاق'],

    /* cover */
    'Light,': ['光，', 'الضوء،'],
    'kept in': ['留存在', 'محفوظ في'],
    'gold': ['金色之中', 'الذهب'],
    'Cast brass, hand-set crystal, flame-shaped glass — bent, set and polished by hand in Guangdong. Made to order for interiors and hospitality.':
      ['铸造黄铜、手工镶嵌水晶、火焰形玻璃 —— 在广东手工折弯、装配与抛光。为室内与酒店空间按需订制。',
       'نحاس مصبوب، وكريستال مركّب يدويًا، وزجاج بشكل اللهب — يُثنى ويُثبَّت ويُلمَّع يدويًا في قوانغدونغ. يُصنع حسب الطلب للمساحات الداخلية والفنادق.'],
    'Follow the light down': ['向下追寻光', 'اتبع الضوء إلى الأسفل'],

    /* commissions */
    'Commissions': ['订制', 'المشاريع'],
    'Every room here is a commission we built, delivered and hung — private houses, hotels, a few restaurants.':
      ['这里的每个空间都是我们承接、交付并悬挂的订制项目 —— 私人住宅、酒店，以及少数餐厅。',
       'كل مساحة هنا مشروع صنعناه وسلّمناه وعلّقناه — منازل خاصة وفنادق ومطاعم قليلة.'],
    'Lights': ['灯具', 'الإضاءة'],
    'Scale': ['尺度', 'المقاس'],
    'Drop': ['垂高', 'الارتفاع'],
    'Finish': ['表面', 'التشطيب'],
    'Twelve arms or thirty-six. The piece is drawn outward from the fixture count, never squeezed into a catalogue size.':
      ['十二臂或三十六臂。作品由灯臂数量向外推演，绝不塞进某个目录尺寸。',
       'اثنا عشر ذراعًا أو ستة وثلاثون. تُرسم القطعة انطلاقًا من عدد الأذرع، ولا تُحشر في مقاس كتالوج.'],
    'From a small pendant to a whole hall. At the far end the crystal pattern is redrawn, not enlarged.':
      ['从一只小吊灯到整个大厅。到了极限尺寸，水晶纹样是重绘的，而不是放大。',
       'من قلادة صغيرة إلى قاعة كاملة. في الطرف الأقصى يُعاد رسم نمط الكريستال، لا يُكبَّر.'],
    'Set by the ceiling and by the height people stand under it. We cut the rods — the drawing does not change.':
      ['由天花高度和下方站立的人决定。我们切割吊杆 —— 图样不变。',
       'يحدّده السقف وطول من يقف تحته. نقصّ القضبان — والرسم لا يتغير.'],
    'The same drawing at three sizes; the crystal is re-pitched, never stretched.':
      ['同一图样三种尺寸；水晶重新排布间距，绝不被拉伸。',
       'الرسم نفسه بثلاثة أحجام؛ يُعاد ضبط مسافات الكريستال، ولا يُمدّ أبدًا.'],
    'Brass, antique brass or polished chrome. One finish per piece, decided with a sample in your hand.':
      ['黄铜、做旧黄铜或抛光镀铬。每件只用一种表面，由你亲手拿着样品决定。',
       'نحاس، أو نحاس عتيق، أو كروم مصقول. تشطيب واحد لكل قطعة، يُحدَّد والعينة في يدك.'],
    'A single drum, or forty arms on three tiers — the ceiling decides how far it can grow.':
      ['单层圆鼓，或三层共四十臂 —— 能长到多大由天花决定。',
       'أسطوانة واحدة، أو أربعون ذراعًا على ثلاث طبقات — السقف يحدد مدى نموّها.'],
    'A lantern form needs more height than width; a wide room asks for a wider answer.':
      ['灯笼形需要的高度大于宽度；宽阔的房间需要更宽阔的回应。',
       'الشكل الفانوسي يحتاج ارتفاعًا أكثر من العرض؛ والغرفة الواسعة تطلب جوابًا أوسع.'],
    'Crystal and brass are the same family in three temperatures; we send samples before drawing.':
      ['水晶与黄铜是同一族属的三种温度；画图之前我们会先寄样品。',
       'الكريستال والنحاس من العائلة نفسها بثلاث درجات حرارة؛ نرسل العينات قبل الرسم.'],

    /* craft */
    'The hand': ['手工', 'اليد'],
    'Cut · strung · lit': ['切割 · 串接 · 点亮', 'قطع · تعليق · إضاءة'],
    'A chandelier is': ['一盏吊灯是', 'الثريا'],
    'a thousand decisions': ['一千个决定', 'ألف قرار'],
    'made by hand.': ['由手工完成。', 'تُصنع باليد.'],
    'Cut': ['切割', 'القطع'],
    'Every facet is cut,': ['每一面都被切割，', 'كل وجه يُقطع،'],
    'then polished': ['然后抛光', 'ثم يُلمَّع'],
    'The edge has to hold light on one side and shadow on the other. Cut too shallow and the crystal turns to glass; cut too deep and it swallows the room.':
      ['棱边要一面留住光、一面留住影。切得太浅，水晶就变成普通玻璃；切得太深，它会把整个房间吞掉。',
       'يجب أن تُمسك الحافة بالضوء من جهة وبالظل من جهة أخرى. القطع الضحل يحوّل الكريستال إلى زجاج، والعميق يبتلع الغرفة.'],
    'Strung': ['串接', 'التعليق'],
    'Each drop is drilled,': ['每一颗坠饰都先钻孔，', 'كل قطرة تُثقب،'],
    'checked, then hung': ['检查，再悬挂', 'تُفحص، ثم تُعلَّق'],
    'In the order the drawing calls for. One row out of line and the whole run comes back down — there is no machine that makes that judgement.':
      ['按图样规定的顺序。有一排偏了，整串就要重来 —— 这个判断没有机器能替你做。',
       'بالترتيب الذي يطلبه الرسم. صفّ واحد خارج الخط يعيد السلسلة كاملة — ولا آلة تقوم بهذا الحكم.'],
    'Lit': ['点亮', 'الإضاءة'],
    'It is only finished': ['只有点亮之后', 'لا تكتمل'],
    'once it is lit': ['才算完成', 'إلا حين تُضاء'],
    'Frame, balance, switch on. In the light the piece either holds together or it does not — and that is the only test that counts.':
      ['装框、配平、通电。在光下，这件作品要么成立，要么不成立 —— 这是唯一算数的检验。',
       'التأطير، والتوازن، ثم التوصيل. في الضوء إمّا أن تتماسك القطعة أو لا — وهذا الاختبار الوحيد المعتبر.'],
    'Start an enquiry': ['开始咨询', 'ابدأ استفسارًا'],

    /* footer */
    'Our story': ['品牌故事', 'قصتنا'],
    'Made to order': ['按需订制', 'حسب الطلب'],
    'The collection': ['产品系列', 'المجموعة'],
    'Factory address': ['工厂地址', 'عنوان المصنع'],
    'Guangdong, China': ['中国 · 广东', 'قوانغدونغ، الصين'],
    'Workshop visits by appointment': ['工坊参观需预约', 'زيارات الورشة بموعد'],
    'Mon — Fri · 09:00–18:00 CST': ['周一至周五 · 09:00–18:00', 'الاثنين — الجمعة · 09:00–18:00'],
    'Connect with us': ['联系我们', 'تواصل معنا'],
    'Useful information': ['实用信息', 'معلومات مفيدة'],
    'Product photographs': ['产品图片', 'صور المنتجات'],
    'Care & finishes': ['保养与表面', 'العناية والتشطيبات'],
    'Trade enquiries': ['商业咨询', 'استفسارات تجارية'],
    'Back to the top': ['回到顶部', 'العودة إلى الأعلى'],
    'Top ↑': ['顶部 ↑', 'أعلى ↑'],
    'Photography — crystal stills via Wikimedia Commons (CC0)': ['摄影 —— 水晶静物来自 Wikimedia Commons（CC0）', 'التصوير — صور الكريستال من ويكيميديا كومنز (CC0)'],
    'Photography — every plate shot on the same ground': ['摄影 —— 所有图版都在同一底面上拍摄', 'التصوير — كل لوحة مصوّرة على الأرضية نفسها'],

    /* collection */
    'Collection': ['产品系列', 'المجموعة'],
    'The collection.': ['产品系列。', 'المجموعة.'],
    'Every piece we make, photographed on the same black. Five families, 118 plates — model number and size on each, so a drawing can start from a number instead of a guess.':
      ['我们做的每一件，都拍在同一块黑底上。五个分类、118 张图版 —— 每张都标型号与尺寸，图纸可以从一个编号开始，而不必靠猜。',
       'كل قطعة نصنعها مصوّرة على الخلفية السوداء نفسها. خمس عائلات و118 لوحة — برقم الطراز والمقاس على كل منها، ليبدأ الرسم من رقم لا من تخمين.'],
    'Plates': ['图版', 'اللوحات'],
    'Families': ['分类', 'العائلات'],
    'Guangdong': ['广东', 'قوانغدونغ'],
    'Workshop': ['工坊', 'الورشة'],
    'Chandeliers': ['吊灯', 'الثريات'],
    'Wall lights': ['壁灯', 'إضاءة الحائط'],
    'Table lamps': ['台灯', 'مصابيح الطاولة'],
    'Floor lamps': ['落地灯', 'مصابيح الأرضية'],
    'Objects': ['器物', 'قطع أخرى'],
    'Ceiling pieces, from a single drop to a hall twelve metres up.': ['吊装灯具，从一颗坠饰到十二米挑高的大厅。', 'قطع سقفية، من قطرة واحدة إلى قاعة بارتفاع اثني عشر مترًا.'],
    'Sconces drawn to a mirror line, a doorway or a stair.': ['按镜线、门洞或楼梯绘制的壁灯。', 'مصابيح حائط مرسومة على خط مرآة أو مدخل أو سلّم.'],
    'Small pieces for a console, a desk, a bedside.': ['用于案几、书桌、床头的细小灯具。', 'قطع صغيرة للطاولة أو المكتب أو جانب السرير.'],
    'Standing pieces, balanced on a single stem.': ['立于单根杆上的落地灯具。', 'قطع قائمة متوازنة على ساق واحدة.'],
    'The pieces that refuse a category.': ['拒绝被归类的那些。', 'القطع التي ترفض التصنيف.'],
    'Ask for a drawing,': ['要一份图纸，', 'اطلب رسمًا،'],
    'not a catalogue page.': ['而不是一页目录。', 'لا صفحة كتالوج.'],
    'Send the room, the ceiling height and the number of the plate you are looking at. We answer with a dimensioned drawing and a price, usually within two working days.':
      ['把空间、天花高度，以及你正在看的图版编号发给我们。我们通常会在两个工作日内回复带尺寸的图纸与报价。',
       'أرسل المساحة وارتفاع السقف ورقم اللوحة التي تنظر إليها. نجيب برسم بأبعاد وسعر، عادة في غضون يومَي عمل.'],
    'Made to order in Guangdong. Send the room and the ceiling height — we answer with a dimensioned drawing and a price, usually within two working days.':
      ['在广东按需订制。把空间与天花高度发给我们 —— 我们通常会在两个工作日内回复带尺寸的图纸与报价。',
       'يُصنع حسب الطلب في قوانغدونغ. أرسل المساحة وارتفاع السقف — نجيب برسم بأبعاد وسعر، عادة في غضون يومَي عمل.'],
    'Enquire about this piece': ['咨询此款', 'استفسر عن هذه القطعة'],

    /* achievements */
    'Registered design': ['外观设计注册', 'تصميم مسجّل'],
    'Filed, examined,': ['提交、审查、', 'إيداع، فحص،'],
    'granted.': ['授权。', 'منح.'],
    'Every shape we sell is drawn here first, then registered. The certificates below are the ones the China National Intellectual Property Administration has granted us — with the pieces they protect.':
      ['我们销售的每个造型都先在这里画出来，然后注册。下面是国家知识产权局授权给我们的证书 —— 以及它们保护的实物。',
       'كل شكل نبيعه يُرسم هنا أولًا ثم يُسجّل. الشهادات أدناه هي ما منحته لنا الإدارة الوطنية للملكية الفكرية — مع القطع التي تحميها.'],
    'Design patents': ['外观设计专利', 'براءات تصميم'],
    'Granted between': ['授权年份', 'مُنحت بين'],
    'Documents & pieces': ['文件与实物', 'وثائق وقطع'],
    'Registered, not invented for the brochure.': ['已注册，不为画册编造。', 'مسجّل، لا مُختلق للكتيّب.'],
    'Design patents cover the shape of a piece — the way a table apron meets its leg, the way a canopy sits over a twelve-arm fixture. Each number above can be checked against the CNIPA register. Copies of the certificates are available on request.':
      ['外观设计专利保护的是造型 —— 牙板与腿如何相接，灯罩如何落在十二臂灯具之上。上面的每个编号都可以在 CNIPA 登记库中查到。证书副本可按要求提供。',
       'تحمي براءات التصميم شكل القطعة — طريقة التقاء الإطار بالساق، وكيفية جلوس الغطاء على تجهيز ذي اثني عشر ذراعًا. يمكن التحقق من كل رقم أعلاه في سجل CNIPA. نسخ الشهادات متاحة عند الطلب.'],
    'Ask for the certificates': ['索取证书', 'اطلب الشهادات'],
    'Design patent': ['外观设计专利', 'براءة تصميم'],
    'Grant notice · 2026': ['授权公告 · 2026', 'إشعار منح · 2026'],
    'Chandelier': ['吊灯', 'ثريا'],
    'Table': ['桌', 'طاولة'],
    'Round table': ['圆桌', 'طاولة مستديرة'],
    'Long table': ['长桌', 'طاولة طويلة'],
    'Side table': ['边桌', 'طاولة جانبية'],
    'Wall light': ['壁灯', 'إضاءة حائط'],
    'Floor lamp': ['落地灯', 'مصباح أرضي'],
    'Lamp base': ['灯座', 'قاعدة مصباح'],
    'Crystal lamp fitting': ['水晶灯具', 'تجهيز مصباح كريستالي'],
    'Piece 88': ['器物 88', 'قطعة 88']
  }

  var lang = 'en'
  try {
    var saved = localStorage.getItem(KEY)
    if (LANGS.indexOf(saved) >= 0) lang = saved
  } catch (e) {}

  window.NCLtext = function (s) {
    if (lang === 'en' || !s) return s
    var hit = T[s]
    return hit ? hit[lang === 'zh' ? 0 : 1] : s
  }
  window.NCLlang = function () { return lang }

  var ATTRS = ['alt', 'aria-label', 'title', 'placeholder']
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/

  function walk(root, apply) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (node) {
        if (node.nodeType === 1) {
          if (SKIP.test(node.tagName)) return NodeFilter.FILTER_REJECT
          if (node.classList && (node.classList.contains('lang-switch') || node.hasAttribute('data-no-i18n'))) return NodeFilter.FILTER_REJECT
          if (node.hasAttribute('aria-hidden') && node.getAttribute('aria-hidden') === 'true' && !node.querySelector('p,h1,h2,h3,span')) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_SKIP
        }
        return NodeFilter.FILTER_ACCEPT
      }
    })
    var nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    nodes.forEach(function (node) {
      var raw = node.nodeValue
      /* the HTML wraps long paragraphs, so the source text carries newlines and runs of
         spaces; match on the collapsed form and keep the surrounding whitespace */
      var text = raw.replace(/\s+/g, ' ').trim()
      if (!text) return
      if (apply) {
        if (!node.__ncl) node.__ncl = raw
        var next = window.NCLtext(text)
        if (next !== text) {
          var lead = raw.match(/^\s*/)[0]
          var trail = raw.match(/\s*$/)[0]
          node.nodeValue = lead + next + trail
        }
      } else if (node.__ncl) {
        node.nodeValue = node.__ncl
        delete node.__ncl
      }
    })
    /* attributes */
    var els = root.querySelectorAll('[alt],[aria-label],[title],[placeholder]')
    ;[].forEach.call(els, function (el) {
      ATTRS.forEach(function (a) {
        if (!el.hasAttribute(a)) return
        var raw = el.getAttribute(a)
        var t = raw.trim()
        if (!t) return
        if (apply) {
          if (!el['__ncl_' + a]) el['__ncl_' + a] = raw
          var next = window.NCLtext(t)
          if (next !== t) el.setAttribute(a, next)
        } else if (el['__ncl_' + a]) {
          el.setAttribute(a, el['__ncl_' + a])
          delete el['__ncl_' + a]
        }
      })
    })
  }

  function applyLang(next, quiet) {
    lang = next
    document.documentElement.lang = next === 'zh' ? 'zh-Hans' : next
    /* deliberately not flipping `dir`: the composition is designed LTR, and mirroring
       moved the rail, the copy and the whole nav. Arabic still reads right-to-left
       inside each line through the browser's bidi handling. */
    document.documentElement.dir = 'ltr'
    document.body.classList.toggle('lang-ar', next === 'ar')
    /* always come back to the English source first: translating an already translated
       node would never match the dictionary again */
    walk(document.body, false)
    if (next !== 'en') walk(document.body, true)
    try { localStorage.setItem(KEY, next) } catch (e) {}
    paintSwitcher()
    /* the deck writes its copy from JS, so let it re-render in the new language */
    document.dispatchEvent(new CustomEvent('ncl:lang', { detail: next }))
  }

  var switcher = null
  function paintSwitcher() {
    if (!switcher) return
    [].forEach.call(switcher.children, function (b) {
      var on = b.getAttribute('data-lang') === lang
      b.classList.toggle('is-on', on)
      b.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }

  function buildSwitcher() {
    var host = document.querySelector('.nav-end') || document.querySelector('.nav')
    if (!host) return
    switcher = document.createElement('div')
    switcher.className = 'lang-switch'
    switcher.setAttribute('role', 'group')
    switcher.setAttribute('aria-label', 'Language')
    LANGS.forEach(function (code) {
      var b = document.createElement('button')
      b.type = 'button'
      b.textContent = LABEL[code]
      b.title = TITLE[code]
      b.setAttribute('data-lang', code)
      b.addEventListener('click', function (e) {
        e.preventDefault()
        if (code !== lang) applyLang(code)
      })
      switcher.appendChild(b)
    })
    host.insertBefore(switcher, host.firstChild)
    paintSwitcher()
  }

  function boot() {
    buildSwitcher()
    if (lang !== 'en') walk(document.body, true)
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang
    document.documentElement.dir = 'ltr'
    document.body.classList.toggle('lang-ar', lang === 'ar')
    paintSwitcher()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()

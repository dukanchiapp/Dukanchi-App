import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';

export const defaultContent = {
  nav: {
    logoSub: 'apna bazaar, apni dukaan',
    ctaText: 'Free mein Join Karo',
  },
  hero: {
    badge: 'India ka apna Local Discovery App',
    h1Line1: 'Ab Aapki',
    h1Accent: 'Local Market',
    h1Line2: 'Aapke Phone Par',
    subtitle:
      'Na 4 din ka wait. Na expensive delivery fees. Seedha apne ghar ke paas ki real dukaan se connect karo.',
    hookText: 'Quick Commerce se sasta. Delivery se fast. Trust se better.',
    hookAccent1: 'Quick Commerce se sasta.',
    hookAccent2: 'Trust se better.',
    cta1: 'App Download Karo — Free',
    cta2: 'Login / Sign Up',
  },
  problem: {
    tag: 'Sachchi Baat',
    h2Normal: '10 minute delivery ne',
    h2Bold: 'aapko loot liya',
    subtitle:
      'Wahi product. Double price. Aur aapke gali ki dukaan band ho gayi. Yeh nahi chalega.',
    badCol: {
      title: 'Quick Commerce',
      items: [
        'Dark store se aata hai — koi human nahi, koi trust nahi',
        'Delivery charge + surge pricing + packaging fee',
        'Ganda product mila? Return ka drama',
        'Aapki gali ka shopkeeper band ho gaya',
      ],
      price: '₹65',
      priceSub: 'Lays packet — delivery + fees ke saath',
    },
    goodCol: {
      title: 'Dukanchi',
      items: [
        'Real dukaan, real insaan — jo aapko jaanta hai',
        'MRP hi price — koi hidden charges nahi',
        'Chat karo, confirm karo, trust ke saath khareedo',
        'Aapka paisa aapke padosi ke ghar jaata hai',
      ],
      price: '₹20',
      priceSub: 'Wahi Lays — seedha dukaan se',
    },
  },
  hooks: [
    {
      emoji: '🚨',
      title: 'Raat 2 baje medicine ki zarurat hai.',
      para1:
        'Amazon? Kal aayega. Blinkit? Stock nahi. Apna pata nahi kaunsa medical store khula hai.',
      para2:
        'Dukanchi pe search karo — 500m mein kaunsa store open hai, exact location, phone number — sab ek jagah. Seedha wahan jao.',
      stat: 'Location + timings + phone — sab mil jaata hai',
    },
    {
      emoji: '🎮',
      title: 'PS5 online 3 hafte se sold out hai.',
      para1: 'Waiting list. Out of stock. Fake listings. Frustrating.',
      para2:
        'Jo online nahi milta, woh offline milta hai. Aapke 1 km ke andar kisi retailer ke paas ho sakta hai PS5. Dukanchi pe search karo.',
      stat: 'Product search → nearby store → confirm → jao',
    },
    {
      emoji: '💬',
      title: 'Mann mein koi product aaye — seedha Dukanchi.',
      para1: 'Pehle call karo. Engaged. Phir jao. Band hai. Time waste.',
      para2:
        'Ab seedha chat karo. Stock confirm karo. Tab jao. Ghar se nikal ke pachtao nahi.',
      stat: 'Chat karo → Confirm karo → Jao',
    },
  ],
  features: {
    tag: 'Kyun Dukanchi',
    h2: 'Jo aur koi nahi deta',
    subtitle: 'Ek app mein sab — local market ka poora experience digitally',
    items: [
      {
        icon: '⚡',
        title: 'Instant Connection',
        desc: 'Chat karo directly dukaan se — koi waiting nahi, koi IVR nahi. Real shopkeeper, real time mein.',
      },
      {
        icon: '📍',
        title: 'Real Availability',
        desc: 'Jo nearby available hai wahi dikhega. Dukanchi pe jo stores hain unke paas real products hain.',
      },
      {
        icon: '💰',
        title: 'Better Prices',
        desc: '10-min delivery se better pricing — kyunki beech mein koi dark store, koi surge pricing, koi nahi.',
      },
      {
        icon: '📞',
        title: 'Full Store Details',
        desc: 'Open/close timings, working days, exact location, phone number — sab ek jagah.',
      },
    ],
  },
  howItWorks: {
    tag: 'Itna Simple',
    h2: '3 steps. 30 seconds.',
    subtitle: 'Koi tutorial nahi. Koi training nahi. Bas karo.',
    steps: [
      {
        num: '1',
        title: 'Search karo',
        desc: 'Jo chahiye — product, category, store name — kuch bhi type karo. AI samjhega.',
        tag: 'Smart search powered by AI',
      },
      {
        num: '2',
        title: 'Nearby store dhundho',
        desc: 'Map pe dekho, distance dekho, open/closed status dekho — sab real-time.',
        tag: 'Live store status',
      },
      {
        num: '3',
        title: 'Chat karo, jao',
        desc: 'Stock confirm karo. Deal pakki karo. Tab ghar se niklo. Zero time waste.',
        tag: 'Direct chat with shopkeeper',
      },
    ],
  },
  illustration: {
    h2: 'Aapka mohalla, aapki dukaan, aapke phone pe.',
    chatBubble1: 'PS5 hai kya?',
    chatBubble2: 'Haan! Aao ☑️',
  },
  campaigns: {
    tag: 'Humara Mission',
    h2: 'Movement ka hissa bano',
    subtitle: 'Har purchase ek choice hai — local economy ko support karo',
    cards: [
      {
        flag: '🇮🇳',
        title: 'Vocal for Local',
        desc: 'Aapka har rupaya aapke padosi ke ghar jaata hai. Local shopkeeper ka business badhta hai. Community strong hoti hai.',
      },
      {
        flag: '💻',
        title: 'Digital Bharat',
        desc: "India ke 63 million kirana stores ko digital banao. Technology har gali tak pahunche — yeh hai Dukanchi ka sapna.",
      },
    ],
  },
  finalCta: {
    h2Normal: 'Jo chahiye, jab chahiye —',
    h2Accent: 'bas chat karo.',
    subtitle:
      'Na 4 din ka wait. Na expensive delivery. Seedha apne aas-paas ki dukaan se connect karo — free mein.',
    cta1: 'App Download Karo — Free',
    cta2: 'Login / Sign Up',
    note: 'Free hai. Hamesha rahega. Proudly Made in India 🇮🇳',
  },
  footer: {
    sub: 'apna bazaar, apni dukaan',
    tagline: 'Vocal for Local | Digital Bharat',
    copyright: '© 2026 Dukanchi. Proudly Supporting Local Retail India.',
  },
  pwaBanner: {
    visible: true,
    title: '✨ Dukanchi installed hai aapke phone pe!',
    subtitle: 'Browser se better experience PWA mein milega',
    buttonText: 'PWA mein Kholiye →',
    buttonUrl: '/',
  },
};

export class LandingController {
  static async getContent(_req: Request, res: Response) {
    try {
      const row = await prisma.landingPageContent.findUnique({ where: { id: 'main' } });
      return res.json({ content: row ? row.content : defaultContent });
    } catch {
      return res.json({ content: defaultContent });
    }
  }

  static async updateContent(req: Request, res: Response) {
    const { content } = req.body;
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'content object required' });
    }
    const updatedBy = (req as any).user?.userId || null;
    try {
      const row = await prisma.landingPageContent.upsert({
        where: { id: 'main' },
        update: { content, updatedBy },
        create: { id: 'main', content, updatedBy },
      });
      return res.json({ success: true, content: row.content });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
}

import { v4 as uuid } from 'uuid';
import type { ProductSection, ProjectData } from './types';
import { SCHEMA_VERSION } from './types';

const CONTACT_URL = 'https://www.globaltt.com/en/quickContact-GlobalTT.html';

const SECTION_BLUEPRINTS: Array<Omit<ProductSection, 'id'>> = [
  {
    title: 'Starlink Solutions',
    bullets: [
      'NEW - Worldwide satellite internet.',
      'Low Earth Orbit(LEO)',
      'Latency <45msec',
      'From 150 Mbps Up to 450 Mbps.',
      'Land, Vehicle, Maritime, Aero.',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/08/Starlink-Mini-Dish-on-a-field-next-to-laptop.png',
    imageAlt: 'Starlink',
    ctaText: 'Contact Us',
  },
  {
    title: 'V-Sat GEO Satellite Ku-Band',
    bullets: [
      'Direct from Belgium (EU Teleport).',
      'One single satellite direct connectivity.',
      'Fully secured, reliable, high availability 99,8%.',
      'Up to 50 Mbps.',
      'Mining, Oil & Gaz, Embassies...',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/07/Ku-Band-1-2.png',
    imageAlt: 'Ku Band',
    ctaText: 'Contact Us',
    titleFontSize: 21,
    bulletFontSize: 15,
  },
  {
    title: 'V-Sat Satellite PRO',
    bullets: [
      'Direct from Belgium.',
      'One Satellite direct connectivity.',
      'Fully secured, high availability & reliability of 99,99%',
      'Up to 50 Mbps.',
      'Embassies, Mining, Camp...',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/07/C-Band-1-1.png',
    imageAlt: 'C-Band',
    ctaText: 'Contact Us',
  },
  {
    title: 'V-Sat GEO Satellite Ka-Band',
    bullets: [
      'Direct from Belgium.',
      'Fully secured, availability 95%.',
      'Up to 50 Mbps.',
      'SOHO, Small Office, Back-up.',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/07/Ka-Band-1-3.png',
    imageAlt: 'Ka-Band',
    ctaText: 'Contact Us',
  },
  {
    title: 'BGAN/Thuraya-IP',
    bullets: [
      'Worldwide secured access.',
      'GEO, L-Band, Internet',
      '1,2 Mbps internet.',
      'Battery & AC.',
      'Voice/tel. line & internet.',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/bgan76D58270-copy-1.jpg',
    imageAlt: 'BGAN',
    ctaText: 'Contact Us',
  },
  {
    title: 'Iridium GO Exec',
    bullets: [
      'Worldwide coverage.',
      'Satellite LEO.',
      'Phone & data access.',
      '88 Kbps/22 Kbps.',
      'Battery and AC.',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/1677665900145-copy.png',
    imageAlt: 'Iridium GO Exec',
    ctaText: 'Contact Us',
  },
  {
    title: 'Iridium PTT',
    bullets: [
      'Dual Mode: PTT and Phone modes.',
      'Secure Dialogue: AES-256 encryption.',
      'Walkie Talkie : two way radio',
      'Satellite: instant communication',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/08/sATTELITE-PHONE.png',
    imageAlt: 'Iridium PTT',
    ctaText: 'Contact Us',
    bulletFontSize: 14,
  },
  {
    title: 'Wi-Fi Long Range',
    bullets: [
      'Wi-Fi 2.4 GHz/5 GHz',
      'Radio WI-FI Range : 1.5 Km',
      'Repeater 10 Km radio link.',
      'Adaptive interference control.',
      'Security Access, Cyber, and ISP billing',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/08/DSCF0503-222Copy.png',
    imageAlt: 'WiFi Long Range',
    ctaText: 'Contact Us',
  },
];

export function createDefaultProject(): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    global: {
      backgroundColor: '#d0d0d0',
      fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
      baseFontSize: 16,
      headingFontSize: 25,
      textColor: '#000000',
      buttonColor: '#f1592a',
      buttonTextColor: '#ffffff',
      accentColor: '#f1592a',
      footerBackgroundColor: '#000000',
      footerTextColor: '#fafafa',
      contactUrl: CONTACT_URL,
    },
    header: {
      logoSrc: 'https://36af7d465b.imgdist.com/pub/bfra/wpnsx7uw/j2q/4ah/ptb/logo%20%282%29.png',
      logoAlt: 'GlobalTT Logo',
      logoWidth: 390,
      title: 'Critical communication - Satellite - RadioLink - TwoWay Radio overIP',
      titleFontSize: 18,
      bannerSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/Untitled-11x-1-e1718357911485.png',
      bannerAlt: 'Coverage Map',
      sectionHeading: 'Satellite High Throughput Connectivity',
      sectionHeadingFontSize: 25,
    },
    sections: SECTION_BLUEPRINTS.map((section) => ({ ...section, id: uuid() })),
    footer: {
      bannerSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/TELEPORT-8-Copy.png',
      bannerAlt: 'Teleport',
      companyName: 'GlobalTT Satellite Teleport',
      address: 'Scientifique Parc Einstein,\nLouvain-la-Neuve, Belgium',
      phone: '+32 (0)10 39 50 70',
      phoneTel: '+3210395070',
      email: 'info@globaltt.com',
      websites: [
        { label: 'www.globaltt.com', url: 'https://www.globaltt.com' },
        { label: 'www.Ipseos.eu', url: 'https://www.ipseos.eu' },
      ],
      socials: [
        { platform: 'facebook', url: 'https://www.facebook.com/pages/GlobalTT-Broadband-High-Speed-Internet-Satellite/182799832710' },
        { platform: 'linkedin', url: 'https://www.linkedin.com/company/globaltt?trk=top_nav_home' },
      ],
    },
  };
}

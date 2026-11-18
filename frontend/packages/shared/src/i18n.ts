import type { Language } from './constants';
export const messages = {
  en: {
    bus_near: 'Your child’s bus is approaching home',
    arrived: 'Your child’s bus has arrived',
    boarded: 'Your child has boarded the bus',
    arrived_school: 'Your child has arrived at school',
    dropped_home: 'Your child has been dropped home',
    absent: 'Your child was marked absent',
    delay: 'The trip has been delayed',
    sos: 'Emergency alert from your child’s trip',
    handover_rejected: 'A child handover was rejected',
    child_unaccounted: 'A child has not been accounted for at trip end',
  },
  sn: {
    bus_near: 'Bhazi remwana wenyu rava pedyo nekumba',
    arrived: 'Bhazi remwana wenyu rasvika',
    boarded: 'Mwana wenyu apinda mubhazi',
    arrived_school: 'Mwana wenyu asvika kuchikoro',
    dropped_home: 'Mwana wenyu asvika kumba',
    absent: 'Mwana wenyu anyorwa seasipo',
    delay: 'Rwendo rwambononoka',
    sos: 'Yambiro yechimbichimbi parwendo rwemwana wenyu',
    handover_rejected: 'Kupihwa kwemwana kwarambwa',
    child_unaccounted: 'Mwana haasati asimbiswa pakupera kwerwendo',
  },
  nd: {
    bus_near: 'Ibhasi yomntwana wakho isisondela ekhaya',
    arrived: 'Ibhasi yomntwana wakho isifikile',
    boarded: 'Umntwana wakho ugibele ibhasi',
    arrived_school: 'Umntwana wakho ufikile esikolo',
    dropped_home: 'Umntwana wakho ufikisiwe ekhaya',
    absent: 'Umntwana wakho ubhalwe njengongafikanga',
    delay: 'Uhambo lubambezeleke',
    sos: 'Isixwayiso esiphuthumayo ohambweni lomntwana wakho',
    handover_rejected: 'Ukunikezelwa komntwana kwaliwe',
    child_unaccounted: 'Umntwana akaqinisekiswanga ekupheleni kohambo',
  },
} as const;
export type MessageKey = keyof typeof messages.en;
export function translate(language: Language, key: MessageKey): string {
  return messages[language][key];
}

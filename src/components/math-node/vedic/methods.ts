/** The Vedic Maths methods, by their original names. Each gets its lesson in turn. */
export interface VedicMethod {
  id: string;
  name: string;
  /** The name in Hindi (Devanagari). */
  nameHi: string;
  /** Has a lesson yet. */
  ready: boolean;
}

export const VEDIC_METHODS: VedicMethod[] = [
  { id: "balancing", name: "Balancing Rule", nameHi: "संतुलन नियम", ready: true },
  { id: "base", name: "Base", nameHi: "आधार (बेस)", ready: true },
  { id: "teens", name: "Multiply 11–19", nameHi: "11–19 का गुणा", ready: true },
  { id: "ekadhikena", name: "Ekadhikena Purvena", nameHi: "एकाधिकेन पूर्वेण", ready: true },
  { id: "vilokanam", name: "Vilokanam", nameHi: "विलोकनम्", ready: true },
  { id: "nikhilam", name: "Nikhilam Navatashcaramam Dashatah", nameHi: "निखिलं नवतश्चरमं दशतः", ready: true },
  { id: "urdhva", name: "Urdhva Tiryagbhyam", nameHi: "ऊर्ध्वतिर्यग्भ्याम्", ready: true },
  { id: "paravartya", name: "Paravartya Yojayet", nameHi: "परावर्त्य योजयेत्", ready: true },
  { id: "shunyam", name: "Shunyam Samyasamuccaye", nameHi: "शून्यं साम्यसमुच्चये", ready: true },
  { id: "anurupye", name: "Anurupye Shunyamanyat", nameHi: "आनुरूप्ये शून्यमन्यत्", ready: true },
  { id: "sankalana", name: "Sankalana Vyavakalanabhyam", nameHi: "संकलनव्यवकलनाभ्याम्", ready: true },
  { id: "purana", name: "Puranapuranabhyam", nameHi: "पूरणापूरणाभ्याम्", ready: true },
  { id: "chalana", name: "Chalana Kalanabhyam", nameHi: "चलनकलनाभ्याम्", ready: true },
  { id: "yavadunam", name: "Yavadunam", nameHi: "यावदूनम्", ready: true },
  { id: "vyashti", name: "Vyashti Samashti", nameHi: "व्यष्टिसमष्टिः", ready: true },
  { id: "shesanyankena", name: "Shesanyankena Charamena", nameHi: "शेषाण्यङ्केन चरमेण", ready: true },
  { id: "sopantya", name: "Sopantyadvayamantyam", nameHi: "सोपान्त्यद्वयमन्त्यम्", ready: true },
  { id: "ekanyunena", name: "Ekanyunena Purvena", nameHi: "एकन्यूनेन पूर्वेण", ready: true },
  { id: "gunita", name: "Gunita Samuccaya", nameHi: "गुणितसमुच्चयः", ready: true },
  { id: "gunaka", name: "Gunaka Samuccaya", nameHi: "गुणकसमुच्चयः", ready: true },
];

/** A method's name in the reader's language. */
export const methodName = (id: string, lang: "en" | "hi") => {
  const m = VEDIC_METHODS.find((x) => x.id === id);
  return m ? (lang === "hi" ? m.nameHi : m.name) : id;
};

// DRAFT Terms and Conditions and Data Privacy Policy text (English + Tagalog).
// Follows the principles of the Data Privacy Act of 2012 (RA 10173) but was NOT written or reviewed
// by a lawyer. Have the OSCA office / the city's Data Protection Officer review it and fill in the
// bracketed parts before real use. Keep in sync with src/lib/privacyText.js in the admin dashboard.
export type Section = [title: string, body: string];

const CONTACT_EN = "[OSCA Valenzuela Data Protection Officer: name, email, phone]";
const CONTACT_TL = "[Data Protection Officer ng OSCA Valenzuela: pangalan, email, telepono]";

export const TERMS: Record<"en" | "tl", Section[]> = {
  en: [
    ["Who this is for", "SCIA is a service of the Office of Senior Citizens Affairs (OSCA) of Valenzuela City for residents aged 60 and above."],
    ["Your account", "Give true information. Do not share your login. If someone helps you register, they may only do so with your knowledge and permission."],
    ["What the service does", "SCIA helps you request and track your Senior Citizen ID, book pick-up and health appointments, join events, get announcements and ask for help in an emergency."],
    ["Emergency features", "The SOS button and Safety Monitoring are aids, not a guarantee. Phone signal, battery and settings can stop them from working. In a real emergency also call your local emergency number."],
    ["Health information", "The assistant inside the app gives general information only. It is not a doctor and does not replace medical advice."],
    ["Changes", "These terms may change. Using the service after a change means you accept the new terms."],
  ],
  tl: [
    ["Para kanino ito", "Ang SCIA ay serbisyo ng Office of Senior Citizens Affairs (OSCA) ng Lungsod ng Valenzuela para sa mga residenteng 60 taong gulang pataas."],
    ["Ang inyong account", "Magbigay ng totoong impormasyon. Huwag ibahagi ang inyong login. Kung may tumutulong sa inyong magparehistro, dapat po ay alam at pumayag kayo."],
    ["Ano ang ginagawa ng serbisyo", "Tinutulungan kayo ng SCIA na humiling at subaybayan ang inyong Senior Citizen ID, mag-book ng pick-up at health appointment, sumali sa mga event, makakuha ng anunsyo at humingi ng tulong sa emergency."],
    ["Mga emergency feature", "Ang SOS button at Safety Monitoring ay pantulong lamang, hindi garantiya. Maaaring hindi gumana dahil sa signal, baterya o settings. Sa tunay na emergency, tumawag din sa inyong lokal na emergency number."],
    ["Impormasyong pangkalusugan", "Pangkalahatang impormasyon lamang ang ibinibigay ng assistant sa app. Hindi ito doktor at hindi nito napapalitan ang payo ng doktor."],
    ["Mga pagbabago", "Maaaring magbago ang mga tuntuning ito. Ang patuloy na paggamit matapos ang pagbabago ay nangangahulugang tinatanggap ninyo ang bagong tuntunin."],
  ],
};

export const PRIVACY: Record<"en" | "tl", Section[]> = {
  en: [
    ["What we collect", "Your name, birthday, sex, address, mobile number, OSCA ID number and a photo of your ID, your guardian's name and mobile number, and, only if you turn on Safety Monitoring, your phone's location and last activity time."],
    ["Why we collect it", "To confirm you are a senior resident, issue and release your ID, schedule your pick-up, check you in to events, send announcements, and alert your guardian and your barangay office when you ask for help or cannot be reached."],
    ["Who sees it", "Authorised OSCA and barangay staff (each only for their own barangay where this applies), and the service providers that run the system: cloud hosting and an SMS gateway used to send alerts. Names are shown to staff as reference codes in general lists."],
    ["How long we keep it", "Only as long as needed for these purposes or as required by law. You can ask us to delete your account and data."],
    ["Your rights", "You may ask to see your data, correct it, object to its use, withdraw your consent or have it deleted, and you may complain to the National Privacy Commission."],
    ["How we protect it", "Access is limited by role, data is stored in a secured cloud database and transferred over encrypted connections."],
    ["Contact", CONTACT_EN],
  ],
  tl: [
    ["Ano ang kinokolekta namin", "Ang inyong pangalan, kaarawan, kasarian, tirahan, mobile number, OSCA ID number at larawan ng inyong ID, pangalan at mobile number ng inyong guardian, at, kung binuksan ninyo ang Safety Monitoring lamang, ang lokasyon ng inyong telepono at huling oras ng aktibidad."],
    ["Bakit namin ito kinokolekta", "Para matiyak na kayo ay senior na residente, mailabas at maibigay ang inyong ID, maiskedyul ang pick-up, ma-check in kayo sa mga event, makapagpadala ng anunsyo, at maalerto ang inyong guardian at barangay office kapag humingi kayo ng tulong o hindi kayo makontak."],
    ["Sino ang nakakakita", "Mga awtorisadong kawani ng OSCA at barangay (bawat isa ay para lamang sa sariling barangay kung naaangkop), at ang mga service provider na nagpapatakbo ng sistema: cloud hosting at SMS gateway para sa mga alerto. Reference code ang ipinapakita sa mga kawani sa pangkalahatang listahan, hindi ang buong pangalan."],
    ["Gaano katagal namin itong iingatan", "Hangga't kailangan lamang para sa mga layuning ito o ayon sa batas. Maaari ninyong hilingin na burahin ang inyong account at datos."],
    ["Ang inyong mga karapatan", "Maaari ninyong hilingin na makita, itama, tutulan ang paggamit, bawiin ang pahintulot o burahin ang inyong datos, at maaari kayong magreklamo sa National Privacy Commission."],
    ["Paano namin ito pinoprotektahan", "Limitado ang access ayon sa tungkulin, nakaimbak ang datos sa ligtas na cloud database at ipinapadala sa pamamagitan ng naka-encrypt na koneksyon."],
    ["Kontak", CONTACT_TL],
  ],
};

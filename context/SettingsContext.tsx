import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// Define the shape of the context value
interface SettingsContextType {
  fontScale: number;
  language: string;
  setFontScale: (scale: number) => void;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

// Create context with the type, defaulting to null (but typed)
const SettingsContext = createContext<SettingsContextType | null>(null);

// Custom hook to use the context
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// Provider component
interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [fontScale, setFontScaleState] = useState<number>(1); // Default to medium
  const [language, setLanguageState] = useState<string>('en'); // Default to English

  // Persistence logic (unchanged)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedFontScale = await AsyncStorage.getItem('fontScale');
        const storedLanguage = await AsyncStorage.getItem('language');
        if (storedFontScale) setFontScaleState(parseFloat(storedFontScale));
        if (storedLanguage) setLanguageState(storedLanguage);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  const setFontScale = async (scale: number) => {
    setFontScaleState(scale);
    try {
      await AsyncStorage.setItem('fontScale', scale.toString());
    } catch (error) {
      console.error('Failed to save fontScale:', error);
    }
  };

  const setLanguage = async (lang: string) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem('language', lang);
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  };

  // Translation helper (unchanged, but ensure it matches the interface)
  const t = (key: string): string => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        fontSize: 'Font Size',
        language: 'Language',
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        english: 'English',
        tagalog: 'Tagalog',
        preview: 'Good day! I am SCIA, a senior citizen friendly assistant.',
        accountSettings: 'Account Settings',
        adjustFontSize: 'Adjust font size',
        changeLanguage: 'Change language',
        exampleTextPreview: 'Example text preview:',
        saveChanges: 'Save Changes',
        profilePage: 'Profile Page',
        changePicture: 'Change Picture',
        removePicture: 'Remove Picture',
        notifications: 'Notifications',
        nameLabel: 'Name:',
        seniorCitizenId: 'Senior Citizen ID:',
        addressLabel: 'Address:',
        contactNumber: 'Contact Number:',
        dobLabel: 'Date of Birth:',
        genderLabel: 'Gender:',
        qrCodeTitle: 'Senior Citizen ID QR Code',
        greeting: 'Magandang Araw Po,',
        programUpdates: 'LGU Program Updates',
        whatLabel: 'What :',
        whenLabel: 'When :',
        whereLabel: 'Where :',
        joinLabel: 'Join',
        chatAssistant: 'Chat Assistant',
        howCanIHelp: 'How can I help you today?',
        voiceAssistant: 'Voice Assistant',
        liveSessionActive: 'Live session active',
        liveRecording: 'Recording your voice...',
        connectingStatus: 'Connecting to Gemini Live...',
        connectedStatus: 'Connected',
        respondingStatus: 'Gemini is responding...',
        connectionErrorStatus: 'Connection error',
        notConnectedStatus: 'Not connected',
        disconnect: 'Disconnect',
        connect: 'Connect',
        inputTranscriptLabel: 'Input transcript',
        modelTranscriptLabel: 'Model transcript',
        connectAndSpeak: 'Connect and start speaking or send realtime text.',
        geminiResponses: 'Gemini responses will appear here.',
        sendRealtimeTextPlaceholder: 'Send realtime text to Live API...',
        speakAndGetHelp: 'Speak and get help instantly',
        reminder: 'Reminder',
        takeLabel: 'Take :',
        timeLabel: 'Time :',
        noteLabel: 'Note :',
        noReminders: 'No medicine reminders today',
        sosEmergency: 'SOS EMERGENCY',
        callForHelp: 'Call for help',
        setAppointment: 'SET APPOINTMENT',
        bookYourVisit: 'Book your visit',
        medicinePillBox: 'MEDICINE PILL BOX',
        manageMedications: 'Manage medications',
        governmentWebsites: 'GOVERNMENT WEBSITES',
        visitOfficialSites: 'Visit official sites',
        scheduleAppointment: 'Schedule Appointment',
        selectedDate: 'Selected Date:',
        bookAppointment: 'Book Appointment',
        newAppointment: 'New Appointment',
        hospitalClinic: 'Hospital / Clinic',
        typePlaceholder: 'Type (Check-up, Consultation, Lab Test)',
        hhPlaceholder: 'HH',
        mmPlaceholder: 'MM',
        medicineNamePlaceholder: 'e.g., Blood Pressure Medicine',
        descriptionPlaceholder: 'e.g., Take after meals',
        dosagePlaceholder: 'e.g., 1, 500',
        intervalPlaceholder: 'e.g., 8',
        dosageLabel: 'Dosage:',
        noDescriptionProvided: 'No description provided',
        saveAppointment: 'Save Appointment',
        cancel: 'Cancel',
        done: 'Done',
        other: 'Other',
        emergencyType: 'Emergency Type',
        fall: 'Fall',
        heartAttack: 'Heart Attack',
        stroke: 'Stroke',
        typeEmergency: 'Type emergency...',
        infoName: 'Name:',
        infoAddress: 'Address:',
        infoBarangay: 'Barangay:',
        infoEmergency: 'Emergency:',
        noMedicines: 'No medicines added yet',
        addFirstMedicine: 'Add your first medicine to get started',
        addMedicine: 'Add Medicine',
        medicineName: 'Medicine Name',
        descriptionPurpose: 'Description / Purpose (Optional)',
        dosage: 'Dosage',
        unit: 'Unit',
        intervalHours: 'Interval (hours)',
        saveSchedule: 'Save & Schedule',
        close: 'Close',
        descriptionLabel: 'Description:',
        scheduleLabel: 'Schedule:',
        nextDose: 'Next Dose:',
        markTakenNow: 'Mark as Taken Now',
      },
      tl: {
        fontSize: 'Laki ng Font',
        language: 'Wika',
        small: 'Maliit',
        medium: 'Katamtaman',
        large: 'Malaki',
        english: 'English',
        tagalog: 'Tagalog',
        preview: 'Kumusta po! Ako si SCIA, ang inyong senior citizen friendly assistant.',
        accountSettings: 'Account Settings',
        adjustFontSize: 'Ayusin ang laki ng font',
        changeLanguage: 'Piliin ang wika',
        exampleTextPreview: 'Halimbawang teksto ng preview:',
        saveChanges: 'I-save ang mga binago',
        profilePage: 'Profile Page',
        changePicture: 'Palitan ang Picture',
        removePicture: 'Tanggalin ang Picture',
        notifications: 'Mga Abiso',
        nameLabel: 'Pangalan:',
        seniorCitizenId: 'Senior Citizen ID:',
        addressLabel: 'Address:',
        contactNumber: 'Contact Number:',
        dobLabel: 'Araw ng Kapanganakan:',
        genderLabel: 'Kasarian:',
        qrCodeTitle: 'Senior Citizen ID QR Code',
        greeting: 'Magandang Araw Po,',
        programUpdates: 'Update sa Programa ng LGU',
        whatLabel: 'Ano :',
        whenLabel: 'Kailan :',
        whereLabel: 'Saan :',
        joinLabel: 'Sumali',
        chatAssistant: 'Chat Assistant',
        howCanIHelp: 'Paano kita matutulungan ngayon?',
        voiceAssistant: 'Voice Assistant',
        liveSessionActive: 'Live session active',
        liveRecording: 'Ire-record ang boses mo...',
        connectingStatus: 'Nagko-connect sa Gemini Live...',
        connectedStatus: 'Connected',
        respondingStatus: 'Gemini ay nagreresponde...',
        connectionErrorStatus: 'Connection error',
        notConnectedStatus: 'Hindi connected',
        disconnect: 'Disconnect',
        connect: 'Connect',
        inputTranscriptLabel: 'Input transcript',
        modelTranscriptLabel: 'Model transcript',
        connectAndSpeak: 'Mag-connect at magsalita o mag-send ng realtime text.',
        geminiResponses: 'Dito lalabas ang Gemini responses.',
        speakAndGetHelp: 'Magsalita at kumuha ng tulong agad',
        reminder: 'Paalala',
        takeLabel: 'Uminom :',
        timeLabel: 'Oras :',
        noteLabel: 'Tala :',
        noReminders: 'Walang medicine reminder ngayon',
        sosEmergency: 'SOS Emergency',
        callForHelp: 'Tumawag ng tulong',
        setAppointment: 'Set Appointment',
        bookYourVisit: 'Mag-book ng appointment',
        medicinePillBox: 'Medicine Pill Box',
        manageMedications: 'Isaayos ang mga gamot',
        governmentWebsites: 'Government Websites',
        visitOfficialSites: 'Bisitahin ang official sites',
        scheduleAppointment: 'Schedule Appointment',
        selectedDate: 'Napiling Petsa:',
        bookAppointment: 'Mag-book ng Appointment',
        newAppointment: 'Bagong Appointment',
        hospitalClinic: 'Hospital / Clinic',
        typePlaceholder: 'I-type (Check-up, Konsultasyon, Lab Test)',
        hhPlaceholder: 'HH',
        mmPlaceholder: 'MM',
        medicineNamePlaceholder: 'e.g., Blood Pressure Medicine',
        descriptionPlaceholder: 'e.g., Inumin pagkatapos kumain',
        dosagePlaceholder: 'e.g., 1, 500',
        intervalPlaceholder: 'e.g., 8',
        dosageLabel: 'Dosage:',
        noDescriptionProvided: 'Walang description na binigay',
        saveAppointment: 'I-save ang Appointment',
        cancel: 'Cancel',
        done: 'Done',
        other: 'Other',
        emergencyType: 'Uri ng Emergency',
        fall: 'Fall',
        heartAttack: 'Heart Attack',
        stroke: 'Stroke',
        typeEmergency: 'Isulat ang emergency...',
        infoName: 'Pangalan:',
        infoAddress: 'Address:',
        infoBarangay: 'Barangay:',
        infoEmergency: 'Emergency:',
        noMedicines: 'Walang gamot na idinagdag pa',
        addFirstMedicine: 'Mag-add ng unang gamot para magsimula',
        addMedicine: 'Mag-add ng gamot',
        medicineName: 'Pangalan ng gamot',
        descriptionPurpose: 'Description / Layun (Opsyonal)',
        dosage: 'Dosage',
        unit: 'Unit',
        intervalHours: 'Interval (hours)',
        saveSchedule: 'Save & Schedule',
        close: 'Close',
        descriptionLabel: 'Description:',
        scheduleLabel: 'Schedule:',
        nextDose: 'Next Dose:',
        markTakenNow: 'Markahan na nainom na',
      },
    };
    const langMap = translations[language] || translations.en;
    return langMap[key] || key;
  };

  const value: SettingsContextType = {
    fontScale,
    language,
    setFontScale,
    setLanguage,
    t,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

// Export the context for advanced use
export default SettingsContext;
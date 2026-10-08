import { en, tl } from '@/constants/translations';
import { ContrastMode, getPalette, Palette } from '@/constants/theme';
import { setCurrentLanguage } from '@/lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type TVars = Record<string, string | number>;

interface SettingsContextType {
  fontScale: number;
  language: string;
  contrast: ContrastMode;
  colors: Palette;
  setFontScale: (scale: number) => void;
  setLanguage: (lang: string) => void;
  setContrast: (mode: ContrastMode) => void;
  t: (key: string, vars?: TVars) => string;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

const DICTS: Record<string, Record<string, string>> = { en, tl };

// New storage key: older installs saved 'en' under 'language' before Tagalog
// became the default, so everyone starts in Tagalog once and can still switch
// to English in Settings (that choice is then remembered).
const LANGUAGE_KEY = 'language_v2';
const CONTRAST_KEY = 'contrast_v1';

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  // Larger text by default: NN/g found tiny type is a recurring problem for older users.
  const [fontScale, setFontScaleState] = useState<number>(1.25);
  // Tagalog by default: most SCIA users are Filipino seniors.
  const [language, setLanguageState] = useState<string>('tl');
  const [contrast, setContrastState] = useState<ContrastMode>('standard');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedFontScale = await AsyncStorage.getItem('fontScale');
        const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
        const storedContrast = await AsyncStorage.getItem(CONTRAST_KEY);
        if (storedContrast === 'standard' || storedContrast === 'high' || storedContrast === 'colorblind') {
          setContrastState(storedContrast);
        }
        if (storedFontScale) {
          // The old "Small" size (0.75) is no longer offered; lift it to the standard size.
          const saved = parseFloat(storedFontScale);
          if (Number.isFinite(saved)) setFontScaleState(Math.max(1, saved));
        }
        if (storedLanguage === 'en' || storedLanguage === 'tl') {
          setLanguageState(storedLanguage);
          setCurrentLanguage(storedLanguage);
        }
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
    setCurrentLanguage(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  };

  const setContrast = async (mode: ContrastMode) => {
    setContrastState(mode);
    try {
      await AsyncStorage.setItem(CONTRAST_KEY, mode);
    } catch (error) {
      console.error('Failed to save contrast:', error);
    }
  };

  const colors = useMemo(() => getPalette(contrast), [contrast]);

  // t("key") or t("key", { name: "Juan" }) for strings with {name} placeholders.
  // Falls back to English, then to the key itself, so a missing Tagalog string
  // never shows up blank.
  const t = (key: string, vars?: TVars): string => {
    const dict = DICTS[language] || tl;
    let text = dict[key] ?? en[key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        text = text.split('{' + k + '}').join(String(vars[k]));
      }
    }
    return text;
  };

  const value: SettingsContextType = {
    fontScale,
    language,
    contrast,
    colors,
    setFontScale,
    setLanguage,
    setContrast,
    t,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export default SettingsContext;

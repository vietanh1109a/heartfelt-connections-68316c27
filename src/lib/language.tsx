import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Language = "vi" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (vi: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "vi",
  setLang: () => {},
  t: (vi) => vi,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem("app-lang") as Language) || "vi";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("app-lang", l);
  };

  const t = (vi: string, en: string) => (lang === "vi" ? vi : en);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'bright' | 'night' | 'black';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'bright',
    setTheme: () => { },
    cycleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

const THEME_ORDER: Theme[] = ['bright', 'night', 'black'];

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('bright');

    useEffect(() => {
        const saved = localStorage.getItem('ffe-theme') as Theme | null;
        if (saved && THEME_ORDER.includes(saved)) {
            setThemeState(saved);
            document.documentElement.setAttribute('data-theme', saved);
        }
    }, []);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem('ffe-theme', t);
        document.documentElement.setAttribute('data-theme', t);
    };

    const cycleTheme = () => {
        const idx = THEME_ORDER.indexOf(theme);
        const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
        setTheme(next);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

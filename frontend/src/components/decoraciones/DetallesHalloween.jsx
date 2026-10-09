export function LunaHalloween() {
    return (
        <svg className="halloween-saludo-icono" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 3a8.5 8.5 0 1 0 4 14A9 9 0 0 1 17 3Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M6 3v4M4 5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

export function AranaHalloween() {
    return (
        <svg className="halloween-arana" viewBox="0 0 40 84" aria-hidden="true">
            <path d="M20 0v46" stroke="currentColor" strokeWidth=".7" opacity=".4" />
            <g className="halloween-arana-cuerpo">
                <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 54 10 49 6 51 M16 57 8 55 4 58 M16 60 9 63 7 68 M24 54 30 49 34 51 M24 57 32 55 36 58 M24 60 31 63 33 68" />
                </g>
                <ellipse cx="20" cy="57" rx="4" ry="5" fill="currentColor" />
                <circle cx="20" cy="51" r="2.5" fill="currentColor" />
            </g>
        </svg>
    );
}

export function SeparadorHalloween() {
    return (
        <div className="halloween-separador" aria-hidden="true">
            <span />
            <svg viewBox="0 0 40 20">
                <path d="M20 8 18 4 16 8Q10 1 1 3L5 13Q11 9 14 16Q17 12 20 19Q23 12 26 16Q29 9 35 13L39 3Q30 1 24 8L22 4Z" fill="currentColor" />
            </svg>
            <span />
        </div>
    );
}

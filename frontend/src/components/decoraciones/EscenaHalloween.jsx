export default function EscenaHalloween() {
    return (
        <div className="halloween-escena" aria-hidden="true">
            <div className="halloween-luna" />
            <svg className="halloween-ramas" viewBox="0 0 1000 800" preserveAspectRatio="none">
                <g fill="none" stroke="#20152c" strokeWidth="12" strokeLinecap="round">
                    <path d="M0 520 L65 350 L38 180 L110 80 M65 350 L142 250 L180 130 M38 180 L0 110 M142 250 L220 235 M1000 650 L930 470 L958 310 L892 180 M930 470 L849 360 L814 245 M958 310 L1000 250 M849 360 L772 342" />
                </g>
            </svg>
            {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} className={`halloween-murcielago halloween-murcielago-${i}`} viewBox="0 0 80 40">
                    <path d="M40 17 L35 8 L32 17 Q18 3 2 5 L11 25 Q20 17 27 32 Q35 25 40 39 Q45 25 53 32 Q60 17 69 25 L78 5 Q62 3 48 17 L45 8Z" fill="currentColor" />
                </svg>
            ))}
            <div className="halloween-niebla" />
        </div>
    );
}

export default function SombreroSemaforo() {
    return (
        <svg
            viewBox="0 0 200 110"
            className="sombrero-semaforo"
            style={{ transform: "rotate(-8deg)" }}
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Ala */}
            <ellipse cx="100" cy="78" rx="92" ry="16" fill="#8B5A2B" />
            <ellipse cx="100" cy="74" rx="86" ry="13" fill="#A6702E" />

            {/* Copa cónica */}
            <path d="M62 76 Q68 22 100 12 Q132 22 138 76 Z" fill="#A6702E" />
            <path
                d="M62 76 Q68 22 100 12 Q132 22 138 76 Z"
                fill="url(#sombraCopa)"
                opacity="0.35"
            />

            {/* Banda tricolor */}
            <rect x="62" y="64" width="25.3" height="7" fill="#006341" />
            <rect x="87.3" y="64" width="25.4" height="7" fill="#FFFFFF" />
            <rect x="112.7" y="64" width="25.3" height="7" fill="#CE1126" />

            <defs>
                <linearGradient id="sombraCopa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
                </linearGradient>
            </defs>
        </svg>
    );
}

import { useId } from "react";

export default function CalabazaSemaforo() {
    const id = useId().replace(/:/g, "");
    const ojos = "M67 92 Q85 82 110 112 Q85 120 67 92Z M150 112 Q175 82 193 92 Q175 120 150 112Z";
    const boca = "M73 142 Q91 150 100 141 L106 150 Q130 155 154 150 L160 141 Q169 150 187 142 Q184 179 156 190 L152 179 L143 181 L141 194 Q130 197 119 194 L117 181 L108 179 L104 190 Q76 179 73 142Z";
    return (
        <svg className="halloween-calabaza" viewBox="0 0 260 240" aria-hidden="true">
            <defs>
                <radialGradient id={`${id}-piel`} cx="36%" cy="24%" r="80%">
                    <stop stopColor="#ffd17a" />
                    <stop offset=".32" stopColor="#f99a32" />
                    <stop offset=".72" stopColor="#d9691d" />
                    <stop offset="1" stopColor="#8c3816" />
                </radialGradient>
                <radialGradient id={`${id}-centro`} cx="30%" cy="22%" r="90%">
                    <stop stopColor="#ffd789" />
                    <stop offset=".4" stopColor="#f9a13e" />
                    <stop offset=".8" stopColor="#df771f" />
                    <stop offset="1" stopColor="#a84918" />
                </radialGradient>
                <linearGradient id={`${id}-tallo`} x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#91a259" />
                    <stop offset=".5" stopColor="#62723e" />
                    <stop offset="1" stopColor="#39412b" />
                </linearGradient>
                <mask id={`${id}-huecos`} maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="240">
                    <rect width="260" height="240" fill="white" />
                    <path d={ojos} fill="black" />
                    <path d={boca} fill="black" />
                </mask>
            </defs>
            <path d="M116 56 Q109 32 124 8 Q137 5 148 15 Q129 35 138 57Z" fill={`url(#${id}-tallo)`} />
            <path d="M125 47 Q121 30 134 16" fill="none" stroke="#bbc382" strokeWidth="3" strokeLinecap="round" opacity=".6" />
            <path d="M141 48 Q165 29 172 42 Q177 53 159 54" fill="none" stroke="#71814b" strokeWidth="3" strokeLinecap="round" />
            <g mask={`url(#${id}-huecos)`}>
                <path d="M130 47 C83 26 14 47 11 128 C8 193 53 235 130 222 C207 235 252 193 249 128 C246 47 177 26 130 47Z" fill={`url(#${id}-piel)`} />
                <ellipse cx="78" cy="133" rx="51" ry="91" fill={`url(#${id}-piel)`} />
                <ellipse cx="182" cy="133" rx="51" ry="91" fill={`url(#${id}-piel)`} />
                <ellipse cx="107" cy="136" rx="43" ry="91" fill={`url(#${id}-centro)`} />
                <ellipse cx="153" cy="136" rx="43" ry="91" fill={`url(#${id}-piel)`} />
                <ellipse cx="130" cy="136" rx="36" ry="91" fill={`url(#${id}-centro)`} />
                <g fill="none" stroke="#843812" strokeWidth="2" opacity=".25">
                    <path d="M78 48 C45 85 45 174 80 215 M182 48 C215 85 215 174 180 215 M109 49 C80 93 82 186 109 223 M151 49 C180 93 178 186 151 223" />
                </g>
                <g fill="none" stroke="#ffe5aa" strokeLinecap="round">
                    <path d="M35 105 Q37 77 56 62 M101 62 Q87 78 84 98 M127 60 Q117 74 117 84" strokeWidth="4" opacity=".35" />
                    <path d="M23 149 Q28 188 54 204" strokeWidth="2" opacity=".18" />
                </g>
            </g>
            <g fill="none" strokeLinejoin="round">
                <path d={ojos} stroke="#743716" strokeWidth="5" />
                <path d={boca} stroke="#743716" strokeWidth="5" />
                <path d="M73 94 Q87 89 106 111 M154 111 Q173 89 187 94 M80 153 Q85 172 101 181 M159 181 Q175 172 180 153" stroke="#ffbf66" strokeWidth="2" opacity=".8" />
            </g>
        </svg>
    );
}

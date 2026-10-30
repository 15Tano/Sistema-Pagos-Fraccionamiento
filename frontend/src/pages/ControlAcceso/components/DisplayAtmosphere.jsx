import { useId } from "react";
import { motion as Motion } from "framer-motion";

// Misma topología (M + ocho curvas C + Z): la interpolación de d es continua.
const SILHOUETTES = [
    "M300 48 C376 24 438 68 460 132 C479 186 563 192 555 271 C548 340 480 350 465 414 C450 493 386 556 312 536 C249 519 232 457 166 466 C91 479 40 420 59 349 C76 286 143 269 120 201 C99 133 205 78 300 48 Z",
    "M300 72 C374 92 475 27 503 113 C527 184 447 215 487 279 C533 352 551 438 463 464 C398 484 382 408 312 444 C241 481 217 568 142 510 C80 462 137 392 95 333 C42 259 57 186 137 176 C220 166 216 49 300 72 Z",
    "M300 122 C367 151 399 39 476 86 C550 130 516 214 546 267 C585 337 494 382 430 360 C356 336 390 470 318 514 C245 559 192 479 160 432 C119 373 25 377 50 290 C69 219 174 263 180 194 C187 117 232 93 300 122 Z",
    "M300 42 C379 20 382 127 448 144 C516 162 579 215 532 280 C490 339 553 405 484 456 C421 502 366 440 306 474 C234 515 167 552 124 481 C86 418 154 369 100 310 C46 252 55 172 133 148 C209 125 222 64 300 42 Z",
];
const FORMS = [
    { name: "one", colors: ["#f8e8cd", "#deb17b", "#f1d8b5"], paths: [...SILHOUETTES, SILHOUETTES[0]], duration: 16, float: { x: ["-3vw", "15vw", "2vw", "-3vw"], y: ["0vh", "13vh", "-5vh", "0vh"], rotate: [0, 12, -8, 0] } },
    { name: "two", colors: ["#eed6b2", "#d2aa77", "#fff1dc"], paths: [SILHOUETTES[2], SILHOUETTES[0], SILHOUETTES[3], SILHOUETTES[1], SILHOUETTES[2]], duration: 21, float: { x: ["3vw", "-15vw", "-3vw", "3vw"], y: ["0vh", "-15vh", "5vh", "0vh"], rotate: [0, -18, 10, 0] } },
    { name: "three", colors: ["#fff8e9", "#e5c293", "#f9e7ca"], paths: [SILHOUETTES[1], SILHOUETTES[3], SILHOUETTES[0], SILHOUETTES[2], SILHOUETTES[1]], duration: 19, float: { x: ["-5vw", "12vw", "0vw", "-5vw"], y: ["5vh", "-8vh", "8vh", "5vh"], rotate: [0, 20, -10, 0] } },
];
const STILL = { x: 0, y: 0, rotate: 0 };

export default function DisplayAtmosphere({ reducedMotion }) {
    const id = useId().replace(/:/g, "");
    return <>
        <div className="ac-display-ambient ac-lava-atmosphere" aria-hidden="true">
            {FORMS.map((form, index) => <Motion.div key={form.name} className={`ac-lava-form ac-lava-form-${form.name}`}
                initial={reducedMotion ? false : STILL} animate={reducedMotion ? STILL : form.float}
                transition={reducedMotion ? { duration: 0 } : { duration: form.duration + 5, repeat: Infinity, ease: "easeInOut" }}>
                <svg viewBox="0 0 600 600" className="ac-lava-svg" focusable="false">
                    <defs><linearGradient id={`${id}-${index}`} x1="5%" y1="10%" x2="90%" y2="85%">
                        {form.colors.map((color, stop) => <stop key={color} offset={`${stop * 50}%`} stopColor={color} />)}
                    </linearGradient></defs>
                    <Motion.path className="ac-lava-silhouette" fill={`url(#${id}-${index})`} stroke="#fff7e6" strokeWidth="1.2"
                        initial={{ d: form.paths[0] }} animate={{ d: reducedMotion ? form.paths[0] : form.paths }}
                        transition={reducedMotion ? { duration: 0 } : { duration: form.duration, repeat: Infinity, ease: "easeInOut" }} />
                </svg>
            </Motion.div>)}
        </div>
        <div className="ac-ambient-sweep-clip" aria-hidden="true"><Motion.div className="ac-ambient-sweep"
            initial={reducedMotion ? false : { x: "-65vw", rotate: -24 }}
            animate={reducedMotion ? { x: 0, rotate: -24, opacity: .18 } : { x: ["-65vw", "145vw"], rotate: -24, opacity: [0, .65, .65, 0] }}
            transition={reducedMotion ? { duration: 0 } : { duration: 14, repeat: Infinity, repeatDelay: 2, ease: "linear", opacity: { duration: 14, repeat: Infinity, repeatDelay: 2, times: [0, .12, .85, 1] } }} />
        </div>
    </>;
}

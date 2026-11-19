import { Radio } from "lucide-react";
import "./TagAccessCard.css";

const sparks = [
    [0, 36], [36, 37], [79, 32], [126, 33],
    [173, 34], [228, 34], [277, 30], [322, 40],
];

export default function TagAccessCard({ code, owner, status, disabled, feedback }) {
    return (
        <div
            className="tag-access-card relative isolate overflow-hidden rounded-[1.35rem] border border-white/15 p-4 text-white shadow-[0_10px_24px_rgba(33,24,19,0.17)] sm:p-5"
            data-disabled={disabled}
            data-feedback={feedback}
        >
            <div className="tag-access-card__surface" aria-hidden="true" />
            <div className="tag-access-card__trace" aria-hidden="true" />
            {feedback === "lock" && <div className="tag-access-card__sweep" aria-hidden="true" />}
            <div className="relative flex items-center justify-between gap-3">
                <div className="tag-access-card__reader" aria-hidden="true">
                    <Radio className="tag-access-card__radio" size={25} strokeWidth={1.7} />
                    <span className="tag-access-card__lock">
                        <span className="tag-access-card__shackle" />
                        <span className="tag-access-card__lock-body" />
                    </span>
                    {feedback === "lock" && (
                        <div className="tag-access-card__impact">
                            {sparks.map(([angle, distance]) => (
                                <span key={angle} style={{ "--angle": `${angle}deg`, "--distance": `${distance}px` }} />
                            ))}
                        </div>
                    )}
                </div>
                <span className="tag-access-card__status rounded-full border px-2.5 py-1 text-xs font-semibold">
                    {status}
                </span>
            </div>
            <p className="relative mt-4 break-all font-mono text-xl font-bold tracking-wider">{code}</p>
            <p className="relative mt-1 break-words text-sm text-white/80">{owner}</p>
        </div>
    );
}

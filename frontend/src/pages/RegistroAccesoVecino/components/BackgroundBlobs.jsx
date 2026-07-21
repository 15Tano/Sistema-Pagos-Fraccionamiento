export default function BackgroundBlobs() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none bg-stone-50 z-0">
            <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-orange-400/30 blur-[120px]" />
            <div className="absolute top-[20%] right-[-10%] w-[450px] h-[450px] rounded-full bg-amber-300/30 blur-[100px]" />
            <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-rose-300/20 blur-[120px]" />
        </div>
    );
}

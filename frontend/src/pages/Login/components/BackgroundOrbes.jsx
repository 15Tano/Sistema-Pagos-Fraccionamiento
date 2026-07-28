// Orbes desenfocados para dar refracción al Liquid Glass
function BackgroundOrbes() {
    return (
        <>
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-orange-300/30 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-stone-300/50 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-white/40 rounded-full blur-[80px] pointer-events-none" />
        </>
    );
}

export default BackgroundOrbes;

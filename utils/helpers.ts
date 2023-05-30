export const waitUntil = async <T extends unknown>(promise: () => Promise<T>, delay = 500): Promise<T> => {
    let v: T|null = null;

    const get = async () => { 
        try{
            v = await promise().catch(() => {}) ?? null;
            if(!v) await new Promise<void>(res => setTimeout(res, delay));
        }
        catch{
            
        }
    }

    while(!v) await get();

    return v;
}

export const parseIntForce = (int: string) => {
    const parsed = parseInt(int);

    return isNaN(parsed) ? null : parsed;
}
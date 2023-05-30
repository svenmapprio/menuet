import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { Readable, Writable } from "stream";

export const POST = (req: NextRequest) => {
    if(req.body){
        const transform = sharp().resize(200, 200, {fit: 'cover'}).webp();

        const writable = Writable.toWeb(transform) as WritableStream<any>;
        const readable = Readable.toWeb(transform) as ReadableStream<any>;
    
        req.body.pipeThrough({writable, readable});
        
        return new NextResponse(readable);

    }

    return new NextResponse();
}
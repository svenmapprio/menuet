import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { Readable, Writable } from "stream";

import { ApiError, db, ErrorCode } from "@/utils/db";
import { routeHandlers } from "@/utils/routeHandlers";
import { getSession } from "@/utils/session";

const s3 = new S3Client({
  forcePathStyle: false,
  endpoint: "https://ams3.digitaloceanspaces.com",
  region: "ams3",
  credentials: {
    accessKeyId: process.env.DO_ACCESS_KEY_ID!,
    secretAccessKey: process.env.DO_SECRET_ACCESS_KEY!,
  },
});

export const PUT = async (req: NextRequest) => {
  if (!req.body) return new NextResponse();

  console.log("got request data");

  const newHeaders = {};

  const session = await getSession(newHeaders);

  if (!session) {
    const error = new ApiError(ErrorCode.UserSessionInvalid);
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  const content = await db.transaction().execute(async (trx) => {
    const { id: contentId } = await routeHandlers.put.content({
      session,
      trx,
      headers: newHeaders,
      req,
    });
    return await routeHandlers.get.content({
      contentId,
      session,
      trx,
      headers: newHeaders,
      req,
    });
  });

  if (!content) return NextResponse.json({});

  const { name } = content;

  const start = Date.now();

  console.log("uploading");

  const transform = sharp();

  transform.setMaxListeners(0);

  const createUpload = (transform: sharp.Sharp, name: string, ext: string) => {
    const readable = Readable.toWeb(transform) as ReadableStream<any>;
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: "menuet",
        Key: `content/${name}.${ext}`,
        ContentType: `image/${ext}`,
        ACL: "public-read",
        Body: readable,
      },
    });

    return upload.done();
  };

  const createUploadClone = (width: number, height: number) => {
    const clone = transform
      .clone()
      .resize({ height, width, fit: "cover", withoutEnlargement: true })
      .webp({ quality: 80 });

    return createUpload(clone, `${name}-${width}-${height}`, "webp");
  };

  const createUploadSet = (size: number) => [
    createUploadClone(size, size),
    // createUploadClone(size, size/2),
    // createUploadClone(size/2, size),
  ];

  const writable = Writable.toWeb(transform) as WritableStream<any>;
  const readable = Readable.toWeb(transform) as ReadableStream<any>;

  const original = transform.clone().png({ quality: 100 });

  const uploads = [
    createUpload(original, `${name}`, "png"),
    ...createUploadSet(200),
    ...createUploadSet(500),
    ...createUploadSet(1000),
  ];

  console.log("piping");

  req.body.pipeThrough({ writable, readable });

  await Promise.all(uploads);

  console.log("upload done", Date.now() - start, "ms");

  return NextResponse.json(content);
};

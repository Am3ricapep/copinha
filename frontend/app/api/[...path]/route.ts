import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:3333";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = `${BACKEND}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    if (!["host", "connection", "transfer-encoding"].includes(k)) headers.set(k, v);
  });

  let body: BodyInit | undefined = undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) {
      body = buf;
    } else {
      // body vazio — remove Content-Type para o Fastify não rejeitar
      headers.delete("content-type");
    }
  }

  const res = await fetch(url, {
    method: req.method,
    headers,
    body,
  });

  const resHeaders = new Headers();
  res.headers.forEach((v, k) => {
    if (!["transfer-encoding", "connection"].includes(k)) resHeaders.set(k, v);
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: resHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

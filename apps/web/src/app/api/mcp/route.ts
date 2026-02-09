import { NextResponse } from 'next/server';

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const jsonRpcError = (id: string | number | null | undefined, code: number, message: string) => ({
  jsonrpc: '2.0' as const,
  id: id ?? null,
  error: { code, message }
});

export async function POST(req: Request) {
  let payload: JsonRpcRequest | null = null;
  try {
    payload = (await req.json()) as JsonRpcRequest;
  } catch (err) {
    return NextResponse.json(jsonRpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  if (!payload || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') {
    return NextResponse.json(jsonRpcError(payload?.id, -32600, 'Invalid Request'), { status: 400 });
  }

  return NextResponse.json(
    jsonRpcError(
      payload.id,
      -32601,
      'MCP in Next.js route is scaffold-only. Route requests to apps/mcp-gateway for execution.'
    ),
    { status: 501 }
  );
}

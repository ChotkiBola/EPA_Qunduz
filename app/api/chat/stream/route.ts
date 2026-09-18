import OpenAI from 'openai';
import {
  MODEL,
  MAX_TOKENS,
  RESPONSE_SCHEMA,
  kontekst,
  messagesQur,
  openai,
  parseReply,
  qismanJavob,
  sanitiseHistory,
  tilniTanla,
  toCards,
} from '@/lib/chat';
import { malumotYoshi, narxEskirganmi } from '@/lib/kb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * /chat uchun haqiqiy oqim (brief v4 §4).
 *
 * Model strict JSON qaytaradi, shuning uchun oqimda yarim JSON keladi. Uni
 * to'liq kelishini kutmasdan "javob" maydonini bo'lak-bo'lak ajratib
 * yuboramiz — mijoz model yozayotgan paytda o'qiy boshlaydi. Sxema kafolati
 * ham saqlanadi: oxirida to'liq JSON qaytadan tahlil qilinadi.
 */
export async function POST(req: Request) {
  let body: { message?: unknown; history?: unknown; til?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'So‘rov formati noto‘g‘ri.' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return Response.json({ error: 'Savol bo‘sh.' }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY sozlanmagan.' }, { status: 500 });
  }

  const til = tilniTanla(body.til, message);
  const history = sanitiseHistory(body.history);
  const hits = kontekst(message, history, til);

  const encoder = new TextEncoder();
  const send = (c: ReadableStreamDefaultController, turi: string, data: unknown) =>
    c.enqueue(encoder.encode(`event: ${turi}\ndata: ${JSON.stringify(data)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const oqim = await openai().chat.completions.create({
          model: MODEL,
          max_completion_tokens: MAX_TOKENS,
          messages: messagesQur(message, history, hits, til),
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'qunduz_javob', strict: true, schema: RESPONSE_SCHEMA },
          },
          stream: true,
        });

        let xom = '';
        let yuborilgan = '';

        for await (const bolak of oqim) {
          const delta = bolak.choices[0]?.delta?.content ?? '';
          if (!delta) continue;
          xom += delta;

          const hozir = qismanJavob(xom);
          if (hozir.length > yuborilgan.length) {
            send(controller, 'matn', { qism: hozir.slice(yuborilgan.length) });
            yuborilgan = hozir;
          }
        }

        const { javob, artikullar } = parseReply(xom);
        send(controller, 'tugadi', {
          javob,
          artikullar,
          mahsulotlar: toCards(artikullar, hits, til),
          til,
          malumot: {
            yoshi_kun: Math.round(malumotYoshi() * 10) / 10,
            eskirgan: narxEskirganmi(),
          },
        });
      } catch (err) {
        const xabar =
          err instanceof OpenAI.APIError
            ? `OpenAI API: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        send(controller, 'xato', { error: xabar });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

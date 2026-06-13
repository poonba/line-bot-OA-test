import { NextRequest, NextResponse } from 'next/server';
import { validateSignature, messagingApi } from '@line/bot-sdk';
import { getFaq } from '@/lib/sheet';
import { askGemini, DEFAULT_REPLY } from '@/lib/gemini';

export const maxDuration = 15;

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

interface LineEvent {
  type: string;
  replyToken?: string;
  message?: { type: string; text?: string };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  if (!validateSignature(rawBody, process.env.LINE_CHANNEL_SECRET!, signature)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let events: LineEvent[];
  try {
    events = (JSON.parse(rawBody) as { events: LineEvent[] }).events ?? [];
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;
    const userText = event.message.text ?? '';
    const replyToken = event.replyToken ?? '';

    let answer: string;
    try {
      const faq = await getFaq();
      answer = await askGemini(faq, userText);
    } catch (err) {
      console.error('[webhook] pipeline error:', err);
      answer = DEFAULT_REPLY;
    }

    try {
      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: answer }],
      });
    } catch (err) {
      console.error('[webhook] LINE reply error:', err);
    }
  }

  return new NextResponse('OK', { status: 200 });
}

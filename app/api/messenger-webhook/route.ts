import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getFaq } from '@/lib/sheet';
import { askGemini, DEFAULT_REPLY } from '@/lib/gemini';

export const maxDuration = 15;

interface MessagingEvent {
  sender: { id: string };
  message?: { text?: string };
}

interface MessengerBody {
  object: string;
  entry: Array<{ messaging: MessagingEvent[] }>;
}

async function sendMessage(psid: string, text: string): Promise<void> {
  const token = process.env.PAGE_ACCESS_TOKEN ?? '';
  const res = await fetch(
    `https://graph.facebook.com/v25.0/me/messages?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        messaging_type: 'RESPONSE',
        message: { text },
      }),
    }
  );
  if (!res.ok) {
    console.error('[messenger] Send API error:', await res.text());
  }
}

// GET — Meta webhook handshake
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// POST — receive messages
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256') ?? '';
    const appSecret = process.env.APP_SECRET ?? '';

    if (appSecret) {
      const expected =
        'sha256=' +
        crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (signature !== expected) {
        console.warn('[messenger] invalid signature');
        return new NextResponse('Unauthorized', { status: 401 });
      }
    } else {
      console.warn('[messenger] APP_SECRET not set — skipping signature check');
    }

    const body = JSON.parse(rawBody) as MessengerBody;
    if (body.object !== 'page') {
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    }

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        const psid = event.sender?.id;
        const userText = event.message?.text;
        if (!psid || !userText) continue;

        let answer: string;
        try {
          const faq = await getFaq();
          answer = await askGemini(faq, userText);
        } catch (err) {
          console.error('[messenger] pipeline error:', err);
          answer = DEFAULT_REPLY;
        }

        try {
          await sendMessage(psid, answer);
        } catch (err) {
          console.error('[messenger] send error:', err);
        }
      }
    }

    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (err) {
    console.error('[messenger] unhandled error:', err);
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  }
}

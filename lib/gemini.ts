import { GoogleGenAI } from '@google/genai';

export const DEFAULT_REPLY =
  'ขออภัยค่ะ เรื่องนี้ทางร้านขอเช็คให้ก่อนนะคะ เดี๋ยวแอดมินมาตอบเพิ่มเติมค่ะ 🙏';

const GEMINI_TIMEOUT_MS = 8_000;

export async function askGemini(faqCsv: string, userMessage: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const prompt = `<role>
คุณคือพี่ที่ร้านของร้าน Tasting Stick ร้านขนมที่ขาย Salami Stick โปรตีนเสริมสำหรับคนไทย
เรียกตัวเองว่า "ทางร้าน" เสมอ
</role>

<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น
- ห้ามแต่งราคา เวลาส่ง หรือที่ตั้งขึ้นเอง ถ้าข้อมูลไม่อยู่ใน <faq> ห้ามเดา
- ถ้าใน <faq> ไม่มีคำตอบสำหรับคำถามนี้ ให้ตอบด้วยข้อความนี้แบบเป๊ะๆ ห้ามดัดแปลง:
  "ขออภัยค่ะ เรื่องนี้ทางร้านขอเช็คให้ก่อนนะคะ เดี๋ยวแอดมินมาตอบเพิ่มเติมค่ะ 🙏"
- โทน: เป็นกันเองนิดๆ แต่สุภาพ
- ใส่ emoji ได้ไม่เกิน 2 อันต่อข้อความ
- ความยาว: สั้นกระชับ 1-3 ประโยค
</constraints>

<output_format>
ตอบเป็นภาษาไทย ไม่ใช้ markdown ไม่ใช้ bullet ตอบเป็นข้อความธรรมดาเหมือนแชตคุยกับลูกค้า
</output_format>

<faq>
${faqCsv}
</faq>

<question>
${userMessage}
</question>`;

  const result = await Promise.race([
    ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 1.0, maxOutputTokens: 1024 },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout (8s)')), GEMINI_TIMEOUT_MS)
    ),
  ]);

  const candidate = result.candidates?.[0];
  console.log('[gemini]', {
    finishReason: candidate?.finishReason,
    thoughtsTokenCount: result.usageMetadata?.thoughtsTokenCount,
    candidatesTokenCount: result.usageMetadata?.candidatesTokenCount,
  });

  if (candidate?.finishReason === 'MAX_TOKENS') return DEFAULT_REPLY;

  return (result.text ?? '').trim() || DEFAULT_REPLY;
}

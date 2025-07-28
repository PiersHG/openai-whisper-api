import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Create OpenAI client at runtime, using env variable
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.audio.transcriptions.create({
      file: body.file, // Ensure this is passed as a readable stream or correct file type
      model: 'whisper-1',
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong', details: error?.message },
      { status: 500 }
    );
  }
}

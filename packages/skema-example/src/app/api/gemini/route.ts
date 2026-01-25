import { NextResponse } from 'next/server';

// Demo mode - API is disabled for hosted version
// To enable, set up skema-core locally with GEMINI_API_KEY

export async function POST() {
    return NextResponse.json(
        { error: 'Demo mode - API is not available in the hosted version. Clone the repo and run locally to use the full functionality.' },
        { status: 503 }
    );
}

export async function DELETE() {
    return NextResponse.json(
        { error: 'Demo mode - Undo is not available in the hosted version.' },
        { status: 503 }
    );
}

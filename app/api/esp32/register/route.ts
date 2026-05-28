import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { macAddress, cellNumber, hubId } = await request.json();

    if (!macAddress || !cellNumber || !hubId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate MAC address format
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      return NextResponse.json(
        { error: 'Invalid MAC address format' },
        { status: 400 }
      );
    }

    // Return success response
    // The frontend will handle actual storage via localStorage
    return NextResponse.json(
      {
        success: true,
        message: 'Device registered successfully',
        macAddress,
        cellNumber,
        hubId,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow ESP32 to check if registration endpoint is available
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/esp32/register',
  });
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { macAddress, pressure, moisture, bioimpedance, temperature, humidity } =
      await request.json();

    if (!macAddress) {
      return NextResponse.json(
        { error: 'Missing MAC address' },
        { status: 400 }
      );
    }

    // Return acknowledgement
    // Frontend stores this data via localStorage and updates component state
    return NextResponse.json(
      {
        success: true,
        message: 'Heartbeat received',
        timestamp: new Date().toISOString(),
        macAddress,
        // Optionally return config to device
        ledConfig: { status: 'on' },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

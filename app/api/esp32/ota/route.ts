import { NextRequest, NextResponse } from 'next/server';
import { publishEsp32FirmwareUpdate } from '@/lib/server/mqtt';

export async function POST(request: NextRequest) {
  try {
    const { macAddress, firmwareUrl, version, checksum, reason } = await request.json();

    if (!macAddress || !firmwareUrl) {
      return NextResponse.json(
        { error: 'Missing macAddress or firmwareUrl' },
        { status: 400 }
      );
    }

    await publishEsp32FirmwareUpdate(
      macAddress,
      {
        firmwareUrl,
        ...(version ? { version } : {}),
        ...(checksum ? { checksum } : {}),
        ...(reason ? { reason } : {}),
      },
      { source: 'web-ota' }
    );

    return NextResponse.json({
      success: true,
      macAddress,
      firmwareUrl,
      version: version ?? null,
      checksum: checksum ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown MQTT publish error',
      },
      { status: 500 }
    );
  }
}

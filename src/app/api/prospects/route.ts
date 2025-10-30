import { NextRequest, NextResponse } from 'next/server';
import { ProspectService, SegmentService } from '@/lib/services';

export async function GET() {
  try {
    const prospects = await ProspectService.getAllProspects();
    return NextResponse.json({ prospects });
  } catch (error) {
    console.error('Failed to fetch prospects:', error);
    return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospects, segmentId } = body;
    
    if (!prospects || !Array.isArray(prospects)) {
      return NextResponse.json({ error: 'Invalid prospects data' }, { status: 400 });
    }
    if (!segmentId || typeof segmentId !== 'string') {
      return NextResponse.json({ error: 'segmentId is required' }, { status: 400 });
    }

    // Attach segment to each prospect on insert
    const createdProspects = await ProspectService.createManyProspects(
      prospects.map((p: any) => ({ ...p, segment: segmentId }))
    );

    // Update segment prospect count
    try { await SegmentService.updateSegmentProspectCount(segmentId); } catch {}

    return NextResponse.json({ prospects: createdProspects });
  } catch (error) {
    console.error('Failed to create prospects:', error);
    return NextResponse.json({ error: 'Failed to create prospects' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { SegmentService } from '@/lib/services';

export async function GET() {
  try {
    const segments = await SegmentService.getAllSegments();
    return NextResponse.json({ segments });
  } catch (error) {
    console.error('Failed to fetch segments:', error);
    return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'Segment name is required' }, { status: 400 });
    }

    const segment = await SegmentService.createSegment({
      name,
      description: description || '',
      prospectCount: 0,
    });
    
    return NextResponse.json({ segment });
  } catch (error) {
    console.error('Failed to create segment:', error);
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 });
  }
}

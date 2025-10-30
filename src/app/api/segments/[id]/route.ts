import { NextRequest, NextResponse } from 'next/server';
import { SegmentService, ProspectService } from '@/lib/services';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // First, delete all prospects in this segment
    const prospects = await ProspectService.getProspectsBySegment(id);
    await Promise.all(prospects.map(p => ProspectService.deleteProspect(p._id!)));
    
    // Then delete the segment
    await SegmentService.deleteSegment(id);
    
    return NextResponse.json({ success: true, deletedProspects: prospects.length });
  } catch (error) {
    console.error('Failed to delete segment:', error);
    return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 });
  }
}

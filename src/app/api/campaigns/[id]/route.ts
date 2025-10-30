import { NextRequest, NextResponse } from 'next/server';
import { CampaignService } from '@/lib/services';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const senderName = formData.get('senderName') as string;
    const senderEmail = formData.get('senderEmail') as string;
    const subject = formData.get('subject') as string;
    const pitch = formData.get('pitch') as string;
    const segmentId = formData.get('segmentId') as string;
    const segmentName = formData.get('segmentName') as string;
    const totalProspects = parseInt(formData.get('totalProspects') as string) || 0;
    
    if (!name || !senderName || !senderEmail || !subject || !pitch || !segmentId || !segmentName) {
      return NextResponse.json({ error: 'All required fields must be provided' }, { status: 400 });
    }

    const campaign = await CampaignService.updateCampaign(id, {
      name,
      senderName,
      senderEmail,
      subject,
      pitch,
      segmentId,
      segmentName,
      totalProspects,
    });

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Failed to update campaign:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}
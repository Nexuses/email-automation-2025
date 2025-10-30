import { NextRequest, NextResponse } from 'next/server';
import { CampaignService } from '@/lib/services';

export async function GET() {
  try {
    const campaigns = await CampaignService.getAllCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, senderName, senderEmail, subject, pitch, segmentId, segmentName, totalProspects } = body;
    
    if (!name || !senderName || !senderEmail || !subject || !pitch || !segmentId || !segmentName) {
      return NextResponse.json({ error: 'All required fields must be provided' }, { status: 400 });
    }

    const campaign = await CampaignService.createCampaign({
      name,
      senderName,
      senderEmail,
      subject,
      pitch,
      segmentId,
      segmentName,
      status: 'draft',
      totalProspects: totalProspects || 0,
      sentEmails: 0,
      failedEmails: 0,
    });
    
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Failed to create campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}

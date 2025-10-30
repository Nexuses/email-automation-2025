export interface Prospect {
  _id?: string;
  firstName: string;
  lastName?: string;
  clientEmail: string;
  companyName?: string;
  segment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  _id?: string;
  name: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  pitch: string;
  segmentId: string;
  segmentName: string;
  status: 'draft' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalProspects: number;
  sentEmails: number;
  failedEmails: number;
  openedEmails: number;
  clickedEmails: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Segment {
  _id?: string;
  name: string;
  description?: string;
  prospectCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTracking {
  _id?: string;
  campaignId: string;
  prospectEmail: string;
  emailSent: boolean;
  emailOpened: boolean;
  emailClicked: boolean;
  openedAt?: Date;
  clickedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

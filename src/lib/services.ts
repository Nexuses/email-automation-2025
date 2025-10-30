import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Prospect, Campaign, Segment, EmailTracking } from '@/types/database';

export class ProspectService {
  static async createProspect(prospect: Omit<Prospect, '_id' | 'createdAt' | 'updatedAt'>): Promise<Prospect> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Prospect>('prospects');
    
    const newProspect: Prospect = {
      ...prospect,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await collection.insertOne(newProspect);
    return { ...newProspect, _id: result.insertedId.toString() };
  }

  static async createManyProspects(prospects: Omit<Prospect, '_id' | 'createdAt' | 'updatedAt'>[]): Promise<Prospect[]> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Prospect>('prospects');
    
    const newProspects: Prospect[] = prospects.map(prospect => ({
      ...prospect,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    const result = await collection.insertMany(newProspects);
    return newProspects.map((prospect, index) => ({
      ...prospect,
      _id: result.insertedIds[index].toString(),
    }));
  }

  static async getProspectsBySegment(segmentId: string): Promise<Prospect[]> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Prospect>('prospects');
    return await collection.find({ segment: segmentId }).toArray();
  }

  static async getAllProspects(): Promise<Prospect[]> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Prospect>('prospects');
    return await collection.find({}).toArray();
  }

  static async updateProspectSegment(prospectId: string, segmentId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Prospect>('prospects');
    await collection.updateOne(
      { _id: new ObjectId(prospectId) },
      { $set: { segment: segmentId, updatedAt: new Date() } }
    );
  }

  static async deleteProspect(prospectId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Prospect>('prospects');
    await collection.deleteOne({ _id: new ObjectId(prospectId) });
  }
}

export class CampaignService {
  static async createCampaign(campaign: Omit<Campaign, '_id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Campaign>('campaigns');
    
    const newCampaign: Campaign = {
      ...campaign,
      sentEmails: 0,
      failedEmails: 0,
      openedEmails: 0,
      clickedEmails: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await collection.insertOne(newCampaign);
    return { ...newCampaign, _id: result.insertedId.toString() };
  }

  static async getAllCampaigns(): Promise<Campaign[]> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Campaign>('campaigns');
    return await collection.find({}).sort({ createdAt: -1 }).toArray();
  }

  static async getCampaignById(campaignId: string): Promise<Campaign | null> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Campaign>('campaigns');
    return await collection.findOne({ _id: new ObjectId(campaignId) });
  }

  static async updateCampaign(campaignId: string, updates: Partial<Omit<Campaign, '_id' | 'createdAt'>>): Promise<Campaign | null> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Campaign>('campaigns');
    
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(campaignId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result;
  }

  static async updateCampaignStatus(campaignId: string, status: Campaign['status'], updates?: Partial<Campaign>): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Campaign>('campaigns');
    
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'running' && !updates?.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (updates) {
      Object.assign(updateData, updates);
    }

    await collection.updateOne(
      { _id: new ObjectId(campaignId) },
      { $set: updateData }
    );
  }

  static async deleteCampaign(campaignId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Campaign>('campaigns');
    await collection.deleteOne({ _id: new ObjectId(campaignId) });
  }
}

export class SegmentService {
  static async createSegment(segment: Omit<Segment, '_id' | 'createdAt' | 'updatedAt'>): Promise<Segment> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Segment>('segments');
    
    const newSegment: Segment = {
      ...segment,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await collection.insertOne(newSegment);
    return { ...newSegment, _id: result.insertedId.toString() };
  }

  static async getAllSegments(): Promise<Segment[]> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Segment>('segments');
    return await collection.find({}).sort({ createdAt: -1 }).toArray();
  }

  static async getSegmentById(segmentId: string): Promise<Segment | null> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Segment>('segments');
    return await collection.findOne({ _id: new ObjectId(segmentId) });
  }

  static async updateSegmentProspectCount(segmentId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const prospectCollection = db.collection<Prospect>('prospects');
    const segmentCollection = db.collection<Segment>('segments');
    
    const count = await prospectCollection.countDocuments({ segment: segmentId });
    await segmentCollection.updateOne(
      { _id: new ObjectId(segmentId) },
      { $set: { prospectCount: count, updatedAt: new Date() } }
    );
  }

  static async deleteSegment(segmentId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<Segment>('segments');
    await collection.deleteOne({ _id: new ObjectId(segmentId) });
  }
}

export class EmailTrackingService {
  static async createTrackingRecord(campaignId: string, prospectEmail: string): Promise<EmailTracking> {
    const { db } = await connectToDatabase();
    const collection = db.collection<EmailTracking>('emailTracking');
    
    const trackingRecord: EmailTracking = {
      campaignId,
      prospectEmail,
      emailSent: true,
      emailOpened: false,
      emailClicked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await collection.insertOne(trackingRecord);
    return { ...trackingRecord, _id: result.insertedId.toString() };
  }

  static async markEmailOpened(campaignId: string, prospectEmail: string): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<EmailTracking>('emailTracking');
    
    await collection.updateOne(
      { campaignId, prospectEmail },
      { 
        $set: { 
          emailOpened: true, 
          openedAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
  }

  static async markEmailClicked(campaignId: string, prospectEmail: string): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<EmailTracking>('emailTracking');
    
    await collection.updateOne(
      { campaignId, prospectEmail },
      { 
        $set: { 
          emailClicked: true, 
          clickedAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
  }

  static async getCampaignMetrics(campaignId: string): Promise<{ openedEmails: number; clickedEmails: number }> {
    const { db } = await connectToDatabase();
    const collection = db.collection<EmailTracking>('emailTracking');
    
    const openedCount = await collection.countDocuments({ campaignId, emailOpened: true });
    const clickedCount = await collection.countDocuments({ campaignId, emailClicked: true });
    
    return { openedEmails: openedCount, clickedEmails: clickedCount };
  }

  static async updateCampaignMetrics(campaignId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const campaignCollection = db.collection<Campaign>('campaigns');
    const trackingCollection = db.collection<EmailTracking>('emailTracking');
    
    const metrics = await this.getCampaignMetrics(campaignId);
    
    await campaignCollection.updateOne(
      { _id: new ObjectId(campaignId) },
      { 
        $set: { 
          openedEmails: metrics.openedEmails,
          clickedEmails: metrics.clickedEmails,
          updatedAt: new Date()
        } 
      }
    );
  }
}

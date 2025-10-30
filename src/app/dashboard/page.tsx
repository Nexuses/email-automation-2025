"use client";

import { useEffect, useState } from 'react';
import { Campaign, Prospect, Segment } from '@/types/database';
import AuthGuard from '@/app/components/AuthGuard';
import { 
  Mail, 
  Users, 
  Target, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [campaignsRes, prospectsRes, segmentsRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/prospects'),
        fetch('/api/segments'),
      ]);
      
      const [campaignsData, prospectsData, segmentsData] = await Promise.all([
        campaignsRes.json(),
        prospectsRes.json(),
        segmentsRes.json(),
      ]);
      
      setCampaigns(campaignsData.campaigns || []);
      setProspects(prospectsData.prospects || []);
      setSegments(segmentsData.segments || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Campaign['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'running':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'cancelled':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const totalProspects = prospects.length;
  const totalSegments = segments.length;
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
  const totalEmailsSent = campaigns.reduce((sum, c) => sum + c.sentEmails, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your email automation campaigns and prospects
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Prospects</p>
              <p className="text-2xl font-bold">{totalProspects}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Segments</p>
              <p className="text-2xl font-bold">{totalSegments}</p>
            </div>
            <Target className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Campaigns</p>
              <p className="text-2xl font-bold">{totalCampaigns}</p>
            </div>
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Emails Sent</p>
              <p className="text-2xl font-bold">{totalEmailsSent}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Campaign Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold mt-2">{activeCampaigns}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Completed</span>
          </div>
          <p className="text-2xl font-bold mt-2">{completedCampaigns}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">Failed</span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {campaigns.filter(c => c.status === 'failed').length}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Draft</span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {campaigns.filter(c => c.status === 'draft').length}
          </p>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No campaigns yet. Create your first campaign to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.slice(0, 5).map((campaign) => (
                <div key={campaign._id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(campaign.status)}
                    <div>
                      <h3 className="font-medium">{campaign.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {campaign.segmentName} • {campaign.totalProspects} prospects
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {campaign.sentEmails} / {campaign.totalProspects}
                      </p>
                      <p className="text-xs text-muted-foreground">emails sent</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Segments Overview */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Segments</h2>
          {segments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No segments yet. Upload prospects and create segments to organize your audience.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {segments.map((segment) => (
                <div key={segment._id} className="p-4 rounded-lg border border-border">
                  <h3 className="font-medium">{segment.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{segment.description}</p>
                  <p className="text-sm font-medium mt-2">{segment.prospectCount} prospects</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

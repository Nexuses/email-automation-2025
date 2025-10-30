"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Campaign, Segment, Prospect } from '@/types/database';
import AuthGuard from '@/app/components/AuthGuard';
import RichTextEditor from '@/app/components/RichTextEditor';
import { 
  Mail, 
  Play, 
  Pause, 
  Trash2, 
  Edit,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Target
} from 'lucide-react';

export default function Campaigns() {
  return (
    <AuthGuard>
      <CampaignsContent />
    </AuthGuard>
  );
}

function CampaignsContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  
  // Campaign form state
  const [campaignName, setCampaignName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('sourav.c@sisindia-tech.com');
  const [subject, setSubject] = useState('');
  const [pitch, setPitch] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [campaignsRes, segmentsRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/segments'),
      ]);
      
      const [campaignsData, segmentsData] = await Promise.all([
        campaignsRes.json(),
        segmentsRes.json(),
      ]);
      
      setCampaigns(campaignsData.campaigns || []);
      setSegments(segmentsData.segments || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load campaigns and segments');
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!campaignName.trim() || !senderName.trim() || !senderEmail.trim() || !subject.trim() || !pitch.trim() || !selectedSegmentId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingCampaign) {
      await updateCampaign();
      return;
    }

    const selectedSegment = segments.find(s => s._id === selectedSegmentId);
    if (!selectedSegment) {
      toast.error('Selected segment not found');
      return;
    }

    setCreatingCampaign(true);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim(),
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim(),
          subject: subject.trim(),
          pitch: pitch.trim(),
          segmentId: selectedSegmentId,
          segmentName: selectedSegment.name,
          totalProspects: selectedSegment.prospectCount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      toast.success('Campaign created successfully');
      setCampaignName('');
      setSenderName('');
      setSenderEmail('sourav.c@sisindia-tech.com');
      setSubject('');
      setPitch('');
      setSelectedSegmentId('');
      setPdfFile(null);
      setShowCreateCampaign(false);
      setShowPreview(false);
      setIsHtmlMode(false);
      setEditingCampaign(null);
      loadData();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const startCampaign = async (campaignId: string) => {
    try {
      // Convert PDF file to base64 if available
      let pdfBase64 = null;
      if (pdfFile) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
      }

      const response = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          pdfFile: pdfBase64,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        const msg = result?.error || 'Failed to start campaign';
        throw new Error(msg);
      }
      toast.success('Campaign started successfully');
      loadData();
      
      // Start listening to progress stream
      const es = new EventSource(`/api/send/stream?jobId=${result.jobId}`);
      es.addEventListener("progress", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          // Update campaign progress in real-time
          loadData();
        } catch {}
      });
      es.addEventListener("complete", (e: MessageEvent) => {
        es.close();
        toast.success("Campaign completed successfully");
        loadData();
      });
    } catch (error) {
      console.error('Failed to start campaign:', error);
      toast.error('Failed to start campaign');
    }
  };

  const cancelCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel campaign');
      }

      toast.success('Campaign cancelled successfully');
      loadData();
    } catch (error) {
      console.error('Failed to cancel campaign:', error);
      toast.error('Failed to cancel campaign');
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete campaign');
      }

      toast.success('Campaign deleted successfully');
      loadData();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      toast.error('Failed to delete campaign');
    }
  };

  const previewEmail = () => {
    if (!pitch.trim()) {
      toast.error('Please enter some content to preview');
      return;
    }
    setShowPreview(true);
  };

  const editCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignName(campaign.name);
    setSenderName(campaign.senderName);
    setSenderEmail(campaign.senderEmail);
    setSubject(campaign.subject);
    setPitch(campaign.pitch);
    setSelectedSegmentId(campaign.segmentId);
    setShowCreateCampaign(true);
  };

  const updateCampaign = async () => {
    if (!editingCampaign) return;

    try {
      setCreatingCampaign(true);

      const formData = new FormData();
      formData.append('name', campaignName.trim());
      formData.append('senderName', senderName.trim());
      formData.append('senderEmail', senderEmail.trim());
      formData.append('subject', subject.trim());
      formData.append('pitch', pitch);
      formData.append('segmentId', selectedSegmentId);
      
      // Find the selected segment to get its name and prospect count
      const selectedSegment = segments.find(s => s._id === selectedSegmentId);
      if (selectedSegment) {
        formData.append('segmentName', selectedSegment.name);
        formData.append('totalProspects', selectedSegment.prospectCount.toString());
      }
      
      if (pdfFile) {
        formData.append('pdf', pdfFile);
      }

      const response = await fetch(`/api/campaigns/${editingCampaign._id}`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }

      toast.success('Campaign updated successfully');
      
      // Reset form
      setCampaignName('');
      setSenderName('');
      setSenderEmail('sourav.c@sisindia-tech.com');
      setSubject('');
      setPitch('');
      setSelectedSegmentId('');
      setPdfFile(null);
      setShowCreateCampaign(false);
      setShowPreview(false);
      setIsHtmlMode(false);
      setEditingCampaign(null);
      loadData();
    } catch (error) {
      console.error('Failed to update campaign:', error);
      toast.error('Failed to update campaign');
    } finally {
      setCreatingCampaign(false);
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
        <div className="text-muted-foreground">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage your email campaigns
          </p>
        </div>
        <button
          onClick={() => setShowCreateCampaign(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first campaign to start sending emails to your prospects
            </p>
            <button
              onClick={() => setShowCreateCampaign(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </button>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign._id} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(campaign.status)}
                    <h3 className="text-lg font-semibold">{campaign.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Segment</p>
                      <p className="font-medium">{campaign.segmentName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Prospects</p>
                      <p className="font-medium">{campaign.totalProspects}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Emails Sent</p>
                      <p className="font-medium">{campaign.sentEmails}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Failed</p>
                      <p className="font-medium">{campaign.failedEmails}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Subject</p>
                      <p className="font-medium">{campaign.subject}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sender</p>
                      <p className="font-medium">{campaign.senderName} ({campaign.senderEmail})</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Content</p>
                      <div className="text-sm">
                        {campaign.pitch.length > 200 ? (
                          <div>
                            <p>{campaign.pitch.substring(0, 200)}...</p>
                            <button 
                              onClick={() => {
                                const fullContent = campaign.pitch;
                                const newWindow = window.open('', '_blank');
                                if (newWindow) {
                                  newWindow.document.write(`
                                    <html>
                                      <head><title>Campaign Content</title></head>
                                      <body style="font-family: Arial, sans-serif; padding: 20px;">
                                        <h2>${campaign.name}</h2>
                                        <h3>Subject: ${campaign.subject}</h3>
                                        <div style="border: 1px solid #ccc; padding: 15px; margin: 10px 0;">
                                          ${fullContent}
                                        </div>
                                      </body>
                                    </html>
                                  `);
                                }
                              }}
                              className="text-primary hover:underline text-xs"
                            >
                              View Full Content
                            </button>
                          </div>
                        ) : (
                          <p>{campaign.pitch}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {campaign.status === 'draft' && (
                    <>
                      <button
                        onClick={() => editCampaign(campaign)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => startCampaign(campaign._id!)}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        <Play className="h-4 w-4" />
                        Start
                      </button>
                    </>
                  )}
                  
                  {campaign.status === 'running' && (
                    <button
                      onClick={() => cancelCampaign(campaign._id!)}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      <Pause className="h-4 w-4" />
                      Cancel
                    </button>
                  )}
                  
                  <button
                    onClick={() => deleteCampaign(campaign._id!)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {campaign.status === 'running' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>{campaign.sentEmails} / {campaign.totalProspects}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary transition-[width]"
                      style={{ 
                        width: `${Math.min(100, Math.round((campaign.sentEmails / Math.max(1, campaign.totalProspects)) * 100))}%` 
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Tracking metrics removed */}
            </div>
          ))
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Campaign Name *</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter campaign name"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Sender Name *</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter sender name"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Sender Email *</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="sender@example.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter email subject"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Select Segment *</label>
                <select
                  value={selectedSegmentId}
                  onChange={(e) => setSelectedSegmentId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose a segment</option>
                  {segments.map((segment) => (
                    <option key={segment._id} value={segment._id}>
                      {segment.name} ({segment.prospectCount} prospects)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Email Content *</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={previewEmail}
                      className="px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                    >
                      Preview
                    </button>
                    <label className="text-xs text-muted-foreground">Mode:</label>
                    <button
                      type="button"
                      onClick={() => setIsHtmlMode(false)}
                      className={`px-2 py-1 text-xs rounded ${
                        !isHtmlMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsHtmlMode(true)}
                      className={`px-2 py-1 text-xs rounded ${
                        isHtmlMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                </div>
                
                {isHtmlMode ? (
                  <textarea
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
                    placeholder="Enter your HTML content...\n\nUse {{firstName}}, {{lastName}}, {{companyName}} for personalization"
                    rows={8}
                  />
                ) : (
                  <RichTextEditor
                    value={pitch}
                    onChange={setPitch}
                    placeholder="Enter your email content... Use {{firstName}}, {{lastName}}, {{companyName}} for personalization"
                    className="w-full"
                  />
                )}
                
                <p className="text-xs text-muted-foreground mt-1">
                  {isHtmlMode 
                    ? "HTML mode: You can use HTML tags, CSS styles, and images for visual emails"
                    : "Text mode: Use the toolbar above to format your email content. Bullet points, bold text, and other formatting will be preserved in the sent emails."
                  }
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">PDF Attachment (Optional)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {pdfFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {pdfFile.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateCampaign(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                disabled={creatingCampaign}
              >
                Cancel
              </button>
              <button
                onClick={createCampaign}
                disabled={creatingCampaign}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {creatingCampaign ? (editingCampaign ? 'Updating...' : 'Creating...') : (editingCampaign ? 'Update Campaign' : 'Create Campaign')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Email Preview</h3>
              <button onClick={() => setShowPreview(false)} className="text-sm underline">Close</button>
            </div>
            <div className="border rounded-lg p-4 bg-white">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: pitch.includes('<') && pitch.includes('>') 
                    ? pitch // Already HTML from rich text editor
                    : pitch
                        .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                        .split('\n')
                        .map(line => {
                          const trimmed = line.trim();
                          if (trimmed === '') return '<br>';
                          const bulletMatch = trimmed.match(/^[\s]*[•\-\*\+]\s+(.+)$/);
                          if (bulletMatch) return `<li>${bulletMatch[1]}</li>`;
                          return `<p style="margin: 8px 0;">${trimmed}</p>`;
                        })
                        .join('')
                        .replace(/<li>/g, '<ul style="margin: 8px 0; padding-left: 20px;"><li>')
                        .replace(/<\/li>/g, '</li></ul>')
                        .replace(/<\/ul><ul/g, '')
                }}
                style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: '1.6', color: '#333' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

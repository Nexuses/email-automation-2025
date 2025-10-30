"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Prospect, Segment } from '@/types/database';
import AuthGuard from '@/app/components/AuthGuard';
import { 
  Upload, 
  Users, 
  Target, 
  Plus, 
  Download,
  Trash2
} from 'lucide-react';

type ExcelRow = Record<string, unknown>;

export default function Prospects() {
  return (
    <AuthGuard>
      <ProspectsContent />
    </AuthGuard>
  );
}

function ProspectsContent() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [showCreateSegment, setShowCreateSegment] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDescription, setNewSegmentDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [segmentNameForUpload, setSegmentNameForUpload] = useState('');
  const [viewSegment, setViewSegment] = useState<Segment | null>(null);
  const [segmentProspects, setSegmentProspects] = useState<Prospect[] | null>(null);
  const [loadingSegmentProspects, setLoadingSegmentProspects] = useState(false);
  const [deletingSegment, setDeletingSegment] = useState<string | null>(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [newProspectFirstName, setNewProspectFirstName] = useState('');
  const [newProspectLastName, setNewProspectLastName] = useState('');
  const [newProspectEmail, setNewProspectEmail] = useState('');
  const [newProspectCompany, setNewProspectCompany] = useState('');
  const [newProspectSegmentId, setNewProspectSegmentId] = useState('');
  const [addingProspect, setAddingProspect] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prospectsRes, segmentsRes] = await Promise.all([
        fetch('/api/prospects'),
        fetch('/api/segments'),
      ]);
      
      const [prospectsData, segmentsData] = await Promise.all([
        prospectsRes.json(),
        segmentsRes.json(),
      ]);
      
      setProspects(prospectsData.prospects || []);
      setSegments(segmentsData.segments || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load prospects and segments');
    } finally {
      setLoading(false);
    }
  };

  const openSegmentModal = async (segment: Segment) => {
    setViewSegment(segment);
    setLoadingSegmentProspects(true);
    try {
      // Filter client-side for now as there's no dedicated endpoint
      const res = await fetch('/api/prospects');
      const json = await res.json();
      const all: Prospect[] = json.prospects || [];
      setSegmentProspects(all.filter(p => p.segment === segment._id));
    } catch {
      setSegmentProspects([]);
    } finally {
      setLoadingSegmentProspects(false);
    }
  };

  const deleteSegment = async (segmentId: string, segmentName: string) => {
    if (!confirm(`Are you sure you want to delete the segment "${segmentName}"? This will also delete all ${segmentProspects?.length || 0} prospects in this segment.`)) {
      return;
    }

    setDeletingSegment(segmentId);
    try {
      const response = await fetch(`/api/segments/${segmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete segment');
      }

      toast.success('Segment and all its prospects deleted successfully');
      loadData();
      setViewSegment(null);
    } catch (error) {
      console.error('Failed to delete segment:', error);
      toast.error('Failed to delete segment');
    } finally {
      setDeletingSegment(null);
    }
  };

  const parseExcelOrCsvFile = (file: File): Promise<ExcelRow[]> => {
    const ext = file.name.toLowerCase().split('.').pop();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result as string;
          const workbook = ext === 'csv'
            ? XLSX.read(data, { type: 'string' })
            : XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      if (ext === 'csv') reader.readAsText(file);
      else reader.readAsBinaryString(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!segmentNameForUpload.trim()) {
      toast.error('Please enter a segment name first');
      return;
    }
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Please upload a valid file (.xlsx, .xls, or .csv)');
      return;
    }

    setUploading(true);
    try {
      const excelData = await parseExcelOrCsvFile(file);

      // Helpers to find values across various header variants
      const normalize = (s: string) => s.toLowerCase().replace(/\s+|_|-/g, '');
      const getValue = (row: Record<string, unknown>, keys: string[]) => {
        const map: Record<string, string> = {};
        Object.keys(row || {}).forEach((k) => { map[normalize(k)] = k; });
        for (const k of keys) {
          const nk = normalize(k);
          if (map[nk] !== undefined) {
            const v = row[map[nk]];
            if (v !== undefined && v !== null) return String(v).trim();
          }
        }
        return '';
      };

      const prospectsData = (excelData || [])
        .map((row) => {
          // First/Last name handling
          const firstName = getValue(row, ['firstname', 'first_name', 'givenname', 'fname']);
          let lastName = getValue(row, ['lastname', 'last_name', 'surname', 'familyname', 'lname']);
          if (!firstName && !lastName) {
            const fullName = getValue(row, ['Client', 'Name', 'FullName', 'Contact', 'ContactName']);
            if (fullName) {
              const parts = fullName.split(/\s+/).filter(Boolean);
              const f = parts.shift() || '';
              const l = parts.join(' ');
              return {
                firstName: f,
                lastName: l || undefined,
                clientEmail: getValue(row, ['ClientEmailId', 'Email', 'email', 'workemail', 'business_email']).trim(),
                companyName: getValue(row, ['company_name', 'company', 'organization', 'org']) || undefined,
              };
            }
          }

          const clientEmail = getValue(row, ['ClientEmailId', 'Email', 'email', 'workemail', 'business_email']).trim();
          const companyName = getValue(row, ['company_name', 'company', 'organization', 'org']);

          return {
            firstName: (firstName || '').trim(),
            lastName: (lastName || '').trim() || undefined,
            clientEmail,
            companyName: companyName || undefined,
          };
        })
        .filter((p) => p.firstName && p.clientEmail);

      if (prospectsData.length === 0) {
        // Show helpful hint with detected headers
        const firstRow = excelData?.[0] || {};
        const headers = Object.keys(firstRow).join(', ');
        toast.error(`No valid prospects found. Expected columns like firstname/lastname or name and email. Found headers: ${headers || 'none'}`);
        return;
      }

      // Find existing segment by name (case-insensitive), or create it
      const existing = segments.find(s => s.name.trim().toLowerCase() === segmentNameForUpload.trim().toLowerCase());
      let segmentId = existing?._id;
      if (!segmentId) {
        const segRes = await fetch('/api/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: segmentNameForUpload.trim(), description: '' }),
        });
        if (!segRes.ok) throw new Error('Failed to create segment');
        const segJson = await segRes.json();
        segmentId = segJson.segment?._id || segJson.segment?.id || segJson._id;
        if (!segmentId) throw new Error('Segment creation returned no id');
      }

      const response = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospects: prospectsData, segmentId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload prospects');
      }
      
      toast.success(`Successfully uploaded ${prospectsData.length} prospects to segment "${segmentNameForUpload.trim()}"`);
      loadData();
      setSegmentNameForUpload('');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload prospects');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const createSegment = async () => {
    if (!newSegmentName.trim()) {
      toast.error('Please enter a segment name');
      return;
    }

    try {
      const response = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSegmentName.trim(),
          description: newSegmentDescription.trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create segment');
      }
      
      toast.success('Segment created successfully');
      setNewSegmentName('');
      setNewSegmentDescription('');
      setShowCreateSegment(false);
      loadData();
    } catch (error) {
      console.error('Failed to create segment:', error);
      toast.error('Failed to create segment');
    }
  };

  const assignProspectsToSegment = async (prospectIds: string[], segmentId: string) => {
    try {
      await Promise.all(
        prospectIds.map(id => ProspectService.updateProspectSegment(id, segmentId))
      );
      
      await SegmentService.updateSegmentProspectCount(segmentId);
      toast.success('Prospects assigned to segment successfully');
      loadData();
    } catch (error) {
      console.error('Failed to assign prospects:', error);
      toast.error('Failed to assign prospects to segment');
    }
  };

  const deleteProspect = async (prospectId: string) => {
    try {
      await ProspectService.deleteProspect(prospectId);
      toast.success('Prospect deleted successfully');
      loadData();
    } catch (error) {
      console.error('Failed to delete prospect:', error);
      toast.error('Failed to delete prospect');
    }
  };

  const addProspect = async () => {
    if (!newProspectFirstName.trim() || !newProspectEmail.trim() || !newProspectSegmentId) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newProspectEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setAddingProspect(true);
    try {
      const response = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospects: [{
            firstName: newProspectFirstName.trim(),
            lastName: newProspectLastName.trim() || undefined,
            clientEmail: newProspectEmail.trim(),
            companyName: newProspectCompany.trim() || undefined,
          }],
          segmentId: newProspectSegmentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add prospect');
      }

      toast.success('Prospect added successfully');
      setNewProspectFirstName('');
      setNewProspectLastName('');
      setNewProspectEmail('');
      setNewProspectCompany('');
      setNewProspectSegmentId('');
      setShowAddProspect(false);
      loadData();
    } catch (error) {
      console.error('Failed to add prospect:', error);
      toast.error('Failed to add prospect');
    } finally {
      setAddingProspect(false);
    }
  };

  const exportProspects = () => {
      const csvContent = [
        ['First Name', 'Last Name', 'Email', 'Company', 'Segment'],
        ...prospects.map(p => [
          p.firstName,
          p.lastName || '',
          p.clientEmail,
          p.companyName || '',
          p.segment || ''
        ])
      ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prospects.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading prospects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prospects</h1>
          <p className="text-muted-foreground">
            Manage your prospect database and organize them into segments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportProspects}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddProspect(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            Add Prospect
          </button>
          <button
            onClick={() => setShowCreateSegment(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Segment
          </button>
        </div>
      </div>

      {/* Upload Section (requires segment name) */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Upload Prospects to a Segment</h2>
        <div className="grid gap-2 mb-4">
          <label className="text-sm font-medium">Segment name</label>
          <input
            type="text"
            value={segmentNameForUpload}
            onChange={(e) => setSegmentNameForUpload(e.target.value)}
            placeholder="Enter or create a segment name"
            className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-[11px] text-muted-foreground">We will use an existing segment if it matches, otherwise a new one will be created.</p>
        </div>
        <div
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDrop={handleDrop}
          className={`relative grid place-items-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
            dragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
          }`}
        >
          <div className="text-muted-foreground">
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Uploading prospects...
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2" />
                <div className="mb-2 text-foreground">Drag & drop file or click to browse</div>
                <div className="text-sm">Supports .csv, .xlsx and .xls files</div>
              </>
            )}
          </div>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={uploading}
          />
        </div>
      </div>

      {/* Segments */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Segments</h2>
        {segments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No segments created yet. Create your first segment to organize prospects.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {segments.map((segment) => (
              <div key={segment._id} className="p-4 rounded-lg border border-border hover:bg-muted/40">
                <div className="flex items-center justify-between mb-2">
                  <button 
                    onClick={() => openSegmentModal(segment)} 
                    className="flex-1 text-left"
                  >
                    <h3 className="font-medium">{segment.name}</h3>
                  </button>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSegment(segment._id!, segment.name);
                      }}
                      disabled={deletingSegment === segment._id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {deletingSegment === segment._id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => openSegmentModal(segment)} 
                  className="w-full text-left"
                >
                  <p className="text-sm text-muted-foreground mb-2">{segment.description}</p>
                  <p className="text-sm font-medium">{segment.prospectCount} prospects</p>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prospects Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">All Prospects ({prospects.length})</h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">All Segments</option>
                {segments.map((segment) => (
                  <option key={segment._id} value={segment._id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {prospects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No prospects uploaded yet. Upload an Excel file to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="p-3 font-medium">First Name</th>
                    <th className="p-3 font-medium">Last Name</th>
                    <th className="p-3 font-medium">Email</th>
                    <th className="p-3 font-medium">Company</th>
                    <th className="p-3 font-medium">Segment</th>
                    {/* No standalone actions in this flow */}
                  </tr>
                </thead>
                <tbody>
                  {prospects
                    .filter(p => !selectedSegment || p.segment === selectedSegment)
                    .map((prospect) => (
                      <tr key={prospect._id} className="border-b border-border">
                        <td className="p-3">{prospect.firstName}</td>
                        <td className="p-3">{prospect.lastName || '-'}</td>
                        <td className="p-3">{prospect.clientEmail}</td>
                        <td className="p-3">{prospect.companyName || '-'}</td>
                        <td className="p-3">
                          {prospect.segment ? (
                            segments.find(s => s._id === prospect.segment)?.name || 'Unknown'
                          ) : (
                            <span className="text-muted-foreground">No segment</span>
                          )}
                        </td>
                        {/* Actions removed to avoid direct manipulation in this flow */}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Segment Modal */}
      {showCreateSegment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Segment</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Segment Name</label>
                <input
                  type="text"
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter segment name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (Optional)</label>
                <textarea
                  value={newSegmentDescription}
                  onChange={(e) => setNewSegmentDescription(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter segment description"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateSegment(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={createSegment}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Create Segment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Segment Prospects Modal */}
      {viewSegment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Segment: {viewSegment.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNewProspectSegmentId(viewSegment._id!);
                    setShowAddProspect(true);
                    setViewSegment(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                >
                  <Plus className="h-3 w-3" />
                  Add Prospect
                </button>
                <button onClick={() => setViewSegment(null)} className="text-sm underline">Close</button>
              </div>
            </div>
            {loadingSegmentProspects ? (
              <div className="text-muted-foreground">Loading prospects...</div>
            ) : segmentProspects && segmentProspects.length > 0 ? (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr className="text-left">
                      <th className="p-2 font-medium">First Name</th>
                      <th className="p-2 font-medium">Last Name</th>
                      <th className="p-2 font-medium">Email</th>
                      <th className="p-2 font-medium">Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segmentProspects.map((p, i) => (
                      <tr key={p._id || i} className="border-b border-border">
                        <td className="p-2 whitespace-nowrap">{p.firstName}</td>
                        <td className="p-2 whitespace-nowrap">{p.lastName || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{p.clientEmail}</td>
                        <td className="p-2 whitespace-nowrap">{p.companyName || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-muted-foreground">No prospects in this segment yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Add Prospect Modal */}
      {showAddProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Prospect</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">First Name *</label>
                <input
                  type="text"
                  value={newProspectFirstName}
                  onChange={(e) => setNewProspectFirstName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <input
                  type="text"
                  value={newProspectLastName}
                  onChange={(e) => setNewProspectLastName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter last name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input
                  type="email"
                  value={newProspectEmail}
                  onChange={(e) => setNewProspectEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Company</label>
                <input
                  type="text"
                  value={newProspectCompany}
                  onChange={(e) => setNewProspectCompany(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Segment *</label>
                <select
                  value={newProspectSegmentId}
                  onChange={(e) => setNewProspectSegmentId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose a segment</option>
                  {segments.map((segment) => (
                    <option key={segment._id} value={segment._id}>
                      {segment.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddProspect(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                disabled={addingProspect}
              >
                Cancel
              </button>
              <button
                onClick={addProspect}
                disabled={addingProspect}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {addingProspect ? 'Adding...' : 'Add Prospect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

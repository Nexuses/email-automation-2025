"use client";

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({ value, onChange, placeholder, className = "" }: RichTextEditorProps) {
  const [showFormattingHelp, setShowFormattingHelp] = useState(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`border border-border rounded-lg ${className}`}>
      {/* Simple toolbar with help */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/20 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Text Editor</span>
          <button
            type="button"
            onClick={() => setShowFormattingHelp(!showFormattingHelp)}
            className="p-1 rounded hover:bg-muted"
            title="Formatting Help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          Use HTML tags for formatting
        </div>
      </div>

      {/* Formatting help */}
      {showFormattingHelp && (
        <div className="p-3 bg-blue-50 border-b border-border">
          <div className="text-sm">
            <p className="font-medium mb-2">Formatting Guide:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><strong>Bold:</strong> &lt;strong&gt;text&lt;/strong&gt;</div>
              <div><strong>Italic:</strong> &lt;em&gt;text&lt;/em&gt;</div>
              <div><strong>Bullet List:</strong> &lt;ul&gt;&lt;li&gt;item&lt;/li&gt;&lt;/ul&gt;</div>
              <div><strong>Numbered List:</strong> &lt;ol&gt;&lt;li&gt;item&lt;/li&gt;&lt;/ol&gt;</div>
              <div><strong>Link:</strong> &lt;a href="url"&gt;text&lt;/a&gt;</div>
              <div><strong>Line Break:</strong> &lt;br&gt;</div>
            </div>
          </div>
        </div>
      )}

      {/* Textarea Editor */}
      <textarea
        value={value}
        onChange={handleTextChange}
        placeholder={placeholder}
        className="w-full p-3 text-sm outline-none resize-none min-h-[150px] border-0 font-mono"
        style={{ 
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '14px',
          lineHeight: '1.6',
          direction: 'ltr',
          textAlign: 'left'
        }}
        rows={8}
      />

      {/* Help text */}
      <div className="p-2 bg-muted/10 text-xs text-muted-foreground">
        💡 <strong>Tip:</strong> You can paste formatted text from other applications. The formatting will be preserved in the sent emails.
      </div>
    </div>
  );
}
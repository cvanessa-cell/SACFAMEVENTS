"use client";

import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ExtractedEvent {
  title?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  address?: string;
  city?: string;
  ageRange?: string;
  priceText?: string;
  registrationUrl?: string;
  confidence?: number;
}

export interface ScreenshotUploaderProps {
  value: string;
  onChange: (url: string) => void;
  onExtracted?: (events: ExtractedEvent[], rawText: string) => void;
  disabled?: boolean;
}

export function ScreenshotUploader({
  value,
  onChange,
  onExtracted,
  disabled,
}: ScreenshotUploaderProps) {
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be under 10MB.");
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
        onChange(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  const handleExtract = useCallback(async () => {
    const source = value;
    if (!source) return;

    setExtracting(true);
    setError(null);
    try {
      const isBase64 = source.startsWith("data:");
      const body = isBase64
        ? { imageBase64: source.replace(/^data:image\/[^;]+;base64,/, "") }
        : { imageUrl: source };

      const res = await fetch("/api/events/screenshot-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Extraction failed");
      onExtracted?.(data.events ?? [], data.rawText ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, [value, onExtracted]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="screenshot-url">Screenshot URL</Label>
        <Input
          id="screenshot-url"
          placeholder="https://…"
          value={value.startsWith("data:") ? "(uploaded file)" : value}
          disabled={disabled || value.startsWith("data:")}
          onChange={(e) => {
            onChange(e.target.value);
            setPreview(null);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={disabled || extracting || !value}
          onClick={handleExtract}
        >
          {extracting ? "Extracting…" : "Extract events from image"}
        </Button>
      </div>

      {preview && (
        <div className="max-w-sm overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Screenshot preview" className="w-full" />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        Upload or paste a screenshot URL. The AI will extract event
        details. Avoid images with children&apos;s faces without consent.
      </p>
    </div>
  );
}

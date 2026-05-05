"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ScreenshotUploaderProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

/** Paste a public HTTPS URL pointing at a screenshot blob; uploads land in Milestone wiring. */
export function ScreenshotUploader({
  value,
  onChange,
  disabled,
}: ScreenshotUploaderProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="screenshot-url">Screenshot URL</Label>
      <Input
        id="screenshot-url"
        placeholder="https://…"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Prefer public hosting (S3/CDN/imgur, etc.). The team should avoid uploading
        images with children&apos;s faces without consent.
      </p>
    </div>
  );
}

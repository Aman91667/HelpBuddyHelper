import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  label: string;
  onImageSelect: (file: File) => void;
  preview?: string;
  disabled?: boolean;
  // Optional validation controls
  maxSizeMB?: number; // default 5
  acceptTypes?: string[]; // default ["image/jpeg", "image/png"]
}

export const ImageUpload = ({ label, onImageSelect, preview, disabled, maxSizeMB = 5, acceptTypes = ["image/jpeg", "image/png"] }: ImageUploadProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(preview || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (restrict to jpeg/png by default)
    if (!acceptTypes.includes(file.type)) {
      setError('Only JPG or PNG images are allowed');
      return;
    }

    // Validate file size (default max 5MB)
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Image size should be less than ${maxSizeMB}MB`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setError(null);
    onImageSelect(file);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 transition-colors',
          previewUrl ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-48 mx-auto rounded-lg object-cover"
            />
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center cursor-pointer"
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            <div className="p-3 rounded-full bg-muted mb-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Click to upload or drag and drop</p>
            <p className="text-xs text-muted-foreground">PNG, JPG up to {maxSizeMB}MB</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes.join(',')}
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

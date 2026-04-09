import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Key, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}

export const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
        if (selected) {
          onKeySelected();
        }
      }
    };
    checkKey();
  }, [onKeySelected]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Proceed to app immediately after triggering as per skill guidelines
      onKeySelected();
    }
  };

  if (hasKey === true) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md border-2 border-primary/20 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">API Key Required</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            To use high-quality video generation (Veo), you must select a paid API key from your Google Cloud project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p>
              Video generation is a premium feature. Make sure your project has billing enabled.
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1 text-primary hover:underline font-medium"
              >
                Learn more about billing
              </a>
            </p>
          </div>
          <Button onClick={handleSelectKey} className="w-full h-12 text-lg font-semibold shadow-lg hover:shadow-primary/20 transition-all">
            Select API Key
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

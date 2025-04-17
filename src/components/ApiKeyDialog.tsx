// src/components/ApiKeyDialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from 'lucide-react';

// Key used for localStorage
const LOCAL_STORAGE_KEY = 'userGoogleApiKey';

interface ApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// The main dialog component that accepts props to control its state
export function ApiKeyDialogContent({ isOpen, onOpenChange }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [storedKeyExists, setStoredKeyExists] = useState(false);

  // Load stored key existence status on mount
  useEffect(() => {
    const storedKey = localStorage.getItem(LOCAL_STORAGE_KEY);
    setStoredKeyExists(!!storedKey);
  }, [isOpen]);

  // Load key into input when dialog opens
  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem(LOCAL_STORAGE_KEY) || '';
      setApiKey(storedKey);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem(LOCAL_STORAGE_KEY, apiKey.trim());
      setStoredKeyExists(true);
      console.log('API Key saved to localStorage.');
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setStoredKeyExists(false);
      console.log('API Key removed from localStorage.');
    }
    onOpenChange(false);
  };

  const handleRemove = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setApiKey('');
    setStoredKeyExists(false);
    console.log('API Key removed from localStorage.');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>API Key Settings</DialogTitle>
          <DialogDescription>
            Provide your own Google AI (Gemini) API key.
            It will be stored securely in your browser's local storage and only used for requests made from your browser.
            It will NOT be sent to our server if you provide one here.
            If provided, it will be sent to our backend to process your requests instead of the default key.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="api-key" className="text-right">
              API Key
            </Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Google AI API Key"
              className="col-span-3"
            />
          </div>
          {storedKeyExists && (
            <p className="text-xs text-center text-green-600 dark:text-green-400">
              An API key is currently stored locally.
            </p>
          )}
          {!storedKeyExists && apiKey && (
            <p className="text-xs text-center text-muted-foreground">
              Enter key and click Save. Leave blank and Save to clear.
            </p>
          )}
        </div>
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          {storedKeyExists && (
            <Button type="button" variant="destructive" onClick={handleRemove}>
              Remove Stored Key
            </Button>
          )}
          <Button type="button" onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The standalone button component that can be used directly
export function ApiKeyDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="API Key Settings"
        onClick={() => setIsOpen(true)}
      >
        <Settings className="h-[1.2rem] w-[1.2rem]" />
      </Button>
      <ApiKeyDialogContent isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

// Renamed to SettingsButtonController for backward compatibility
export function SettingsButtonController() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="API Key Settings"
        onClick={() => setIsDialogOpen(true)}
      >
        <Settings className="h-[1.2rem] w-[1.2rem]" />
      </Button>
      <ApiKeyDialogContent isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
}

// For backward compatibility
export function SettingsButton() {
  return <SettingsButtonController />;
}
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Smartphone, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/app-context';

const STORAGE_KEY = 'fleetvu_mobile_bridge_choice';
const SESSION_KEY = 'fleetvu_mobile_bridge_session';

type BridgeChoice = 'mobile' | 'force-desktop' | null;

function getStoredChoice(): BridgeChoice {
  if (typeof window === 'undefined') return null;
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session === 'mobile' || session === 'force-desktop') return session;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'mobile' || stored === 'force-desktop') return stored;
  return null;
}

function setStoredChoice(choice: BridgeChoice) {
  if (typeof window === 'undefined') return;
  if (choice) {
    sessionStorage.setItem(SESSION_KEY, choice);
    localStorage.setItem(STORAGE_KEY, choice);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function useForceDesktopViewport(): boolean {
  const [forceDesktop, setForceDesktop] = useState(false);

  useEffect(() => {
    const choice = getStoredChoice();
    setForceDesktop(choice === 'force-desktop');

    if (choice === 'force-desktop') {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=1280, initial-scale=0.4, maximum-scale=2.0');
      } else {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=1280, initial-scale=0.4, maximum-scale=2.0';
        document.head.appendChild(meta);
      }
    }
  }, []);

  return forceDesktop;
}

export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const choice = getStoredChoice();
      if (choice === 'force-desktop') {
        setIsMobile(false);
        return;
      }
      setIsMobile(window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

export function useIsTabletViewport(): boolean {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const check = () => {
      const choice = getStoredChoice();
      if (choice === 'force-desktop') {
        setIsTablet(false);
        return;
      }
      setIsTablet(window.innerWidth < 1024);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isTablet;
}

export function DesktopOptimizationBridge() {
  const { user } = useApp();
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      // On login screen — show for any mobile viewport
      const check = () => {
        const choice = getStoredChoice();
        if (choice) {
          setShowBanner(false);
          return;
        }
        setShowBanner(window.innerWidth < 768);
      };
      check();
      return;
    }

    // For logged-in users — only show for executive and super_admin roles
    if (user.role !== 'executive' && user.role !== 'super_admin' && user.role !== 'global_admin') {
      setShowBanner(false);
      return;
    }

    const check = () => {
      const choice = getStoredChoice();
      if (choice) {
        setShowBanner(false);
        return;
      }
      setShowBanner(window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [user, mounted]);

  const handleContinueMobile = useCallback(() => {
    setStoredChoice('mobile');
    setShowBanner(false);
  }, []);

  const handleForceDesktop = useCallback(() => {
    setStoredChoice('force-desktop');
    setShowBanner(false);
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=1280, initial-scale=0.4, maximum-scale=2.0');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=1280, initial-scale=0.4, maximum-scale=2.0';
      document.head.appendChild(meta);
    }
    window.scrollTo(0, 0);
  }, []);

  if (!mounted || !showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100000] animate-fade-in">
      <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white shadow-2xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          {/* Icon + message */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium leading-snug">
              For optimal incident reconstruction, multi-sensor analytics, and complete reporting tools, we recommend accessing FleetVu Global Command from a desktop or tablet.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              size="sm"
              className="bg-white text-orange-600 hover:bg-white/90 font-semibold text-xs h-8 gap-1.5 flex-1 sm:flex-none"
              onClick={handleForceDesktop}
            >
              <Monitor className="w-3.5 h-3.5" />
              Force Desktop View
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/15 font-medium text-xs h-8 gap-1.5 flex-1 sm:flex-none"
              onClick={handleContinueMobile}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Continue in Mobile Mode
            </Button>
            <button
              className="p-1 rounded-md hover:bg-white/15 transition-colors shrink-0"
              onClick={handleContinueMobile}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

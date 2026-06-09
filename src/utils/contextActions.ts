import { Phone, Mail, Link, MapPin, Youtube, Github, Search, Coins } from 'lucide-react';
import React from 'react';

export interface ContextAction {
  id: string;
  label: string;
  icon: React.ElementType;
  action: (value: any) => void;
}

export interface ActionDetector {
  id: string;
  name: string;
  match: (value: any) => boolean;
  getActions: (value: any) => ContextAction[];
}

export const actionDetectors: ActionDetector[] = [
  {
    id: 'email',
    name: 'Email Detector',
    match: (value: any) => {
      if (typeof value !== 'string') return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    },
    getActions: (value: string) => [{
      id: 'open-email',
      label: 'Open Email',
      icon: Mail,
      action: (val: string) => window.open(`mailto:${val.trim()}`, '_self')
    }]
  },
  {
    id: 'phone',
    name: 'Phone Number Detector',
    match: (value: any) => {
      if (typeof value !== 'string' && typeof value !== 'number') return false;
      const strVal = String(value).trim();
      
      if (!/\d/.test(strVal)) return false;
      if (!/^[\d\+\s\(\)\.-]+$/.test(strVal)) return false;
      
      const digitsOnly = strVal.replace(/[^\d]/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;

      // To avoid false positives on large pure numbers (like 1234567), require some formatting 
      // or a length of at least 10 for pure digit sequences unless they start with + or 0
      const hasFormatting = /[\+\(\)\-\s]/.test(strVal);
      if (!hasFormatting && strVal[0] !== '+' && strVal[0] !== '0' && digitsOnly.length < 10) {
        return false;
      }
      return true;
    },
    getActions: (value: any) => [{
      id: 'call-phone',
      label: 'Call',
      icon: Phone,
      action: (val: any) => window.open(`tel:${String(val).replace(/[^\d+]/g, '')}`, '_self')
    }]
  },
  {
    id: 'github',
    name: 'GitHub Link Detector',
    match: (value: any) => {
      if (typeof value !== 'string') return false;
      try {
        const url = new URL(value);
        return url.hostname === 'github.com' || url.hostname === 'www.github.com';
      } catch {
        return false;
      }
    },
    getActions: (value: string) => [{
      id: 'open-github',
      label: 'Open Repository',
      icon: Github,
      action: (val: string) => window.open(val, '_blank')
    }]
  },
  {
    id: 'youtube',
    name: 'YouTube Link Detector',
    match: (value: any) => {
      if (typeof value !== 'string') return false;
      try {
        const url = new URL(value);
        return url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com' || url.hostname === 'youtu.be';
      } catch {
        return false;
      }
    },
    getActions: (value: string) => [{
      id: 'watch-youtube',
      label: 'Watch Video',
      icon: Youtube,
      action: (val: string) => window.open(val, '_blank')
    }]
  },
  {
    id: 'url',
    name: 'URL Detector',
    match: (value: any) => {
      if (typeof value !== 'string') return false;
      try {
        new URL(value);
        // Exclude GitHub/YouTube to prevent duplicates since they have dedicated actions
        if (actionDetectors.find(d => d.id === 'github')?.match(value)) return false;
        if (actionDetectors.find(d => d.id === 'youtube')?.match(value)) return false;
        return value.startsWith('http://') || value.startsWith('https://');
      } catch (e) {
        return false;
      }
    },
    getActions: (value: string) => [{
      id: 'open-link',
      label: 'Open Link',
      icon: Link,
      action: (val: string) => window.open(val, '_blank')
    }]
  },
  {
    id: 'coordinates',
    name: 'Coordinates Detector',
    match: (value: any) => {
      if (typeof value !== 'string') return false;
      // Matches "lat, lng" e.g., "37.7749, -122.4194"
      return /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(value.trim());
    },
    getActions: (value: string) => [{
      id: 'open-maps',
      label: 'Open in Maps',
      icon: MapPin,
      action: (val: string) => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val.trim())}`, '_blank')
    }]
  },
  {
    id: 'ip',
    name: 'IP Address Detector',
    match: (value: any) => {
      if (typeof value !== 'string') return false;
      return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value.trim());
    },
    getActions: (value: string) => [{
      id: 'lookup-ip',
      label: 'Lookup IP',
      icon: Search,
      action: (val: string) => window.open(`https://whatismyipaddress.com/ip/${val.trim()}`, '_blank')
    }]
  },
  {
    id: 'crypto',
    name: 'Crypto Address Detector',
    match: (value: any) => {
      if (typeof value !== 'string') return false;
      // Basic match for Bitcoin/Ethereum addresses (Very naive heuristic)
      const isEth = /^0x[a-fA-F0-9]{40}$/.test(value.trim());
      const isBtc = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(value.trim());
      return isEth || isBtc;
    },
    getActions: (value: string) => [{
      id: 'open-explorer',
      label: 'Open Explorer',
      icon: Coins,
      action: (val: string) => {
        if (/^0x/.test(val.trim())) {
          window.open(`https://etherscan.io/address/${val.trim()}`, '_blank');
        } else {
          window.open(`https://www.blockchain.com/explorer/addresses/btc/${val.trim()}`, '_blank');
        }
      }
    }]
  }
];

export function getDynamicActions(value: any): ContextAction[] {
  if (value === null || value === undefined) return [];
  const actions: ContextAction[] = [];
  for (const detector of actionDetectors) {
    if (detector.match(value)) {
      actions.push(...detector.getActions(value));
    }
  }
  return actions;
}

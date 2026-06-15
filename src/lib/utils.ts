import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function getTrustLevel(score: number): "safe" | "warning" | "danger" {
  if (score >= 70) return "safe";
  if (score >= 30) return "warning";
  return "danger";
}

export function getTrustColor(score: number): string {
  if (score >= 70) return "var(--success)";
  if (score >= 30) return "var(--warning)";
  return "var(--danger)";
}

export function getTrustLabel(score: number): string {
  if (score >= 85) return "Verified Safe";
  if (score >= 70) return "Likely Safe";
  if (score >= 50) return "Needs Caution";
  if (score >= 30) return "Suspicious";
  return "High Risk";
}

export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

import type { SVGProps } from "react";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconHome(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 10.2 12 3l9 7.2" />
      <path d="M5.5 9.4V20h13V9.4" />
      <path d="M9.8 20v-5.4h4.4V20" />
    </svg>
  );
}
export function IconCompass(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.4 8.6-2 4.8-4.8 2 2-4.8 4.8-2Z" />
    </svg>
  );
}
export function IconBooks(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M4 4.5h5v15H4z" />
      <path d="M10.5 4.5h4v15h-4z" />
      <path d="m16.2 5.4 3.6.9-3.2 13.3-3.6-.9" />
    </svg>
  );
}
export function IconUsers(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="9.5" cy="8" r="3.3" />
      <path d="M3.5 20c0-3.2 2.7-5.3 6-5.3s6 2.1 6 5.3" />
      <path d="M16.5 5.2a3 3 0 0 1 0 5.8" />
      <path d="M18 14.9c1.7.7 2.8 2.1 2.8 4.1" />
    </svg>
  );
}
export function IconHandshake(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 9.5 7 6l3.2 2.4 2-1.4 2.8 1.6L21 9.5" />
      <path d="M21 9.5v5.2l-4.3 3.6-3-2.4-2.3 1.7L8 15.8 3 14.7V9.5" />
      <path d="m11.4 13.4 2.3 1.9" />
    </svg>
  );
}
export function IconSearch(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}
export function IconPlus(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function IconCheck(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}
export function IconMoon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
    </svg>
  );
}
export function IconSun(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M5.6 5.6 4 4M20 20l-1.6-1.6M18.4 5.6 20 4M4 20l1.6-1.6" />
    </svg>
  );
}
export function IconSparkle(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2l-1.7-5.8L4.5 10.7 10.3 9 12 3.2Z" />
      <path d="M18.8 3v3M20.3 4.5h-3" />
    </svg>
  );
}
export function IconShare(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="17.5" cy="6" r="2.6" />
      <circle cx="6.5" cy="12" r="2.6" />
      <circle cx="17.5" cy="18" r="2.6" />
      <path d="m8.9 10.7 6.3-3.4M8.9 13.3l6.3 3.4" />
    </svg>
  );
}

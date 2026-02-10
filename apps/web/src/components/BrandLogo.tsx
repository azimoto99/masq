interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export function BrandLogo({ className = 'h-10 w-auto select-none', alt = 'Masq' }: BrandLogoProps) {
  return <img src="/logo.png" alt={alt} className={className} loading="eager" decoding="async" />;
}

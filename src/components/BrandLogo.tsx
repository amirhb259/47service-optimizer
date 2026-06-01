import logoSrc from "../styles/Logo.png";

type BrandLogoProps = {
  className?: string;
  label?: string;
};

export default function BrandLogo({ className = "", label = "47Service" }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src={logoSrc}
      alt={label}
      decoding="async"
      draggable="false"
    />
  );
}

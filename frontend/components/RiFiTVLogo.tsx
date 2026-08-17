import Image from "next/image";

type Props = {
  mark?: boolean;
  className?: string;
  priority?: boolean;
};

export function RiFiTVLogo({ mark = false, className = "", priority = false }: Props) {
  const light = mark ? "/brand/rifitv-icon-light.png" : "/brand/rifitv-logo-light.png";
  const dark = mark ? "/brand/rifitv-icon-dark.png" : "/brand/rifitv-logo-dark.png";
  const width = mark ? 44 : 128;
  const height = mark ? 44 : 58;

  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`}>
      <Image className={mark ? "theme-icon-light h-10 w-10 object-contain" : "theme-logo-light h-10 w-auto object-contain"} src={light} alt="RiFiTV" width={width} height={height} priority={priority} loading={priority ? "eager" : "lazy"} />
      <Image className={mark ? "theme-icon-dark h-10 w-10 object-contain" : "theme-logo-dark h-10 w-auto object-contain"} src={dark} alt="RiFiTV" width={width} height={height} priority={priority} loading={priority ? "eager" : "lazy"} />
    </span>
  );
}

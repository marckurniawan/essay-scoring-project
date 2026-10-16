
type LogoProps = {
  size?: number;
};

export default function Logo({ size = 40 }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicon.ico"
      alt="EssAI"
      width={size}
      height={size}
      className="shrink-0 rounded-xl"
      style={{ width: size, height: size }}
    />
  );
}

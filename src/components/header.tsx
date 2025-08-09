"use client";

import dynamic from "next/dynamic";
import ThemeSwitcher from "./themeSwitcher";
import Image from "next/image";
import AmocaLogo from "@/assets/logos/amoca-logo.jpeg";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const Header = () => {
  return (
    <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
      <div className="flex items-center gap-3">
        <Image src={AmocaLogo} alt="AMOCA Logo" width={36} height={36} className="rounded-full" />
        <span className="text-lg font-semibold">AMOCA DEX</span>
      </div>

      <div className="flex pt-4 lg:pt-0 w-full lg:w-auto items-end justify-center gap-4 lg:static lg:size-auto lg:bg-none">
        <WalletMultiButtonDynamic />
        <ThemeSwitcher />
      </div>
    </div>
  );
};

export default Header;

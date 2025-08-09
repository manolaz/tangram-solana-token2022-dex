"use client";

import { useCallback, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Keypair,
  SystemProgram,
  Transaction,
  Connection,
  clusterApiUrl,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMintInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import Link from "next/link";

type CreateState = {
  name: string;
  symbol: string;
  decimals: number;
  uri: string;
  initialSupply: string; // human-readable, e.g. "1000"
};

const defaultState: CreateState = {
  name: "Only Possible On Solana",
  symbol: "OPOS",
  decimals: 2,
  uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/Climate/metadata.json",
  initialSupply: "0",
};

export default function CreateToken2022Page() {
  const wallet = useWallet();
  const [form, setForm] = useState<CreateState>(defaultState);
  const [isSubmitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    mint?: string;
    ata?: string;
    signature?: string;
    error?: string;
  } | null>(null);

  const connection = useMemo(() => new Connection(clusterApiUrl("devnet"), "confirmed"), []);

  const onChange = (key: keyof CreateState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSubmit = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setResult({ error: "Connect a wallet first." });
      return;
    }

    try {
      setSubmitting(true);
      setResult(null);

      // Create a new mint account sized for Token-2022 (no extra extensions here).
      const mintKeypair = Keypair.generate();

      // If you want to add extensions later, include them in this array.
      const requiredSpace = getMintLen([/* ExtensionType.MetadataPointer, etc. */] as ExtensionType[]);
      const lamports = await connection.getMinimumBalanceForRentExemption(requiredSpace);

      const tx = new Transaction();
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: requiredSpace,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          Number(form.decimals),
          wallet.publicKey,
          null,
          TOKEN_2022_PROGRAM_ID
        )
      );

      // Derive the creator's ATA for the new mint
      const ata = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      // Optionally create the ATA and mint an initial supply
      const initialSupply = Number(form.initialSupply || 0);
      if (initialSupply > 0) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            ata,
            wallet.publicKey, // owner
            mintKeypair.publicKey,
            TOKEN_2022_PROGRAM_ID
          ),
          createMintToInstruction(
            mintKeypair.publicKey,
            ata,
            wallet.publicKey,
            BigInt(Math.round(initialSupply * 10 ** Number(form.decimals))),
            [],
            TOKEN_2022_PROGRAM_ID
          )
        );
      }

      tx.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      // Sign mint account creation
      tx.partialSign(mintKeypair);
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

      setResult({
        mint: mintKeypair.publicKey.toBase58(),
        ata: ata.toBase58(),
        signature: sig,
      });
    } catch (e: any) {
      setResult({ error: e?.message ?? String(e) });
    } finally {
      setSubmitting(false);
    }
  }, [wallet, connection, form]);

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Create Token-2022 Mint</h1>
          <Link className="text-primary underline" href="/">Home</Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2">
            <span className="text-sm opacity-70">Name</span>
            <input className="w-full rounded border p-2" value={form.name} onChange={onChange("name")} />
          </label>
          <label>
            <span className="text-sm opacity-70">Symbol</span>
            <input className="w-full rounded border p-2" value={form.symbol} onChange={onChange("symbol")} />
          </label>
          <label>
            <span className="text-sm opacity-70">Decimals</span>
            <input type="number" className="w-full rounded border p-2" value={form.decimals}
                   onChange={(e) => setForm((p) => ({ ...p, decimals: Number(e.target.value) }))} />
          </label>
          <label className="col-span-2">
            <span className="text-sm opacity-70">Metadata URI</span>
            <input className="w-full rounded border p-2" value={form.uri} onChange={onChange("uri")} />
          </label>
          <label className="col-span-2">
            <span className="text-sm opacity-70">Initial Supply (human units)</span>
            <input type="number" className="w-full rounded border p-2" value={form.initialSupply} onChange={onChange("initialSupply")} />
          </label>
        </div>

        <button
          disabled={!wallet.connected || isSubmitting}
          onClick={onSubmit}
          className="rounded bg-primary-green px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : wallet.connected ? "Create Token" : "Connect Wallet"}
        </button>

        {result?.error && (
          <p className="text-red-600">{result.error}</p>
        )}
        {result?.signature && (
          <div className="space-y-1">
            <p className="text-green-700">Success!</p>
            <p className="break-all">Mint: {result.mint}</p>
            {result.ata && <p className="break-all">Your ATA: {result.ata}</p>}
            <a className="text-primary underline"
               href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
               target="_blank" rel="noreferrer">View on Explorer</a>
          </div>
        )}

        <div className="opacity-70 text-sm">
          Tip: This page creates a Token-2022 mint and optionally mints an initial supply to your ATA. Metadata
          fields are collected for future use; adding on-chain metadata requires the Token-2022 Metadata extension
          which can be integrated later.
        </div>
      </div>
    </main>
  );
}


